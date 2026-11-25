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
  END_AREA_TYPE,
  END_ORDER,
  PARK_SCOPE_TYPE,
  WARM_CAMERA_TYPE,
  missingEndSteps,
  endOfPlan,
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

test('stepsToReopen opens what a stopped plan needs again, and nothing else', async () => {
  const m = await import('@/utils/sequenceSimple');
  const item = (Id, FullTypeName, Status = 'FINISHED', extra = {}) => ({
    Id,
    FullTypeName,
    Status,
    ...extra,
  });
  const smart = (Id, Status, done, childStatus) =>
    item(Id, m.SMART_EXPOSURE_TYPE, Status, {
      Items: [
        item(`${Id}-filter`, 'NINA.Sequencer.SequenceItem.FilterWheel.SwitchFilter'),
        item(`${Id}-take`, 'NINA.Sequencer.SequenceItem.Imaging.TakeExposure', childStatus, {
          ExposureTime: 60,
        }),
      ],
      Conditions: [
        {
          FullTypeName: 'NINA.Sequencer.Conditions.LoopCondition',
          Iterations: 10,
          CompletedIterations: done,
        },
      ],
    });
  const dso = (Id, Status, Items) =>
    item(Id, 'NINA.Sequencer.Container.DeepSkyObjectContainer', Status, { Items, Triggers: [] });
  const tree = [
    { GlobalTriggers: [] },
    item('start', m.START_AREA_TYPE, 'FINISHED', {
      Items: [
        item('cool', m.COOL_CAMERA_TYPE),
        item('unpark', m.UNPARK_SCOPE_TYPE, 'DISABLED'),
        item('own', 'NINA.Sequencer.SequenceItem.Utility.WaitForTime'),
      ],
    }),
    item('targets', 'NINA.Sequencer.Container.TargetAreaContainer', 'CREATED', {
      Items: [
        dso('through', 'FINISHED', [
          item('through-center', m.CENTER_TYPE),
          smart('through-row', 'FINISHED', 10, 'FINISHED'),
        ]),
        dso('stopped', 'CREATED', [
          item('slew', m.SLEW_TYPE, 'DISABLED'),
          item('center', m.CENTER_TYPE),
          item('guide', m.START_GUIDING_TYPE, 'FAILED'),
          item('focus', m.RUN_AUTOFOCUS_TYPE, 'CREATED'),
          item('script', 'NINA.Sequencer.SequenceItem.Utility.ExternalScript'),
          smart('l', 'FINISHED', 10, 'FINISHED'),
          smart('r', 'CREATED', 3, 'CREATED'),
        ]),
        // Pictures added to a finished target
        dso('extended', 'FINISHED', [smart('new', 'CREATED', 0, 'CREATED')]),
      ],
    }),
  ];
  const targets = ['center', 'guide', 'r-filter', 'extended', 'new-filter'];
  assert.deepEqual(m.stepsToReopen(tree), ['cool', ...targets]);
  assert.deepEqual(m.stepsToReopen(tree, { start: false }), targets);
  assert.deepEqual(m.stepsToReopen(null), []);
});

