import test from 'node:test';
import assert from 'node:assert/strict';

const {
  FLIP_TEST_LEAD_MINUTES,
  altitudeDeg,
  analyzeFlipLog,
  buttonForSkyMove,
  checkStartPosition,
  comparePierSides,
  flipTriggerStatus,
  hourAngleHours,
  isSequenceRunning,
  observedAxisSense,
  planFlipTest,
  suggestSkyMoves,
} = await import('@/utils/meridianFlipDayTest');

const LST_HOURS = 6;
const LAT_DEG = 48;
const FEW = { PauseTimeBeforeMeridian: 0, MinutesAfterMeridian: 5, MaxMinutesAfterMeridian: 15 };

test('altitudeDeg: on the meridian the altitude is 90 - |lat - dec|', () => {
  assert.ok(Math.abs(altitudeDeg(0, 20, 48) - 62) < 1e-9);
  assert.ok(Math.abs(altitudeDeg(0, 48, 48) - 90) < 1e-9);
});

test('planFlipTest: short exposures flip one exposure after the earliest time', () => {
  const plan = planFlipTest(FEW, 60);
  assert.equal(plan.leadMinutes, FLIP_TEST_LEAD_MINUTES);
  assert.equal(plan.latestFlipMinutes, 6);
});

test('planFlipTest: long exposures are capped at the latest time', () => {
  assert.equal(planFlipTest(FEW, 1200).latestFlipMinutes, 15);
});

test('planFlipTest: a pause does not push the start point east and flips at the earliest time', () => {
  const plan = planFlipTest(
    { PauseTimeBeforeMeridian: 2, MinutesAfterMeridian: 0, MaxMinutesAfterMeridian: 2 },
    300
  );
  assert.equal(plan.leadMinutes, FLIP_TEST_LEAD_MINUTES);
  assert.equal(plan.latestFlipMinutes, 0);
});

test('planFlipTest: the wait loop outlasts the latest flip', () => {
  const plan = planFlipTest(FEW, 300);
  assert.ok(plan.waitCount * 5 > plan.leadMinutes + 15 + 5);
});

test('planFlipTest: duration and wait loop follow the real distance to the meridian', () => {
  const near = planFlipTest(FEW, 300);
  const far = planFlipTest(FEW, 300, 30);
  assert.equal(far.expectedMinutes - near.expectedMinutes, 30 - FLIP_TEST_LEAD_MINUTES);
  assert.ok(far.waitCount * 5 > 30 + 15 + 5);
  // Closer than the lead counts as the lead.
  assert.equal(planFlipTest(FEW, 300, 1).expectedMinutes, near.expectedMinutes);
});

test('hourAngleHours is negative east of the meridian and wraps around 0h', () => {
  assert.ok(Math.abs(hourAngleHours(12, 12.25) + 0.25) < 1e-9);
  assert.ok(Math.abs(hourAngleHours(0.1, 23.9) - 0.2) < 1e-9);
  assert.ok(Math.abs(hourAngleHours(23.9, 0.1) + 0.2) < 1e-9);
});

// Scope 10 min east of the meridian at dec 50, lat 48 (near the zenith), sun far away.
const START = {
  lstHours: LST_HOURS,
  raHours: LST_HOURS + 10 / 60,
  decDeg: 50,
  latDeg: LAT_DEG,
  sideOfPier: 'pierWest',
  sun: { raDeg: (LST_HOURS - 3) * 15, decDeg: -12 },
  plan: planFlipTest(FEW, 300),
};

test('checkStartPosition: east of the meridian, counterweight down, clear sky is ready', () => {
  const result = checkStartPosition(START);
  assert.ok(Math.abs(result.minutesToMeridian - 10) < 1e-6);
  assert.deepEqual(
    [result.leadOk, result.pierOk, result.altitudeOk, result.sunOk, result.ready],
    [true, true, true, true, true]
  );
});

test('checkStartPosition: the post-flip side blocks the start', () => {
  // What an OnStep with preferred pier side East does after a goto near the meridian.
  const result = checkStartPosition({ ...START, sideOfPier: 'pierEast' });
  assert.equal(result.pierOk, false);
  assert.equal(result.ready, false);
});

test('checkStartPosition: an unknown side of pier does not block', () => {
  const result = checkStartPosition({ ...START, sideOfPier: 'pierUnknown' });
  assert.equal(result.pierOk, null);
  assert.equal(result.ready, true);
});

