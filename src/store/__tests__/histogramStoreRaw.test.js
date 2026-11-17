import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: axios } = await import('axios');
const { rawHttp } = await import('@/services/api/core');
const { setupErrorHandler } = await import('@/utils/errorHandler');
const { useSettingsStore } = await import('@/store/settingsStore');
const { apiStore } = await import('@/store/store');
const { useHistogramStore } = await import('@/store/histogramStore');
const { HISTOGRAM_BINS } = await import('@/utils/rawImage/parseRawImage');

freshPinia();
const settingsStore = useSettingsStore();
settingsStore.connection.ip = '10.0.0.5';
settingsStore.connection.port = 5000;
settingsStore.connection.instances = [];
settingsStore.selectedInstanceId = null;
apiStore().apiPort = 1888;
const histogramStore = useHistogramStore();

// The app's global interceptors turn failed requests into resolved mocks; the raw image
// requests must still see the real status and body.
setupErrorHandler();

const encode = (text) => new TextEncoder().encode(text).buffer;

function stubAdapter(t, status, data, headers = {}) {
  const calls = [];
  const adapter = async (config) => {
    calls.push(config);
    const response = { status, statusText: String(status), data, headers, config };
    if (status >= 200 && status < 300) return response;
    throw new axios.AxiosError('failed', 'ERR_BAD_RESPONSE', config, null, response);
  };
  const previousRaw = rawHttp.defaults.adapter;
  const previousGlobal = axios.defaults.adapter;
  rawHttp.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  t.after(() => {
    rawHttp.defaults.adapter = previousRaw;
    axios.defaults.adapter = previousGlobal;
  });
  return calls;
}

function container(meta, values) {
  const json = new TextEncoder().encode(JSON.stringify(meta));
  let offset = 4 + json.length;
  offset += (4 - (offset % 4)) % 4;
  const buffer = new ArrayBuffer(offset + HISTOGRAM_BINS * 4 + values.length * 2);
  new DataView(buffer).setUint32(0, json.length, true);
  new Uint8Array(buffer, 4, json.length).set(json);
  const histogram = new Uint32Array(buffer, offset, HISTOGRAM_BINS);
  values.forEach((v) => histogram[v]++);
  new Uint16Array(buffer, offset + HISTOGRAM_BINS * 4, values.length).set(values);
  return buffer;
}

async function statusFor(url, source = { kind: 'prepared' }) {
  await histogramStore.requestRaw(url, source);
  return histogramStore.getEntry(url)?.status;
}

test('a plugin without the route (HTML 404) is reported as unsupported', async (t) => {
  stubAdapter(t, 404, encode('<html>404 Not Found</html>'), { 'content-type': 'text/html' });
  assert.equal(await statusFor('blob:a'), 'unsupported');
});

test('a backend answering unknown paths with a page (200, HTML) is unsupported too', async (t) => {
  stubAdapter(t, 200, encode('<!doctype html><html></html>'), { 'content-type': 'text/html' });
  assert.equal(await statusFor('blob:b'), 'unsupported');
});

test("the plugin's JSON error code survives the global interceptors", async (t) => {
  stubAdapter(
    t,
    409,
    encode(JSON.stringify({ success: false, code: 'livestack-save-disabled', error: 'x' })),
    { 'content-type': 'application/json' }
  );
  const status = await statusFor('blob:c', { kind: 'livestack', target: 'M31', filter: 'L' });
  assert.equal(status, 'livestack-save-disabled');
});

test('a valid container becomes ready with auto levels and the request hits the plugin port', async (t) => {
  const meta = {
    version: 1,
    imageId: 'prepared-1',
    width: 2,
    height: 2,
    sourceWidth: 2,
    sourceHeight: 2,
    channels: 1,
    bitDepth: 16,
    isBayered: false,
    bayerPattern: null,
    stats: [{ min: 100, max: 400, mean: 250, median: 200, mad: 10, clipLow: 0, clipHigh: 0 }],
  };
  const calls = stubAdapter(t, 200, container(meta, [100, 200, 300, 400]), {
    'content-type': 'application/octet-stream',
  });

  assert.equal(await statusFor('blob:d'), 'ready');
  assert.equal(calls[0].url, 'http://10.0.0.5:5000/api/raw-image/prepared');
  const entry = histogramStore.getEntry('blob:d');
  assert.equal(entry.levels.length, 1);
  assert.ok(entry.levels[0].black > 0 && entry.levels[0].black < 200 / 65535);
  assert.deepEqual([...entry.offsets], [0]);
  histogramStore.clearImageCache('blob:d');
  assert.equal(histogramStore.getEntry('blob:d'), null);
});
