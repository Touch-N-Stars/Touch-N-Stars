import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();
freshPinia();
const { default: axios } = await import('axios');
const { default: apiPinsService } = await import('@/services/apiPinsService');
const { useSettingsStore } = await import('@/store/settingsStore');
useSettingsStore().connection.ip = '10.0.0.25';

test('saved network actions use the selected Pi, authentication and UUID routes', async (t) => {
  const calls = [];
  for (const method of ['get', 'put', 'post', 'delete']) {
    t.mock.method(axios, method, async (url, ...args) => {
      const config = args.at(-1);
      calls.push({ method, url, config, data: args.length > 1 ? args[0] : undefined });
      return { data: method === 'get' ? { networks: [] } : { jobId: 'wifi-job' } };
    });
  }
  assert.deepEqual(await apiPinsService.getPinsSavedWifiNetworks(), { networks: [] });
  assert.equal(
    (
      await apiPinsService.updatePinsSavedWifiNetwork('profile/id', {
        priority: 0,
        auto_connect: false,
      })
    ).jobId,
    'wifi-job'
  );
  assert.equal((await apiPinsService.connectPinsSavedWifiNetwork('profile/id')).jobId, 'wifi-job');
  assert.equal((await apiPinsService.forgetPinsSavedWifiNetwork('profile/id')).jobId, 'wifi-job');
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      'http://10.0.0.25:8000/wifi/networks',
      'http://10.0.0.25:8000/wifi/networks/profile%2Fid',
      'http://10.0.0.25:8000/wifi/networks/profile%2Fid/connect',
      'http://10.0.0.25:8000/wifi/networks/profile%2Fid',
    ]
  );
  for (const call of calls) assert.match(call.config.headers.Authorization, /^Bearer /);
  assert.deepEqual(calls[1].data, { priority: 0, auto_connect: false });
});