test('checkStartPosition: the lead counts to the earliest flip, not to the meridian', () => {
  // FEW flips 5 min after the meridian: 3 min past it the flip is still 2 min away.
  const past = checkStartPosition({ ...START, raHours: LST_HOURS - 3 / 60 });
  assert.ok(past.minutesToMeridian < 0);
  assert.ok(Math.abs(past.minutesToFlip - 2) < 1e-6);
  assert.equal(past.ready, true);
  // Half a minute before the flip leaves no time to load the sequence.
  const late = checkStartPosition({ ...START, raHours: LST_HOURS - 4.5 / 60 });
  assert.equal(late.leadOk, false);
  assert.equal(late.ready, false);
});

test('checkStartPosition: without minutes after the meridian the lead ends before it', () => {
  const plan = planFlipTest({ ...FEW, MinutesAfterMeridian: 0 }, 300);
  assert.equal(checkStartPosition({ ...START, plan, raHours: LST_HOURS + 2 / 60 }).leadOk, true);
  assert.equal(checkStartPosition({ ...START, plan, raHours: LST_HOURS + 0.5 / 60 }).leadOk, false);
});

test('planFlipTest: a start past the meridian shortens the expected duration', () => {
  assert.ok(planFlipTest(FEW, 60, -3).expectedMinutes < planFlipTest(FEW, 60, 5).expectedMinutes);
});

test('checkStartPosition: low altitude and the sun on the path block the start', () => {
  assert.equal(checkStartPosition({ ...START, decDeg: -30 }).altitudeOk, false);
  // Sun on the meridian a little south of the path, as around noon.
  const sun = { raDeg: LST_HOURS * 15, decDeg: 30 };
  assert.equal(checkStartPosition({ ...START, sun }).sunOk, false);
});

test('checkStartPosition returns null without mount time, site or sun position', () => {
  assert.equal(checkStartPosition({ ...START, lstHours: NaN }), null);
  assert.equal(checkStartPosition({ ...START, latDeg: undefined }), null);
  assert.equal(checkStartPosition({ ...START, sun: null }), null);
});

const suggest = (overrides, check = {}) =>
  suggestSkyMoves({
    check: {
      leadOk: true,
      pierOk: true,
      altitudeOk: true,
      sunOk: true,
      minutesToFlip: 8,
      ...check,
    },
    decDeg: 50,
    latDeg: LAT_DEG,
    sunDecDeg: -12,
    leadMinutes: 2,
    ...overrides,
  });

test('suggestSkyMoves: nothing to do at a good start point', () => {
  assert.deepEqual(suggest({}), { ra: null, dec: null, decReason: null, nearPole: false });
});

test('suggestSkyMoves: east when too close or past, west when far before the meridian', () => {
  assert.equal(suggest({}, { leadOk: false, minutesToFlip: -3 }).ra, 'east');
  assert.equal(suggest({}, { minutesToFlip: 120 }).ra, 'west');
});

test('suggestSkyMoves: at the pole only a hint, no Dec arrow - RA alone reaches the flip', () => {
  const atPole = suggest({ decDeg: 90 }, { minutesToFlip: 120 });
  assert.equal(atPole.dec, null);
  assert.equal(atPole.nearPole, true);
  assert.equal(atPole.ra, 'west');
  assert.equal(suggest({ decDeg: -89, latDeg: -33 }).nearPole, true);
});

test('suggestSkyMoves: Dec towards the zenith when low, away from the sun when close', () => {
  assert.equal(suggest({ decDeg: -20 }, { altitudeOk: false }).dec, 'north');
  assert.equal(suggest({ decDeg: 30, sunDecDeg: 20 }, { sunOk: false }).dec, 'north');
  assert.equal(suggest({ decDeg: 10, sunDecDeg: 20 }, { sunOk: false }).dec, 'south');
});

test('suggestSkyMoves: no arrows on the post-flip side', () => {
  assert.equal(suggest({}, { pierOk: false, leadOk: false }).ra, null);
  assert.equal(suggest({}, { pierOk: false, decDeg: 89 }).dec, null);
});

test('observedAxisSense: east lowers the hour angle against the tracking drift', () => {
  const before = { timeMs: 0, haHours: -1, decDeg: 40 };
  // 2 s of tracking alone: no usable signal.
  assert.equal(
    observedAxisSense(before, { timeMs: 2000, haHours: -1 + 2 / 3600, decDeg: 40 }, 'east'),
    null
  );
  const east = { timeMs: 2000, haHours: -1.05, decDeg: 40 };
  assert.equal(observedAxisSense(before, east, 'east'), 1);
  assert.equal(observedAxisSense(before, east, 'west'), -1);
});

