import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { useSequenceV2Store } = await import('@/store/sequenceV2Store');
const { default: apiService } = await import('@/services/apiService');
const {
  MERIDIAN_FLIP_TRIGGER_TYPE,
  DITHER_AFTER_EXPOSURES_TYPE,
  COOL_CAMERA_TYPE,
  SMART_EXPOSURE_TYPE,
  START_AREA_TYPE,
  END_AREA_TYPE,
  PARK_SCOPE_TYPE,
  WARM_CAMERA_TYPE,
  SLEW_TYPE,
  CENTER_TYPE,
  CENTER_AND_ROTATE_TYPE,
  START_GUIDING_TYPE,
  AF_AFTER_TIME_TYPE,
  AF_AFTER_FILTER_CHANGE_TYPE,
} = await import('@/utils/sequenceSimple');

const STUBBED = [
  'sequenceEnable',
  'sequenceAddTrigger',
  'sequenceAddItem',
  'sequenceSetProperty',
  'sequenceResetStatus',
];

function smartExposure(id, ditherAfter) {
  return {
    Id: id,
    FullTypeName: SMART_EXPOSURE_TYPE,
    Status: 'CREATED',
    Triggers: [
      {
        Id: `${id}-dither`,
        FullTypeName: DITHER_AFTER_EXPOSURES_TYPE,
        AfterExposures: ditherAfter,
      },
    ],
  };
}

function tree({
  globalTriggers = [],
  startItems = [],
  endItems = [],
  dsoSteps = [],
  dsoTriggers = [],
} = {}) {
  return [
    { Id: 'root', GlobalTriggers: globalTriggers },
    { Id: 'start', FullTypeName: START_AREA_TYPE, Items: startItems },
    {
      Id: 'targets',
      FullTypeName: 'NINA.Sequencer.Container.TargetAreaContainer',
      Items: [
        {
          Id: 'dso',
          FullTypeName: 'NINA.Sequencer.Container.DeepSkyObjectContainer',
          Items: [...dsoSteps, smartExposure('l', 1), smartExposure('r', 0), smartExposure('g', 2)],
          Triggers: dsoTriggers,
        },
      ],
    },
    { Id: 'end', FullTypeName: END_AREA_TYPE, Items: endItems },
  ];
}

// apiStore().isBackendReachable stays false, so refresh() returns without touching the
// network and the held tree stays as the test set it up.
function setup(treeOptions) {
  freshPinia();
  const store = useSequenceV2Store();
  store.data = tree(treeOptions);
  const calls = [];
  const original = {};
  for (const name of STUBBED) {
    original[name] = apiService[name];
    apiService[name] = async (...args) => {
      calls.push({ name, args });
      return { Success: true };
    };
  }
  const restore = () => Object.assign(apiService, original);
  return { store, calls, restore };
}

const ran = (Id, FullTypeName, Status = 'FINISHED') => ({ Id, FullTypeName, Status });

// A Smart Exposure with pictures left
const row = (Id, { iterations }) => ({
  Id,
  FullTypeName: SMART_EXPOSURE_TYPE,
  Status: 'CREATED',
  Items: [
    {
      Id: `${Id}-take`,
      FullTypeName: 'NINA.Sequencer.SequenceItem.Imaging.TakeExposure',
      Status: 'CREATED',
      ExposureTime: 60,
    },
  ],
  Conditions: [
    {
      FullTypeName: 'NINA.Sequencer.Conditions.LoopCondition',
      Iterations: iterations,
      CompletedIterations: 2,
    },
  ],
});

test('a plan that ran to its end prepares and parks again on the next start', async (t) => {
  const { store, calls, restore } = setup({
    startItems: [ran('cool', COOL_CAMERA_TYPE)],
    endItems: [ran('off', SLEW_TYPE, 'DISABLED'), ran('park', PARK_SCOPE_TYPE)],
  });
  t.after(restore);
  assert.equal(await store.rearmPlan(), true);
  assert.deepEqual(
    calls.map((c) => [c.name, c.args[0]]),
    [
      ['sequenceResetStatus', 'cool'],
      ['sequenceResetStatus', 'park'],
    ]
  );
});

