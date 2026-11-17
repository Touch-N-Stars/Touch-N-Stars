import test from 'node:test';
import assert from 'node:assert/strict';

const {
  exposureRow,
  summarizeDsoContainer,
  summarizeTargets,
  findAreaContainer,
  enabledItemNames,
  formatDuration,
  findByType,
  isActive,
  collectSmartExposureDithers,
  slewMode,
  insertionPoint,
  binningLabel,
  formatClock,
  TARGET_ORDER,
  SLEW_TYPE,
  CENTER_TYPE,
  CENTER_AND_ROTATE_TYPE,
  START_GUIDING_TYPE,
  RUN_AUTOFOCUS_TYPE,
  SMART_EXPOSURE_TYPE,
  TAKE_MANY_EXPOSURES_TYPE,
  START_AREA_TYPE,
  MERIDIAN_FLIP_TRIGGER_TYPE,
  DITHER_AFTER_EXPOSURES_TYPE,
  COOL_CAMERA_TYPE,
} = await import('@/utils/sequenceSimple');

const DSO = 'NINA.Sequencer.Container.DeepSkyObjectContainer';

function smart(id, { filter, time, iterations, completed = 0, status = 'CREATED' }) {
  return {
    Id: id,
    FullTypeName: SMART_EXPOSURE_TYPE,
    Status: status,
    Items: [
      {
        Id: `${id}-f`,
        FullTypeName: 'NINA.Sequencer.SequenceItem.FilterWheel.SwitchFilter',
        ComboBoxText: filter,
      },
      {
        Id: `${id}-e`,
        FullTypeName: 'NINA.Sequencer.SequenceItem.Imaging.TakeExposure',
        ExposureTime: time,
        Gain: 100,
      },
    ],
    Conditions: [
      {
        Id: `${id}-l`,
        FullTypeName: 'NINA.Sequencer.Conditions.LoopCondition',
        Iterations: iterations,
        CompletedIterations: completed,
      },
    ],
  };
}

function takeMany(id, { time, iterations, completed = 0 }) {
  return {
    Id: id,
    FullTypeName: TAKE_MANY_EXPOSURES_TYPE,
    Status: 'CREATED',
    Items: [{ Id: `${id}-e`, ExposureTime: time, Gain: 0 }],
    Conditions: [{ Id: `${id}-l`, Iterations: iterations, CompletedIterations: completed }],
  };
}

test('exposureRow reads filter, time and progress of a Smart Exposure', () => {
  const row = exposureRow(smart('s', { filter: 'Ha', time: 300, iterations: 20, completed: 5 }));
  assert.equal(row.filterName, 'Ha');
  assert.equal(row.exposureTime, 300);
  assert.equal(row.filterItem.Id, 's-f');
  assert.equal(row.exposureItem.Id, 's-e');
  assert.equal(row.loopCondition.Id, 's-l');
  assert.equal(row.totalSeconds, 6000);
  assert.equal(row.remainingSeconds, 4500);
});

test('exposureRow reads a Take Many Exposures without a filter switch', () => {
  const row = exposureRow(takeMany('t', { time: 60, iterations: 10, completed: 2 }));
  assert.equal(row.filterItem, null);
  assert.equal(row.exposureItem.Id, 't-e');
  assert.equal(row.remainingSeconds, 480);
});

test('exposureRow ignores every other item type', () => {
  assert.equal(exposureRow({ Id: 'af', FullTypeName: 'NINA.Autofocus.RunAutofocus' }), null);
  assert.equal(exposureRow(null), null);
});

test('finished and disabled rows have no remaining time', () => {
  const finished = exposureRow(
    smart('a', { filter: 'L', time: 60, iterations: 10, status: 'FINISHED' })
  );
  const disabled = exposureRow(
    smart('b', { filter: 'L', time: 60, iterations: 10, status: 'DISABLED' })
  );
  assert.equal(finished.remainingSeconds, 0);
  assert.equal(finished.totalSeconds, 600);
  assert.equal(disabled.remainingSeconds, 0);
  assert.equal(disabled.totalSeconds, 0);
});

test('completed iterations above the target do not produce negative time', () => {
  const row = exposureRow(smart('a', { filter: 'L', time: 60, iterations: 5, completed: 9 }));
  assert.equal(row.completed, 5);
  assert.equal(row.remainingSeconds, 0);
});

