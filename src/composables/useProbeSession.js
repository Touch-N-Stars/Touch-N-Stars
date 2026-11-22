import { computed, ref } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useCameraStore } from '@/store/cameraStore';
import { useSettingsStore } from '@/store/settingsStore';
import { POSITION_TOLERANCE, readFocuser, useFocusFrame } from '@/composables/useFocusFrame';

// The focuser-and-camera loop the assistant's measurements share: move, wait until the focuser
// has settled, take a frame there. run() drives one bounded measurement and always brings the
// focuser back to where it started, whether the measurement finished, failed or was stopped.

const MOVE_TIMEOUT_MS = 120000;
const FRAME_TIMEOUT_EXTRA_MS = 30000;
const POLL_MS = 500;
const FRAME_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function useProbeSession(logTag) {
  const store = apiStore();
  const cameraStore = useCameraStore();
  const settingsStore = useSettingsStore();
  const focusFrame = useFocusFrame();

  const running = ref(false);
  const phase = ref('');
  const failure = ref('');
  let aborted = false;

  const exposure = computed(
    () => Number(store.profileInfo?.FocuserSettings?.AutoFocusExposureTime) || 2
  );

  // Same gain choice as the snapshot on the camera page and the rough-focus preview.
  function gain() {
    const profileGain = Number(store.profileInfo?.SnapShotControlSettings?.Gain);
    if (Number.isFinite(profileGain)) return profileGain;
    const settingsGain = Number(settingsStore.camera.gain);
    return Number.isFinite(settingsGain) ? settingsGain : -1;
  }

  function checkAborted() {
    if (aborted) throw new Error('aborted');
  }

  async function waitFor(condition, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
      checkAborted();
      if (Date.now() > deadline) throw new Error('timeout');
      await sleep(POLL_MS);
    }
  }

  // readFocuser() reads fresh, not from the store: right after a move command the polled store
  // still shows the old position, which may already lie within the tolerance of a small offset.
  const near = (position, target) => Math.abs(Number(position) - target) <= POSITION_TOLERANCE;

  // Waits for two settled readings in a row: NINA's backlash compensation moves in legs, and
  // IsMoving can drop between them.
  async function moveTo(position) {
    await apiService.moveFocuser(position);
    const deadline = Date.now() + MOVE_TIMEOUT_MS;
    let settled = 0;
    while (settled < 2) {
      checkAborted();
      if (Date.now() > deadline) throw new Error('timeout');
      await sleep(POLL_MS);
      const focuser = await readFocuser();
      settled = !focuser.IsMoving && near(focuser.Position, position) ? settled + 1 : 0;
    }
  }

  // Takes one frame at `position` and returns its HFR and star count. A frame without stars counts
  // too (HFR 0): that is how a probe that went too far shows up. A frame during which the focuser
  // was not at `position` (still settling) is taken again.
  async function frame(position) {
    for (let attempt = 0; attempt < FRAME_ATTEMPTS; attempt++) {
      // A frame still in flight from the rough-focus loop must not count as this one.
      await waitFor(
        () => !store.cameraInfo?.IsExposing && !cameraStore.loading,
        exposure.value * 1000 + FRAME_TIMEOUT_EXTRA_MS
      );
      const sample = await focusFrame.capture(exposure.value, gain(), checkAborted);
      if (sample.position !== null && near(sample.position, position)) {
        return { hfr: sample.hfr, stars: sample.stars };
      }
      console.warn(
        `[${logTag}] Frame taken at ${sample.position ?? 'a moving focuser'} instead of ${position}, retaking`
      );
      await moveTo(position);
    }
    throw new Error('timeout');
  }

  // Runs `measure(focuser)` with the focuser as read at the start. `measure` reports an expected
  // outcome by setting `failure` itself; thrown errors become 'timeout' or 'error'.
  async function run(measure) {
    if (running.value) return;
    running.value = true;
    aborted = false;
    failure.value = '';
    cameraStore.isLooping = false;

    let focuser = {};
    try {
      focuser = await readFocuser();
    } catch (err) {
      console.error(`[${logTag}] Error reading the focuser:`, err);
    }
    const startPosition = Number(focuser.Position);
    if (!Number.isFinite(startPosition)) {
      failure.value = 'error';
      running.value = false;
      return;
    }
    try {
      await measure({ ...focuser, Position: startPosition });
    } catch (err) {
      if (err.message !== 'aborted') {
        console.error(`[${logTag}] Measurement failed:`, err);
        failure.value = ['timeout', 'noImage'].includes(err.message) ? 'timeout' : 'error';
      }
    } finally {
      phase.value = 'return';
      aborted = false;
      try {
        if (!near((await readFocuser()).Position, startPosition)) await moveTo(startPosition);
      } catch (err) {
        console.error(`[${logTag}] Error returning to the start position:`, err);
        failure.value = failure.value || 'returnFailed';
      }
      phase.value = '';
      running.value = false;
    }
  }

  async function stop() {
    // The way back to the start position is never cut short.
    if (!running.value || phase.value === 'return') return;
    aborted = true;
    if (store.cameraInfo?.IsExposing || cameraStore.loading) {
      try {
        await cameraStore.abortExposure(apiService);
      } catch (err) {
        console.error(`[${logTag}] Error aborting exposure:`, err);
      }
    }
  }

  return { running, phase, failure, moveTo, frame, run, stop };
}