test('a stopped plan reopens its steps one by one, without resetting what follows', async (t) => {
  const { store, calls, restore } = setup({
    startItems: [ran('cool', COOL_CAMERA_TYPE)],
    dsoSteps: [row('row', { iterations: 5 }), ran('center', CENTER_TYPE)],
    endItems: [ran('park', PARK_SCOPE_TYPE, 'CREATED')],
  });
  t.after(restore);
  assert.equal(await store.rearmPlan(), true);
  assert.deepEqual(
    calls.map((c) => [c.name, ...c.args]),
    ['cool', 'center'].flatMap((id) => [
      ['sequenceEnable', id, false],
      ['sequenceEnable', id, true],
    ])
  );
});

test('a fresh plan is left alone', async (t) => {
  const { store, calls, restore } = setup({
    startItems: [ran('cool', COOL_CAMERA_TYPE, 'CREATED')],
    dsoSteps: [row('row', { iterations: 5 }), ran('center', CENTER_TYPE, 'CREATED')],
  });
  t.after(restore);
  assert.equal(await store.rearmPlan(), true);
  assert.deepEqual(calls, []);
});

test('a step that cannot be reopened keeps the plan from starting', async (t) => {
  const { store, restore } = setup({
    dsoSteps: [row('row', { iterations: 5 }), ran('center', CENTER_TYPE)],
  });
  t.after(restore);
  apiService.sequenceEnable = async (id, enabled) => ({ Success: !enabled });
  assert.equal(await store.rearmPlan(), false);
});

test('a refused reset keeps the plan from starting without its park', async (t) => {
  const { store, restore } = setup({ endItems: [ran('park', PARK_SCOPE_TYPE)] });
  t.after(restore);
  apiService.sequenceResetStatus = async () => ({ Success: false });
  assert.equal(await store.rearmPlan(), false);
  apiService.sequenceResetStatus = async () => {
    throw new Error('offline');
  };
  assert.equal(await store.rearmPlan(), false);
});

test('switching on a missing global trigger appends it to the global triggers', async (t) => {
  const { store, calls, restore } = setup({
    globalTriggers: [{ Id: 'af', FullTypeName: 'Other', Status: 'CREATED' }],
  });
  t.after(restore);

  await store.setGlobalTriggerEnabled(MERIDIAN_FLIP_TRIGGER_TYPE, true);

  assert.deepEqual(calls, [
    { name: 'sequenceAddTrigger', args: ['af', MERIDIAN_FLIP_TRIGGER_TYPE, true] },
  ]);
});

test('the first global trigger goes into the root container', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  await store.setGlobalTriggerEnabled(MERIDIAN_FLIP_TRIGGER_TYPE, true);

  assert.deepEqual(calls, [
    { name: 'sequenceAddTrigger', args: ['root', MERIDIAN_FLIP_TRIGGER_TYPE, null] },
  ]);
});

test('an existing global trigger is enabled and disabled, never removed', async (t) => {
  const { store, calls, restore } = setup({
    globalTriggers: [{ Id: 'mf', FullTypeName: MERIDIAN_FLIP_TRIGGER_TYPE, Status: 'DISABLED' }],
  });
  t.after(restore);

  await store.setGlobalTriggerEnabled(MERIDIAN_FLIP_TRIGGER_TYPE, true);
  store.data[0].GlobalTriggers[0].Status = 'CREATED';
  await store.setGlobalTriggerEnabled(MERIDIAN_FLIP_TRIGGER_TYPE, true); // already on
  await store.setGlobalTriggerEnabled(MERIDIAN_FLIP_TRIGGER_TYPE, false);

  assert.deepEqual(calls, [
    { name: 'sequenceEnable', args: ['mf', true] },
    { name: 'sequenceEnable', args: ['mf', false] },
  ]);
});

