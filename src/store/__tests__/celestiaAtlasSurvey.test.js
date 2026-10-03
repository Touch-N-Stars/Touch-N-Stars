import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: axios } = await import('axios');
const { useSettingsStore } = await import('@/store/settingsStore');
const { apiStore } = await import('@/store/store');
const { useCelestiaAtlasSurveyStore } = await import('@/store/celestiaAtlasSurveyStore');

// apiService caches its store references from the first active Pinia (see
// apiServiceEndpoints.test.js), so one Pinia serves every test in this file.
freshPinia();
const settingsStore = useSettingsStore();
apiStore(); // core.js resolves both the settings and the api store from the active Pinia
settingsStore.connection.ip = '10.0.0.5';
settingsStore.connection.port = 5000;
settingsStore.connection.instances = [];
settingsStore.selectedInstanceId = null;

function serverStatus({
  installedOrder = null,
  present = {},
  freeBytes = 5e9,
  job = null,
  legacyFormat = false,
} = {}) {
  const orders = [3, 4, 5, 6, 7].map((order) => {
    const tileCount = 12 * 4 ** order;
    const tilesPresent =
      present[order] ?? (installedOrder !== null && order <= installedOrder ? tileCount : 0);
    return {
      order,
      tileCount,
      tilesPresent,
      bytes: tilesPresent * 20_000,
      complete: tilesPresent >= tileCount,
    };
  });
  return {
    success: true,
    installedOrder,
    hasAllsky: installedOrder !== null,
    legacyFormat,
    totalBytes: orders.reduce((sum, order) => sum + order.bytes, 0),
    freeBytes,
    orders,
    job,
    minOrder: 3,
    baseOrder: 4,
    maxOrder: 7,
  };
}

test('status is polled from the plugin server on the instance port and mirrored into the store', async (t) => {
  const calls = [];
  t.mock.method(axios, 'get', async (url, config) => {
    calls.push({ url, config });
    return { status: 200, data: serverStatus({ installedOrder: 4 }) };
  });
  const store = useCelestiaAtlasSurveyStore();
  store.reset();

  await store.refresh();

  assert.equal(calls[0].url, 'http://10.0.0.5:5000/api/atlas/survey/status');
  assert.deepEqual(calls[0].config.params, { survey: 'dss' });
  assert.equal(store.supported, true);
  assert.equal(store.loaded, true);
  assert.equal(store.installedOrder, 4);
  assert.equal(store.isRunning, false);
  assert.equal(store.hasAnyData, true);
});

test('a plugin without the endpoints (404) is reported as unsupported, not as an error', async (t) => {
  t.mock.method(axios, 'get', async () => ({ status: 404, data: '' }));
  const store = useCelestiaAtlasSurveyStore();
  store.reset();

  await store.refresh();

  assert.equal(store.supported, false);
  assert.equal(store.error, '');
  assert.equal(store.status, null);
  assert.equal(store.loaded, true);
});

test('order options estimate only what is still missing and mark installed orders', async (t) => {
  t.mock.method(axios, 'get', async () => ({
    status: 200,
    // orders 3-4 complete, half of order 5 already on disk
    data: serverStatus({ installedOrder: 4, present: { 5: 6144 } }),
  }));
  const store = useCelestiaAtlasSurveyStore();
  store.reset();
  await store.refresh();

  const options = store.orderOptions;
  assert.deepEqual(
    options.map((option) => [option.order, option.installed]),
    [
      [4, true],
      [5, false],
      [6, false],
      [7, false],
    ]
  );
  assert.equal(options[0].missingBytes, 0);
  assert.equal(options[1].missingBytes, Math.round((12288 * 75_000) / 2));
  assert.equal(options[2].missingBytes, Math.round((12288 * 75_000) / 2) + 49152 * 93_000);
});

test('a legacy WebP survey counts as not installed but still as data that can be deleted', async (t) => {
  t.mock.method(axios, 'get', async () => ({
    status: 200,
    data: serverStatus({ legacyFormat: true }),
  }));
  const store = useCelestiaAtlasSurveyStore();
  store.reset();
  await store.refresh();

  assert.equal(store.legacyFormat, true);
  assert.equal(store.installedOrder, null);
  assert.equal(store.hasAnyData, true);
  assert.equal(store.hasPartialOrder, false);
  assert.equal(store.estimateMissingBytes(4), 768 * 42_000 + 3072 * 55_000);
});

test('the free-space check applies the server margin on top of the estimate', async (t) => {
  const baseEstimate = 768 * 42_000 + 3072 * 55_000;
  t.mock.method(axios, 'get', async () => ({
    status: 200,
    data: serverStatus({ freeBytes: baseEstimate * 1.05 }),
  }));
  const store = useCelestiaAtlasSurveyStore();
  store.reset();
  await store.refresh();

  assert.equal(store.estimateMissingBytes(4), baseEstimate);
  assert.equal(store.hasEnoughFreeSpace(4), false);

  store.status.freeBytes = baseEstimate * 1.2;
  assert.equal(store.hasEnoughFreeSpace(4), true);

  // Unknown free space never blocks the button; the server still refuses when full.
  store.status.freeBytes = null;
  assert.equal(store.hasEnoughFreeSpace(7), true);
});

