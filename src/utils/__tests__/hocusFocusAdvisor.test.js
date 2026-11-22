import test from 'node:test';
import assert from 'node:assert/strict';

const advisor = await import('@/utils/hocusFocusAdvisor');
const { imageScale, suggestPixelScalePreset, evaluateRun, checkPrerequisites } = advisor;

// Builds a last-run response from HFR values at evenly spaced focuser positions.
function makeRun(hfrs, overrides = {}) {
  return {
    Success: true,
    IsActiveAutoFocuser: true,
    InProgress: false,
    Filter: '',
    InitialHFR: 3,
    FinalHFR: 2,
    AcceptedStarCountMin: 80,
    AcceptedStarCountMax: 120,
    RSquares: { Hyperbolic: 0.97, Quadratic: null, LeftTrend: 0, RightTrend: 0 },
    Points: hfrs.map((HFR, i) => ({
      Position: 1000 + i * 100,
      HFR,
      Error: 0.1,
      Rejected: false,
      Excluded: false,
    })),
    ...overrides,
  };
}

const settings = {
  stepSize: 50,
  offsetSteps: 4,
  exposureTime: 2,
  rSquaredThreshold: 0.8,
  focusRange: 'Typical',
};
const ids = (result) => result.findings.map((f) => f.id);

// Simulator run on the PINS test Pi (Sky Simulator camera + focuser, step size 50): the curve
// barely rises at the edges.
const simulatorRun = {
  Success: true,
  IsActiveAutoFocuser: true,
  InProgress: false,
  Filter: '',
  InitialHFR: 1.3821655311381282,
  FinalHFR: 1.3909506530518332,
  AcceptedStarCountMin: 98,
  AcceptedStarCountMax: 110,
  RSquares: { Hyperbolic: 0.9915386873417262, Quadratic: null, LeftTrend: 0, RightTrend: 0 },
  Points: [
    [24700, 1.828],
    [24750, 1.678],
    [24800, 1.529],
    [24850, 1.462],
    [24900, 1.412],
    [24950, 1.388],
    [25000, 1.414],
    [25050, 1.482],
    [25100, 1.537],
    [25150, 1.67],
  ].map(([Position, HFR]) => ({ Position, HFR, Error: 0.1, Rejected: false, Excluded: false })),
};

test('imageScale and the pixel-scale preset follow focal length, pixel size and binning', () => {
  assert.equal(Math.round(imageScale(512, 2.9) * 100) / 100, 1.17);
  assert.equal(Math.round(imageScale(512, 2.9, 2) * 100) / 100, 2.34);
  assert.equal(imageScale(0, 2.9), null);
  assert.equal(suggestPixelScalePreset(imageScale(512, 2.9)), 'Typical');
  assert.equal(suggestPixelScalePreset(imageScale(250, 3.76, 2)), 'WideField');
  assert.equal(suggestPixelScalePreset(imageScale(2000, 3.76)), 'LongFocalLength');
  assert.equal(suggestPixelScalePreset(null), null);
});

test('a well bracketed curve gives no findings', () => {
  const result = evaluateRun(makeRun([6, 4.5, 3.2, 2.3, 2, 2.3, 3.1, 4.4, 6.2]), settings);
  assert.deepEqual(result.findings, []);
});

test('the simulator run is too flat and proposes a larger step size', () => {
  const result = evaluateRun(simulatorRun, settings);
  assert.deepEqual(ids(result), ['tooFlat']);
  assert.deepEqual(result.findings[0].fix, {
    target: 'profile',
    key: 'FocuserSettings-AutoFocusStepSize',
    value: 75,
  });
});

test('a steep curve proposes a smaller step size', () => {
  const result = evaluateRun(makeRun([14, 9, 4, 2, 4, 9, 13]), settings);
  assert.deepEqual(ids(result), ['tooSteep']);
  assert.equal(result.findings[0].fix.value, 35);
});

test('a minimum at the edge means focus was not bracketed', () => {
  const result = evaluateRun(makeRun([2, 2.5, 3.2, 4, 5]), settings);
  assert.deepEqual(ids(result), ['notBracketed']);
  assert.equal(result.findings[0].params.side, 'inward');
  assert.deepEqual(result.findings[0].fix, {
    target: 'profile',
    key: 'FocuserSettings-AutoFocusInitialOffsetSteps',
    value: 6,
  });
});