test('a raised count and a row cut off by dawn run again on the next start', async () => {
  const m = await import('@/utils/sequenceSimple');
  const dso = (Id, Status, Items, Conditions = []) => ({
    Id,
    FullTypeName: DSO,
    Status,
    Items,
    Conditions,
  });
  const loop = (Id, Iterations, CompletedIterations, Status = 'FINISHED') => ({
    Id,
    FullTypeName: m.LOOP_CONDITION_TYPE,
    Status,
    Iterations,
    CompletedIterations,
  });
  const raised = dso(
    'raised',
    'FINISHED',
    [
      smart('l', { filter: 'L', time: 60, iterations: 25, completed: 20, status: 'FINISHED' }),
      smart('r', { filter: 'R', time: 60, iterations: 20, completed: 20, status: 'FINISHED' }),
    ],
    [loop('once', 1, 1), loop('own', 3, 3), loop('off', 1, 1, 'DISABLED')]
  );
  // Seen on PINS: the running row ends FINISHED, the rest of the target SKIPPED
  const dawn = dso(
    'dawn',
    'FINISHED',
    [
      { Id: 'center', FullTypeName: CENTER_TYPE, Status: 'SKIPPED' },
      smart('g', { filter: 'G', time: 60, iterations: 20, status: 'SKIPPED' }),
      smart('b', { filter: 'B', time: 60, iterations: 20, status: 'DISABLED' }),
    ],
    [loop('dawn-once', 1, 1)]
  );
  const through = dso(
    'through',
    'FINISHED',
    [smart('x', { filter: 'L', time: 60, iterations: 5, completed: 5, status: 'FINISHED' })],
    [loop('through-once', 1, 1)]
  );
  const tree = [{ Id: 'targets', Items: [raised, dawn, through] }];
  assert.deepEqual(m.stepsToReopen(tree), ['raised', 'l', 'dawn', 'center', 'g']);
  assert.deepEqual(m.loopsToRestart(tree), ['once', 'dawn-once']);

  const resumable = summarizeTargets(tree, { resumable: true });
  assert.deepEqual(
    resumable.targets.map((t) => t.framesLeft),
    [5, 20, 0]
  );
  assert.equal(resumable.remainingSeconds, 25 * 60);
  // While the plan runs, and outside the simple mode, the sequencer is through with them
  assert.equal(summarizeTargets(tree).remainingSeconds, 0);
});

test('pictures of a target the running plan is through with are not awaited any more', () => {
  // Interrupted by dawn during an exposure: the target FINISHED, its rows still CREATED
  const tree = [
    {
      Id: 'dso',
      FullTypeName: DSO,
      Status: 'FINISHED',
      Items: [smart('l', { filter: 'L', time: 60, iterations: 20, completed: 4 })],
    },
  ];
  assert.equal(summarizeTargets(tree).remainingSeconds, 0);
  assert.equal(summarizeTargets(tree, { resumable: true }).remainingSeconds, 16 * 60);
});

test('limits cut a target off and free the time for the next one', () => {
  const dso = (Id, time, iterations) => ({
    Id,
    FullTypeName: DSO,
    Status: 'CREATED',
    Items: [
      smart(`${Id}-l`, { filter: 'L', time, iterations }),
      smart(`${Id}-r`, { filter: 'R', time, iterations }),
    ],
  });
  const tree = [{ Id: 'targets', Items: [dso('a', 60, 10), dso('b', 60, 10)] }];
  const summary = summarizeTargets(tree, {
    nowMs: 0,
    notBeforeMs: 600000,
    limitAt: (container, startMs) => (container.Id === 'a' ? startMs + 750000 : null),
  });
  const [a, b] = summary.targets;
  assert.deepEqual([a.startMs, a.endMs, a.framesLeft, a.framesFit], [600000, 1350000, 20, 12]);
  assert.deepEqual([b.startMs, b.limitMs, b.framesFit], [1350000, null, 20]);
  assert.deepEqual([summary.framesLeft, summary.framesFit], [40, 32]);
  // Limit already passed: skipped at once
  const gone = summarizeTargets(tree, { nowMs: 5000, limitAt: () => 5000 });
  assert.deepEqual([gone.framesFit, gone.endMs], [0, 5000]);
});

test('an imaging time is shared evenly between the filters', async () => {
  const { framesForTime } = await import('@/utils/sequenceSimple');
  const rows = [
    smart('l', { filter: 'L', time: 55, iterations: 10, completed: 4 }),
    smart('ha', { filter: 'Ha', time: 295, iterations: 10 }),
    smart('off', { filter: 'R', time: 60, iterations: 10, status: 'DISABLED' }),
  ].map((item) => exposureRow(item, 5));
  const dark = exposureRow(smart('d', { filter: 'L', time: 60, iterations: 10 }), 5);
  dark.imageType = 'DARK';
  const plan = framesForTime([...rows, dark], 7200);
  assert.deepEqual(
    plan.map((p) => [p.row.id, p.frames, p.iterations]),
    [
      ['l', 60, 64],
      ['ha', 12, 12],
    ]
  );
  // Never less than one picture
  assert.deepEqual(
    framesForTime(rows, 60).map((p) => p.frames),
    [1, 1]
  );
  assert.deepEqual(framesForTime([], 3600), []);
});

