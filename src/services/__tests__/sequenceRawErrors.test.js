import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: axios } = await import('axios');
const { default: apiService } = await import('@/services/apiService');
const { rawHttp } = await import('@/services/api/core');
const { setupErrorHandler } = await import('@/utils/errorHandler');
const { useSettingsStore } = await import('@/store/settingsStore');
const { apiStore } = await import('@/store/store');

freshPinia();
const settingsStore = useSettingsStore();
settingsStore.connection.ip = '10.0.0.5';
settingsStore.connection.port = 5000;
settingsStore.connection.instances = [];
settingsStore.selectedInstanceId = null;
apiStore().apiPort = 1888;

// The app installs the global interceptors that turn failed requests into resolved mocks.
// The sequence feature detection must not be affected by them.
setupErrorHandler();

// Answers every request with the given status/body, rejecting like axios does for non-2xx
function stubAdapter(t, status, data, headers = {}) {
  const adapter = async (config) => {
    const response = { status, statusText: String(status), data, headers, config };
    if (status >= 200 && status < 300) return response;
    const error = new axios.AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_RESPONSE',
      config,
      null,
      response
    );
    throw error;
  };
  const previousRaw = rawHttp.defaults.adapter;
  const previousGlobal = axios.defaults.adapter;
  rawHttp.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  t.after(() => {
    rawHttp.defaults.adapter = previousRaw;
    axios.defaults.adapter = previousGlobal;
  });
}

const HTML_404 = '<html><body>404 Not Found</body></html>';

test('the global interceptor resolves a 404 into a mock (why rawHttp is needed)', async (t) => {
  stubAdapter(t, 404, HTML_404);
  const res = await axios.get('http://10.0.0.5:5000/api/sequence/status');
  assert.equal(res.data.Success, false);
  assert.equal(res.data.StatusCode, 404);
});

test('fetchSequenceStatus rejects with the real response on an unknown route (PINS plugin)', async (t) => {
  stubAdapter(t, 404, HTML_404);
  await assert.rejects(apiService.fetchSequenceStatus(), (e) => {
    assert.equal(e.response.status, 404);
    assert.equal(e.response.data, HTML_404);
    return true;
  });
});

test('fetchSequenceStatus keeps the JSON body of an endpoint error', async (t) => {
  stubAdapter(t, 400, { Success: false, Error: 'No sequence loaded' });
  await assert.rejects(apiService.fetchSequenceStatus(), (e) => {
    assert.equal(e.response.status, 400);
    assert.equal(e.response.data.Error, 'No sequence loaded');
    return true;
  });
});

test('the editor probe is negative for an unknown route', async (t) => {
  stubAdapter(t, 404, HTML_404);
  assert.equal(await apiService.probeSequenceEditorSupport(), false);
});

test('the editor probe is positive when the endpoint answers "no sequence loaded"', async (t) => {
  stubAdapter(t, 400, { Success: false, Error: 'No sequence loaded' });
  assert.equal(await apiService.probeSequenceEditorSupport(), true);
});

test('the editor probe is positive for a status payload', async (t) => {
  stubAdapter(t, 200, { Revision: 'rev-a', Running: false, Items: [] });
  assert.equal(await apiService.probeSequenceEditorSupport(), true);
});
