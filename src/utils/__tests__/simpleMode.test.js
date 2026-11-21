import test from 'node:test';
import assert from 'node:assert/strict';

const {
  SIMPLE_NAV_ITEMS,
  isHiddenInSimpleMode,
  simpleNavOrder,
  nightKey,
  isInNight,
  marksForNight,
  nightSteps,
  currentStepId,
  endNightActions,
  isWarmingUp,
} = await import('@/utils/simpleMode');

function snapshot(overrides = {}) {
  return {
    hasEquipment: true,
    allConnected: true,
    camera: { connected: true, canCool: true, coolerOn: false, temperature: 20, targetTemp: -10 },
    mount: { connected: true, parked: false, tracking: true, slewing: false },
    focuser: { connected: true, afRunning: false, afDoneTonight: false },
    guider: { inProfile: true, state: 'Stopped' },
    sequence: { running: false, targets: 0, totalSeconds: 0, remainingSeconds: 0 },
    tppaRunning: false,
    marks: {},
    ...overrides,
  };
}

const statusOf = (steps, id) => steps.find((s) => s.id === id)?.status;

test('simple navigation keeps only its own entries, in its own order', () => {
  assert.equal(isHiddenInSimpleMode('home'), false);
  assert.equal(isHiddenInSimpleMode('settings'), false);
  assert.equal(isHiddenInSimpleMode('mount'), true);
  assert.equal(isHiddenInSimpleMode('plugin-livestack'), true);
  assert.equal(isHiddenInSimpleMode('pins'), true);
  assert.equal(isHiddenInSimpleMode('monitoring'), true);
  // Targets come from the sky atlas, not the framing page
  assert.equal(isHiddenInSimpleMode('skyview'), false);
  assert.equal(isHiddenInSimpleMode('framing'), true);
  assert.deepEqual(
    SIMPLE_NAV_ITEMS.map(simpleNavOrder),
    SIMPLE_NAV_ITEMS.map((_, i) => i)
  );
  assert.equal(simpleNavOrder('dome'), 99);
});

test('a night runs from noon to noon', () => {
  assert.equal(nightKey(new Date(2026, 10, 20, 21, 0)), '2026-11-20');
  assert.equal(nightKey(new Date(2026, 10, 21, 3, 30)), '2026-11-20');
  assert.equal(nightKey(new Date(2026, 10, 21, 11, 59)), '2026-11-20');
  assert.equal(nightKey(new Date(2026, 10, 21, 12, 0)), '2026-11-21');
  // Month and year boundaries
  assert.equal(nightKey(new Date(2027, 0, 1, 2, 0)), '2026-12-31');
});

test('isInNight accepts ms, ISO strings and dates and rejects garbage', () => {
  const key = '2026-11-20';
  assert.equal(isInNight(new Date(2026, 10, 21, 1, 0), key), true);
  assert.equal(isInNight(new Date(2026, 10, 21, 1, 0).getTime(), key), true);
  assert.equal(isInNight(new Date(2026, 10, 21, 1, 0).toISOString(), key), true);
  assert.equal(isInNight(new Date(2026, 10, 19, 23, 0), key), false);
  assert.equal(isInNight('', key), false);
  assert.equal(isInNight(null, key), false);
  assert.equal(isInNight('not a date', key), false);
});

test('marks of another night are dropped', () => {
  assert.deepEqual(marksForNight({ night: '2026-11-20', marks: { polar: 'done' } }, '2026-11-20'), {
    polar: 'done',
  });
  assert.deepEqual(
    marksForNight({ night: '2026-11-19', marks: { polar: 'done' } }, '2026-11-20'),
    {}
  );
  assert.deepEqual(marksForNight(undefined, '2026-11-20'), {});
});

test('steps come in the order of a night and optional ones only when they apply', () => {
  const ids = nightSteps(snapshot()).map((s) => s.id);
  // Focus before polar alignment and target: both plate-solve, which needs sharp stars
  assert.deepEqual(ids, [
    'connect',
    'cool',
    'mount',
    'focus',
    'polar',
    'target',
    'guide',
    'capture',
    'end',
  ]);

  const noCoolNoGuide = nightSteps(
    snapshot({
      camera: { connected: true, canCool: false },
      guider: { inProfile: false, state: '' },
    })
  ).map((s) => s.id);
  assert.equal(noCoolNoGuide.includes('cool'), false);
  assert.equal(noCoolNoGuide.includes('guide'), false);
});