test('too few stars come first and propose a longer exposure', () => {
  const result = evaluateRun(
    makeRun([6, 4, 2, 4, 6], {
      AcceptedStarCountMin: 3,
      AcceptedStarCountMax: 8,
      RSquares: { Hyperbolic: 0.5 },
      Filter: 'Ha',
    }),
    settings
  );
  assert.equal(ids(result)[0], 'fewStars');
  assert.equal(result.findings[0].params.narrowband, true);
  assert.equal(result.findings[0].fix.value, 4);
  assert.ok(ids(result).includes('poorFit'));
  // starsLost needs enough stars in focus to be meaningful
  assert.ok(!ids(result).includes('starsLost'));
});

test('stars lost at the defocused ends suggest the wide focus range once', () => {
  const run = makeRun([6, 4, 2, 4, 6], { AcceptedStarCountMin: 10, AcceptedStarCountMax: 120 });
  assert.deepEqual(evaluateRun(run, settings).findings[0].fix, {
    target: 'hf-sd',
    key: 'Simple_FocusRange',
    value: 'WideRange',
  });
  assert.deepEqual(evaluateRun(run, { ...settings, focusRange: 'WideRange' }).findings, []);
});

test('a worse final HFR is reported without a fix', () => {
  const result = evaluateRun(makeRun([6, 4, 2, 4, 6], { InitialHFR: 2, FinalHFR: 2.6 }), settings);
  assert.deepEqual(ids(result), ['worseAfter']);
  assert.equal(result.findings[0].fix, null);
});

test('a run from NINA’s own autofocus engine is flagged', () => {
  assert.deepEqual(ids(evaluateRun({ Success: true, IsActiveAutoFocuser: false }, settings)), [
    'notActive',
  ]);
});

test('nothing to judge yields null', () => {
  assert.equal(evaluateRun(null, settings), null);
  assert.equal(evaluateRun({ Success: false, Error: 'No AutoFocus run' }, settings), null);
  assert.equal(evaluateRun(makeRun([3, 2, 3], { InProgress: true }), settings), null);
  assert.equal(evaluateRun(makeRun([3, 2]), settings), null);
  assert.equal(evaluateRun({ Success: true, IsActiveAutoFocuser: true }, settings), null);
});

test('fixes are left out when the base value is unknown', () => {
  const result = evaluateRun(simulatorRun, {});
  assert.deepEqual(ids(result), ['tooFlat']);
  assert.equal(result.findings[0].fix, null);
});

test('checkPrerequisites reports missing optics and stacked binning', () => {
  const profile = {
    TelescopeSettings: { FocalLength: 0 },
    CameraSettings: { PixelSize: 3.76 },
    FocuserSettings: { AutoFocusBinning: 2 },
  };
  assert.deepEqual(checkPrerequisites(profile, { DetectionBinning: 'Bin2' }), [
    'missingOptics',
    'binningStacked',
  ]);
  assert.deepEqual(
    checkPrerequisites(
      {
        TelescopeSettings: { FocalLength: 512 },
        CameraSettings: { PixelSize: 2.9 },
        FocuserSettings: { AutoFocusBinning: 1 },
      },
      { DetectionBinning: 'Bin2' }
    ),
    []
  );
});

test('focusSamples returns the newest and the sharpest frame with its focuser position', () => {
  const { focusSamples } = advisor;
  const frames = [
    { hfr: 2.4, position: 1000, stars: 40 },
    { hfr: 1.6, position: 1100, stars: 70 },
    { hfr: 1.9, position: 1150, stars: 60 },
    { hfr: 0, position: 1200, stars: 0 },
    { hfr: 1.2, position: null, stars: 90 },
  ];
  assert.deepEqual(focusSamples(frames), {
    latest: { hfr: 1.9, position: 1150, stars: 60 },
    best: { hfr: 1.6, position: 1100, stars: 70 },
  });
  assert.deepEqual(focusSamples([]), { latest: null, best: null });
  assert.deepEqual(focusSamples(null), { latest: null, best: null });
});

// Aborted run on the PINS test Pi (Sky Simulator, step size 3000, 3 points per side): the outer
// frames found no stars and came back rejected with HFR 0.
const abortedRun = {
  Success: true,
  IsActiveAutoFocuser: true,
  InProgress: false,
  Filter: null,
  InitialHFR: 1.397,
  FinalHFR: null,
  AcceptedStarCountMin: 2,
  AcceptedStarCountMax: 107,
  RSquares: { Hyperbolic: 1, Quadratic: null, LeftTrend: 0, RightTrend: 0 },
  Points: [
    [22000, 10.24, false],
    [25000, 1.403, false],
    [28000, 9.94, false],
    [31000, 0, true],
    [34000, 0, true],
  ].map(([Position, HFR, Rejected]) => ({ Position, HFR, Rejected, Excluded: false })),
};

