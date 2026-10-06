import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { useSequenceV2Store } = await import('@/store/sequenceV2Store');
const { default: apiService } = await import('@/services/apiService');

const GUARDED = [
  'sequenceMove',
  'sequenceRemove',
  'sequenceSetProperty',
  'sequenceEnable',
  'sequenceResetStatus',
  'sequenceDuplicate',
  'sequnceTargetSet',
];

// A running DSO container holding a running exposure next to an idle one, plus a
// running trigger and condition -- those carry a status too and are only reachable
// through the getter's Triggers/Conditions recursion.
function tree() {
  return [
    { Id: 'root', GlobalTriggers: [{ Id: 'gt', Status: 'CREATED' }] },
    {
      Id: 'targets',
      Name: 'Targets',
      Items: [
        {
          Id: 'dso',
          Status: 'RUNNING',
          FullTypeName: 'NINA.Sequencer.Container.DeepSkyObjectContainer',
          Items: [
            { Id: 'exposure-running', Status: 'RUNNING' },
            { Id: 'exposure-idle', Status: 'CREATED' },
          ],
          Triggers: [{ Id: 'trigger-running', Status: 'RUNNING' }],
          Conditions: [{ Id: 'condition-running', Status: 'RUNNING' }],
        },
      ],
    },
  ];
}

function setup() {
  freshPinia();
  const store = useSequenceV2Store();
  store.data = tree();
  // The store is a plain facade object, so the endpoints can be swapped out directly.
  const calls = [];
  const original = {};
  for (const name of GUARDED) {
    original[name] = apiService[name];
    apiService[name] = async (...args) => {
      calls.push({ name, args });
      return { Success: true };
    };
  }
  const restore = () => Object.assign(apiService, original);
  return { store, calls, restore };
}

// apiStore().isBackendReachable stays false, so the loadCurrent()/fetchStatusUpdate()
// each action ends with return before touching the network.

test('mutating actions are rejected for a running item', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  for (const id of ['dso', 'exposure-running', 'trigger-running', 'condition-running']) {
    await store.remove(id);
    await store.enable(id, true);
    await store.resetStatus(id);
    await store.setProperty(id, 'ExposureTime', 30);
    await store.move(id, 'exposure-idle', true);
    await store.setDsoTarget(id, 'M31', 10.68, 41.27, 0);
  }

  assert.deepEqual(calls, []);
});

test('the same actions go through for an idle sibling of a running item', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  await store.remove('exposure-idle');
  await store.enable('exposure-idle', false);
  await store.resetStatus('exposure-idle');
  await store.setProperty('exposure-idle', 'ExposureTime', 30);
  await store.move('exposure-idle', 'exposure-running', true);

  assert.deepEqual(
    calls.map((c) => c.name),
    [
      'sequenceRemove',
      'sequenceEnable',
      'sequenceResetStatus',
      'sequenceSetProperty',
      'sequenceMove',
    ]
  );
});

test('duplicating a running item stays allowed -- it does not change the item', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  await store.duplicate('exposure-running');

  assert.deepEqual(calls, [{ name: 'sequenceDuplicate', args: ['exposure-running'] }]);
});

test('findById reaches items, triggers and conditions at any depth', () => {
  const { store, restore } = setup();
  restore();

  assert.equal(store.findById('exposure-running')?.Status, 'RUNNING');
  assert.equal(store.findById('trigger-running')?.Status, 'RUNNING');
  assert.equal(store.findById('condition-running')?.Status, 'RUNNING');
  assert.equal(store.findById('gt')?.Status, 'CREATED');
  assert.equal(store.findById('nope'), undefined);
});

test('setDsoTarget refuses an Id that is not in the held tree instead of using index 0', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  const result = await store.setDsoTarget('unknown-dso', 'M31', 10.68, 41.27, 0);

  assert.equal(result.ok, false);
  assert.deepEqual(calls, []);
});