test('connect is done only with equipment and everything connected', () => {
  assert.equal(statusOf(nightSteps(snapshot()), 'connect'), 'done');
  assert.equal(statusOf(nightSteps(snapshot({ allConnected: false })), 'connect'), 'open');
  assert.equal(statusOf(nightSteps(snapshot({ hasEquipment: false })), 'connect'), 'open');
});

test('cooling is read from the camera', () => {
  const cam = (c) => snapshot({ camera: { connected: true, canCool: true, ...c } });
  assert.equal(statusOf(nightSteps(cam({ coolerOn: false })), 'cool'), 'open');
  const cooling = { coolerOn: true, targetTemp: -10 };
  assert.equal(statusOf(nightSteps(cam({ ...cooling, temperature: 20 })), 'cool'), 'running');
  assert.equal(statusOf(nightSteps(cam({ ...cooling, temperature: -9.2 })), 'cool'), 'done');
  // Cooler reported on without a known target never counts as cooled
  assert.equal(
    statusOf(nightSteps(cam({ coolerOn: true, temperature: -10, targetTemp: undefined })), 'cool'),
    'running'
  );
  // A skip holds until the cooler is switched on anyway
  assert.equal(statusOf(nightSteps({ ...cam({}), marks: { cool: 'skipped' } }), 'cool'), 'skipped');
});

test('a cooler holding another temperature is no cooling in progress', () => {
  const cam = (c) => snapshot({ camera: { connected: true, canCool: true, ...c } });
  // Fresh profile with the simulator: holds -6 °C, target -10 °C, no ramp
  const holding = {
    coolerOn: true,
    ramping: false,
    setPoint: -6,
    temperature: -6,
    targetTemp: -10,
  };
  assert.equal(statusOf(nightSteps(cam(holding)), 'cool'), 'open');
  // A ramp towards the target runs
  assert.equal(
    statusOf(nightSteps(cam({ ...holding, ramping: true, setPoint: -8 })), 'cool'),
    'running'
  );
  // Ramp done, setpoint at the target, sensor still catching up
  assert.equal(
    statusOf(nightSteps(cam({ ...holding, setPoint: -10, temperature: -7 })), 'cool'),
    'running'
  );
  // A skip stays a skip
  assert.equal(
    statusOf(nightSteps({ ...cam(holding), marks: { cool: 'skipped' } }), 'cool'),
    'skipped'
  );
});

test('a warm-up is no cooling in progress', () => {
  const cam = (c) => snapshot({ camera: { connected: true, canCool: true, ...c } });
  const warming = { coolerOn: true, warming: true, targetTemp: -10, temperature: -7 };
  // Seen after "end the night": "Cool the camera - running -7 °C -> -10 °C" came first again
  assert.equal(statusOf(nightSteps({ ...cam(warming), marks: { end: 'done' } }), 'cool'), 'done');
  assert.equal(statusOf(nightSteps(cam(warming)), 'cool'), 'open');
  assert.equal(
    statusOf(nightSteps({ ...cam(warming), marks: { cool: 'skipped', end: 'done' } }), 'cool'),
    'skipped'
  );
});

test('a warm-up is recognised from the camera store or the setpoint', () => {
  const at = (setPoint, temperature, coolingState = 'holding') => ({
    coolingState,
    setPoint,
    temperature,
    targetTemp: -10,
  });
  assert.equal(isWarmingUp(at(-10, -10, 'warming')), true);
  // After a reload the store has no latch: the setpoint leads the sensor upwards
  assert.equal(isWarmingUp(at(-4, -7)), true);
  assert.equal(isWarmingUp(at(-6, -7, 'cooling')), true);
  // A cool-down ramp: setpoint above the target, but below the sensor
  assert.equal(isWarmingUp(at(15, 18, 'cooling')), false);
  assert.equal(isWarmingUp(at(-10, -10)), false);
  assert.equal(isWarmingUp(at('NaN', -7)), false);
});

test('mount is ready when unparked and tracking', () => {
  const m = (mount) => statusOf(nightSteps(snapshot({ mount })), 'mount');
  assert.equal(m({ connected: true, parked: false, tracking: true }), 'done');
  assert.equal(m({ connected: true, parked: true, tracking: false }), 'open');
  assert.equal(m({ connected: true, parked: false, tracking: false }), 'open');
  assert.equal(m({ connected: true, parked: false, tracking: false, slewing: true }), 'running');
  assert.equal(m({ connected: false }), 'open');
});

test('manual steps follow their marks, live activity shows as running', () => {
  const steps = nightSteps(snapshot({ marks: { polar: 'done', target: 'skipped' } }));
  assert.equal(statusOf(steps, 'polar'), 'done');
  assert.equal(statusOf(steps, 'target'), 'skipped');
  assert.equal(statusOf(nightSteps(snapshot({ tppaRunning: true })), 'polar'), 'running');
  assert.equal(
    statusOf(nightSteps(snapshot({ tppaRunning: true, marks: { polar: 'done' } })), 'polar'),
    'done'
  );
});