test('the wait for darkness is found with the tracking around it', async () => {
  const { darknessWait, WAIT_FOR_SUN_TYPE, SET_TRACKING_TYPE } =
    await import('@/utils/sequenceSimple');
  const tracking = (Id, TrackingMode) => ({ Id, FullTypeName: SET_TRACKING_TYPE, TrackingMode });
  const tree = (Items) => [{ Id: 'start', FullTypeName: START_AREA_TYPE, Items }];
  const wait = { Id: 'wait', FullTypeName: WAIT_FOR_SUN_TYPE };
  const ids = (Items) => Object.values(darknessWait(tree(Items))).map((item) => item?.Id ?? null);
  assert.deepEqual(
    ids([
      tracking('own', 'Sidereal'),
      tracking('stop', 'Stopped'),
      { Id: 'cool', FullTypeName: COOL_CAMERA_TYPE },
      wait,
      tracking('late', 'Stopped'),
      tracking('resume', 'Sidereal'),
    ]),
    ['wait', 'stop', 'resume']
  );
  assert.deepEqual(ids([wait]), ['wait', null, null]);
  assert.deepEqual(ids([tracking('stop', 'Stopped')]), [null, null, null]);
});

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

const endTree = (...items) => [
  { FullTypeName: START_AREA_TYPE, Items: [] },
  { FullTypeName: END_AREA_TYPE, Id: 'end', Items: items },
];

test('missingEndSteps asks for parking always and for the warm-up only with a cooler', () => {
  assert.deepEqual(missingEndSteps(endTree(), { canCool: true }), [
    PARK_SCOPE_TYPE,
    WARM_CAMERA_TYPE,
  ]);
  assert.deepEqual(missingEndSteps(endTree(), { canCool: false }), [PARK_SCOPE_TYPE]);
  assert.deepEqual(missingEndSteps(endTree()), [PARK_SCOPE_TYPE]);
});

test('missingEndSteps counts a switched-off step as missing and an active one as done', () => {
  const tree = endTree(
    { FullTypeName: PARK_SCOPE_TYPE, Status: 'DISABLED' },
    { FullTypeName: WARM_CAMERA_TYPE, Status: 'CREATED' }
  );
  assert.deepEqual(missingEndSteps(tree, { canCool: true }), [PARK_SCOPE_TYPE]);
  // A finished plan still has its steps: FINISHED is not DISABLED.
  const done = endTree(
    { FullTypeName: PARK_SCOPE_TYPE, Status: 'FINISHED' },
    { FullTypeName: WARM_CAMERA_TYPE, Status: 'FINISHED' }
  );
  assert.deepEqual(missingEndSteps(done, { canCool: true }), []);
});

test('missingEndSteps has nothing to ask for without an end area', () => {
  assert.deepEqual(missingEndSteps([{ FullTypeName: START_AREA_TYPE, Items: [] }]), []);
  assert.deepEqual(missingEndSteps(null, { canCool: true }), []);
});

test('the end area parks before it warms up', () => {
  assert.deepEqual(END_ORDER, [PARK_SCOPE_TYPE, WARM_CAMERA_TYPE]);
  const warmOnly = { Id: 'end', Items: [{ Id: 'w', FullTypeName: WARM_CAMERA_TYPE }] };
  assert.deepEqual(insertionPoint(warmOnly, PARK_SCOPE_TYPE, END_ORDER, 'bottom'), {
    targetId: 'w',
    insertAfter: false,
  });
});

test('endOfPlan reports what the plan does after its last picture', () => {
  assert.deepEqual(endOfPlan(endTree()), { park: false, warm: false });
  assert.deepEqual(
    endOfPlan(
      endTree(
        { FullTypeName: PARK_SCOPE_TYPE, Status: 'CREATED' },
        { FullTypeName: WARM_CAMERA_TYPE, Status: 'DISABLED' }
      )
    ),
    { park: true, warm: false }
  );
  assert.deepEqual(endOfPlan(null), { park: false, warm: false });
});