test('actions post to the plugin server and surface a refused start as actionError', async (t) => {
  const posts = [];
  t.mock.method(axios, 'get', async () => ({
    status: 200,
    data: serverStatus({
      job: { state: 'running', targetOrder: 4, currentOrder: 3, tilesDone: 10, tilesTotal: 3840 },
    }),
  }));
  t.mock.method(axios, 'post', async (url, body) => {
    posts.push({ url, body });
    return {
      status: 200,
      data: { success: false, error: 'A survey download is already running.', code: 409 },
    };
  });
  const store = useCelestiaAtlasSurveyStore();
  store.reset();

  const started = await store.startDownload(5);

  assert.equal(started, false);
  assert.equal(posts[0].url, 'http://10.0.0.5:5000/api/atlas/survey/download');
  assert.deepEqual(posts[0].body, { survey: 'dss', targetOrder: 5 });
  assert.equal(store.actionError, 'A survey download is already running.');
  assert.equal(store.busy, false);

  await store.refresh();
  assert.equal(store.isRunning, true);
  assert.ok(Math.abs(store.progressFraction - 10 / 3840) < 1e-9);
});

test('deleteSurvey posts keepOrder only when given, to downgrade instead of wiping everything', async (t) => {
  const posts = [];
  t.mock.method(axios, 'get', async () => ({
    status: 200,
    data: serverStatus({ installedOrder: 5 }),
  }));
  t.mock.method(axios, 'post', async (url, body) => {
    posts.push({ url, body });
    return { status: 200, data: { success: true } };
  });
  const store = useCelestiaAtlasSurveyStore();
  store.reset();

  await store.deleteSurvey(4);
  assert.equal(posts[0].url, 'http://10.0.0.5:5000/api/atlas/survey/delete');
  assert.deepEqual(posts[0].body, { survey: 'dss', keepOrder: 4 });

  await store.deleteSurvey();
  assert.deepEqual(posts[1].body, { survey: 'dss' });
});

test('tick refreshes every time while a job runs but throttles when idle', async (t) => {
  let running = true;
  let gets = 0;
  t.mock.method(axios, 'get', async () => {
    gets += 1;
    return {
      status: 200,
      data: serverStatus({
        job: running ? { state: 'running', tilesDone: 1, tilesTotal: 10 } : { state: 'completed' },
      }),
    };
  });
  const store = useCelestiaAtlasSurveyStore();
  store.reset();

  await store.tick();
  await store.tick();
  assert.equal(gets, 2);

  running = false;
  await store.tick(); // observes the finished job
  await store.tick(); // idle now: within the throttle window, no request
  assert.equal(gets, 3);

  store.lastRefreshAt = Date.now() - 60_000;
  await store.tick();
  assert.equal(gets, 4);
});

function nsnsStatus({ installedOrder = null } = {}) {
  const counts = { 3: 528, 4: 2016, 5: 8000, 6: 31872 };
  const orders = [3, 4, 5, 6].map((order) => {
    const tilesPresent = installedOrder !== null && order <= installedOrder ? counts[order] : 0;
    return {
      order,
      tileCount: counts[order],
      tilesPresent,
      bytes: tilesPresent * 80_000,
      complete: tilesPresent >= counts[order],
    };
  });
  return {
    success: true,
    survey: 'nsns',
    installedOrder,
    hasAllsky: installedOrder !== null,
    legacyFormat: false,
    totalBytes: orders.reduce((sum, order) => sum + order.bytes, 0),
    freeBytes: 5e9,
    orders,
    job: null,
    minOrder: 3,
    baseOrder: 4,
    maxOrder: 6,
  };
}

test('the NSNS store is separate from DSS and asks the server for its own survey', async (t) => {
  const calls = [];
  t.mock.method(axios, 'get', async (url, config) => {
    calls.push({ url, config });
    return { status: 200, data: nsnsStatus({ installedOrder: 4 }) };
  });
  const dss = useCelestiaAtlasSurveyStore('dss');
  const nsns = useCelestiaAtlasSurveyStore('nsns');
  dss.reset();
  nsns.reset();

  await nsns.refresh();

  assert.notEqual(dss, nsns);
  assert.equal(useCelestiaAtlasSurveyStore('unknown'), dss);
  assert.deepEqual(calls[0].config.params, { survey: 'nsns' });
  assert.equal(nsns.supported, true);
  assert.equal(nsns.installedOrder, 4);
  assert.equal(dss.loaded, false);
  assert.deepEqual(
    nsns.orderOptions.map((option) => [option.order, option.installed]),
    [
      [4, true],
      [5, false],
      [6, false],
    ]
  );
  assert.equal(nsns.estimateMissingBytes(5), 8000 * 92_000);
});

test('a plugin from before NSNS answers with DSS status, which counts as unsupported for NSNS', async (t) => {
  t.mock.method(axios, 'get', async () => ({
    status: 200,
    data: serverStatus({ installedOrder: 4 }),
  }));
  const nsns = useCelestiaAtlasSurveyStore('nsns');
  nsns.reset();

  await nsns.refresh();

  assert.equal(nsns.supported, false);
  assert.equal(nsns.status, null);
});

test('NSNS actions carry the survey id', async (t) => {
  const posts = [];
  t.mock.method(axios, 'get', async () => ({ status: 200, data: nsnsStatus() }));
  t.mock.method(axios, 'post', async (url, body) => {
    posts.push({ url, body });
    return { status: 200, data: { success: true } };
  });
  const nsns = useCelestiaAtlasSurveyStore('nsns');
  nsns.reset();

  await nsns.startDownload(4);
  await nsns.cancelDownload();
  await nsns.deleteSurvey();

  assert.deepEqual(
    posts.map((post) => [post.url.replace('http://10.0.0.5:5000/api/', ''), post.body]),
    [
      ['atlas/survey/download', { survey: 'nsns', targetOrder: 4 }],
      ['atlas/survey/cancel', { survey: 'nsns' }],
      ['atlas/survey/delete', { survey: 'nsns' }],
    ]
  );
});
