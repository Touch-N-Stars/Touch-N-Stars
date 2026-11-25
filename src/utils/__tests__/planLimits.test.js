import test from 'node:test';
import assert from 'node:assert/strict';

const {
  darkFrom,
  darkUntil,
  defaultDarkness,
  clampEndDarkness,
  planCutOff,
  planLimitState,
  planWindow,
  siteFromProfile,
  targetLimit,
  targetLimitAt,
} = await import('@/utils/planLimits');
const {
  ALTITUDE_CONDITION_TYPE,
  COOL_CAMERA_TYPE,
  LOOP_CONDITION_TYPE,
  SMART_EXPOSURE_TYPE,
  START_AREA_TYPE,
  SUN_CONDITION_TYPE,
  WAIT_FOR_SUN_TYPE,
  summarizeTargets,
} = await import('@/utils/sequenceSimple');

const DSO = 'NINA.Sequencer.Container.DeepSkyObjectContainer';
const MUNICH = { lat: 48.1, lon: 11.6 };
// 2026-11-25, noon UTC; astronomical data: nautical dusk about 16:40 UTC, dawn about 05:22 UTC,
// from the sun's declination (-20.75) and transit (11:00.6 UTC) worked out by hand
const NOON = Date.UTC(2026, 10, 25, 12);
const hhmm = (ms) => new Date(ms).toISOString().slice(11, 16);
const minutesApart = (ms, iso) => Math.abs(ms - Date.parse(iso)) / 60000;

const sun = (Offset, Status = 'CREATED') => ({
  Id: 'sun',
  FullTypeName: SUN_CONDITION_TYPE,
  Status,
  Offset,
});
const altitude = (Offset, Status = 'CREATED') => ({
  Id: 'alt',
  FullTypeName: ALTITUDE_CONDITION_TYPE,
  Status,
  Offset,
});
const row = (Id, { time = 120, iterations, completed = 0, Status = 'CREATED' }) => ({
  Id,
  FullTypeName: SMART_EXPOSURE_TYPE,
  Status,
  Items: [{ FullTypeName: 'NINA.Sequencer.SequenceItem.Imaging.TakeExposure', ExposureTime: time }],
  Conditions: [
    { FullTypeName: LOOP_CONDITION_TYPE, Iterations: iterations, CompletedIterations: completed },
  ],
});
// M 42: rises in the evening, highest about 01:00 local time, low again towards the morning
const m42 = (Conditions, Items = [], Status = 'CREATED') => ({
  Id: 'dso',
  FullTypeName: DSO,
  Status,
  Name: 'M 42',
  Target: 'RA: 05:35:17; Dec: -5° 23\' 28"; Epoch: J2000; Position Angle: 0',
  Conditions,
  Items,
});
const tree = (startItems, targets) => [
  { GlobalTriggers: [] },
  { Id: 'start', FullTypeName: START_AREA_TYPE, Items: startItems },
  {
    Id: 'targets',
    FullTypeName: 'NINA.Sequencer.Container.TargetAreaContainer',
    Items: targets,
  },
];
const wait = (Offset, Status = 'CREATED') => ({
  Id: 'wait',
  FullTypeName: WAIT_FOR_SUN_TYPE,
  Status,
  Offset,
});

test('dusk and dawn of a site', () => {
  const dusk = darkFrom(NOON, -12, MUNICH);
  assert.ok(minutesApart(dusk, '2026-11-25T16:40:00Z') < 4, hhmm(dusk));
  const dawn = darkUntil(dusk, -12, MUNICH);
  assert.ok(minutesApart(dawn, '2026-11-26T05:22:00Z') < 4, hhmm(dawn));
  // Already dark
  assert.equal(darkFrom(dusk + 3600000, -12, MUNICH), dusk + 3600000);
});

test('the default darkness follows bright summer nights', () => {
  const june = Date.UTC(2026, 5, 21, 12);
  assert.equal(defaultDarkness(NOON, MUNICH), -12);
  assert.equal(defaultDarkness(june, MUNICH), -12);
  assert.equal(defaultDarkness(june, { lat: 57, lon: 10 }), -9);
  assert.equal(defaultDarkness(june, { lat: 70, lon: 20 }), null);
  assert.equal(defaultDarkness(june, null), -12);
});

test('a site needs both coordinates', () => {
  assert.equal(siteFromProfile(null), null);
  assert.equal(siteFromProfile({ AstrometrySettings: { Latitude: 48 } }), null);
  assert.deepEqual(siteFromProfile({ AstrometrySettings: { Latitude: '48.1', Longitude: 11.6 } }), {
    lat: 48.1,
    lon: 11.6,
  });
});

test('a target ends at dawn or when it sets below its altitude, whichever comes first', () => {
  const evening = Date.UTC(2026, 10, 25, 18);
  const dawn = darkUntil(evening, -12, MUNICH);
  assert.equal(targetLimitAt(m42([sun(-12)]), evening, MUNICH), dawn);
  // M 42 sinks below 20 degrees well before dawn; while it rises through 20 it is not cut off
  const low = targetLimitAt(m42([sun(-12), altitude(20)]), evening, MUNICH);
  assert.ok(low > evening + 6 * 3600000 && low < dawn, hhmm(low));
  // In daylight, and setting below the limit: at once
  assert.equal(targetLimitAt(m42([sun(-12)]), NOON, MUNICH), NOON);
  assert.equal(targetLimitAt(m42([altitude(20)]), low + 60000, MUNICH), low + 60000);
  // ... with the reason
  const why = (conditions, ms) => targetLimit(m42(conditions), ms, MUNICH)?.by;
  assert.equal(why([sun(-12), altitude(20)], NOON), 'light');
  assert.equal(why([sun(-12), altitude(20)], evening), 'low');
  assert.equal(why([], NOON), undefined);
  // Switched off, or unknown site
  assert.equal(targetLimitAt(m42([sun(-12, 'DISABLED')]), NOON, MUNICH), null);
  assert.equal(targetLimitAt(m42([sun(-12)]), NOON, null), null);
  // Circumpolar and never below the limit
  const polar = { ...m42([altitude(20)]), Target: 'RA: 02:31:00; Dec: 89° 15\' 00"; Epoch: J2000' };
  assert.equal(targetLimitAt(polar, NOON, MUNICH), null);
});

