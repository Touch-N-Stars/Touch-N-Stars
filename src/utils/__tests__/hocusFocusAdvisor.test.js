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

test('focusSamples returns the newest and the sharpest new frame with its focuser position', () => {
  const { focusSamples, historyEntryId } = advisor;
  const old = { Id: 'a', HFR: 1.1, FocuserPosition: 900, Stars: 80 };
  const history = [
    old,
    { Id: 'b', HFR: 2.4, FocuserPosition: 1000, Stars: 40 },
    { Id: 'c', HFR: 1.6, FocuserPosition: 1100, Stars: 70 },
    { Id: 'd', HFR: 1.9, FocuserPosition: 1150, Stars: 60 },
    { Id: 'e', HFR: 0, FocuserPosition: 1200 },
    { Id: 'f', HFR: 1.2, FocuserPosition: null },
  ];
  assert.deepEqual(focusSamples(history, new Set([historyEntryId(old)])), {
    latest: { hfr: 1.9, position: 1150, stars: 60 },
    best: { hfr: 1.6, position: 1100, stars: 70 },
  });
  assert.deepEqual(focusSamples([old], new Set(['a'])), { latest: null, best: null });
  assert.deepEqual(focusSamples(null), { latest: null, best: null });
  assert.equal(historyEntryId({ Date: 'x', Filename: 'y.fits' }), 'x|y.fits');
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
