import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();
freshPinia();
const { default: axios } = await import('axios');
const { default: apiPinsService } = await import('@/services/apiPinsService');
const { useSettingsStore } = await import('@/store/settingsStore');
const settings = useSettingsStore();
settings.connection.ip = '10.0.0.25';

test('swap status reads the selected Pi through the authenticated daemon API', async (t) => {
  let call;
  t.mock.method(axios, 'get', async (url, config) => {
    call = { url, config };
    return { data: { configuredSizeMb: 4096, pendingReboot: true } };
  });
  const result = await apiPinsService.getPinsSystemSwap();
  assert.equal(call.url, 'http://10.0.0.25:8000/system/swap');
  assert.match(call.config.headers.Authorization, /^Bearer /);
  assert.equal(result.pendingReboot, true);
});

test('swap updates send a numeric size and preserve the job response', async (t) => {
  let call;
  t.mock.method(axios, 'put', async (url, data, config) => {
    call = { url, data, config };
    return { data: { jobId: 'swap-1', status: 'started' } };
  });
  const result = await apiPinsService.updatePinsSystemSwap(8);
  assert.equal(call.url, 'http://10.0.0.25:8000/system/swap');
  assert.deepEqual(call.data, { sizeGb: 8 });
  assert.match(call.config.headers.Authorization, /^Bearer /);
  assert.equal(result.jobId, 'swap-1');
});

test('older daemons and storage errors propagate so settings can explain failure', async (t) => {
  const error = Object.assign(new Error('Not enough free storage'), {
    response: { status: 409, data: { detail: 'Not enough free storage' } },
  });
  t.mock.method(axios, 'put', async () => {
    throw error;
  });
  await assert.rejects(apiPinsService.updatePinsSystemSwap(8), (value) => value === error);
});
