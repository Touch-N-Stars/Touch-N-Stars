import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTick, reactive, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { installBrowserGlobals } from '../../test-helpers/browserEnv.js';
import { mountComposable } from '../../test-helpers/pollingTestEnv.js';

installBrowserGlobals();

const { default: apiService } = await import('@/services/apiService');
const { useProfileSetting, readProfilePath, STATUS_RESET_MS } =
  await import('@/composables/useProfileSetting');

function setup(t, profileInfo = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = reactive({ profileInfo });
  pinia._s.set('store', store);

  const calls = [];
  let respond = () => Promise.resolve({ Success: true });
  t.mock.method(apiService, 'profileChangeValue', (path, value) => {
    calls.push([path, value]);
    return respond(path, value);
  });
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});

  const unmounts = [];
  t.after(() => unmounts.forEach((u) => u()));

  function use(key, options) {
    const { result, unmount } = mountComposable(() => useProfileSetting(key, options));
    unmounts.push(unmount);
    return { ...result, unmount };
  }

  return {
    store,
    calls,
    use,
    respondWith(fn) {
      respond = fn;
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('readProfilePath walks nested objects and array indices', () => {
  const profile = { A: { List: [{ X: 1 }, { X: 2 }] } };
  assert.equal(readProfilePath(profile, 'A-List-1-X'), 2);
  assert.equal(readProfilePath(profile, 'A-Missing-X'), undefined);
  assert.equal(readProfilePath(undefined, 'A'), undefined);
});

test('value starts at the profile value and falls back while it is missing', async (t) => {
  const env = setup(t, { CameraSettings: { Gain: 100 } });
  assert.equal(env.use('CameraSettings-Gain').value.value, 100);
  assert.equal(env.use('CameraSettings-Offset', { fallback: 7 }).value.value, 7);
});

test('value follows profile changes from elsewhere', async (t) => {
  const env = setup(t, {});
  const { value } = env.use('CameraSettings-Gain', { fallback: 0 });
  env.store.profileInfo = { CameraSettings: { Gain: 120 } };
  await nextTick();
  assert.equal(value.value, 120);
});

test('save sends the converted value and reports saved', async (t) => {
  const env = setup(t, { FlatWizardSettings: { HistogramMeanTarget: 0.5 } });
  const setting = env.use('FlatWizardSettings-HistogramMeanTarget', {
    fromProfile: (v) => Math.round(v * 100),
    toProfile: (v) => v / 100,
  });
  assert.equal(setting.value.value, 50);

  assert.equal(await setting.save(60), true);
  assert.deepEqual(env.calls, [['FlatWizardSettings-HistogramMeanTarget', 0.6]]);
  assert.equal(setting.value.value, 60);
  assert.equal(setting.status.value, 'saved');

  t.mock.timers.tick(STATUS_RESET_MS);
  assert.equal(setting.status.value, '');
});

test('a rejected save reverts to the profile value', async (t) => {
  const env = setup(t, { TelescopeSettings: { SettleTime: 5 } });
  env.respondWith(() => Promise.resolve({ Success: false, Error: 'nope' }));
  const setting = env.use('TelescopeSettings-SettleTime');

  assert.equal(await setting.save(9), false);
  assert.equal(setting.value.value, 5);
  assert.equal(setting.status.value, 'error');
});

test('a failed request reverts to the profile value', async (t) => {
  const env = setup(t, { TelescopeSettings: { SettleTime: 5 } });
  env.respondWith(() => Promise.reject(new Error('offline')));
  const setting = env.use('TelescopeSettings-SettleTime');

  assert.equal(await setting.save(9), false);
  assert.equal(setting.value.value, 5);
  assert.equal(setting.status.value, 'error');
});

test('a stale poll during a save does not overwrite the new value', async (t) => {
  const env = setup(t, { GuiderSettings: { DitherPixels: 3 } });
  const pending = deferred();
  env.respondWith(() => pending.promise);
  const setting = env.use('GuiderSettings-DitherPixels');

  const saving = setting.save(5);
  assert.equal(setting.saving.value, true);
  // Some other field changed, the poll replaces profileInfo with the pre-save value.
  env.store.profileInfo = { GuiderSettings: { DitherPixels: 4 } };
  await nextTick();
  assert.equal(setting.value.value, 5);

  pending.resolve({ Success: true });
  await saving;
  assert.equal(setting.saving.value, false);
  assert.equal(setting.value.value, 5);
});

test('hold pauses following the profile', async (t) => {
  const env = setup(t, { CameraSettings: { Gain: 100 } });
  const focused = ref(true);
  const { value } = env.use('CameraSettings-Gain', { hold: () => focused.value });
  env.store.profileInfo = { CameraSettings: { Gain: 200 } };
  await nextTick();
  assert.equal(value.value, 100);
});

test('a custom source replaces the profile lookup', async (t) => {
  const env = setup(t, {});
  const external = ref(3);
  const { value } = env.use('RotatorSettings-OvershootAngle', { source: () => external.value });
  assert.equal(value.value, 3);
  external.value = 4;
  await nextTick();
  assert.equal(value.value, 4);
});

test('a reactive key reads and writes the current path', async (t) => {
  const env = setup(t, { List: [{ V: 1 }, { V: 2 }] });
  const index = ref(0);
  const setting = env.use(() => `List-${index.value}-V`);
  assert.equal(setting.value.value, 1);
  index.value = 1;
  await nextTick();
  assert.equal(setting.value.value, 2);
  await setting.save(8);
  assert.deepEqual(env.calls, [['List-1-V', 8]]);
});
