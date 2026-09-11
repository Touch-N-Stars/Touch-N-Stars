import { defineStore } from 'pinia';
import { apiStore } from '@/store/store';
import { useFramingStore } from '@/store/framingStore';
import { useImagetStore } from './imageStore';
import { ref, computed, watch, nextTick } from 'vue';
import { timeSync } from '@/utils/timeSync';
import { useSettingsStore } from './settingsStore';
import { useMountStore } from './mountStore';
import apiService from '@/services/apiService';
import { positionAngleFromNinaPlateSolve } from '@/integrations/celestiaAtlas/positionAngle';

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
      await apiService.startCameraCooling(temperature, minutes ?? 10);
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

    try {
      // Phase 1: Start exposure (Server provides ExposureEndTime and IsExposing)
      await apiService.startCapture(exposureTime, gain, solve, true, save, targetName);
      isLoadingImage.value = true;
      // This wait has no timeout, so it must honor aborts: resetCaptureState()
      // (backend teardown) and abortExposure() set isAbort while we may be
      // stuck here waiting for an exposure that will never report back.
      while (!imageStore.isImageFetching) {
        if (isAbort.value) return;
        await wait(100);
        //console.log('[cameraStore] Waiting for exposure to complete...');
      }

      // Phase 2: Load image with timeout
      if (!isAbort.value) {
        console.log('[cameraStore] Starting to load image data from API...');

        // Wait for image or timeout
        let attempts = 0;
        const maxAttempts = 60;
        const previousImage = imageStore.imageData;

        while (attempts < maxAttempts && !isAbort.value) {
          try {
            const resImageData = await apiService.getImageData();

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

        try {
          console.log('[cameraStore] Image successfully loaded');
        } catch (error) {
          console.error('[cameraStore] Image loading failed:', error.message);
          if (!isAbort.value) {
            alert('Image was not provided in time');
          }
        } finally {
          // Clear timeout
          if (loadingTimeout.value) {
            clearTimeout(loadingTimeout.value);
            loadingTimeout.value = null;
          }
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

    // Actions
    capturePhoto,
    getCameraRotation,
    abortExposure,
    updateCountdown,
    stopCountdown,
    resetCaptureState,
    readSettings,
    startCooling,
    startWarming,
    cancelTempChange,
  };
});
