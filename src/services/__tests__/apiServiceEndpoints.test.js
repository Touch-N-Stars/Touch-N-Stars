import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: axios } = await import('axios');
const { default: apiService } = await import('@/services/apiService');
const { useSettingsStore } = await import('@/store/settingsStore');
const { apiStore } = await import('@/store/store');

// apiService caches its store references from the first active Pinia, so this
// file uses ONE Pinia for all tests and mutates the store state per test.
freshPinia();
const settingsStore = useSettingsStore();
const store = apiStore();

function seedInstance({ ip, port, apiPort }) {
  settingsStore.connection.ip = ip;
  settingsStore.connection.port = port;
  settingsStore.connection.instances = [];
  settingsStore.selectedInstanceId = null;
  store.apiPort = apiPort;
}

function recordGets(t, data = { Success: true }) {
  const calls = [];
  t.mock.method(axios, 'get', async (url, config) => {
    calls.push({ url, config });
    return { status: 200, data };
  });
  return calls;
}

test('the two APIs target different ports: plugin API uses the instance port, Advanced API the handshake apiPort', async (t) => {
  seedInstance({ ip: '10.0.0.5', port: 5000, apiPort: 1888 });
  const calls = recordGets(t);

  await apiService.fetchTnsPluginVersion(); // TNS plugin API
  await apiService.fetchApiVersion(); // Advanced API (v2)

  assert.equal(calls[0].url, 'http://10.0.0.5:5000/api/version');
  assert.equal(calls[1].url, 'http://10.0.0.5:1888/v2/api/version');
});

test('URLs are rebuilt per request - an instance switch redirects every call', async (t) => {
  seedInstance({ ip: '10.0.0.5', port: 5000, apiPort: 1888 });
  const calls = recordGets(t);

  await apiService.fetchTnsPluginVersion();

  // switchBackend(): endpoint changes, new handshake fills a new apiPort
  seedInstance({ ip: '10.0.0.9', port: 5001, apiPort: 2999 });
  await apiService.fetchTnsPluginVersion();
  await apiService.fetchApiVersion();

  assert.equal(calls[0].url, 'http://10.0.0.5:5000/api/version');
  assert.equal(calls[1].url, 'http://10.0.0.9:5001/api/version');
  assert.equal(calls[2].url, 'http://10.0.0.9:2999/v2/api/version');
});

test('PINS daemon calls hit port 8000 on the selected instance host', async (t) => {
  seedInstance({ ip: '10.0.0.5', port: 5000, apiPort: 1888 });
  const calls = recordGets(t, []);

  await apiService.getFileDevices();
  assert.equal(calls[0].url, 'http://10.0.0.5:8000/files/devices');
});

test('PINS daemon token prefers the selected instance token over global fallbacks', async (t) => {
  seedInstance({ ip: '10.0.0.5', port: 5000, apiPort: 1888 });
  settingsStore.connection.instances = [
    { id: 'a', ip: '10.0.0.5', port: 5000, apiToken: 'instance-a-token' },
  ];
  settingsStore.selectedInstanceId = 'a';
  localStorage.setItem('PINS_API_TOKEN', 'global-token');
  t.after(() => localStorage.removeItem('PINS_API_TOKEN'));

  const calls = recordGets(t, []);
  await apiService.getFileDevices();
  assert.equal(calls[0].config.headers.Authorization, 'Bearer instance-a-token');
});

test('PINS daemon token falls back to the global localStorage token when the instance has none', async (t) => {
  seedInstance({ ip: '10.0.0.5', port: 5000, apiPort: 1888 });
  settingsStore.connection.instances = [{ id: 'a', ip: '10.0.0.5', port: 5000 }];
  settingsStore.selectedInstanceId = 'a';
  localStorage.setItem('PINS_API_TOKEN', 'global-token');
  t.after(() => localStorage.removeItem('PINS_API_TOKEN'));

  const calls = recordGets(t, []);
  await apiService.getFileDevices();
  // Documented multi-instance caveat (audit #7): this fallback is shared by
  // ALL instances - only correct when they use the same token.
  assert.equal(calls[0].config.headers.Authorization, 'Bearer global-token');
});

test('deleting a history image is a DELETE by entry id with the file name as cross-check', async (t) => {
  seedInstance({ ip: '10.0.0.5', port: 5000, apiPort: 1888 });
  const calls = [];
  t.mock.method(axios, 'delete', async (url, config) => {
    calls.push({ url, config });
    return { status: 200, data: { Success: true } };
  });

  await apiService.deleteHistoryImage('3f2b9c6e1d4a4f0b8e7c2a1d5b6e7f80', 'M31_0007.fits');
  await apiService.deleteHistoryImage('a/b');

  assert.equal(
    calls[0].url,
    'http://10.0.0.5:1888/v2/api/image-history/3f2b9c6e1d4a4f0b8e7c2a1d5b6e7f80'
  );
  assert.deepEqual(calls[0].config.params, { filename: 'M31_0007.fits' });
  // The id lands in the path, so it is encoded; without a file name the
  // parameter is omitted entirely.
  assert.equal(calls[1].url, 'http://10.0.0.5:1888/v2/api/image-history/a%2Fb');
  assert.deepEqual(calls[1].config.params, {});
});