test('summarizeDsoContainer separates exposure rows from other steps', () => {
  const container = {
    Id: 'dso',
    FullTypeName: DSO,
    Items: [
      { Id: 'center', FullTypeName: 'NINA.Sequencer.SequenceItem.Platesolving.Center' },
      { Id: 'wait', FullTypeName: 'NINA.Sequencer.SequenceItem.Utility.WaitForAltitude' },
      smart('r', { filter: 'R', time: 120, iterations: 10 }),
      smart('g', { filter: 'G', time: 120, iterations: 10, completed: 10 }),
      { Id: 'nested', FullTypeName: 'NINA.Sequencer.Container.SequentialContainer', Items: [] },
    ],
  };
  const summary = summarizeDsoContainer(container);
  assert.deepEqual(
    summary.rows.map((r) => r.id),
    ['r', 'g']
  );
  // Center is shown as a switch, so it is not an "other" step.
  assert.deepEqual(
    summary.otherItems.map((i) => i.Id),
    ['wait', 'nested']
  );
  assert.equal(summary.totalSeconds, 2400);
  assert.equal(summary.remainingSeconds, 1200);
});

test('summarizeTargets lists every DSO container in order and adds up the time', () => {
  const tree = [
    { Id: 'root', GlobalTriggers: [] },
    { Id: 'start', FullTypeName: START_AREA_TYPE, Items: [] },
    {
      Id: 'targets',
      FullTypeName: 'NINA.Sequencer.Container.TargetAreaContainer',
      Items: [
        {
          Id: 'm31',
          FullTypeName: DSO,
          Items: [smart('a', { filter: 'L', time: 60, iterations: 30 })],
        },
        { Id: 'm42', FullTypeName: DSO, Items: [takeMany('b', { time: 30, iterations: 20 })] },
      ],
    },
  ];
  const summary = summarizeTargets(tree);
  assert.deepEqual(
    summary.targets.map((t) => t.container.Id),
    ['m31', 'm42']
  );
  assert.equal(summary.totalSeconds, 2400);
  assert.equal(summary.remainingSeconds, 2400);
});

test('findAreaContainer and enabledItemNames build the area summary line', () => {
  const tree = [
    { Id: 'root' },
    {
      Id: 'start',
      FullTypeName: START_AREA_TYPE,
      Items: [
        { Id: 'c', Name: 'Cool Camera', Status: 'CREATED' },
        { Id: 'u', FullTypeName: 'NINA.Sequencer.SequenceItem.Telescope.UnparkScope' },
        { Id: 'x', Name: 'Disabled', Status: 'DISABLED' },
      ],
    },
  ];
  const start = findAreaContainer(tree, START_AREA_TYPE);
  assert.equal(start.Id, 'start');
  assert.deepEqual(enabledItemNames(start.Items), ['Cool Camera', 'Unpark Scope']);
  assert.equal(findAreaContainer(tree, 'Missing'), null);
});

test('formatDuration', () => {
  assert.equal(formatDuration(0), '0 s');
  assert.equal(formatDuration(45), '45 s');
  assert.equal(formatDuration(61), '2 min');
  assert.equal(formatDuration(3600), '1 h 00 min');
  assert.equal(formatDuration(7500), '2 h 05 min');
  assert.equal(formatDuration(undefined), '0 s');
});

test('enabledItemNames leaves out the types shown as switches', () => {
  const items = [
    { Id: 'mf', Name: 'Meridian Flip', FullTypeName: MERIDIAN_FLIP_TRIGGER_TYPE },
    { Id: 'af', Name: 'AF after HFR' },
  ];
  assert.deepEqual(enabledItemNames(items, [MERIDIAN_FLIP_TRIGGER_TYPE]), ['AF after HFR']);
});

test('findByType and isActive', () => {
  const items = [
    { Id: 'a', FullTypeName: 'Other' },
    { Id: 'c', FullTypeName: COOL_CAMERA_TYPE, Status: 'DISABLED' },
  ];
  assert.equal(findByType(items, COOL_CAMERA_TYPE).Id, 'c');
  assert.equal(findByType(items, 'Missing'), null);
  assert.equal(findByType(undefined, COOL_CAMERA_TYPE), null);
  assert.equal(isActive(items[1]), false);
  assert.equal(isActive({ Status: 'CREATED' }), true);
  assert.equal(isActive(null), false);
});

test('collectSmartExposureDithers finds only Smart Exposure triggers that still dither', () => {
  const withDither = (id, after) => ({
    Id: id,
    FullTypeName: SMART_EXPOSURE_TYPE,
    Triggers: [{ Id: `${id}-d`, FullTypeName: DITHER_AFTER_EXPOSURES_TYPE, AfterExposures: after }],
  });
  const tree = [
    {
      Id: 'root',
      GlobalTriggers: [{ Id: 'g', FullTypeName: DITHER_AFTER_EXPOSURES_TYPE, AfterExposures: 1 }],
    },
    {
      Id: 'targets',
      Items: [
        {
          Id: 'dso',
          FullTypeName: DSO,
          Items: [withDither('a', 1), withDither('b', 0), withDither('c', 3)],
        },
      ],
    },
  ];
  assert.deepEqual(
    collectSmartExposureDithers(tree).map((t) => t.Id),
    ['a-d', 'c-d']
  );
});