test('switching off something that does not exist does nothing', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  await store.setGlobalTriggerEnabled(MERIDIAN_FLIP_TRIGGER_TYPE, false);
  await store.setStartItemEnabled(COOL_CAMERA_TYPE, false);

  assert.deepEqual(calls, []);
});

test('camera cooling is added at the top of the start area', async (t) => {
  const { store, calls, restore } = setup({
    startItems: [{ Id: 'unpark', FullTypeName: 'Unpark', Status: 'CREATED' }],
  });
  t.after(restore);

  await store.setStartItemEnabled(COOL_CAMERA_TYPE, true);

  assert.deepEqual(calls, [{ name: 'sequenceAddItem', args: ['unpark', COOL_CAMERA_TYPE, false] }]);
});

test('camera cooling goes into an empty start area', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  await store.setStartItemEnabled(COOL_CAMERA_TYPE, true);

  assert.deepEqual(calls, [{ name: 'sequenceAddItem', args: ['start', COOL_CAMERA_TYPE, null] }]);
});

test('global dithering zeroes the Smart Exposure dithers that still dither', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);
  // Plays the backend: the reload after the add shows the new global trigger.
  store.refresh = async () => {
    if (!store.data[0].GlobalTriggers.length) {
      store.data[0].GlobalTriggers.push({
        Id: 'new-dither',
        FullTypeName: DITHER_AFTER_EXPOSURES_TYPE,
        Status: 'CREATED',
      });
    }
  };

  await store.setGlobalDither(true);

  assert.deepEqual(calls, [
    { name: 'sequenceAddTrigger', args: ['root', DITHER_AFTER_EXPOSURES_TYPE, null] },
    { name: 'sequenceSetProperty', args: ['l-dither', 'AfterExposures', 0] },
    { name: 'sequenceSetProperty', args: ['g-dither', 'AfterExposures', 0] },
  ]);
});

test('a rejected global dither trigger leaves the Smart Exposures dithering', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  await store.setGlobalDither(true); // refresh() is a no-op: the trigger never appears

  assert.deepEqual(
    calls.map((c) => c.name),
    ['sequenceAddTrigger']
  );
});

test('switching dithering off stops the exposure rows dithering too', async (t) => {
  const { store, calls, restore } = setup({
    globalTriggers: [{ Id: 'd', FullTypeName: DITHER_AFTER_EXPOSURES_TYPE, Status: 'CREATED' }],
  });
  t.after(restore);

  await store.setGlobalDither(false);

  assert.deepEqual(calls, [
    { name: 'sequenceEnable', args: ['d', false] },
    { name: 'sequenceSetProperty', args: ['l-dither', 'AfterExposures', 0] },
    { name: 'sequenceSetProperty', args: ['g-dither', 'AfterExposures', 0] },
  ]);
});

test('without a global trigger, off still stops the exposure rows', async (t) => {
  // A fresh plan: only the dither triggers built into the Smart Exposures.
  const { store, calls, restore } = setup();
  t.after(restore);

  await store.setGlobalDither(false);

  assert.deepEqual(calls, [
    { name: 'sequenceSetProperty', args: ['l-dither', 'AfterExposures', 0] },
    { name: 'sequenceSetProperty', args: ['g-dither', 'AfterExposures', 0] },
  ]);
});

test('a new Smart Exposure does not dither twice while global dithering is on', async (t) => {
  const { store, calls, restore } = setup({
    globalTriggers: [{ Id: 'd', FullTypeName: DITHER_AFTER_EXPOSURES_TYPE, Status: 'CREATED' }],
  });
  t.after(restore);

  await store.addItem('dso', SMART_EXPOSURE_TYPE, true);

  assert.deepEqual(calls, [
    { name: 'sequenceAddItem', args: ['dso', SMART_EXPOSURE_TYPE, true] },
    { name: 'sequenceSetProperty', args: ['l-dither', 'AfterExposures', 0] },
    { name: 'sequenceSetProperty', args: ['g-dither', 'AfterExposures', 0] },
  ]);
});

