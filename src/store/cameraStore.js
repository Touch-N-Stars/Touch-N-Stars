import { defineStore } from 'pinia';
import { apiStore } from '@/store/store';
import { useFramingStore } from '@/store/framingStore';
import { useImagetStore } from './imageStore';
import { ref, shallowRef, computed, watch, nextTick } from 'vue';
import { timeSync } from '@/utils/timeSync';
import { useSettingsStore } from './settingsStore';
import { useMountStore } from './mountStore';
import { useSequenceStore } from './sequenceStore';
import { useToastStore } from './toastStore';
import apiService from '@/services/apiService';
import i18n from '@/i18n';
import { positionAngleFromNinaPlateSolve } from '@/integrations/celestiaAtlas/positionAngle';
import { isBackendRefusal, reportBackendRefusal, toastBackendError } from '@/utils/backendErrors';

// Safety net for the wait between "exposure started" and "image download started" in
// capturePhoto(). That download is normally triggered by the IMAGE-PREPARED event; when the
// event is lost or the frame is skipped as unchanged, the capture button would spin forever.
// After the exposure, NINA is asked whether the capture is done; two consecutive "done"
// answers without a download (the second one leaves the event time to arrive) load the
// image directly. The hard limit ends the wait even when NINA never reports the capture as
// done; it counts from the end of the exposure and leaves room for slow hosts (a Pi needs
// about 45 s to prepare and analyse a 26 MP frame).
const CAPTURE_DONE_POLL_MS = 1000;
const CAPTURE_DONE_CONFIRMATIONS = 2;
const CAPTURE_HARD_LIMIT_MS = 90 * 1000;
const CAPTURE_IN_PROGRESS = 'Capture already in progress';

// How long after a camera connect the auto start waits for a payload that allows its actions.
const AUTO_START_WINDOW_MS = 30 * 1000;
const AUTO_START_KEY_PREFIX = 'camera_auto_start_';

// A failed capture answers getResult with 500 "Capture failed: <reason>". Older ninaAPI versions
// returned the previous image or "Unknown error" instead, so this never matches there.
function isCaptureFailed(result) {
  return result?.StatusCode === 500 && String(result.Error || '').startsWith('Capture failed');
}

// An aborted exposure (from this app, NINA or another client) also reports
// "Capture failed: cancelled"; it ends the wait but is no error for the user.
function isCaptureCancelled(result) {
  return /cancel/i.test(String(result?.Error || ''));
}