test('empty frames at the sweep ends propose halving the step size and nothing else', () => {
  const result = evaluateRun(abortedRun, { ...settings, stepSize: 3000 });
  assert.deepEqual(ids(result), ['edgesLost']);
  assert.deepEqual(result.findings[0].fix, {
    target: 'profile',
    key: 'FocuserSettings-AutoFocusStepSize',
    value: 1500,
  });
  // Also with fewer than three usable points, which used to give no diagnosis at all.
  const twoLeft = { ...abortedRun, Points: abortedRun.Points.slice(1) };
  assert.deepEqual(ids(evaluateRun(twoLeft, { ...settings, stepSize: 3000 })), ['edgesLost']);
  // A run whose every frame was empty has nothing to judge.
  const allEmpty = { ...abortedRun, Points: abortedRun.Points.slice(3) };
  assert.equal(evaluateRun(allEmpty, settings), null);
});

test('checkPrerequisites flags implausible points per side and a sweep over the travel', () => {
  const { ISSUE_FIXES } = advisor;
  const profile = (stepSize, offsetSteps) => ({
    TelescopeSettings: { FocalLength: 512 },
    CameraSettings: { PixelSize: 2.9 },
    FocuserSettings: {
      AutoFocusBinning: 1,
      AutoFocusStepSize: stepSize,
      AutoFocusInitialOffsetSteps: offsetSteps,
    },
  });
  const focuser = { MaxStep: 65535 };
  assert.deepEqual(checkPrerequisites(profile(170, 4), null, focuser), []);
  assert.deepEqual(checkPrerequisites(profile(170, 12), null, focuser), ['offsetStepsUnusual']);
  assert.deepEqual(checkPrerequisites(profile(3000, 3), null, focuser), ['sweepTooLarge']);
  // Without a known travel there is nothing to compare the sweep with.
  assert.deepEqual(checkPrerequisites(profile(3000, 3), null, {}), []);
  assert.equal(ISSUE_FIXES.offsetStepsUnusual.value, 4);
});

test('sweepRange spans the offset steps on both sides and flags leaving the travel', () => {
  const { sweepRange } = advisor;
  assert.deepEqual(sweepRange(25000, 170, 4, 65535), {
    from: 24320,
    to: 25680,
    half: 680,
    outOfRange: false,
  });
  assert.equal(sweepRange(1000, 500, 4, 65535).outOfRange, true);
  assert.equal(sweepRange(65000, 500, 4, 65535).outOfRange, true);
  assert.equal(sweepRange(25000, 0, 4, 65535), null);
});

// Runs the measurement against a model focuser: HFR(d)² = ref² + (k·(d + backlash))², stars gone
// beyond `lostAt` steps. The start frame is in focus. Returns the suggested step size for 4 points
// per side and the number of probes taken.
function measure(
  k,
  { ref = 2, lostAt = Infinity, maxOffset = Infinity, firstOffset = 4, backlash = 0 } = {}
) {
  const { nextProbe, suggestStepSize } = advisor;
  const reference = { hfr: ref, stars: 100 };
  const probes = [];
  for (;;) {
    const next = nextProbe(reference, probes, { maxOffset }, firstOffset);
    if (next.action === 'done') {
      return { ...suggestStepSize(reference, probes, 4), count: probes.length };
    }
    if (next.action === 'fail') return { fail: next.reason, count: probes.length };
    const d = next.offset;
    probes.push(
      d >= lostAt
        ? { offset: d, hfr: 0, stars: 0 }
        : { offset: d, hfr: Math.sqrt(ref * ref + (k * (d + backlash)) ** 2), stars: 100 }
    );
  }
}

// Step size at which the 4th point reaches 3× the in-focus HFR on the model focuser.
const idealStep = (k, ref = 2) => (Math.sqrt(8) * ref) / (k * 4);
const near = (step, k, tolerance = 0.02) =>
  Math.abs(step - idealStep(k)) / idealStep(k) < tolerance;

