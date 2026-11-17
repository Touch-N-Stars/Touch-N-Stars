import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();
freshPinia();
const { default: axios } = await import('axios');
const { default: apiPinsService } = await import('@/services/apiPinsService');
const { useSettingsStore } = await import('@/store/settingsStore');
useSettingsStore().connection.ip = '10.0.0.25';

test('repository status uses the selected Pi and authentication', async (t) => {
  let call;
  t.mock.method(axios, 'get', async (url, config) => {
    call = { url, config };
    return { data: { channel: 'trixie', configured: true } };
  });
  assert.equal((await apiPinsService.getPinsRepository()).channel, 'trixie');
  assert.equal(call.url, 'http://10.0.0.25:8000/repository');
  assert.match(call.config.headers.Authorization, /^Bearer /);
});

test('switch posts only the allowlisted channel and preserves the asynchronous job', async (t) => {
  const calls = [];
  t.mock.method(axios, 'post', async (url, data, config) => {
    calls.push({ url, data, config });
    return { data: { jobId: 'repository-1', status: 'started' } };
  });
  for (const channel of ['unstable', 'trixie']) {
    assert.equal((await apiPinsService.setPinsRepository(channel)).jobId, 'repository-1');
  }
  assert.deepEqual(
    calls.map((call) => call.data),
    [{ channel: 'unstable' }, { channel: 'trixie' }]
  );
  assert.equal(calls[0].url, 'http://10.0.0.25:8000/repository');
  assert.match(calls[0].config.headers.Authorization, /^Bearer /);
  assert.throws(() => apiPinsService.setPinsRepository('testing'), /channel/);
  assert.equal(calls.length, 2);
});
