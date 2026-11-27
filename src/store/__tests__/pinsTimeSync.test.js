import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { usePinsStore } = await import('@/store/pinsStore');

test('a new profile switches automatic time sync on', () => {
  freshPinia();
  const pins = usePinsStore();

  assert.equal(pins.enableTimeSyncForNewProfile(), true);
  assert.equal(pins.timeSyncEnabled, true);
});

test('a user who switched it off by hand keeps it off', () => {
  freshPinia();
  const pins = usePinsStore();
  pins.setTimeSync(false);

  assert.equal(pins.enableTimeSyncForNewProfile(), false);
  assert.equal(pins.timeSyncEnabled, false);
});

test('nothing to do when sync is already on', () => {
  freshPinia();
  const pins = usePinsStore();
  pins.setTimeSync(true);

  assert.equal(pins.enableTimeSyncForNewProfile(), false);
  assert.equal(pins.timeSyncEnabled, true);
});