test('the measurement finds the step size for coarse and fine focusers alike', () => {
  // About 2 steps per AF point.
  const coarse = measure(0.7);
  assert.ok(near(coarse.stepSize, 0.7, 0.3), JSON.stringify(coarse));
  assert.ok(coarse.count <= 5);
  // About 300 steps per AF point.
  const fine = measure(0.0047);
  assert.ok(near(fine.stepSize, 0.0047), JSON.stringify(fine));
  assert.equal(fine.limited, false);
  assert.ok(fine.count <= 12, JSON.stringify(fine));
});

test('backlash shifting every probe does not bend the measured slope', () => {
  // The PINS test Pi: probes landed about 400 steps (BacklashOut) beyond their nominal offset.
  const result = measure(0.0043, { backlash: 400 });
  assert.ok(near(result.stepSize, 0.0043), JSON.stringify(result));
  assert.equal(result.limited, false);
});

test('the measured Pi run keeps the sweep inside the probes that still had stars', () => {
  const { suggestStepSize } = advisor;
  // Sky Simulator on the PINS test Pi: stars barely grow, and at 512 steps out only 42 of 111
  // stars are left. Reaching 3× in-focus HFR would take about ±820 steps, where the stars are gone.
  const probes = [
    [1, 1.39, 106],
    [2, 1.39, 110],
    [4, 1.38, 103],
    [8, 1.39, 110],
    [16, 1.4, 105],
    [32, 1.4, 108],
    [64, 1.42, 108],
    [128, 1.51, 111],
    [256, 1.83, 92],
    [512, 2.78, 42],
  ].map(([offset, hfr, stars]) => ({ offset, hfr, stars }));
  const result = suggestStepSize({ hfr: 1.4, stars: 100 }, probes, 3);
  assert.equal(result.limited, true);
  // No probe lost the stars, so the furthest probe itself bounds the sweep: 512 / 3 ≈ 170.
  assert.ok(Math.abs(result.stepSize * 3 - 512) < 40, JSON.stringify(result));
});

test('the full Pi run caps the sweep a margin inside the star-loss boundary', () => {
  const { suggestStepSize } = advisor;
  // Second run on the Pi, probed out until the stars faded (31 of 109 at 704 steps is lost).
  const probes = [
    [1, 1.39, 102],
    [2, 1.39, 104],
    [4, 1.39, 105],
    [8, 1.38, 109],
    [16, 1.4, 98],
    [32, 1.4, 106],
    [64, 1.42, 104],
    [128, 1.5, 109],
    [256, 1.82, 90],
    [512, 2.78, 44],
    [1024, 4.67, 13],
    [768, 3.68, 28],
    [640, 3.25, 34],
    [704, 3.47, 31],
  ].map(([offset, hfr, stars]) => ({ offset, hfr, stars }));
  const result = suggestStepSize({ hfr: 1.39, stars: 100 }, probes, 3);
  assert.equal(result.limited, true);
  // 0.7 · ~650 / 3 ≈ 152: the outer points sit near 455 steps, where about half the stars remain.
  assert.ok(result.stepSize >= 140 && result.stepSize <= 160, JSON.stringify(result));
});

test('the measurement bisects back when a probe loses the stars', () => {
  // Stars vanish soon after the rise starts: bisection collects points below the loss.
  // Stars vanish at 100 steps, long before 3× (≈ 283 steps): the sweep is capped below that.
  const result = measure(0.02, { lostAt: 100, firstOffset: 16 });
  assert.equal(result.limited, true);
  assert.ok(result.stepSize * 4 < 70 && result.stepSize * 4 >= 55, JSON.stringify(result));
  assert.ok(result.count <= 16);
  // Lost even at one step: nothing usable.
  assert.equal(measure(0.01, { lostAt: 1 }).fail, 'lost');
});

test('the measurement stops at the travel limit without a clear rise', () => {
  assert.deepEqual(measure(0.0001, { maxOffset: 500 }).fail, 'noSignal');
  assert.equal(advisor.nextProbe({ hfr: 0 }, []).reason, 'noReference');
});

test('initialProbeOffset starts from the hand-focus frames or at four steps', () => {
  const { initialProbeOffset } = advisor;
  assert.equal(initialProbeOffset([]), 4);
  assert.equal(
    initialProbeOffset([
      { position: 1000, hfr: 2 },
      { position: 1000, hfr: 2.1 },
    ]),
    4
  );
  // k = √(4² − 2²)/400 ≈ 0.00866 → 1.5× is reached at ≈ 258 steps → start at half.
  assert.equal(
    initialProbeOffset([
      { position: 1000, hfr: 2 },
      { position: 1400, hfr: 4 },
    ]),
    129
  );
});