test('without global dithering a new Smart Exposure keeps its own dither', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  await store.addItem('dso', SMART_EXPOSURE_TYPE, true);

  assert.deepEqual(calls, [{ name: 'sequenceAddItem', args: ['dso', SMART_EXPOSURE_TYPE, true] }]);
});

test('the end parks before it warms up: a new park goes before the warm-up', async (t) => {
  const { store, calls, restore } = setup({
    endItems: [{ Id: 'warm', FullTypeName: WARM_CAMERA_TYPE, Status: 'CREATED' }],
  });
  t.after(restore);

  await store.setEndItemEnabled(PARK_SCOPE_TYPE, true);

  assert.deepEqual(calls, [{ name: 'sequenceAddItem', args: ['warm', PARK_SCOPE_TYPE, false] }]);
});

test('a new warm-up goes after the park', async (t) => {
  const { store, calls, restore } = setup({
    endItems: [{ Id: 'park', FullTypeName: PARK_SCOPE_TYPE, Status: 'CREATED' }],
  });
  t.after(restore);

  await store.setEndItemEnabled(WARM_CAMERA_TYPE, true);

  assert.deepEqual(calls, [{ name: 'sequenceAddItem', args: ['park', WARM_CAMERA_TYPE, true] }]);
});

test('a new target step goes before the first exposure', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  await store.setTargetItemEnabled('dso', START_GUIDING_TYPE, true);

  assert.deepEqual(calls, [{ name: 'sequenceAddItem', args: ['l', START_GUIDING_TYPE, false] }]);
});

test('switching the slew mode disables the other approaches and adds the new one', async (t) => {
  const { store, calls, restore } = setup({
    dsoSteps: [
      { Id: 'slew', FullTypeName: SLEW_TYPE, Status: 'CREATED' },
      { Id: 'rot', FullTypeName: CENTER_AND_ROTATE_TYPE, Status: 'DISABLED' },
    ],
  });
  t.after(restore);

  await store.setTargetSlewMode('dso', 'center');

  assert.deepEqual(calls, [
    { name: 'sequenceEnable', args: ['slew', false] },
    // Placed right before the first exposure, i.e. behind the other approaches.
    { name: 'sequenceAddItem', args: ['l', CENTER_TYPE, false] },
  ]);
});

test('slew mode off only disables', async (t) => {
  const { store, calls, restore } = setup({
    dsoSteps: [{ Id: 'center', FullTypeName: CENTER_TYPE, Status: 'CREATED' }],
  });
  t.after(restore);

  await store.setTargetSlewMode('dso', 'off');

  assert.deepEqual(calls, [{ name: 'sequenceEnable', args: ['center', false] }]);
});

test('an autofocus trigger is appended to the target or re-enabled', async (t) => {
  const { store, calls, restore } = setup({
    dsoTriggers: [{ Id: 'other', FullTypeName: 'X', Status: 'CREATED' }],
  });
  t.after(restore);

  await store.setContainerTriggerEnabled('dso', AF_AFTER_TIME_TYPE, true);
  store.data[2].Items[0].Triggers.push({
    Id: 'aft',
    FullTypeName: AF_AFTER_TIME_TYPE,
    Status: 'DISABLED',
  });
  await store.setContainerTriggerEnabled('dso', AF_AFTER_TIME_TYPE, true);

  assert.deepEqual(calls, [
    { name: 'sequenceAddTrigger', args: ['other', AF_AFTER_TIME_TYPE, true] },
    { name: 'sequenceEnable', args: ['aft', true] },
  ]);
});

test('simple target steps switch on centering and guiding before the exposures', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  await store.applySimpleTargetSteps(
    'dso',
    { slewMode: 'center', startGuiding: true },
    { addExposure: true }
  );

  // The target already has exposures: none is added
  assert.deepEqual(calls, [
    { name: 'sequenceAddItem', args: ['l', CENTER_TYPE, false] },
    { name: 'sequenceAddItem', args: ['l', START_GUIDING_TYPE, false] },
  ]);
});

