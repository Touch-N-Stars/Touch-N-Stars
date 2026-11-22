import { ref } from 'vue';
import { apiStore } from '@/store/store';
import { useProbeSession } from '@/composables/useProbeSession';
import {
  backlashCalibrationFailure,
  backlashPlan,
  backlashReader,
  backlashWalk,
  initialProbeOffset,
  nextScanProbe,
  probeLimits,
  scanPreload,
  sharpestCalibrationFrame,
  suggestBacklash,
  suggestOffsetSteps,
  suggestStepSize,
} from '@/utils/hocusFocusAdvisor';

// Measures step size and backlash in one go (see nextScanProbe() and backlashPlan() in
// hocusFocusAdvisor.js). Every frame is reached moving the same way after a preload, so neither
// result depends on how the rough focus was last approached:
//   1. scan out from the start until past focus and far enough up the arm → step size
//   2. calibration frames beside the focus the scan found, a walk in and one back out → backlash
// One call to start() runs the whole bounded sequence; stop() ends it early. Either way the
// focuser goes back to where it started.

export function useFocuserProbe() {
  const store = apiStore();
  const session = useProbeSession('useFocuserProbe');
  const { phase, failure, moveTo, frame } = session;

  const scan = ref([]);
  const stepResult = ref(null);
  const plan = ref(null);
  const calibration = ref([]);
  // [{ sign, steps, hfr, stars }] in the order they were taken
  const walk = ref([]);
  const backlashResult = ref(null);
  const backlashFailure = ref('');
  // Focuser position of the sharpest calibration frame when the focus estimate was off.
  const sharpestPosition = ref(null);

  function reset() {
    scan.value = [];
    stepResult.value = null;
    plan.value = null;
    calibration.value = [];
    walk.value = [];
    backlashResult.value = null;
    backlashFailure.value = '';
    sharpestPosition.value = null;
  }

  // `handSamples` are the frames from focusing by hand; they choose the first probe distance.
  async function start(handSamples = []) {
    if (session.running.value) return;
    reset();

    await session.run(async (focuser) => {
      const startPosition = focuser.Position;
      const { direction, maxOffset } = probeLimits(startPosition, focuser.MaxStep);
      const preload = scanPreload(startPosition, focuser.MaxStep, direction);
      const at = (offset) => startPosition + direction * offset;
      // Every frame is approached moving in `direction`: a target behind the last one is
      // reached from `preload` steps further back.
      let last = null;
      const approach = async (offset) => {
        if (last === null || offset < last) await moveTo(at(offset - preload));
        await moveTo(at(offset));
        last = offset;
      };

      // 1. Focus scan and step size.
      phase.value = 'scan';
      const settings = store.profileInfo?.FocuserSettings || {};
      const firstOffset = initialProbeOffset(handSamples);
      let done = null;
      for (;;) {
        const next = nextScanProbe(scan.value, { maxOffset }, firstOffset);
        if (next.action === 'fail') {
          failure.value = next.reason;
          return;
        }
        if (next.action === 'done') {
          done = next;
          break;
        }
        await approach(next.offset);
        scan.value = [...scan.value, { offset: next.offset, ...(await frame(at(next.offset))) }];
      }
      const offsetSteps = suggestOffsetSteps(settings.AutoFocusInitialOffsetSteps);
      const step = suggestStepSize(done.best, done.probes, offsetSteps);
      if (!step) {
        failure.value = 'noSignal';
        return;
      }
      stepResult.value = { offsetSteps, ...step };

      // 2. Backlash, around the focus the scan found and on the sweep it suggests.
      const focusOffset = Math.round(done.best.offset + (step.focus || 0));
      const p = backlashPlan(
        at(focusOffset),
        focuser.MaxStep,
        step.stepSize,
        offsetSteps,
        direction
      );
      if (!p) {
        backlashFailure.value = 'noRoom';
        return;
      }
      plan.value = p;
      const fromFocus = (offset) => at(focusOffset) + direction * offset;

      phase.value = 'calibrate';
      await moveTo(fromFocus(p.calibration[0] - p.preload));
      for (const offset of p.calibration) {
        await moveTo(fromFocus(offset));
        calibration.value = [...calibration.value, { offset, ...(await frame(fromFocus(offset))) }];
      }
      const calibrationFailure = backlashCalibrationFailure(calibration.value);
      if (calibrationFailure) {
        backlashFailure.value = calibrationFailure;
        if (calibrationFailure === 'notInFocus') {
          sharpestPosition.value = fromFocus(sharpestCalibrationFrame(calibration.value).offset);
        }
        return;
      }

      // Walks `sign` (−1 towards focus) from `from` until the stars change; returns the outcome
      // and the offset the walk ended at.
      const walkFrom = async (from, startReading, sign) => {
        const frames = [];
        for (;;) {
          const next = backlashWalk(p, calibration.value, startReading, frames, sign);
          if (next.action !== 'step') {
            return { ...next, offset: from + sign * frames.length * p.step };
          }
          const offset = from + sign * (frames.length + 1) * p.step;
          await moveTo(fromFocus(offset));
          const sample = await frame(fromFocus(offset));
          frames.push(sample);
          walk.value = [...walk.value, { sign, steps: frames.length * p.step, ...sample }];
        }
      };

      const outermost = calibration.value[calibration.value.length - 1];
      phase.value = 'walkIn';
      const towards = await walkFrom(
        outermost.offset,
        backlashReader(calibration.value)(outermost),
        -1
      );
      if (towards.action === 'fail') {
        backlashFailure.value = towards.reason;
        return;
      }
      phase.value = 'walkOut';
      const away = await walkFrom(towards.offset, towards.end, 1);
      if (away.action === 'fail') {
        backlashFailure.value = away.reason;
        return;
      }
      backlashResult.value = suggestBacklash(
        settings,
        { towards: towards.remainder, away: away.remainder },
        direction,
        step.stepSize
      );
    });
  }

  return {
    running: session.running,
    phase,
    failure,
    scan,
    stepResult,
    plan,
    calibration,
    walk,
    backlashResult,
    backlashFailure,
    sharpestPosition,
    start,
    stop: session.stop,
  };
}