test('focus is done after an autofocus tonight or a manual mark', () => {
  const f = (focuser, marks = {}) => statusOf(nightSteps(snapshot({ focuser, marks })), 'focus');
  assert.equal(f({ afRunning: true }), 'running');
  assert.equal(f({ afDoneTonight: true }), 'done');
  assert.equal(f({}, { focus: 'done' }), 'done');
  assert.equal(f({}), 'open');
  // A running autofocus beats an earlier skip
  assert.equal(f({ afRunning: true }, { focus: 'skipped' }), 'running');
});

test('guiding is read from the guider state', () => {
  const g = (state, marks = {}) =>
    statusOf(nightSteps(snapshot({ guider: { inProfile: true, state }, marks })), 'guide');
  assert.equal(g('Guiding'), 'done');
  assert.equal(g('Calibrating'), 'running');
  assert.equal(g('Stopped'), 'open');
  assert.equal(g('Stopped', { guide: 'skipped' }), 'skipped');
  assert.equal(g('Stopped', { guide: 'done' }), 'open');
});

test('capture runs with the sequence and is done once the plan is through', () => {
  const c = (sequence) => statusOf(nightSteps(snapshot({ sequence })), 'capture');
  assert.equal(
    c({ running: true, targets: 1, totalSeconds: 100, remainingSeconds: 100 }),
    'running'
  );
  assert.equal(c({ running: false, targets: 1, totalSeconds: 100, remainingSeconds: 0 }), 'done');
  assert.equal(c({ running: false, targets: 0, totalSeconds: 0, remainingSeconds: 0 }), 'open');
  assert.equal(c({ running: false, targets: 2, totalSeconds: 100, remainingSeconds: 50 }), 'open');
  // A target without any exposure is not "all pictures taken"
  assert.equal(c({ running: false, targets: 1, totalSeconds: 0, remainingSeconds: 0 }), 'open');
});

test('the current step is the first that is neither done nor skipped', () => {
  const steps = nightSteps(
    snapshot({
      camera: { connected: true, canCool: true, coolerOn: true, temperature: -10, targetTemp: -10 },
      marks: { polar: 'skipped' },
    })
  );
  // Focus is open and comes before polar alignment
  assert.equal(currentStepId(steps), 'focus');
  const focused = nightSteps(
    snapshot({
      camera: { connected: true, canCool: true, coolerOn: true, temperature: -10, targetTemp: -10 },
      marks: { focus: 'done', polar: 'skipped' },
    })
  );
  assert.equal(currentStepId(focused), 'target');
  assert.equal(currentStepId([{ id: 'a', status: 'done' }]), null);
  // Cooling runs by itself: the next open step is the one to work on
  const cooling = nightSteps(
    snapshot({
      camera: { connected: true, canCool: true, coolerOn: true, temperature: 15, targetTemp: -10 },
    })
  );
  assert.equal(statusOf(cooling, 'cool'), 'running');
  assert.equal(currentStepId(cooling), 'focus');
  // After the night was ended nothing asks for attention, not even the parked mount
  const ended = nightSteps(
    snapshot({
      mount: { connected: true, parked: true, tracking: false, slewing: false },
      marks: { end: 'done' },
    })
  );
  assert.equal(statusOf(ended, 'mount'), 'open');
  assert.equal(currentStepId(ended), null);
  // Nothing open: the running step is the one to watch
  assert.equal(
    currentStepId([
      { id: 'a', status: 'done' },
      { id: 'b', status: 'running' },
    ]),
    'b'
  );
});

test('end of night runs only what applies, sequence first and camera last', () => {
  assert.deepEqual(
    endNightActions({ sequenceRunning: true, guiding: true, mountUnparked: true, coolerOn: true }),
    ['stopSequence', 'stopGuiding', 'parkMount', 'warmCamera']
  );
  assert.deepEqual(
    endNightActions({
      sequenceRunning: false,
      guiding: false,
      mountUnparked: true,
      coolerOn: false,
    }),
    ['parkMount']
  );
  assert.deepEqual(endNightActions({}), []);
});

const { latestPicture, hfrSeries } = await import('@/utils/simpleMode');

const shot = (date, extra = {}) => ({ Date: date, HFR: 2.5, Stars: 120, ...extra });

