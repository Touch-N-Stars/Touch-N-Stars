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
} = await import('@/utils/sequenceSimple');

const STUBBED = ['sequenceEnable', 'sequenceAddTrigger', 'sequenceAddItem', 'sequenceSetProperty'];

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

test('switching global dithering off leaves the Smart Exposures alone', async (t) => {
  const { store, calls, restore } = setup({
    globalTriggers: [{ Id: 'd', FullTypeName: DITHER_AFTER_EXPOSURES_TYPE, Status: 'CREATED' }],
  });
  t.after(restore);

  await store.setGlobalDither(false);

  assert.deepEqual(calls, [{ name: 'sequenceEnable', args: ['d', false] }]);
});

test('park goes after warm camera at the end, warm camera before park', async (t) => {
  const { store, calls, restore } = setup({
    endItems: [{ Id: 'warm', FullTypeName: WARM_CAMERA_TYPE, Status: 'CREATED' }],
  });
  t.after(restore);

  await store.setEndItemEnabled(PARK_SCOPE_TYPE, true);

  assert.deepEqual(calls, [{ name: 'sequenceAddItem', args: ['warm', PARK_SCOPE_TYPE, true] }]);
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