test('simple target steps leave a complete target alone and switch guiding off when skipped', async (t) => {
  const { store, calls, restore } = setup({
    dsoSteps: [
      { Id: 'center', FullTypeName: CENTER_TYPE, Status: 'CREATED' },
      { Id: 'guide', FullTypeName: START_GUIDING_TYPE, Status: 'CREATED' },
    ],
  });
  t.after(restore);

  await store.applySimpleTargetSteps('dso', { slewMode: 'center', startGuiding: true });
  assert.deepEqual(calls, []);

  await store.applySimpleTargetSteps('dso', { slewMode: 'center', startGuiding: false });
  assert.deepEqual(calls, [{ name: 'sequenceEnable', args: ['guide', false] }]);
});

test('simple target steps switch on autofocus after a filter change, and never off', async (t) => {
  const { store, calls, restore } = setup({
    dsoSteps: [
      { Id: 'center', FullTypeName: CENTER_TYPE, Status: 'CREATED' },
      { Id: 'guide', FullTypeName: START_GUIDING_TYPE, Status: 'CREATED' },
    ],
    dsoTriggers: [{ Id: 'aft', FullTypeName: AF_AFTER_TIME_TYPE, Status: 'CREATED' }],
  });
  t.after(restore);

  const steps = { slewMode: 'center', startGuiding: true };
  await store.applySimpleTargetSteps('dso', { ...steps, afOnFilterChange: true });
  assert.deepEqual(calls, [
    { name: 'sequenceAddTrigger', args: ['aft', AF_AFTER_FILTER_CHANGE_TYPE, true] },
  ]);

  // A trigger the user added stays when the rig has no filter wheel
  calls.length = 0;
  store.data[2].Items[0].Triggers.push({
    Id: 'afc',
    FullTypeName: AF_AFTER_FILTER_CHANGE_TYPE,
    Status: 'CREATED',
  });
  await store.applySimpleTargetSteps('dso', { ...steps, afOnFilterChange: false });
  assert.deepEqual(calls, []);
});

test('a simple target without pictures gets an exposure row', async (t) => {
  const { store, calls, restore } = setup({
    dsoSteps: [{ Id: 'center', FullTypeName: CENTER_TYPE, Status: 'CREATED' }],
  });
  t.after(restore);
  // Only the approach, no exposures
  store.data[2].Items[0].Items = store.data[2].Items[0].Items.slice(0, 1);

  await store.applySimpleTargetSteps(
    'dso',
    { slewMode: 'center', startGuiding: false },
    { addExposure: true }
  );

  assert.deepEqual(calls, [
    { name: 'sequenceAddItem', args: ['center', SMART_EXPOSURE_TYPE, true] },
  ]);
});

// The backend adds the row with an untouched filter, which PINS runs as "first slot".
function exposureWithFilter(id, switchFilter) {
  return {
    ...smartExposure(id, 1),
    Items: [
      {
        Id: `${id}-filter`,
        FullTypeName: 'NINA.Sequencer.SequenceItem.FilterWheel.SwitchFilter',
        ...switchFilter,
      },
    ],
  };
}

test('a new exposure row starts with the next filter, or is told to keep the current one', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);
  const names = ['L', 'R'];
  const dso = store.data[2].Items[0];
  const unset = { SelectedFilter: 0, ComboBoxText: null, FilterNames: names };
  const added = ['a', 'b', 'c'];
  apiService.sequenceAddItem = async () => {
    dso.Items = [...dso.Items, exposureWithFilter(added.shift(), { ...unset })];
    return { Success: true };
  };
  apiService.sequenceSetProperty = async (id, property, value) => {
    calls.push([id, property, value]);
    const filter = dso.Items.flatMap((i) => i.Items ?? []).find((i) => i.Id === id);
    filter.ComboBoxText = value === 0 ? '(Current)' : names[value - 1];
    return { Success: true };
  };

  for (let i = 0; i < 3; i += 1) await store.addExposureRow('dso');

  assert.deepEqual(calls, [
    ['a-filter', 'SelectedFilter', 1],
    ['b-filter', 'SelectedFilter', 2],
    ['c-filter', 'SelectedFilter', 0],
  ]);
});