test('the newest picture wins, preview or saved', () => {
  const history = [shot('2026-11-20T21:00:00Z'), shot('2026-11-20T21:05:00Z')];
  const t0505 = Date.parse('2026-11-20T21:05:00Z');

  assert.equal(latestPicture({ preview: null, history }).index, 1);
  assert.equal(
    latestPicture({ preview: { url: 'blob:x', atMs: t0505 + 60000 }, history }).source,
    'preview'
  );
  assert.equal(
    latestPicture({ preview: { url: 'blob:x', atMs: t0505 - 60000 }, history }).source,
    'history'
  );
  assert.equal(
    latestPicture({ preview: { url: 'blob:x', atMs: 1 }, history: null }).source,
    'preview'
  );
  assert.equal(latestPicture({ preview: null, history: [] }), null);
  // A deleted newest picture falls back to the one before
  assert.equal(latestPicture({ preview: null, history, isDeleted: (_, i) => i === 1 }).index, 0);
});

test('a preview and a saved picture of the same frame show the saved one', () => {
  const history = [shot('2026-11-20T21:05:00Z', { TargetName: 'M 31', ExposureTime: 10 })];
  const t0505 = Date.parse('2026-11-20T21:05:00Z');
  // A plan frame arrives as preview a few seconds after it was saved
  const same = latestPicture({ preview: { url: 'blob:x', atMs: t0505 + 3000 }, history });
  assert.equal(same.source, 'history');
  assert.equal(same.entry.TargetName, 'M 31');
  // The rig's clock is off by an hour; the arrival time on this device decides
  const arrived = Date.now();
  assert.equal(
    latestPicture({
      preview: { url: 'blob:x', atMs: arrived + 2000 },
      history,
      historyArrivedAtMs: arrived,
    }).source,
    'history'
  );
  assert.equal(
    latestPicture({
      preview: { url: 'blob:x', atMs: arrived + 120000 },
      history,
      historyArrivedAtMs: arrived,
    }).source,
    'preview'
  );
  // A test picture right after the last plan frame is still the test picture
  assert.equal(
    latestPicture({
      preview: { url: 'blob:x', atMs: arrived + 8000, own: true },
      history,
      historyArrivedAtMs: arrived,
    }).source,
    'preview'
  );
});

test('the HFR trend keeps the last pictures with a usable HFR, oldest first', () => {
  const history = [
    shot('a', { HFR: 3 }),
    shot('b', { HFR: 'NaN' }),
    shot('c', { HFR: 0 }),
    shot('d', { HFR: 2.4, Stars: 'NaN' }),
    shot('e', { HFR: 2.2 }),
  ];
  assert.deepEqual(
    hfrSeries(history).map((p) => p.hfr),
    [3, 2.4, 2.2]
  );
  assert.equal(hfrSeries(history)[1].stars, null);
  assert.deepEqual(
    hfrSeries(history, 2).map((p) => p.hfr),
    [2.4, 2.2]
  );
  assert.deepEqual(hfrSeries(null), []);
});

const {
  nightPhase,
  imagingActivity,
  rateGuiding,
  hfrHealth,
  histogramSummary,
  nightFrames,
  runningPlanPosition,
} = await import('@/utils/simpleMode');

test('nightPhase follows the capture and end steps', () => {
  const steps = (capture, end = 'open') => [
    { id: 'connect', status: 'done' },
    { id: 'capture', status: capture },
    { id: 'end', status: end },
  ];
  assert.equal(nightPhase(steps('open')), 'prepare');
  assert.equal(nightPhase(steps('running')), 'imaging');
  assert.equal(nightPhase(steps('done')), 'finished');
  // An ended night stays ended even if a plan is started again by mistake elsewhere
  assert.equal(nightPhase(steps('running', 'done')), 'ended');
});

test('imagingActivity puts what pauses the pictures first', () => {
  const base = { afRunning: false, slewing: false, guiderState: 'Guiding', exposing: true };
  assert.equal(imagingActivity(base), 'exposing');
  assert.equal(imagingActivity({ ...base, afRunning: true, slewing: true }), 'autofocus');
  assert.equal(imagingActivity({ ...base, slewing: true }), 'slewing');
  assert.equal(imagingActivity({ ...base, guiderState: 'Calibrating' }), 'calibrating');
  assert.equal(imagingActivity({ ...base, settling: true }), 'settling');
  assert.equal(imagingActivity({ ...base, exposing: false }), 'busy');
});

test('rateGuiding compares the RMS with the image scale', () => {
  assert.equal(rateGuiding(0.6, 1.5).level, 'good');
  assert.equal(rateGuiding(1.2, 1.5).level, 'ok');
  assert.equal(rateGuiding(2, 1.5).level, 'poor');
  assert.equal(rateGuiding(null, 1.5).level, null);
  assert.equal(rateGuiding(0.8, null).level, null);
});

