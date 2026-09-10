import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { useSequenceStore } = await import('@/store/sequenceStore');
const { default: apiService } = await import('@/services/apiService');

const SETTING_KEY = 'sequence_auto_lock_on_start';
const LOCK_KEY = 'sequence_controls_locked';

// Swaps the three settings endpoints for recording stubs. `createResult` lets a
// test simulate the 409 the plugin server returns for an already existing key.
function setup({ createResult = { StatusCode: 200 }, getValue } = {}) {
  freshPinia();
  const store = useSequenceStore();

  const calls = [];
  const original = {};
  for (const name of ['getSetting', 'createSetting', 'updateSetting']) {
    original[name] = apiService[name];
  }
  apiService.getSetting = async (key) => {
    calls.push({ name: 'getSetting', key });
    return getValue === undefined ? {} : { Response: { Value: getValue } };
  };
  apiService.createSetting = async (setting) => {
    calls.push({ name: 'createSetting', key: setting.Key, value: setting.Value });
    return createResult;
  };
  apiService.updateSetting = async (key, value) => {
    calls.push({ name: 'updateSetting', key, value });
    return { StatusCode: 200 };
  };

  const restore = () => Object.assign(apiService, original);
  return { store, calls, restore };
}

const locksOf = (calls) => calls.filter((c) => c.key === LOCK_KEY);

// A poll that succeeded and saw no running item. Only these confirm a state.
const confirmIdle = (store) => store.confirmSequenceRunning(false);

// What clearAllStates() does to this store on a connection loss: it forces
// sequenceRunning to false without any poll having proved anything.
const connectionLost = (store) => {
  store.$patch({ sequenceRunning: false, sequenceIsLoaded: false, firstLoad: true });
};

test('a confirmed start does not lock while the option is off', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  confirmIdle(store);
  store.confirmSequenceRunning(true);

  assert.equal(store.sequenceControlsLocked, false);
  assert.deepEqual(locksOf(calls), []);
});

test('a confirmed start locks the controls and persists it while the option is on', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  store.autoLockControlsOnStart = true;
  confirmIdle(store);
  store.confirmSequenceRunning(true);

  assert.equal(store.sequenceControlsLocked, true);
  // Persisted through the same key the manual lock button uses.
  assert.deepEqual(locksOf(calls), [{ name: 'createSetting', key: LOCK_KEY, value: 'true' }]);
});

test('the first observation never locks, so a reload during a run stays unlocked', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  // App started while a sequence was already running: the first poll reports
  // RUNNING, which is not a transition we may react to.
  store.autoLockControlsOnStart = true;
  store.confirmSequenceRunning(true);

  assert.equal(store.sequenceControlsLocked, false);
  assert.deepEqual(locksOf(calls), []);
});

test('a reconnect after a connection loss does not re-lock a released lock', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  store.autoLockControlsOnStart = true;
  confirmIdle(store);
  store.confirmSequenceRunning(true); // sequence starts, controls lock
  store.setSequenceControlsLocked(false); // user deliberately unlocks
  calls.length = 0;

  connectionLost(store); // clearAllStates() forces sequenceRunning to false
  store.confirmSequenceRunning(true); // backend is back, sequence still running

  assert.equal(store.sequenceControlsLocked, false);
  assert.deepEqual(locksOf(calls), []);
});

test('a single failed poll does not produce a fake start', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  store.autoLockControlsOnStart = true;
  confirmIdle(store);
  store.confirmSequenceRunning(true);
  store.setSequenceControlsLocked(false);
  calls.length = 0;

  // getSequenceInfo()'s error branch: a timeout sets the flag without confirming.
  store.setSequenceRunning(false);
  store.confirmSequenceRunning(true);

  assert.equal(store.sequenceControlsLocked, false);
  assert.deepEqual(locksOf(calls), []);
});

test('an optimistic start that the backend never confirms does not lock', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  store.autoLockControlsOnStart = true;
  confirmIdle(store);

  // controlSequence.startSequence() sets the flag before calling the backend.
  store.setSequenceRunning(true);
  assert.equal(store.sequenceControlsLocked, false, 'must not lock before confirmation');

  // NINA refused the start; the next poll corrects the flag back.
  store.confirmSequenceRunning(false);

  assert.equal(store.sequenceControlsLocked, false);
  assert.deepEqual(locksOf(calls), []);
});

test('an already locked control bar is not re-saved on start', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  store.autoLockControlsOnStart = true;
  store.sequenceControlsLocked = true;
  confirmIdle(store);
  store.confirmSequenceRunning(true);

  assert.equal(store.sequenceControlsLocked, true);
  assert.deepEqual(locksOf(calls), []);
});

test('the end of a sequence never unlocks -- that stays manual', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  store.autoLockControlsOnStart = true;
  confirmIdle(store);
  store.confirmSequenceRunning(true);
  calls.length = 0;

  store.confirmSequenceRunning(false);

  assert.equal(store.sequenceControlsLocked, true);
  assert.deepEqual(locksOf(calls), []);
});

test('confirmSequenceRunning still drives the plain running flag', async (t) => {
  const { store, restore } = setup();
  t.after(restore);

  store.confirmSequenceRunning(true);
  assert.equal(store.sequenceRunning, true);

  store.confirmSequenceRunning(false);
  assert.equal(store.sequenceRunning, false);
});

test('toggling the option persists it, falling back to update on 409', async (t) => {
  const { store, calls, restore } = setup({ createResult: { StatusCode: 409 } });
  t.after(restore);

  store.setAutoLockControlsOnStart(true);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(store.autoLockControlsOnStart, true);
  assert.deepEqual(calls, [
    { name: 'createSetting', key: SETTING_KEY, value: 'true' },
    { name: 'updateSetting', key: SETTING_KEY, value: 'true' },
  ]);
});

test('the option is read back from the backend setting', async (t) => {
  const { store, restore } = setup({ getValue: 'true' });
  t.after(restore);

  await store.loadAutoLockControlsOnStart();

  assert.equal(store.autoLockControlsOnStart, true);
});

test('a missing backend setting leaves the option at its default', async (t) => {
  const { store, restore } = setup();
  t.after(restore);

  await store.loadAutoLockControlsOnStart();

  assert.equal(store.autoLockControlsOnStart, false);
});
