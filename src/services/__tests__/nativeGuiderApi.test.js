import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: apiService } = await import('@/services/apiService');
const { nativeGuiderHttp, mapNativeGuiderError } = await import('@/services/api/nativeGuider');
const { useSettingsStore } = await import('@/store/settingsStore');
const { apiStore } = await import('@/store/store');

// One Pinia for the whole file (apiService caches its store references).
freshPinia();
const settingsStore = useSettingsStore();
settingsStore.connection.ip = '10.0.0.5';
settingsStore.connection.port = 5000;
apiStore().apiPort = 1888;

function recordRequests(t, data = { success: true, response: { ok: 1 } }) {
  const calls = [];
  t.mock.method(nativeGuiderHttp, 'request', async (config) => {
    calls.push(config);
    return { status: 200, data };
  });
  return calls;
}

test('native guider calls go to the plugin server port and unwrap response', async (t) => {
  const calls = recordRequests(t);

  const result = await apiService.getNativeGuiderStatus();
  await apiService.getNativeGuiderSteps(200);
  await apiService.setNativeGuiderSetting('Gain', 120);
  await apiService.nativeGuiderAction('dither', { pixels: 3, raOnly: true });
  await apiService.buildNativeGuiderDarks({ minExposure: 1, maxExposure: 2, frames: 3 });

  assert.deepEqual(result, { ok: 1 });
  assert.equal(calls[0].method, 'get');
  assert.equal(calls[0].url, 'http://10.0.0.5:5000/api/internal-guider/status');
  assert.deepEqual(calls[1].params, { max: 200 });
  assert.equal(calls[2].method, 'post');
  assert.equal(calls[2].url, 'http://10.0.0.5:5000/api/internal-guider/settings');
  assert.deepEqual(calls[2].data, { name: 'Gain', value: 120 });
  assert.equal(calls[3].url, 'http://10.0.0.5:5000/api/internal-guider/dither');
  assert.deepEqual(calls[3].params, { pixels: 3, raOnly: true });
  assert.equal(calls[4].url, 'http://10.0.0.5:5000/api/internal-guider/darks/build');
  assert.deepEqual(calls[4].data, { minExposure: 1, maxExposure: 2, frames: 3 });
});

test('frame-info passes the pinned frame and the image URL carries the render options', async (t) => {
  const calls = recordRequests(t);
  await apiService.getNativeGuiderFrameInfo({ cropSize: 21, frame: 17 });
  assert.equal(calls[0].url, 'http://10.0.0.5:5000/api/internal-guider/frame-info');
  assert.deepEqual(calls[0].params, { cropSize: 21, frame: 17 });
  await apiService.getNativeGuiderFrameInfo({ secondaries: 2 });
  assert.deepEqual(calls[1].params, { cropSize: 31, secondaries: 2 });

  const url = apiService.getNativeGuiderImageUrl({ maxWidth: 768.4, stretch: 0.33, frame: 17 });
  assert.equal(
    url,
    'http://10.0.0.5:5000/api/internal-guider/image?maxWidth=768&stretch=0.33&quality=80&frame=17'
  );
});

test('failures carry the backend reason, status and code', async (t) => {
  t.mock.method(nativeGuiderHttp, 'request', async () => {
    const error = new Error('Request failed with status code 409');
    error.response = {
      status: 409,
      data: { success: false, error: 'No guider is connected.', code: 'NotAvailable' },
    };
    throw error;
  });

  await assert.rejects(apiService.nativeGuiderAction('loop'), (error) => {
    assert.equal(error.message, 'No guider is connected.');
    assert.equal(error.status, 409);
    assert.equal(error.code, 'NotAvailable');
    return true;
  });
});

test('star selection posts the frame position and keeps the rejection reason', async (t) => {
  const calls = recordRequests(t, {
    success: true,
    response: { action: 'select-star', star: { x: 101.5, y: 55.2 }, secondaryStars: 7 },
  });
  const result = await apiService.selectNativeGuiderStar(101.2, 55);
  assert.equal(calls[0].method, 'post');
  assert.equal(calls[0].url, 'http://10.0.0.5:5000/api/internal-guider/select-star');
  assert.deepEqual(calls[0].params, { x: 101.2, y: 55 });
  assert.ok(calls[0].timeout >= 60000, 'waits for the next guide frame');
  assert.equal(result.secondaryStars, 7);

  t.mock.method(nativeGuiderHttp, 'request', async () => {
    const error = new Error('Request failed with status code 409');
    error.response = {
      status: 409,
      data: {
        success: false,
        error: 'No star was found at that position.',
        code: 'Rejected',
        messageCode: 'NoStar',
        messageParameters: {},
      },
    };
    throw error;
  });
  await assert.rejects(apiService.selectNativeGuiderStar(10, 20), (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.messageCode, 'NoStar');
    assert.equal(error.message, 'No star was found at that position.');
    return true;
  });
});

test('cancelled requests are flagged, network errors keep their message', () => {
  const cancelled = mapNativeGuiderError({ code: 'ERR_CANCELED' });
  assert.equal(cancelled.cancelled, true);
  const network = mapNativeGuiderError(new Error('Network Error'));
  assert.equal(network.message, 'Network Error');
  assert.equal(network.status, undefined);
});

test('coach calls use the coach routes, bodies and history limit', async (t) => {
  const calls = recordRequests(t, { success: true, response: { phase: 'Running' } });

  const started = await apiService.startNativeGuiderCoach({
    steps: ['CameraCheck', 'Drift'],
    driftSeconds: 240,
  });
  await apiService.getNativeGuiderCoach();
  await apiService.skipNativeGuiderCoachStep();
  await apiService.cancelNativeGuiderCoach();
  await apiService.applyNativeGuiderCoachActions(['drift.minMove', 'trial:B']);
  await apiService.getNativeGuiderCoachHistory(12);
  await apiService.dismissNativeGuiderHint('hint.raOscillation');

  assert.deepEqual(started, { phase: 'Running' });
  const base = 'http://10.0.0.5:5000/api/internal-guider/';
  assert.deepEqual(
    calls.map((c) => [c.method, c.url.slice(base.length)]),
    [
      ['post', 'coach/start'],
      ['get', 'coach'],
      ['post', 'coach/skip'],
      ['post', 'coach/cancel'],
      ['post', 'coach/apply'],
      ['get', 'coach/history'],
      ['post', 'hints/dismiss'],
    ]
  );
  assert.deepEqual(calls[0].data, { steps: ['CameraCheck', 'Drift'], driftSeconds: 240 });
  assert.deepEqual(calls[4].data, { ids: ['drift.minMove', 'trial:B'] });
  assert.deepEqual(calls[5].params, { max: 12 });
  assert.deepEqual(calls[6].data, { id: 'hint.raOscillation' });
});

test('a coach rejection keeps the guider message code', async (t) => {
  t.mock.method(nativeGuiderHttp, 'request', async () => {
    const error = new Error('Request failed with status code 409');
    error.response = {
      status: 409,
      data: {
        success: false,
        error: 'Another session is running.',
        code: 'Rejected',
        messageCode: 'coach.busy',
        messageParameters: { sessionId: 's1' },
      },
    };
    throw error;
  });

  await assert.rejects(apiService.startNativeGuiderCoach({}), (error) => {
    assert.equal(error.message, 'Another session is running.');
    assert.equal(error.status, 409);
    assert.equal(error.messageCode, 'coach.busy');
    assert.deepEqual(error.messageParameters, { sessionId: 's1' });
    return true;
  });
});