test('hfrHealth compares the newest HFR with earlier frames of the same filter', () => {
  const frames = (filter, values) => values.map((HFR) => ({ HFR, Filter: filter, Stars: 100 }));
  const history = [
    ...frames('L', [2, 2, 2.1, 1.9]),
    ...frames('Ha', [3, 3]),
    ...frames('L', [2.6]),
  ];
  const health = hfrHealth(history);
  assert.equal(health.filter, 'L');
  assert.equal(health.baseline, 2);
  assert.ok(Math.abs(health.change - 0.3) < 1e-9);
  assert.equal(health.level, 'poor');

  // Too few earlier frames of that filter: value only, no verdict
  const fresh = hfrHealth([...frames('L', [2, 2, 2]), ...frames('Ha', [3])]);
  assert.equal(fresh.hfr, 3);
  assert.equal(fresh.level, null);

  assert.equal(hfrHealth([]), null);
  // Deleted frames do not count
  assert.equal(hfrHealth(frames('L', [2, 2, 2, 2.05]), (_, i) => i === 3).hfr, 2);
});

test('nightFrames counts the light frames of the night only', () => {
  const history = [
    { ImageType: 'LIGHT', Date: '2026-11-20T23:00:00', ExposureTime: 300, HFR: 2 },
    { ImageType: 'LIGHT', Date: '2026-11-21T02:00:00', ExposureTime: 300, HFR: 3 },
    { ImageType: 'SNAPSHOT', Date: '2026-11-21T02:10:00', ExposureTime: 5, HFR: 2 },
    { ImageType: 'LIGHT', Date: '2026-11-19T23:00:00', ExposureTime: 300, HFR: 2 },
  ];
  assert.deepEqual(nightFrames(history, '2026-11-20'), {
    frames: 2,
    seconds: 600,
    medianHfr: 2.5,
  });
});

test('runningPlanPosition prefers the running target and row', () => {
  const row = (status, remainingSeconds) => ({ status, enabled: true, remainingSeconds });
  const done = {
    container: { Status: 'FINISHED' },
    rows: [row('FINISHED', 0)],
    remainingSeconds: 0,
  };
  const running = {
    container: { Status: 'RUNNING', Name: 'M 31' },
    rows: [row('FINISHED', 0), row('RUNNING', 600), row('CREATED', 600)],
    remainingSeconds: 1200,
    endMs: 5,
  };
  const position = runningPlanPosition({ targets: [done, running] });
  assert.equal(position.container.Name, 'M 31');
  assert.equal(position.row, running.rows[1]);

  // Between items: the first row with frames left
  const between = {
    ...running,
    container: { Status: 'CREATED', Name: 'M 33' },
    rows: [row('FINISHED', 0), row('CREATED', 600)],
  };
  assert.equal(runningPlanPosition({ targets: [done, between] }).row, between.rows[1]);
  assert.equal(runningPlanPosition({ targets: [done] }), null);
});

test('histogramSummary counts the pixels at the extremes and zooms to the data', () => {
  const histogram = new Uint32Array(65536);
  histogram[100] = 3; // minimum
  for (let v = 180; v < 260; v++) histogram[v] = 1000; // sky background
  histogram[65535] = 42; // saturated stars
  const raw = {
    meta: { bitDepth: 16, stats: [{ min: 100, max: 65535, median: 220, mad: 20 }] },
    histograms: [histogram],
  };
  const summary = histogramSummary(raw, 40);
  assert.equal(summary.min, 100);
  assert.equal(summary.minCount, 3);
  assert.equal(summary.max, 65535);
  assert.equal(summary.maxCount, 42);
  assert.equal(summary.saturated, true);
  assert.equal(summary.bins.length, 40);
  // The view starts at the darkest data, not at 0, so the background is not one spike
  assert.ok(summary.lo >= 100 && summary.lo < 180);
  // ... and ends near the background, not at the saturated stars
  assert.ok(summary.hi < 1000);
  assert.ok(summary.bins.filter((b) => b > 0).length > 5);

  // 14-bit data below its own limit is not saturated
  const unsaturated = histogramSummary({
    meta: { bitDepth: 14, stats: [{ min: 100, max: 9000, median: 220, mad: 20 }] },
    histograms: [histogram],
  });
  assert.equal(unsaturated.saturated, false);

  assert.equal(histogramSummary({ meta: { stats: [] }, histograms: [] }), null);
});