export const useCameraStore = defineStore('cameraStore', () => {
  const framingStore = useFramingStore();
  const store = apiStore();
  const loading = ref(false);
  const isLoadingImage = ref(false);
  const loadingTimeout = ref(null);
  const isLooping = ref(false);
  const isAbort = ref(false);
  const showInfo = ref(false);
  const plateSolveError = ref(false);
  const plateSolveResult = ref('');
  const exposureCountdown = ref(0);
  const exposureProgress = ref(0);
  const countdownRunning = ref(false);
  const binningMode = ref('1x1');
  const readoutMode = ref(0);
  const containerSize = ref(100);
  const slewModal = ref(false);
  let countdownSessionId = 0; // Unique ID for each countdown session
  const cameraSettings = ref();
  // Device settings of PINS' guide camera slot, same shape as cameraSettings.
  const guideCameraSettings = ref();

  // Helper function to wait briefly
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  //Read Camera settings (only PINS)
  async function readSettings() {
    if (!store.isPINS) return;
    if (!store.cameraInfo.Connected) return;
    try {
      const response = await apiService.cameraAction('get-settings');
      cameraSettings.value = response.Response;
      console.log('[Camerastore] Camera settings: ', response.Response);
    } catch (error) {
      console.error(' [cameraStore]Error fetching camera settings:', error.message);
    }
  }

  // Read the device settings of the guide camera slot (PINS only)
  async function readGuideCameraSettings() {
    if (!store.guideCameraInfo.Connected) return;
    try {
      const response = await apiService.guideCameraAction('get-settings');
      if (response?.Success) guideCameraSettings.value = response.Response;
    } catch (error) {
      console.error('[cameraStore] Error fetching guide camera settings:', error.message);
    }
  }

  // --- Cooler state (single source of truth) -------------------------------
  //
  // Backend facts this section is built on (NINA CameraVM / ninaAPI):
  // - CoolCamera/WarmCamera set TempChangeRunning and the first setpoint
  //   synchronously, but CameraInfo (CoolerOn, Temperature, setpoint) is only
  //   refreshed every DevicePollingInterval (2s). Together with the 2s poll
  //   here, the app sees a new state 4-6s after the button press.
  // - TempChangeRunning exists on PINS only; the official ninaAPI has no such
  //   field, so a heuristic has to do there.
  // - The ramp steps the setpoint every 15s, rounded to whole degrees; on a
  //   slow ramp the setpoint can sit still for minutes.
  // - A warm-up ramps towards 20°C while TargetTemp keeps the cool-down
  //   target, and NINA switches the cooler off once the warm-up is done.
  // - A cancel writes TemperatureSetPoint = Temperature and leaves the cooler on.
  // - Ramps started from NINA's own UI or a sequence use a different
  //   CancellationTokenSource, so a cancel from here cannot stop them.

  // Optimistic intent right after a button press. It is only cleared once
  // the poll data confirms it (see the cameraInfo watch below): a short fixed
  // timer used to expire before the confirming poll arrived, and the UI fell
  // back to the stale state for a cycle. The long timeout is a safety net for
  // a ramp that never started (driver error).
  const coolingPending = ref(null); // 'cooling' | 'warming' | 'cancel' | null
  let coolingPendingTimer = null;
  const COOLING_PENDING_MS = 15000;

  // Heuristic-only latches for actions commanded from TNS (no TempChangeRunning):
  // - commandedWarmUp: the distance heuristic is blind to a warm-up that starts
  //   at the cool target, so remember that one runs until the cooler goes off.
  // - holdSetpoint: after a cancel the setpoint sits next to the cool target,
  //   which the distance heuristic would read as a running ramp. Remember the
  //   held setpoint instead; any new ramp moves it within 15s.
  const commandedWarmUp = ref(null); // { deadline } | null
  const holdSetpoint = ref(null); // number | null
  let holdCaptureAt = 0; // earliest time a payload surely shows the post-cancel setpoint
  let holdCandidate = null; // setpoint of the previous payload after that time

  // Setpoint trend bookkeeping for the direction, see the cameraInfo watch.
  let trendSetpoint = null; // setpoint of the previous payload
  let trendSeenRunning = 0; // consecutive running payloads that showed it

  function clearHeuristicLatches() {
    commandedWarmUp.value = null;
    holdSetpoint.value = null;
    holdCaptureAt = 0;
    holdCandidate = null;
  }

  function setCoolingPending(kind) {
    coolingPending.value = kind;
    clearTimeout(coolingPendingTimer);
    if (kind) {
      coolingPendingTimer = setTimeout(() => {
        // Never confirmed: the ramp evidently did not start.
        coolingPending.value = null;
        clearHeuristicLatches();
      }, COOLING_PENDING_MS);
    }
  }

  function devicePollMs() {
    return (store.profileInfo?.ApplicationSettings?.DevicePollingInterval ?? 2) * 1000;
  }

  // Latched direction of the running ramp. TargetTemp cannot be used here:
  // it always holds the cool-down target (e.g. -10°C) even while a warm-up
  // ramp runs towards ambient. The moving TemperatureSetPoint is the
  // reliable signal instead - NINA steps it towards the ramp destination.
  const rampDirection = ref(null); // 'cooling' | 'warming' | null

  // Instant guess from the current setpoint position: while a ramp runs the
  // setpoint leads the camera temperature in the ramp direction.
  function inferRampDirection() {
    const info = store.cameraInfo;
    if (info.TemperatureSetPoint == null || info.Temperature == null) return null;
    if (info.TemperatureSetPoint < info.Temperature) return 'cooling';
    if (info.TemperatureSetPoint > info.Temperature) return 'warming';
    return null;
  }

  // The cool-down target the camera is actually driven to.
  // CameraInfo.TargetTemp cannot be used: NINA initializes CameraVM.TargetTemp
  // from the profile once at connect and only updates it when the value is
  // edited in NINA's own UI. Changing the target from TNS writes the profile
  // and passes the temperature to /equipment/camera/cool directly, so
  // TargetTemp keeps reporting the old value (e.g. -10 while the camera cools
  // to 25). Both paths do update the profile setting, which makes it the
  // reliable source; TargetTemp/setpoint stay as fallbacks for the case where
  // the profile has not been fetched yet.
  const targetTemp = computed(() => {
    const profileTemp = store.profileInfo?.CameraSettings?.Temperature;
    if (profileTemp != null && !isNaN(profileTemp)) return profileTemp;
    const info = store.cameraInfo;
    return info.TargetTemp ?? info.TemperatureSetPoint ?? null;
  });

  // Is a temperature ramp running?
  // PINS reports the real NINA state via TempChangeRunning; the official
  // ninaAPI lacks the field, so the heuristic below has to do there. PINS
  // sends unavailable values as the string "NaN"; every comparison with it is
  // false, which is the intended outcome, so no extra guards are needed.
  const isRampRunning = computed(() => {
    const info = store.cameraInfo;
    if (!info.Connected) return false;
    // Real state. CoolerOn is deliberately not required here: CameraInfo lags
    // one device poll behind the flag, and INDI derives CoolerOn from the
    // cooler power, which is 0 for the whole of a warm-up.
    if (typeof info.TempChangeRunning === 'boolean') return info.TempChangeRunning;

    // Heuristic fallback.
    if (!info.CoolerOn) return false;
    if (commandedWarmUp.value) return true;
    if (holdSetpoint.value != null && info.TemperatureSetPoint === holdSetpoint.value) return false;
    // AtTargetTemp is not used: ninaAPI defines it as exact equality of sensor
    // and setpoint, which also happens mid-ramp whenever the camera catches
    // up with the current integer step.
    const target = targetTemp.value;
    if (target == null || info.Temperature == null) return false;
    // A cooler manually switched on far from the target reads as "running",
    // a slow final approach (<1°C) reads as "holding".
    if (Math.abs(info.Temperature - target) > 1) return true;
    // Near the cool target only a warm-up ramp steps the setpoint above it
    // (covers warm-ups started from NINA's UI or a sequence).
    return typeof info.TemperatureSetPoint === 'number' && info.TemperatureSetPoint > target + 0.5;
  });

  // 'off' | 'cooling' | 'warming' | 'holding'
  const coolingState = computed(() => {
    const info = store.cameraInfo;
    if (!info.Connected || !info.CanSetTemperature) return 'off';
    if (coolingPending.value === 'cooling' || coolingPending.value === 'warming') {
      return coolingPending.value;
    }
    if (coolingPending.value === 'cancel') return info.CoolerOn ? 'holding' : 'off';
    // A running ramp wins over a CoolerOn that still reads false (see isRampRunning).
    if (isRampRunning.value) return rampDirection.value ?? inferRampDirection() ?? 'cooling';
    return info.CoolerOn ? 'holding' : 'off';
  });

  // Runs on every changed camera payload (the store drops unchanged ones):
  // maintains the latches, then confirms or ends the optimistic intent and
  // manages the direction latch over the ramp lifecycle.
  watch(
    () => store.cameraInfo,
    (info) => {
      if (!info.CoolerOn) clearHeuristicLatches();
      if (commandedWarmUp.value && Date.now() >= commandedWarmUp.value.deadline) {
        commandedWarmUp.value = null;
      }
      // Any ramp moves the setpoint; a moved setpoint ends the hold.
      if (holdSetpoint.value != null && info.TemperatureSetPoint !== holdSetpoint.value) {
        holdSetpoint.value = null;
      }
      // Capture the held setpoint once NINA's post-cancel write surely
      // reached us: one device poll after the cancel completed, and two
      // consecutive payloads since then agree on the setpoint. A payload
      // requested before the cancel can still arrive after the deadline and
      // would carry the old ramp's setpoint.
      if (holdCaptureAt && Date.now() >= holdCaptureAt) {
        const setpoint = info.TemperatureSetPoint;
        if (Number.isFinite(setpoint) && setpoint === holdCandidate) {
          holdSetpoint.value = setpoint;
          holdCaptureAt = 0;
          holdCandidate = null;
        } else {
          holdCandidate = setpoint;
        }
      }

      const running = isRampRunning.value;
      const pending = coolingPending.value;
      if ((pending === 'cooling' || pending === 'warming') && running) setCoolingPending(null);
      // Without the real flag a cancel only counts as confirmed once the held
      // setpoint is known; an earlier "not running" may be a coincidence of
      // the old ramp and would leave the distance heuristic without the hold.
      const cancelConfirmed =
        typeof info.TempChangeRunning === 'boolean' || holdSetpoint.value != null;
      if (pending === 'cancel' && !running && cancelConfirmed) setCoolingPending(null);

      // Direction. Every setpoint move of a running ramp re-derives it, so a
      // ramp replaced from outside TNS (NINA UI, sequence) flips the latch.
      // Two signals, each wrong in one situation, so they are combined:
      // - The trend (previous vs. new setpoint) is right while the ramp
      //   steps, even when a fast cooler keeps the sensor below the
      //   setpoint. It is wrong for the first step, when the previous
      //   setpoint is a leftover from before the ramp (e.g. the old cool
      //   target under a camera that warmed up passively) - recorded on a
      //   PINS Pi as 10 -> 17 while cooling from 23°C.
      // - Setpoint vs. temperature is right for the first step, when the
      //   sensor has not moved yet, and wrong once the sensor overshoots.
      // A leftover shows in at most one running payload (NINA refreshes
      // CameraInfo every device poll), so the trend only counts once the
      // previous setpoint was seen in two running payloads.
      const setpoint = info.TemperatureSetPoint;
      if (setpoint !== trendSetpoint) {
        if (running && setpoint != null && trendSetpoint != null) {
          if (trendSeenRunning >= 2 && setpoint > trendSetpoint) rampDirection.value = 'warming';
          else if (trendSeenRunning >= 2 && setpoint < trendSetpoint)
            rampDirection.value = 'cooling';
          else rampDirection.value = inferRampDirection() ?? rampDirection.value;
        }
        trendSetpoint = setpoint;
        trendSeenRunning = running ? 1 : 0;
      } else {
        trendSeenRunning = running ? trendSeenRunning + 1 : 0;
      }

      if (running) {
        if (!rampDirection.value) rampDirection.value = inferRampDirection();
      } else if (coolingPending.value !== 'cooling' && coolingPending.value !== 'warming') {
        // Keep the direction while a start is still unconfirmed: the payload
        // may predate the command.
        rampDirection.value = null;
      }

      runAutoStart(info);
    }
  );

  function resetCoolingIntent() {
    setCoolingPending(null);
    rampDirection.value = null;
    clearHeuristicLatches();
  }

  // A cancelled ramp task ends asynchronously: its catch writes the setpoint
  // to the driver (slow on INDI) and only then its finally clears
  // TempChangeRunning. A ramp started meanwhile has already set the flag, so
  // it reads false for its whole duration (seen on a PINS Pi). Wait for the
  // flag to drop before starting; the field is live, not cached. Without
  // the field (official ninaAPI) there is nothing to wait for.
  async function waitForRampIdle() {
    if (typeof store.cameraInfo.TempChangeRunning !== 'boolean') return;
    for (let i = 0; i < 10; i++) {
      const info = (await apiService.cameraAction('info'))?.Response;
      if (info?.TempChangeRunning !== true) return;
      await wait(300);
    }
  }

  async function startCooling(temperature, minutes) {
    clearHeuristicLatches();
    // Within 1°C of the target NINA skips the ramp and returns at once, so
    // there is nothing to show as pending.
    const info = store.cameraInfo;
    const instant =
      Number.isFinite(info.Temperature) && Math.abs(info.Temperature - temperature) <= 1;
    if (!instant) {
      // Intent first, so the UI reacts on the press and not after two roundtrips.
      rampDirection.value = 'cooling';
      setCoolingPending('cooling');
    }
    try {
      // Cancel first: cool and warm share one CancellationTokenSource in
      // ninaAPI, see waitForRampIdle() for why the start has to wait.
      await apiService.stopCameraWarming();
      await waitForRampIdle();
      const response = await apiService.startCameraCooling(temperature, minutes ?? 10);
      if (isBackendRefusal(response)) resetCoolingIntent();
      return response;
    } catch (error) {
      resetCoolingIntent();
      throw error;
    }
  }

  async function startWarming(minutes) {
    clearHeuristicLatches();
    rampDirection.value = 'warming';
    setCoolingPending('warming');
    // NINA gives a warm-up its duration plus 15 minutes before it gives up;
    // past that the plain heuristic takes over again.
    commandedWarmUp.value = {
      deadline: Date.now() + ((minutes ?? 10) + 15) * 60000 + 20000,
    };
    try {
      await apiService.stopCameraCooling();
      await waitForRampIdle();
      await apiService.startCameraWarming(minutes ?? 10);
    } catch (error) {
      resetCoolingIntent();
      throw error;
    }
  }

  async function cancelTempChange() {
    clearHeuristicLatches();
    setCoolingPending('cancel');
    try {
      // cancel=true on an idle ramp is a no-op, so cancel both to stay correct
      // even if the derived direction is momentarily wrong.
      await apiService.stopCameraCooling();
      await apiService.stopCameraWarming();
    } catch (error) {
      setCoolingPending(null);
      throw error;
    }
    // NINA has written the held setpoint now; its next device poll reads it back.
    holdCaptureAt = Date.now() + devicePollMs() + 1000;
  }

  // --- Auto start on connect -------------------------------------------------
  //
  // Opt-in: cools the camera and, when chosen, switches the dew heater on after
  // a camera connect. apiStore only calls armAutoStart() for a connect it saw
  // happen, never for a camera that was already connected when the app attached
  // to the backend: opening the app must not command the camera.
  //
  // The choice belongs to one profile on one backend, so it lives in a backend
  // setting keyed by the profile id and never in the persisted settingsStore:
  // that one is shared by all instances on this device, and profile ids can
  // repeat between backends (cloned PINS images).
  //
  // The connect event arrives before the first camera payload and a driver may
  // report its capabilities a moment after Connected, so the actions run from
  // the cameraInfo watch once a payload allows them.
  let autoStart = null; // { cool, dewHeater, deadline } | null
  let autoStartGeneration = 0; // ends an armAutoStart() still waiting for the backend
  let autoStartConfigLoad = 0; // only the newest load may write autoStartConfig

  // Choice of the active profile for the settings UI; null until it is known.
  const autoStartConfig = shallowRef(null); // { cool, dewHeater } | null

  // null when the backend could not tell; a profile without an entry has it off.
  async function readAutoStartConfig(profileId) {
    try {
      const response = await apiService.getSetting(`${AUTO_START_KEY_PREFIX}${profileId}`);
      if (response?.StatusCode === 404) return { cool: false, dewHeater: false };
      if (response?.Response?.Value === undefined) return null;
      const { cool, dewHeater } = JSON.parse(response.Response.Value);
      return { cool: cool === true, dewHeater: dewHeater === true };
    } catch (error) {
      console.warn('[cameraStore] Could not read the auto start setting:', error.message);
      return null;
    }
  }

  async function loadAutoStartConfig() {
    const load = ++autoStartConfigLoad;
    autoStartConfig.value = null;
    const profileId = store.profileInfo?.Id;
    if (!profileId) return;
    const config = await readAutoStartConfig(profileId);
    if (load === autoStartConfigLoad) autoStartConfig.value = config;
  }

  async function saveAutoStartConfig(patch) {
    const previous = autoStartConfig.value;
    const profileId = store.profileInfo?.Id;
    if (!previous || !profileId) return;
    const next = { ...previous, ...patch };
    autoStartConfig.value = next;

    const key = `${AUTO_START_KEY_PREFIX}${profileId}`;
    const value = JSON.stringify(next);
    try {
      let response = await apiService.createSetting({ Key: key, Value: value });
      if (response?.StatusCode === 409) response = await apiService.updateSetting(key, value);
      if (!isBackendRefusal(response)) return;
      toastBackendError(response, 'components.camera.autoStartSaveFailed');
    } catch (error) {
      toastBackendError({ Error: error.message }, 'components.camera.autoStartSaveFailed');
    }
    if (autoStartConfig.value === next) autoStartConfig.value = previous;
  }

  async function armAutoStart() {
    const generation = ++autoStartGeneration;
    // A profile switched elsewhere only shows up with the periodic refresh, and
    // both this choice and the cool target depend on it.
    await store.fetchProfilInfos();
    const profileId = store.profileInfo?.Id;
    const config = profileId ? await readAutoStartConfig(profileId) : null;
    if (generation !== autoStartGeneration || !config?.cool) return;
    autoStart = {
      cool: true,
      dewHeater: config.dewHeater,
      deadline: Date.now() + AUTO_START_WINDOW_MS,
    };
    // The payload that allows the actions may have arrived during the reads.
    runAutoStart(store.cameraInfo);
  }

  function runAutoStart(info) {
    if (!autoStart) return;
    // A running sequence owns the camera. sequenceRunning is only polled while
    // the sequence page is open, so this cannot catch every run.
    if (Date.now() >= autoStart.deadline || useSequenceStore().sequenceRunning) {
      autoStart = null;
      return;
    }
    if (!info.Connected) return;

    let coolTarget = null;
    if (autoStart.cool && info.CanSetTemperature) {
      // A cooler that is already on stays as it is, whoever switched it on.
      if (info.CoolerOn || isRampRunning.value || coolingPending.value) {
        autoStart.cool = false;
      } else if (Number.isFinite(targetTemp.value)) {
        coolTarget = targetTemp.value;
        autoStart.cool = false;
      }
    }

    let startDewHeater = false;
    if (autoStart.dewHeater && info.HasDewHeater) {
      startDewHeater = !info.DewHeaterOn;
      autoStart.dewHeater = false;
    }

    if (!autoStart.cool && !autoStart.dewHeater) autoStart = null;
    if (coolTarget != null || startDewHeater) executeAutoStart(coolTarget, startDewHeater);
  }

  // A failure stays on screen: nobody pressed anything, so nobody is watching for it.
  async function tryAutoAction(action, titleKey) {
    try {
      const response = await action();
      if (!isBackendRefusal(response)) return true;
      toastBackendError(response, titleKey, { autoClose: false });
    } catch (error) {
      toastBackendError({ Error: error.message }, titleKey, { autoClose: false });
    }
    return false;
  }

  // Hardware moved without a button press, so the user gets told, in one toast
  // because a second one would replace the first.
  async function executeAutoStart(coolTarget, startDewHeater) {
    const t = i18n.global.t;
    const started = [];
    if (
      coolTarget != null &&
      (await tryAutoAction(
        () => startCooling(coolTarget, store.profileInfo?.CameraSettings?.CoolingDuration),
        'components.camera.autoCoolFailed'
      ))
    ) {
      started.push(t('components.camera.autoCoolStarted', { temperature: coolTarget }));
    }
    if (
      startDewHeater &&
      (await tryAutoAction(
        () => apiService.startStoppDewheater(true),
        'components.camera.autoDewHeaterFailed'
      ))
    ) {
      started.push(t('components.camera.autoDewHeaterStarted'));
    }
    if (started.length) {
      useToastStore().showToast({
        type: 'info',
        title: t('components.camera.autoStartTitle'),
        message: started.join(' '),
      });
    }
  }

  // Start capture + image fetch
  async function capturePhoto(apiService, exposureTime, gain, solve = false) {
    if (exposureTime <= 0) {
      exposureTime = 2; // Default value
      return;
    }

    loading.value = true;
    isLoadingImage.value = false;
    isAbort.value = false;
    plateSolveResult.value = null;
    const save = store.profileInfo.SnapShotControlSettings.Save;
    const imageStore = useImagetStore();
    const settingsStore = useSettingsStore();
    const mountSotre = useMountStore();
    const targetName = settingsStore.camera.snapshotTargetName;

    // Taken before the exposure: the fallback in phase 1 may already have replaced it.
    const previousImage = imageStore.imageData;

    try {
      // Phase 1: Start exposure (Server provides ExposureEndTime and IsExposing)
      const started = await apiService.startCapture(
        exposureTime,
        gain,
        solve,
        true,
        save,
        targetName
      );
      if (reportBackendRefusal(started, 'components.backendErrors.captureStart')) {
        isLooping.value = false;
        return;
      }
      isLoadingImage.value = true;
      // Must honor aborts: resetCaptureState() (backend teardown) and abortExposure() set
      // isAbort while we may be waiting for an exposure that will never report back.
      if (!(await waitForImageFetch(apiService, imageStore, exposureTime))) return;

      // Phase 2: Load image with timeout
      if (!isAbort.value) {
        console.log('[cameraStore] Starting to load image data from API...');

        // Wait for image or timeout
        let attempts = 0;
        const maxAttempts = 60;

        while (attempts < maxAttempts && !isAbort.value) {
          try {
            const resImageData = await apiService.getImageData();
            if (isCaptureFailed(resImageData)) {
              reportCaptureFailure(resImageData);
              return;
            }

            // Check if new image is available
            if (previousImage !== imageStore.imageData) {
              console.log('[cameraStore] Image data received from API.');

              if (solve === false) {
                return;
              }

              if (resImageData.Response !== 'Capture already in progress') {
                //save plate solve result
                plateSolveResult.value = resImageData?.Response?.PlateSolveResult || null;
                console.log('[cameraStore] PlateSolveResult:', plateSolveResult.value);
                //if solve to mount is enabled, sync coordinates
                if (plateSolveResult.value && settingsStore.camera.useSyncSolveToMount) {
                  await mountSotre.syncCoordinates(
                    plateSolveResult.value.Coordinates.RADegrees,
                    plateSolveResult.value.Coordinates.Dec
                  );
                }
                return;
              }
            }
          } catch (error) {
            console.error(' [cameraStore]Error fetching image:', error.message);
          }

          attempts++;
          //console.debug(`[cameraStore] Waiting for image... Attempt ${attempts}/${maxAttempts}`);
          await wait(1000);
        }

        // The loop returns as soon as the image is there, so reaching this means it never came.
        if (!isAbort.value) reportImageTimeout();
        if (loadingTimeout.value) {
          clearTimeout(loadingTimeout.value);
          loadingTimeout.value = null;
        }
      }
    } catch (error) {
      console.error('[cameraStore] Error during capture:', error.message);
    } finally {
      loading.value = false;
      isLoadingImage.value = false;
      await nextTick(); // Force DOM update for Safari

      // Continuous loop?
      if (isLooping.value && !isAbort.value) {
        console.log('[cameraStore] Starting next looped exposure...');
        capturePhoto(apiService, exposureTime, gain, solve, false, save);
        console.log('[cameraStore] save value in loop: ', save);
      }
    }
  }

  /**
   * Waits until the image download of the capture has started (see CAPTURE_DONE_POLL_MS).
   * Returns false when the wait ended without an image: aborted or hard limit reached.
   */
  // Ends a loop as well: the next capture would most likely fail for the same reason.
  function reportImageTimeout() {
    console.error('[cameraStore] No image arrived for the capture');
    const { t } = i18n.global;
    useToastStore().showToast({
      type: 'error',
      title: t('components.camera.imageTimeoutTitle'),
      message: t('components.camera.imageTimeout'),
    });
  }

  function reportCaptureFailure(result) {
    console.error('[cameraStore] Capture failed:', result.Error);
    isLooping.value = false;
    if (isAbort.value || isCaptureCancelled(result)) return;
    toastBackendError(result, 'components.backendErrors.capture');
  }

  async function waitForImageFetch(apiService, imageStore, exposureTime) {
    const startedAt = Date.now();
    const exposureMs = exposureTime * 1000;
    let lastCheck = 0;
    let doneAnswers = 0;

    while (!imageStore.isImageFetching) {
      if (isAbort.value) return false;
      const elapsed = Date.now() - startedAt;
      if (elapsed > exposureMs + CAPTURE_HARD_LIMIT_MS) {
        // A loop would only start the next capture into the same silence.
        isLooping.value = false;
        reportImageTimeout();
        return false;
      }

      if (elapsed >= exposureMs && Date.now() - lastCheck >= CAPTURE_DONE_POLL_MS) {
        lastCheck = Date.now();
        const result = await apiService.getImageData().catch(() => null);
        if (isCaptureFailed(result)) {
          reportCaptureFailure(result);
          return false;
        }
        const done = result?.Success === true && result.Response !== CAPTURE_IN_PROGRESS;
        doneAnswers = done ? doneAnswers + 1 : 0;
        if (doneAnswers >= CAPTURE_DONE_CONFIRMATIONS && !imageStore.isImageFetching) {
          console.warn('[cameraStore] Capture done without IMAGE-PREPARED, loading the image');
          await imageStore.getImage();
          return true;
        }
      }
      await wait(100);
    }
    return true;
  }

  /**
   * Aborts the exposure
   */
  async function abortExposure(apiService) {
    try {
      console.log('[cameraStore] Canceling exposure...');
      await apiService.cameraAction('abort-exposure');

      isAbort.value = true;
      isLoadingImage.value = false;
      await nextTick(); // Force DOM update for Safari
      isLooping.value = false;

      // Clear timeout if running
      if (loadingTimeout.value) {
        clearTimeout(loadingTimeout.value);
        loadingTimeout.value = null;
      }

      console.log('E[cameraStore] xposure successfully aborted.');
    } catch (error) {
      console.error('[cameraStore] Error aborting exposure:', error);
    } finally {
      loading.value = false;
    }
  }

  async function getCameraRotation(apiService, exposureTime = 2, gain) {
    loading.value = true;
    isLoadingImage.value = true;
    plateSolveError.value = false;

    try {
      // Start capture via API
      let result; // Variable declaration for result
      let plateSolveResult = null;
      let plateSolveStatusCode = 0;
      isLoadingImage.value = true;
      result = await apiService.getPlatesovle(exposureTime, gain);
      console.log('[cameraStore] result platesolve: ', result);

      plateSolveResult = result?.Response?.PlateSolveResult;
      plateSolveStatusCode = result?.StatusCode;
      if (plateSolveStatusCode != 200) {
        plateSolveError.value = true;
        console.log('[cameraStore] plateSolveError: ', plateSolveStatusCode, plateSolveError.value);
      }
      if (plateSolveResult) {
        const positionAngle = positionAngleFromNinaPlateSolve(plateSolveResult.PositionAngle);
        if (positionAngle === null) {
          plateSolveError.value = true;
          console.error('[cameraStore] Plate solve returned an invalid position angle');
        } else {
          framingStore.rotationAngle = positionAngle;
          console.log('[cameraStore] Camera position angle: ', framingStore.rotationAngle);
        }
      }
    } catch (error) {
      console.error('[cameraStore] Error during capture:', error.message);
    } finally {
      loading.value = false;
      isLoadingImage.value = false;
      await nextTick(); // Force DOM update for Safari
    }
  }

  // Tear down all client-driven capture activity. Called from
  // apiStore.clearAllStates() when the backend session ends (connection lost,
  // or an in-place endpoint change during onboarding): without this, a running
  // snapshot loop survives the
  // teardown and starts commanding whatever backend connects next, and the
  // wait loops in capturePhoto() can hang forever. Backend-derived settings
  // (cameraSettings, binning/readout indices) are dropped too - they belong
  // to the previous instance's camera.
  function resetCaptureState() {
    isLooping.value = false;
    // Releases capturePhoto()'s wait loops; every new capture resets it.
    isAbort.value = true;
    stopCountdown();
    exposureCountdown.value = 0;
    exposureProgress.value = 0;
    loading.value = false;
    isLoadingImage.value = false;
    cameraSettings.value = undefined;
    binningMode.value = '1x1';
    readoutMode.value = 0;
    setCoolingPending(null);
    rampDirection.value = null;
    autoStart = null;
    autoStartGeneration++;
    autoStartConfigLoad++;
    autoStartConfig.value = null;
  }

  // Stop countdown (e.g. when app is paused)
  function stopCountdown() {
    if (countdownRunning.value) {
      console.log('[cameraStore] Stopping exposure countdown...');
      countdownRunning.value = false;
    }
  }

  // Countdown for status display with server time synchronization
  async function updateCountdown() {
    const exposureEndTime = store.cameraInfo.ExposureEndTime;

    if (!exposureEndTime) {
      exposureCountdown.value = 0;
      exposureProgress.value = 0;
      return;
    }

    // Create new session ID for this countdown instance
    const currentSessionId = ++countdownSessionId;

    // Stop all existing countdown loops immediately
    countdownRunning.value = false;

    // Wait briefly to ensure running loops are definitely terminated
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Ensure time synchronization before starting countdown
    await timeSync.ensureSync();

    const endTime = new Date(exposureEndTime).getTime();
    if (isNaN(endTime)) {
      console.error('[cameraStore] Invalid date format for ExposureEndTime.');
      exposureCountdown.value = 0;
      exposureProgress.value = 0;
      return;
    }

    // Reset progress to 0 at the start
    exposureProgress.value = 0;

    // Start the new countdown
    countdownRunning.value = true;

    // Store initial countdown value to calculate the total duration
    let initialCountdown = null;

    // Watchdog: Track previous countdown value to detect stuck timer
    let previousCountdown = null;
    let stuckCounter = 0;
    const maxStuckIterations = 3; // Restart after 3 seconds of no change

    while (countdownRunning.value && currentSessionId === countdownSessionId) {
      // Use server-synchronized time for an accurate countdown
      const remainingTime = timeSync.calculateCountdown(exposureEndTime);

      if (remainingTime <= 0 || !store.cameraInfo.IsExposing) {
        exposureProgress.value = 100;
        exposureCountdown.value = 0;
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
        exposureProgress.value = 0;
        countdownRunning.value = false;
        break;
      }

      // Watchdog: Check if the countdown value changed
      if (previousCountdown !== null && previousCountdown === remainingTime) {
        stuckCounter++;
        console.warn(
          `[cameraStore] Watchdog Countdown stuck at ${remainingTime}s (${stuckCounter}/${maxStuckIterations})`
        );

        if (stuckCounter >= maxStuckIterations) {
          console.error(
            '[cameraStore] Watchdog Countdown stuck for too long, restarting countdown with time resynchronization...'
          );
          // Force time resynchronization
          await timeSync.ensureSync();
          stuckCounter = 0;
          previousCountdown = null;
          initialCountdown = null;
          continue; // Continue with a fresh calculation
        }
      } else {
        // Countdown is progressing normally, reset stuck counter
        stuckCounter = 0;
      }

      previousCountdown = remainingTime;
      exposureCountdown.value = remainingTime;

      // Set initial countdown on the first iteration
      if (initialCountdown === null) {
        initialCountdown = remainingTime;
      }

      // Calculate progress based on countdown: 0% when countdown = initial, 100% when countdown = 0
      if (initialCountdown > 0) {
        const elapsedTime = initialCountdown - remainingTime;
        exposureProgress.value = Math.max(0, Math.min(100, (elapsedTime / initialCountdown) * 100));
      } else {
        exposureProgress.value = 0;
      }

      // Re-synchronize periodically during long exposures
      if (remainingTime % 30 === 0) {
        timeSync.ensureSync();
      }

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    }
  }

  return {
    loading,
    isLoadingImage,
    isLooping,
    isAbort,
    showInfo,
    coolingPending,
    rampDirection,
    isRampRunning,
    targetTemp,
    coolingState,
    plateSolveError,
    plateSolveResult,
    exposureCountdown,
    exposureProgress,
    countdownRunning,
    binningMode,
    readoutMode,
    containerSize,
    slewModal,
    cameraSettings,
    guideCameraSettings,
    autoStartConfig,

    // Actions
    capturePhoto,
    getCameraRotation,
    abortExposure,
    updateCountdown,
    stopCountdown,
    resetCaptureState,
    readSettings,
    readGuideCameraSettings,
    startCooling,
    startWarming,
    cancelTempChange,
    armAutoStart,
    loadAutoStartConfig,
    saveAutoStartConfig,
  };
});