test('overhead per frame is added to the time of every frame', () => {
  const row = exposureRow(smart('s', { filter: 'L', time: 60, iterations: 10, completed: 4 }), 5);
  assert.equal(row.totalSeconds, 650);
  assert.equal(row.remainingSeconds, 390);
});

test('summarizeTargets chains the clock times of the targets', () => {
  const tree = [
    { Id: 'root' },
    {
      Id: 'targets',
      Items: [
        {
          Id: 'a',
          FullTypeName: DSO,
          Items: [smart('x', { filter: 'L', time: 60, iterations: 10 })],
        },
        {
          Id: 'b',
          FullTypeName: DSO,
          Items: [smart('y', { filter: 'L', time: 30, iterations: 4 })],
        },
      ],
    },
  ];
  const summary = summarizeTargets(tree, { nowMs: 1000, overheadSeconds: 0 });
  assert.equal(summary.targets[0].startMs, 1000);
  assert.equal(summary.targets[0].endMs, 601000);
  assert.equal(summary.targets[1].startMs, 601000);
  assert.equal(summary.targets[1].endMs, 721000);
  assert.equal(summary.endMs, 721000);
  assert.equal(summarizeTargets(tree).endMs, null);
});

test('slewMode reports the active approach, the most thorough one first', () => {
  const container = (items) => ({ Items: items });
  assert.equal(slewMode(container([])), 'off');
  assert.equal(slewMode(container([{ FullTypeName: SLEW_TYPE }])), 'slew');
  assert.equal(
    slewMode(
      container([{ FullTypeName: SLEW_TYPE, Status: 'DISABLED' }, { FullTypeName: CENTER_TYPE }])
    ),
    'center'
  );
  assert.equal(
    slewMode(container([{ FullTypeName: CENTER_TYPE }, { FullTypeName: CENTER_AND_ROTATE_TYPE }])),
    'centerAndRotate'
  );
  assert.equal(slewMode(container([{ FullTypeName: CENTER_TYPE, Status: 'DISABLED' }])), 'off');
});

test('insertionPoint places a target step before the exposures', () => {
  const container = {
    Id: 'dso',
    Items: [
      { Id: 'wait', FullTypeName: 'Wait' },
      { Id: 'r', FullTypeName: SMART_EXPOSURE_TYPE },
    ],
  };
  assert.deepEqual(insertionPoint(container, CENTER_TYPE, TARGET_ORDER, 'top'), {
    targetId: 'r',
    insertAfter: false,
  });
});

test('insertionPoint keeps the step order: slew, guiding, autofocus', () => {
  const container = {
    Id: 'dso',
    Items: [
      { Id: 'slew', FullTypeName: SLEW_TYPE },
      { Id: 'af', FullTypeName: RUN_AUTOFOCUS_TYPE },
      { Id: 'r', FullTypeName: SMART_EXPOSURE_TYPE },
    ],
  };
  assert.deepEqual(insertionPoint(container, START_GUIDING_TYPE, TARGET_ORDER, 'top'), {
    targetId: 'af',
    insertAfter: false,
  });
  assert.deepEqual(insertionPoint(container, SMART_EXPOSURE_TYPE, TARGET_ORDER, 'top'), {
    targetId: 'r',
    insertAfter: true,
  });
});

test('insertionPoint falls back to top or bottom without known neighbours', () => {
  const container = {
    Id: 'end',
    Items: [
      { Id: 'a', FullTypeName: 'X' },
      { Id: 'b', FullTypeName: 'Y' },
    ],
  };
  assert.deepEqual(insertionPoint(container, COOL_CAMERA_TYPE, [COOL_CAMERA_TYPE], 'top'), {
    targetId: 'a',
    insertAfter: false,
  });
  assert.deepEqual(insertionPoint(container, COOL_CAMERA_TYPE, [COOL_CAMERA_TYPE], 'bottom'), {
    targetId: 'b',
    insertAfter: true,
  });
  assert.deepEqual(insertionPoint({ Id: 'empty', Items: [] }, COOL_CAMERA_TYPE, [], 'top'), {
    targetId: 'empty',
    insertAfter: null,
  });
});

test('binningLabel and formatClock', () => {
  assert.equal(binningLabel({ X: 2, Y: 2 }), '2x2');
  assert.equal(binningLabel('3'), '3x3');
  assert.equal(binningLabel(null), '1x1');
  assert.equal(formatClock(null), '');
  assert.match(formatClock(Date.UTC(2026, 0, 1, 12, 5)), /^\d{2}:\d{2}$/);
});
