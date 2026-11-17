import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '@/test-helpers/browserEnv.js';

installBrowserGlobals();
freshPinia();
const { default: apiService } = await import('@/services/apiService');
const { default: apiPinsService } = await import('@/services/apiPinsService');
const { useNinaPluginInstallStore } = await import('../ninaPluginInstallStore.js');

// One Pinia for the whole file (apiService caches its store references); reset per test.
const store = useNinaPluginInstallStore();
const LIVESTACK = { name: 'LiveStack', pinsPackage: 'pins-plugin-livestack' };
const FAST = { settleMs: 0, pollMs: 1, timeoutMs: 50 };

function reset() {
  store.$reset();
  store.open({ pluginName: 'livestack', requirement: LIVESTACK });
}

test('opens only for requirements with a PINS package', () => {
  store.$reset();
  store.open({ pluginName: 'x', requirement: { name: 'X', pinsPackage: null } });
  assert.equal(store.show, false);
  reset();
  assert.equal(store.show, true);
  assert.equal(store.phase, 'confirm');
});

test('a successful install asks for the NINA restart', async (t) => {
  reset();
  let installed;
  t.mock.method(apiPinsService, 'runPinsPluginAction', async (action, pkg) => {
    installed = [action, pkg];
    return { jobId: 'job-1' };
  });
  t.mock.method(apiPinsService, 'getPinsDaemonJob', async () => ({ status: 'success' }));

  await store.install();

  assert.deepEqual(installed, ['install', 'pins-plugin-livestack']);
  assert.equal(store.phase, 'restartPrompt');
});

test('a failed install keeps the dialog open with the reason, ready to retry', async (t) => {
  reset();
  t.mock.method(apiPinsService, 'runPinsPluginAction', async () => ({ jobId: 'job-2' }));
  t.mock.method(apiPinsService, 'getPinsDaemonJob', async () => ({
    status: 'failed',
    exitCode: 100,
    errorMessage: 'Unable to locate package',
  }));

  await store.install();

  assert.equal(store.phase, 'failed');
  assert.equal(store.errorMessage, 'Unable to locate package');
  assert.equal(store.show, true);
});

test('restart reboots PINS and finishes once NINA lists the plugin again', async (t) => {
  reset();
  store.phase = 'restartPrompt';
  let rebooted = false;
  t.mock.method(apiService, 'restart', async () => {
    rebooted = true;
    return { Success: true };
  });
  let polls = 0;
  t.mock.method(apiService, 'getPlugins', async () => {
    polls += 1;
    if (polls === 1) throw new Error('Network Error'); // device still rebooting
    return { Success: true, Response: ['ninaAPI', 'LiveStack'] };
  });

  const before = store.completedCount;
  await store.restartPins(FAST);

  assert.equal(rebooted, true);
  assert.equal(store.phase, 'done');
  assert.equal(store.completedCount, before + 1);
});

test('a connection cut by the reboot itself still counts as a started restart', async (t) => {
  reset();
  store.phase = 'restartPrompt';
  t.mock.method(apiService, 'restart', async () => {
    throw new Error('Network Error');
  });
  t.mock.method(apiService, 'getPlugins', async () => ({ Success: true, Response: ['LiveStack'] }));

  await store.restartPins(FAST);

  assert.equal(store.phase, 'done');
});

test('a device that does not come back in time ends in the timeout hint', async (t) => {
  reset();
  store.phase = 'restartPrompt';
  t.mock.method(apiService, 'restart', async () => ({ Success: true }));
  t.mock.method(apiService, 'getPlugins', async () => {
    throw new Error('Network Error');
  });

  await store.restartPins(FAST);

  assert.equal(store.phase, 'restartTimeout');
});

test('a refused restart stays on the prompt with the error', async (t) => {
  reset();
  store.phase = 'restartPrompt';
  t.mock.method(apiService, 'restart', async () => {
    const error = new Error('boom');
    error.response = { status: 500, data: { detail: 'shutdown failed' } };
    throw error;
  });

  await store.restartPins(FAST);

  assert.equal(store.phase, 'restartPrompt');
  assert.equal(store.errorMessage, 'shutdown failed');
});

test('offer skips straight to the restart when the package is already installed', async (t) => {
  store.$reset();
  t.mock.method(apiPinsService, 'getPinsPlugins', async () => ({
    plugins: [{ packageName: 'pins-plugin-livestack', installed: true }],
  }));

  await store.offer({ pluginName: 'livestack', requirement: LIVESTACK });

  assert.equal(store.phase, 'restartPrompt');
});