test('the window starts at dusk while the wait is still to come', () => {
  const at = (item, extra = {}) =>
    planWindow(tree([item], []), { nowMs: NOON, site: MUNICH, ...extra });
  const dusk = darkFrom(NOON, -12, MUNICH);
  assert.equal(at(wait(-12)).notBeforeMs, dusk);
  assert.equal(at(wait(-12, 'RUNNING'), { running: true }).notBeforeMs, dusk);
  // Through in this run; a plan that does not run waits with its next start
  assert.equal(at(wait(-12, 'FINISHED'), { running: true }).notBeforeMs, null);
  assert.equal(at(wait(-12, 'FINISHED')).notBeforeMs, dusk);
  assert.equal(at(wait(-12, 'DISABLED')).notBeforeMs, null);
  assert.equal(at({ FullTypeName: COOL_CAMERA_TYPE }).notBeforeMs, null);
  // Already dark, no site
  assert.equal(at(wait(-12), { nowMs: dusk + 60000 }).notBeforeMs, null);
  assert.equal(at(wait(-12), { site: null }).notBeforeMs, null);
  // When it would get dark, also for a plan that does not wait
  assert.equal(at(wait(-12, 'DISABLED')).darkMs, dusk);
  assert.equal(at({ FullTypeName: COOL_CAMERA_TYPE }).darkMs, dusk);
  assert.equal(at(wait(-12), { nowMs: dusk + 60000 }).darkMs, null);
  const white = planWindow(tree([wait(-12)], []), {
    nowMs: Date.UTC(2026, 5, 21, 12),
    site: { lat: 60, lon: 10 },
  });
  assert.deepEqual([white.notBeforeMs, white.noDarkness], [null, true]);
});

test('the summary starts at dusk, stops at dawn and counts what fits', () => {
  // 600 x 125 s = 20 h 50 min do not fit into one night
  const plan = tree([wait(-12)], [m42([sun(-12)], [row('l', { iterations: 600 })])]);
  const times = planWindow(plan, { nowMs: NOON, site: MUNICH });
  const summary = summarizeTargets(plan, { overheadSeconds: 5, nowMs: NOON, ...times });
  const dusk = darkFrom(NOON, -12, MUNICH);
  const dawn = darkUntil(dusk, -12, MUNICH);
  const [target] = summary.targets;
  assert.deepEqual([target.startMs, target.endMs, target.limitMs], [dusk, dawn, dawn]);
  assert.equal(summary.framesLeft, 600);
  assert.equal(summary.framesFit, Math.floor((dawn - dusk) / 125000));
  assert.equal(summary.endMs, dawn);
});

test('a plan is cut off when none of its open targets may run now', () => {
  const night = Date.UTC(2026, 10, 25, 22);
  const open = m42(
    [sun(-12)],
    [row('l', { iterations: 60, completed: 43, Status: 'FINISHED' })],
    'FINISHED'
  );
  const through = m42([], [row('r', { iterations: 5, completed: 5, Status: 'FINISHED' })]);
  const cut = (targets, nowMs) =>
    planCutOff(summarizeTargets(tree([], targets), { resumable: true }), nowMs, MUNICH);
  assert.equal(cut([open, through], NOON), true);
  assert.equal(cut([open], night), false);
  assert.equal(cut([through], NOON), false);
  // Not started yet, or stopped by the user
  assert.equal(cut([{ ...open, Status: 'CREATED' }], NOON), false);
  // One target without a limit could still run
  assert.equal(cut([open, m42([], [row('g', { iterations: 5 })], 'FINISHED')], NOON), false);
});

test('the switches show what holds for all targets and what the user declined', () => {
  const a = m42([sun(-15), altitude(25)]);
  const bare = m42([]);
  const state = (startItems, targets) => planLimitState(tree(startItems, targets), targets);
  assert.deepEqual(state([wait(-12)], [a]), {
    waits: true,
    stopsAtDawn: true,
    stopsWhenLow: true,
    startDarkness: -12,
    endDarkness: -15,
    minAltitude: 25,
    dawnDeclined: false,
    lowDeclined: false,
  });
  const mixed = state([wait(-9, 'DISABLED')], [a, bare]);
  assert.deepEqual(
    [mixed.waits, mixed.stopsAtDawn, mixed.startDarkness, mixed.endDarkness, mixed.dawnDeclined],
    [false, false, -9, -15, false]
  );
  const off = state([], [m42([sun(-12, 'DISABLED'), altitude(20, 'DISABLED')]), bare]);
  assert.deepEqual(
    [off.dawnDeclined, off.lowDeclined, off.startDarkness, off.endDarkness],
    [true, true, null, -12]
  );
  assert.equal(state([], []).stopsAtDawn, false);
});

test('a target never ends darker than the plan starts', () => {
  assert.equal(clampEndDarkness(-12, -6, true), -6);
  assert.equal(clampEndDarkness(-6, -12, true), -6);
  // Without the wait the start does not matter
  assert.equal(clampEndDarkness(-12, -6, false), -12);
  assert.equal(clampEndDarkness(-12, null, true), -12);
});