test('observedAxisSense: Dec sense, and no verdict near the pole', () => {
  const before = { timeMs: 0, haHours: 0, decDeg: 40 };
  assert.equal(observedAxisSense(before, { ...before, decDeg: 41 }, 'north'), 1);
  assert.equal(observedAxisSense(before, { ...before, decDeg: 41 }, 'south'), -1);
  const pole = { timeMs: 0, haHours: 0, decDeg: 85 };
  assert.equal(observedAxisSense(pole, { ...pole, decDeg: 84 }, 'south'), null);
});

test('buttonForSkyMove swaps the button for a reversed axis', () => {
  assert.equal(buttonForSkyMove('east', 1), 'east');
  assert.equal(buttonForSkyMove('east', -1), 'west');
  assert.equal(buttonForSkyMove('north', -1), 'south');
  assert.equal(buttonForSkyMove(null, 1), null);
});

test('isSequenceRunning finds a running item anywhere in the state', () => {
  const idle = [{ GlobalTriggers: [{ Status: 'CREATED' }] }, { Items: [{ Status: 'FINISHED' }] }];
  assert.equal(isSequenceRunning(idle), false);
  const running = [{ Items: [{ Items: [{ Status: 'RUNNING' }] }] }];
  assert.equal(isSequenceRunning(running), true);
  assert.equal(isSequenceRunning(null), false);
});

test('flipTriggerStatus reads the global trigger of the test sequence', () => {
  const state = [
    { GlobalTriggers: [{ Name: 'Meridianflip_Trigger', Status: 'RUNNING' }] },
    { Items: [], Name: 'Start_Container' },
  ];
  assert.equal(flipTriggerStatus(state), 'RUNNING');
  assert.equal(flipTriggerStatus([{ GlobalTriggers: [] }]), null);
  assert.equal(flipTriggerStatus(null), null);
});

// Recorded from NINA (PINS, INDI telescope simulator, no camera), newest first as the
// plugin's /api/logs returns it.
const FAILED_FLIP_LOG = [
  ['20:01:48.315', 'Meridian Flip - Re-enable Tracking after meridian flip error'],
  ['20:01:48.306', 'Meridian Flip - Resuming Autoguider'],
  ['20:01:48.300', 'Meridian Flip - Resuming Autoguider after meridian flip error'],
  ['20:01:48.223', 'Meridian Flip - Recenter after meridian flip'],
  ['20:01:19.198', 'Meridian Flip - Settling scope for 30'],
  ['20:00:40.861', 'Meridian Flip - Scope will flip to coordinates RA: 20:58:24'],
  ['20:00:39.818', 'Meridian Flip - Initializing Meridian Flip.'],
  ['19:52:17.692', 'Meridian Flip - Telescope is not tracking. Skip flip evaluation'],
].map(([time, message]) => ({ timestamp: `2026-10-24T${time}`, message }));

test('analyzeFlipLog names the step that failed', () => {
  assert.deepEqual(analyzeFlipLog(FAILED_FLIP_LOG), {
    found: true,
    failed: true,
    failedStep: 'recenter',
  });
});

test('analyzeFlipLog reports a clean flip and an absent one', () => {
  const clean = FAILED_FLIP_LOG.filter((e) => !/error|Recenter|Autoguider/.test(e.message));
  assert.deepEqual(analyzeFlipLog(clean), { found: true, failed: false, failedStep: null });
  assert.deepEqual(analyzeFlipLog([]), { found: false, failed: false, failedStep: null });
  assert.deepEqual(analyzeFlipLog(null), { found: false, failed: false, failedStep: null });
});

test('analyzeFlipLog only looks at the most recent flip', () => {
  const older = FAILED_FLIP_LOG.map((e) => ({
    ...e,
    timestamp: e.timestamp.replace('2026-10-24', '2026-10-23'),
  }));
  const newer = FAILED_FLIP_LOG.filter((e) => !/error|Recenter|Autoguider/.test(e.message));
  assert.equal(analyzeFlipLog([...older, ...newer]).failed, false);
});

test('comparePierSides', () => {
  assert.equal(comparePierSides('pierWest', 'pierEast'), 'changed');
  assert.equal(comparePierSides('pierWest', 'pierWest'), 'unchanged');
  assert.equal(comparePierSides('pierUnknown', 'pierEast'), 'unknown');
  assert.equal(comparePierSides(undefined, undefined), 'unknown');
});
