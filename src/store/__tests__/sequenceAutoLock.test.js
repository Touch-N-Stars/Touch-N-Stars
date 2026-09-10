import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { useSequenceStore } = await import('@/store/sequenceStore');
const { default: apiService } = await import('@/services/apiService');

const SETTING_KEY = 'sequence_auto_lock_on_start';

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

const savesOf = (calls) => calls.filter((c) => c.key === 'sequence_controls_locked');

// The poller reports the idle state once before a run begins; that first call is
// the initial sync the store deliberately ignores.
const settle = (store) => store.setSequenceRunning(false);

test('a sequence start does not lock while the option is off', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  settle(store);
  store.setSequenceRunning(true);

  assert.equal(store.sequenceControlsLocked, false);
  assert.deepEqual(savesOf(calls), []);
});

test('a sequence start locks the controls and persists it while the option is on', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  store.autoLockControlsOnStart = true;
  settle(store);
  store.setSequenceRunning(true);

  assert.equal(store.sequenceControlsLocked, true);
  // setSequenceControlsLocked persists through the same key the manual button uses.
  assert.deepEqual(savesOf(calls), [
    { name: 'createSetting', key: 'sequence_controls_locked', value: 'true' },
  ]);
});

test('the initial sync never locks, so a released lock stays released', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  // App reloaded while a sequence was already running: the very first status
  // sync reports RUNNING, which must not be treated as a start.
  store.autoLockControlsOnStart = true;
  store.setSequenceRunning(true);

  assert.equal(store.sequenceControlsLocked, false);
  assert.deepEqual(savesOf(calls), []);
});

test('an already locked control bar is not re-saved on start', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  store.autoLockControlsOnStart = true;
  store.sequenceControlsLocked = true;
  settle(store);
  store.setSequenceRunning(true);

  assert.equal(store.sequenceControlsLocked, true);
  assert.deepEqual(savesOf(calls), []);
});

test('the end of a sequence never unlocks -- that stays manual', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  store.autoLockControlsOnStart = true;
  settle(store);
  store.setSequenceRunning(true);
  calls.length = 0;

  store.setSequenceRunning(false);

  assert.equal(store.sequenceControlsLocked, true);
  assert.deepEqual(savesOf(calls), []);
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
