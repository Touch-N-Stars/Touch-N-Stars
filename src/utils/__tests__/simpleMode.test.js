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
    latestPicture({ preview: { url: 'blob:x', atMs: t0505 + 1000 }, history }).source,
    'preview'
  );
  assert.equal(
    latestPicture({ preview: { url: 'blob:x', atMs: t0505 - 1000 }, history }).source,
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
