import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeRigSharedSettingsSync,
  serializeRigSharedSettings,
} from '@/services/rigSharedSettingsService';
import { setAppBackgrounded } from '@/utils/appLifecycle';

const REFRESH_INTERVAL_MS = 5000;

function startSync(t) {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  setAppBackgrounded(false);

  const counter = { loads: 0 };
  const stopSync = initializeRigSharedSettingsSync({
    _sharedRigSettingsReady: true,
    $subscribe: () => () => {},
    loadSharedRigUiSettings: async () => {
      counter.loads++;
    },
  });
  t.after(() => {
    stopSync();
    setAppBackgrounded(false);
  });
  return counter;
}

test('refreshes the rig-shared settings on the interval', (t) => {
  const counter = startSync(t);

  t.mock.timers.tick(REFRESH_INTERVAL_MS);

  assert.equal(counter.loads, 1);
});

test('does not refresh while the app is backgrounded', (t) => {
  const counter = startSync(t);
  setAppBackgrounded(true);

  t.mock.timers.tick(REFRESH_INTERVAL_MS * 3);
  assert.equal(counter.loads, 0);

  setAppBackgrounded(false);
  t.mock.timers.tick(REFRESH_INTERVAL_MS);
  assert.equal(counter.loads, 1);
});

test('rig-shared settings exclude device-local and secret-bearing state', () => {
  const serialized = serializeRigSharedSettings({
    monitorViewSetting: { showImage: true },
    livestack: { showFilters: false },
    celestiaAtlas: { atmosphereVisible: true },
    language: 'de',
    keepAwakeEnabled: true,
    wifiBindingEnabled: true,
    connection: { ip: '10.42.0.1' },
    wifiPassword: 'must-not-leak',
  });
  const payload = JSON.parse(serialized);

  assert.deepEqual(Object.keys(payload).sort(), [
    'celestiaAtlas',
    'livestack',
    'monitorViewSetting',
    'schemaVersion',
  ]);
  assert.equal(serialized.includes('must-not-leak'), false);
  assert.equal(serialized.includes('10.42.0.1'), false);
  assert.equal(serialized.includes('"language"'), false);
});
