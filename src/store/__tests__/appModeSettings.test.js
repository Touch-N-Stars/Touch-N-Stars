import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { useSettingsStore } = await import('@/store/settingsStore');
const { default: apiService } = await import('@/services/apiService');
const { serializeRigSharedSettings } = await import('@/services/rigSharedSettingsService');

function setup(t) {
  freshPinia();
  const writes = [];
  const originals = {
    createSetting: apiService.createSetting,
    updateSetting: apiService.updateSetting,
  };
  apiService.createSetting = async (setting) => writes.push(setting);
  apiService.updateSetting = async (key) => writes.push(key);
  t.after(() => Object.assign(apiService, originals));
  return { settingsStore: useSettingsStore(), writes };
}

test('a fresh or upgraded install stays in the expert view', (t) => {
  const { settingsStore } = setup(t);
  assert.equal(settingsStore.appMode, 'expert');
  assert.equal(settingsStore.isEasyMode, false);

  settingsStore.appMode = undefined;
  assert.equal(settingsStore.isEasyMode, false);
});

test('the sequence layout follows a change of the mode', (t) => {
  const { settingsStore } = setup(t);

  settingsStore.setAppMode('easy');
  assert.equal(settingsStore.isEasyMode, true);
  assert.equal(settingsStore.sequence.viewMode, 'simple');

  settingsStore.setAppMode('expert');
  assert.equal(settingsStore.sequence.viewMode, 'full');
});

test('the jump into the expert editor leaves the global mode alone', (t) => {
  const { settingsStore } = setup(t);
  settingsStore.setAppMode('easy');

  settingsStore.setSequenceViewMode('full');
  assert.equal(settingsStore.appMode, 'easy');

  // Re-selecting the mode that is already active must not undo that jump.
  settingsStore.setAppMode('easy');
  assert.equal(settingsStore.sequence.viewMode, 'full');
});

test('an expert keeps a chosen simple sequence view until the mode really changes', (t) => {
  const { settingsStore } = setup(t);
  settingsStore.setSequenceViewMode('simple');

  settingsStore.setAppMode('expert');
  assert.equal(settingsStore.sequence.viewMode, 'simple');
});

test('switching the mode writes nothing to the backend and leaves the navbar alone', (t) => {
  const { settingsStore, writes } = setup(t);
  settingsStore.navbar.hiddenItems = ['dome'];
  const order = [...settingsStore.navbar.itemOrder];
  const rigSnapshot = serializeRigSharedSettings(settingsStore);

  settingsStore.setAppMode('easy');
  settingsStore.setAppMode('expert');

  assert.deepEqual(writes, []);
  assert.deepEqual(settingsStore.navbar.hiddenItems, ['dome']);
  assert.deepEqual(settingsStore.navbar.itemOrder, order);
  assert.equal(serializeRigSharedSettings(settingsStore), rigSnapshot);
});