test('probeLimits moves away from the nearer end of travel', () => {
  const { probeLimits } = advisor;
  assert.deepEqual(probeLimits(25000, 65535), { direction: 1, maxOffset: 16383.75 });
  assert.deepEqual(probeLimits(60000, 65535), { direction: -1, maxOffset: 16383.75 });
  assert.deepEqual(probeLimits(500, 0), { direction: 1, maxOffset: Infinity });
});

// --- Backlash measurement --------------------------------------------------------------------

// A focuser with mechanical slack behind NINA's compensation decorators (FocuserDecorator in
// N.I.N.A.). The drawtube sits at motor + gap; moving out first closes the gap, moving in first
// opens it up to `backlash`. Positions are the reported ones, as the app sees them.
function slackFocuser({ backlash, model = 'OVERSHOOT', backlashIn = 0, backlashOut = 0, start }) {
  let motor = start;
  let gap = 0;
  let offset = 0;
  let lastDirection = 0;
  const drive = (target) => {
    const delta = target - motor;
    gap = delta > 0 ? Math.max(0, gap - delta) : Math.min(backlash, gap - delta);
    motor = target;
    if (delta) lastDirection = Math.sign(delta);
  };
  return {
    get drawtube() {
      return motor + gap;
    },
    get position() {
      return motor - offset;
    },
    move(target) {
      if (model === 'ABSOLUTE') {
        const adjusted = target + offset;
        const direction = Math.sign(adjusted - motor);
        let comp = 0;
        if (direction < 0 && lastDirection > 0) comp = -backlashIn;
        if (direction > 0 && lastDirection < 0) comp = backlashOut;
        offset += comp;
        drive(adjusted + comp);
      } else {
        const direction = Math.sign(target - motor);
        if (direction < 0 && backlashIn) drive(target - backlashIn);
        if (direction > 0 && backlashOut) drive(target + backlashOut);
        drive(target);
      }
    },
  };
}

// Mirrors the backlash part of useFocuserProbe against a simulated focuser. Stars follow
// a hyperbola that reaches three times the in-focus HFR at the AF half sweep (400 steps here).
function measureBacklash(
  rig,
  { start = 30000, maxStep = 65535, focusAt = 0, seeing = [], stepSize = 100 } = {}
) {
  const settings = {
    AutoFocusStepSize: stepSize,
    AutoFocusInitialOffsetSteps: 4,
    BacklashCompensationModel: rig.model || 'OVERSHOOT',
    BacklashIn: rig.backlashIn || 0,
    BacklashOut: rig.backlashOut || 0,
  };
  const plan = advisor.backlashPlan(start, maxStep, stepSize, 4);
  const focuser = slackFocuser({ ...rig, start });
  const width = plan.half / Math.sqrt(8);
  const focus = start + plan.direction * focusAt;
  let frames = 0;
  const frame = () => {
    const d = (focuser.drawtube - focus) / width;
    return { hfr: 2 * Math.sqrt(1 + d * d) + (seeing[frames++ % seeing.length] || 0), stars: 100 };
  };
  const at = (offset) => start + plan.direction * offset;

  focuser.move(at(plan.calibration[0] - plan.preload));
  const calibration = plan.calibration.map((offset) => {
    focuser.move(at(offset));
    return { offset, ...frame() };
  });
  const failure = advisor.backlashCalibrationFailure(calibration);
  if (failure) return { failure };

  const walk = (from, startReading, sign) => {
    const taken = [];
    for (;;) {
      const next = advisor.backlashWalk(plan, calibration, startReading, taken, sign);
      if (next.action !== 'step')
        return { ...next, offset: from + sign * taken.length * plan.step };
      focuser.move(at(from + sign * (taken.length + 1) * plan.step));
      taken.push(frame());
    }
  };
  const last = calibration[calibration.length - 1];
  const towards = walk(last.offset, advisor.backlashReader(calibration)(last), -1);
  if (towards.action === 'fail') return { failure: towards.reason };
  const away = walk(towards.offset, towards.end, 1);
  if (away.action === 'fail') return { failure: away.reason };
  const remainder = { towards: towards.remainder, away: away.remainder };
  return {
    remainder,
    frames,
    ...advisor.suggestBacklash(settings, remainder, plan.direction, stepSize),
  };
}

const within = (actual, expected, tolerance) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );

test('backlashPlan scales with the AF sweep and needs room on both sides', () => {
  const { backlashPlan } = advisor;
  assert.deepEqual(backlashPlan(30000, 65535, 100, 4), {
    direction: 1,
    half: 400,
    calibration: [200, 300, 400],
    preload: 4200,
    step: 200,
    maxSteps: 20,
    low: 100,
    high: 640,
    threshold: 60,
  });
  // Near the upper end the arm lies inwards.
  assert.equal(backlashPlan(60000, 65535, 100, 4).direction, -1);
  // Close to 0 the walk in runs out of room behind the start, and the preload with it.
  const tight = backlashPlan(400, 65535, 100, 4);
  assert.equal(tight.maxSteps, 3);
  assert.equal(tight.preload, 600);
  assert.equal(backlashPlan(0, 65535, 100, 4), null);
  assert.equal(backlashPlan(30000, 65535, 0, 4), null);
  assert.equal(backlashPlan(undefined, 65535, 100, 4), null);
});

test('backlash without compensation suggests an outward overshoot with margin', () => {
  const result = measureBacklash({ backlash: 120 });
  within(result.remainder.towards, 120, 12);
  within(result.remainder.away, 120, 12);
  assert.equal(result.model, 'OVERSHOOT');
  within(result.backlash, 120, 12);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].key, 'FocuserSettings-BacklashOut');
  within(result.changes[0].value, 150, 15);
});

test('backlash is measured the same way on an inward arm', () => {
  // Here the calibration is approached moving inwards, which leaves the drawtube 120 steps nearer
  // to focus, where the V starts to bend: the straight line reads a little high.
  const result = measureBacklash({ backlash: 120 }, { start: 60000 });
  within(result.backlash, 120, 24);
});

test('an overshoot that covers the backlash needs no change', () => {
  const result = measureBacklash({ backlash: 120, backlashOut: 200 });
  assert.equal(result.backlash, null);
  assert.deepEqual(result.changes, []);
  // A set inward overshoot stays the side that is suggested.
  const short = measureBacklash({ backlash: 120, backlashIn: 60 });
  assert.equal(short.changes[0].key, 'FocuserSettings-BacklashIn');
  within(short.backlash, 120, 12);
});

test('absolute compensation is corrected per reversal', () => {
  const none = measureBacklash({ backlash: 120, model: 'ABSOLUTE' });
  assert.deepEqual(
    none.changes.map((c) => c.key),
    ['FocuserSettings-BacklashIn', 'FocuserSettings-BacklashOut']
  );
  for (const c of none.changes) within(c.value, 120, 12);

  const exact = measureBacklash({
    backlash: 120,
    model: 'ABSOLUTE',
    backlashIn: 120,
    backlashOut: 120,
  });
  assert.deepEqual(exact.changes, []);
  within(exact.backlash, 120, 1);

  // Overcompensation shows up as a negative remainder and lowers the value.
  const over = measureBacklash({
    backlash: 120,
    model: 'ABSOLUTE',
    backlashIn: 160,
    backlashOut: 160,
  });
  for (const c of over.changes) within(c.value, 120, 12);

  // Only the wrong side changes.
  const lopsided = measureBacklash({
    backlash: 120,
    model: 'ABSOLUTE',
    backlashIn: 120,
    backlashOut: 0,
  });
  assert.deepEqual(
    lopsided.changes.map((c) => c.key),
    ['FocuserSettings-BacklashOut']
  );
  within(lopsided.changes[0].value, 120, 12);
});

test('a focuser without backlash keeps its settings', () => {
  for (const model of ['OVERSHOOT', 'ABSOLUTE']) {
    const result = measureBacklash({ backlash: 0, model });
    assert.equal(result.backlash, 0);
    assert.deepEqual(result.changes, []);
  }
});

test('seeing jitter and an imperfect rough focus keep the estimate usable', () => {
  // Rough focus 60 steps off towards the arm, and ±0.1 px HFR noise per frame.
  const result = measureBacklash(
    { backlash: 120 },
    { focusAt: 60, seeing: [0.1, -0.1, 0.05, -0.1, 0.1, 0.05, -0.05] }
  );
  within(result.backlash, 120, 36);
});

test('backlash far larger than the AF sweep is still measured', () => {
  // The docker sky simulator: 100 steps of backlash against a half sweep of 16.
  const result = measureBacklash({ backlash: 100 }, { stepSize: 4 });
  within(result.backlash, 100, 8);
  const pi = measureBacklash({ backlash: 1500, model: 'ABSOLUTE' });
  for (const c of pi.changes) within(c.value, 1500, 60);
});

