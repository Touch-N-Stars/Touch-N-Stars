import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: axios } = await import('axios');
const { setupErrorHandler } = await import('@/utils/errorHandler');

freshPinia();
setupErrorHandler();

// Answers every request with the given status/body, rejecting like axios does for non-2xx
function stubAdapter(t, status, data) {
  const adapter = async (config) => {
    const response = { status, statusText: String(status), data, headers: {}, config };
    if (status >= 200 && status < 300) return response;
    throw new axios.AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_RESPONSE',
      config,
      null,
      response
    );
  };
  const previous = axios.defaults.adapter;
  axios.defaults.adapter = adapter;
  t.after(() => {
    axios.defaults.adapter = previous;
  });
}

test('a refused request keeps the server reason and ErrorCode', async (t) => {
  stubAdapter(t, 503, {
    Success: false,
    Error: 'Tilter state cannot be read',
    ErrorCode: 'status-unavailable',
  });
  const res = await axios.post('http://10.0.0.5:1888/api/hocusfocus/tilter/set-positions');
  assert.equal(res.data.Success, false);
  assert.equal(res.data.Error, 'Tilter state cannot be read');
  assert.equal(res.data.ErrorCode, 'status-unavailable');
  assert.equal(res.data.StatusCode, 503);
});

test('a body without Error falls back to its Message', async (t) => {
  stubAdapter(t, 409, { Success: false, Message: 'Base filter has no measurement' });
  const res = await axios.post('http://10.0.0.5:1888/api/filter-offset/apply');
  assert.equal(res.data.Error, 'Base filter has no measurement');
  assert.equal(res.data.StatusCode, 409);
});

test('an HTML error body still gets the generic text', async (t) => {
  stubAdapter(t, 404, '<html><body>404 Not Found</body></html>');
  const res = await axios.put('http://10.0.0.5:1888/api/unknown');
  assert.equal(res.data.Success, false);
  assert.equal(res.data.Error, 'PUT request failed');
  assert.equal(res.data.StatusCode, 404);
  assert.equal(res.data.Response, '');
});

test('a plugin body with a lowercase error key keeps its reason', async (t) => {
  stubAdapter(t, 500, { error: 'Interner Fehler beim Starten des Autofokus' });
  const res = await axios.get('http://10.0.0.5:5000/api/autofocus/start');
  assert.equal(res.data.Success, false);
  assert.equal(res.data.Error, 'Interner Fehler beim Starten des Autofokus');
});