test('backlash beyond the walk, overcompensation or flat stars fail instead of guessing', () => {
  assert.equal(measureBacklash({ backlash: 5000 }).failure, 'tooLarge');
  assert.equal(
    measureBacklash({ backlash: 120, model: 'ABSOLUTE', backlashIn: 600, backlashOut: 600 })
      .failure,
    'overcompensated'
  );
  // Rough focus 300 steps off: the calibration straddles focus.
  assert.equal(measureBacklash({ backlash: 120 }, { focusAt: 300 }).failure, 'notInFocus');
  // The failing run on the docker simulator: start 24975, sharpest frame 51 steps out.
  const straddling = [
    { offset: 34, hfr: 2.43, stars: 82 },
    { offset: 51, hfr: 1.44, stars: 158 },
    { offset: 68, hfr: 1.85, stars: 130 },
  ];
  assert.equal(advisor.backlashCalibrationFailure(straddling), 'notInFocus');
  assert.equal(advisor.sharpestCalibrationFrame(straddling).offset, 51);
  const flat = [200, 300, 400].map((offset) => ({ offset, hfr: 2, stars: 100 }));
  assert.equal(advisor.backlashCalibrationFailure(flat), 'flat');

  const { backlashCalibrationFailure } = advisor;
  const lost = [
    { offset: 200, hfr: 3, stars: 100 },
    { offset: 300, hfr: 0, stars: 0 },
    { offset: 400, hfr: 6, stars: 90 },
  ];
  assert.equal(backlashCalibrationFailure(lost), 'lost');
  // Far out of focus all frames have equally few stars: still lost, not flat (docker simulator).
  const defocused = [
    { offset: 14, hfr: 7.94, stars: 3 },
    { offset: 21, hfr: 8.6, stars: 2 },
    { offset: 28, hfr: 8.65, stars: 2 },
  ];
  assert.equal(backlashCalibrationFailure(defocused), 'lost');
});

// --- Combined focus scan and backlash ----------------------------------------------------------

// Mirrors useFocuserProbe against a simulated focuser that was focused by hand, approaching the
// rough focus from `cameFrom`. Stars follow a hyperbola that reaches three times the in-focus HFR
// at 400 steps (so the right step size for 4 points per side is 100) and vanish beyond `lostAt`.
function measureFocuser(
  rig,
  { cameFrom = 'in', start = 30000, lostAt = 700, maxStep = 65535, focusAhead = 0 } = {}
) {
  const focuser = slackFocuser({ ...rig, start });
  focuser.move(cameFrom === 'in' ? start - 2000 : start + 2000);
  focuser.move(start);
  // `focusAhead`: the rough focus missed, focus lies that far outwards.
  const focus = focuser.drawtube + focusAhead;
  const width = 400 / Math.sqrt(8);
  const frame = () => {
    const d = Math.abs(focuser.drawtube - focus);
    return d > lostAt
      ? { hfr: 0, stars: 0 }
      : { hfr: 2 * Math.sqrt(1 + (d / width) ** 2), stars: 100 };
  };
  const settings = {
    AutoFocusInitialOffsetSteps: 4,
    BacklashCompensationModel: rig.model || 'OVERSHOOT',
    BacklashIn: rig.backlashIn || 0,
    BacklashOut: rig.backlashOut || 0,
  };

  const { direction, maxOffset } = advisor.probeLimits(start, maxStep);
  const preload = advisor.scanPreload(start, maxStep, direction);
  const at = (offset) => start + direction * offset;
  let last = null;
  const approach = (offset) => {
    if (last === null || offset < last) focuser.move(at(offset - preload));
    focuser.move(at(offset));
    last = offset;
  };
  const scan = [];
  let done;
  for (;;) {
    const next = advisor.nextScanProbe(scan, { maxOffset }, 4);
    if (next.action === 'fail') return { failure: next.reason };
    if (next.action === 'done') {
      done = next;
      break;
    }
    approach(next.offset);
    scan.push({ offset: next.offset, ...frame() });
  }
  const step = advisor.suggestStepSize(done.best, done.probes, 4);
  const focusOffset = Math.round(done.best.offset + (step.focus || 0));
  const p = advisor.backlashPlan(at(focusOffset), maxStep, step.stepSize, 4, direction);
  const fromFocus = (offset) => at(focusOffset) + direction * offset;
  focuser.move(fromFocus(p.calibration[0] - p.preload));
  const calibration = p.calibration.map((offset) => {
    focuser.move(fromFocus(offset));
    return { offset, ...frame() };
  });
  const calibrationFailure = advisor.backlashCalibrationFailure(calibration);
  if (calibrationFailure) return { stepSize: step.stepSize, failure: calibrationFailure };
  const walk = (from, startReading, sign) => {
    const taken = [];
    for (;;) {
      const next = advisor.backlashWalk(p, calibration, startReading, taken, sign);
      if (next.action !== 'step') return { ...next, offset: from + sign * taken.length * p.step };
      focuser.move(fromFocus(from + sign * (taken.length + 1) * p.step));
      taken.push(frame());
    }
  };
  const outermost = calibration[calibration.length - 1];
  const towards = walk(outermost.offset, advisor.backlashReader(calibration)(outermost), -1);
  if (towards.action === 'fail') return { stepSize: step.stepSize, failure: towards.reason };
  const away = walk(towards.offset, towards.end, 1);
  if (away.action === 'fail') return { stepSize: step.stepSize, failure: away.reason };
  return {
    stepSize: step.stepSize,
    frames: scan.length + calibration.length,
    ...advisor.suggestBacklash(
      settings,
      { towards: towards.remainder, away: away.remainder },
      direction,
      step.stepSize
    ),
  };
}

test('step size and backlash do not depend on how the rough focus was approached', () => {
  for (const backlash of [0, 50, 150, 400, 1000]) {
    for (const cameFrom of ['in', 'out']) {
      const result = measureFocuser({ backlash }, { cameFrom });
      const label = `backlash ${backlash}, rough focus from ${cameFrom}`;
      assert.equal(result.failure, undefined, `${label}: ${result.failure}`);
      within(result.stepSize, 100, 12);
      within(result.backlash, backlash, Math.max(10, backlash * 0.1));
    }
  }
});

test('the focus scan with NINA compensation already set', () => {
  // An overshoot that covers the backlash: every move ends the same way, nothing to change.
  const covered = measureFocuser({ backlash: 300, backlashOut: 400 }, { cameFrom: 'out' });
  within(covered.stepSize, 100, 12);
  assert.deepEqual(covered.changes, []);
  // Absolute compensation that is too small is topped up.
  const short = measureFocuser({
    backlash: 300,
    model: 'ABSOLUTE',
    backlashIn: 100,
    backlashOut: 100,
  });
  within(short.stepSize, 100, 12);
  for (const c of short.changes) within(c.value, 300, 30);
});

test('the focus scan copes with a missed rough focus and stars that fade right after focus', () => {
  // The docker simulator run: start 75 steps short of focus, stars gone about 45 steps beyond it,
  // which left only two usable frames past focus before the scan filled in.
  for (const backlash of [0, 300]) {
    const result = measureFocuser({ backlash }, { focusAhead: 750, lostAt: 450 });
    assert.equal(result.failure, undefined, `backlash ${backlash}: ${result.failure}`);
    within(result.backlash, backlash, Math.max(10, backlash * 0.1));
  }
});

test('the focus scan fails cleanly without stars', () => {
  assert.equal(measureFocuser({ backlash: 0 }, { lostAt: -1 }).failure, 'noReference');
});

test('ABSOLUTE compensation with In and Out apart blocks the measurement', () => {
  const { compensationBlocksMeasurement } = advisor;
  const absolute = (backlashIn, backlashOut) => ({
    BacklashCompensationModel: 'ABSOLUTE',
    BacklashIn: backlashIn,
    BacklashOut: backlashOut,
  });
  assert.equal(compensationBlocksMeasurement(absolute(0, 150)), 'lopsidedAbsolute');
  assert.equal(compensationBlocksMeasurement(absolute(150, 150)), null);
  assert.equal(compensationBlocksMeasurement(absolute(0, 0)), null);
  assert.equal(
    compensationBlocksMeasurement({ BacklashCompensationModel: 'OVERSHOOT', BacklashOut: 300 }),
    null
  );
  // Why: NINA's scale walks by the difference on every re-approach and the scan falls apart.
  const lopsided = measureFocuser({ backlash: 150, model: 'ABSOLUTE', backlashOut: 400 });
  assert.equal(lopsided.failure, 'lost');
  // With both values equal, set or not, the measurement works.
  const equal = measureFocuser({
    backlash: 150,
    model: 'ABSOLUTE',
    backlashIn: 80,
    backlashOut: 80,
  });
  within(equal.stepSize, 100, 12);
  for (const c of equal.changes) within(c.value, 150, 15);
});
