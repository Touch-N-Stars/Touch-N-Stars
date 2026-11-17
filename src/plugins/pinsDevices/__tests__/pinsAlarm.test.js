import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: axios } = await import('axios');
const { default: apiService } = await import('@/services/apiService');
const { rawHttp } = await import('@/services/api/core');
const { setupErrorHandler } = await import('@/utils/errorHandler');
const { useSettingsStore } = await import('@/store/settingsStore');
const { apiStore } = await import('@/store/store');
const { usePinsAlarmStore } = await import('@/plugins/pinsDevices/store/pinsAlarmStore');
const alarmUtils = await import('@/plugins/pinsDevices/utils/alarm');

// One Pinia for the whole file: apiService keeps the store references of the first one
freshPinia();
const settingsStore = useSettingsStore();
settingsStore.connection.ip = '10.0.0.5';
settingsStore.connection.port = 5000;
settingsStore.connection.instances = [];
settingsStore.selectedInstanceId = null;
apiStore().apiPort = 1888;
apiStore().isBackendReachable = true;
setupErrorHandler();

const HTML_404 = '<html><body>404 Not Found</body></html>';
const BASE = 'http://10.0.0.5:5000/api/pins/alarm';

// Answers by route: handler(config) -> [status, data]; records every request
function stubRoutes(t, handler) {
  const calls = [];
  const adapter = async (config) => {
    calls.push(config);
    const [status, data] = handler(config);
    const response = { status, statusText: String(status), data, headers: {}, config };
    if (status >= 200 && status < 300) return response;
    if (status === 0) {
      throw new axios.AxiosError('Network Error', 'ERR_NETWORK', config, null, undefined);
    }
    throw new axios.AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_RESPONSE',
      config,
      null,
      response
    );
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

const ok = (response) => [200, { Success: true, Response: response, StatusCode: 200, Type: 'X' }];
const fail = (status, error) => [
  status,
  { Success: false, Error: error, StatusCode: status, Type: 'Error' },
];

const SETTINGS = {
  Enabled: true,
  Categories: {
    Errors: true,
    Guiding: true,
    Mount: true,
    Safety: true,
    PowerBox: true,
    Disk: true,
    Warnings: false,
  },
  Volume: 50,
  ToneMs: 400,
  PauseMs: 600,
  BurstSeconds: 5,
  GraceMinutes: 3,
  ThrottleMinutes: 10,
  Exclusions: ['Focuser'],
};

function resetStore() {
  const s = usePinsAlarmStore();
  s.$reset();
  return s;
}

test('the API calls hit the alarm routes with the right method, body and params', async (t) => {
  const calls = stubRoutes(t, () => ok({}));
  await apiService.getPinsAlarmSettings();
  await apiService.setPinsAlarmSettings({ Volume: 20 });
  await apiService.testPinsAlarm({ Volume: 30 });
  await apiService.silencePinsAlarm();
  await apiService.getPinsAlarmStatus();
  await apiService.getPinsAlarmHistory(5);
  const seen = calls.map((c) => [
    c.method,
    c.url,
    c.data ? JSON.parse(c.data) : undefined,
    c.params,
  ]);
  assert.deepEqual(seen, [
    ['get', BASE, undefined, undefined],
    ['put', BASE, { Volume: 20 }, undefined],
    ['post', `${BASE}/test`, { Volume: 30 }, undefined],
    ['post', `${BASE}/silence`, { Minutes: 30 }, undefined],
    ['get', `${BASE}/status`, undefined, undefined],
    ['get', `${BASE}/history`, undefined, { limit: 5 }],
  ]);
});

test('a box without the alarm API (HTML 404) is marked unsupported and not polled', async (t) => {
  const calls = stubRoutes(t, () => [404, HTML_404]);
  const s = resetStore();
  await s.loadSettings();
  assert.equal(s.unsupported, true);
  assert.equal(s.loadError, null);
  // even with settings from before, an unsupported box is not polled
  s.settings = SETTINGS;
  const before = calls.length;
  await s.refreshLive();
  assert.equal(calls.length, before);
});

test('no answer is a load error, not an old plugin', async (t) => {
  stubRoutes(t, () => [0, null]);
  const s = resetStore();
  await s.loadSettings();
  assert.equal(s.unsupported, false);
  assert.ok(s.loadError);
});

test('settings load and live data refresh', async (t) => {
  stubRoutes(t, (c) => {
    if (c.url === BASE) return ok({ Settings: SETTINGS, Stored: false, Defaults: SETTINGS });
    if (c.url.endsWith('/status')) return ok({ Enabled: true, Armed: true });
    if (c.url.endsWith('/history'))
      return ok({ Entries: [{ Id: 1, Key: 'k', Outcome: 'Beeped' }] });
    return ok({});
  });
  const s = resetStore();
  await s.loadSettings();
  assert.equal(s.settings.Volume, 50);
  assert.equal(s.stored, false);
  await s.refreshLive();
  assert.equal(s.status.Armed, true);
  assert.equal(s.history.length, 1);
});

test('test beep results', async (t) => {
  const cases = [
    [ok({ Result: 'Ok', Tones: 5, Volume: 50 }), { kind: 'ok', tones: 5 }],
    [fail(404, 'PowerBox device not connected'), { kind: 'noPowerBox' }],
    [fail(400, 'Beep method not available on PowerBox device'), { kind: 'notSupported' }],
    [fail(400, 'Volume must be 1..100'), { kind: 'failed', reason: 'Volume must be 1..100' }],
    [
      fail(500, 'PowerBox did not start the tone'),
      { kind: 'failed', reason: 'PowerBox did not start the tone' },
    ],
    [fail(503, 'Shutting down'), { kind: 'failed', reason: 'Shutting down' }],
    [[0, null], { kind: 'unreachable' }],
  ];
  for (const [answer, expected] of cases) {
    await t.test(JSON.stringify(expected), async (tt) => {
      stubRoutes(tt, (c) => (c.url.endsWith('/test') ? answer : ok({})));
      const s = resetStore();
      s.settings = SETTINGS;
      const result = await s.testBeep({ Volume: 30 });
      assert.deepEqual(result, expected);
      assert.equal(s.testing, false);
    });
  }
});

test('saveSettings keeps the old settings on a refusal and runs one after the other', async (t) => {
  const order = [];
  let inFlight = 0;
  let overlapped = false;
  const calls = stubRoutes(t, (c) => {
    const body = JSON.parse(c.data);
    order.push(Object.keys(body)[0]);
    if (body.Volume === 0) return fail(400, 'Volume must be 1..100');
    return ok({ Settings: { ...SETTINGS, ...body }, Stored: true });
  });
  // a slow first answer must not let the second request overtake it
  const adapter = rawHttp.defaults.adapter;
  rawHttp.defaults.adapter = async (config) => {
    inFlight++;
    if (inFlight > 1) overlapped = true;
    try {
      if (config.data && JSON.parse(config.data).Volume === 20)
        await new Promise((r) => setTimeout(r, 30));
      return await adapter(config);
    } finally {
      inFlight--;
    }
  };
  const s = resetStore();
  s.settings = SETTINGS;
  assert.equal(await s.saveSettings({ Volume: 0 }), false);
  assert.equal(s.settings.Volume, 50);
  assert.match(s.saveError, /Volume/);

  const first = s.saveSettings({ Volume: 20 });
  const second = s.saveSettings({ ToneMs: 300 });
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(overlapped, false);
  assert.deepEqual(order.slice(-2), ['Volume', 'ToneMs']);
  assert.equal(s.settings.ToneMs, 300);
  assert.equal(s.saveError, null);
  assert.equal(calls.length, 3);
});

test('exclusions are validated before they are sent', async (t) => {
  const calls = stubRoutes(t, (c) =>
    ok({ Settings: { ...SETTINGS, ...JSON.parse(c.data) }, Stored: true })
  );
  const s = resetStore();
  s.settings = SETTINGS;
  assert.equal(await s.addExclusion(' x '), 'tooShort');
  assert.equal(await s.addExclusion('focuser'), 'duplicate');
  assert.equal(await s.addExclusion('x'.repeat(201)), 'tooLong');
  assert.equal(calls.length, 0);
  assert.equal(await s.addExclusion('  Dome  '), null);
  assert.deepEqual(JSON.parse(calls[0].data), { Exclusions: ['Focuser', 'Dome'] });
  const full = Array.from({ length: 50 }, (_, i) => `entry${i}`);
  assert.equal(alarmUtils.validateExclusion('new', full), 'tooMany');
});

test('server times without an offset are UTC and corrected by the clock offset', () => {
  assert.equal(
    alarmUtils.parseServerUtc('2026-11-12T22:00:00').toISOString(),
    '2026-11-12T22:00:00.000Z'
  );
  assert.equal(
    alarmUtils.parseServerUtc('2026-11-12T22:00:00Z').toISOString(),
    '2026-11-12T22:00:00.000Z'
  );
  assert.equal(
    alarmUtils.parseServerUtc('2026-11-12T23:00:00+01:00').toISOString(),
    '2026-11-12T22:00:00.000Z'
  );
  // the box's clock is 60 s ahead of the phone
  assert.equal(
    alarmUtils.parseServerUtc('2026-11-12T22:01:00', 60_000).toISOString(),
    '2026-11-12T22:00:00.000Z'
  );
  assert.equal(alarmUtils.parseServerUtc(null), null);
  assert.equal(alarmUtils.parseServerUtc('garbage'), null);
});

test('status line priority', () => {
  const now = Date.parse('2026-11-12T22:00:00Z');
  const line = (status, muted) => alarmUtils.alarmStatusLine(status, muted, now)?.key;
  const base = { Enabled: true, PowerBoxConnected: true, GraceRemainingSeconds: 0, Armed: false };
  assert.equal(line({ ...base, Enabled: false, ShuttingDown: true }), 'disabled');
  assert.equal(line({ ...base, ShuttingDown: true }), 'shuttingDown');
  assert.equal(line(base, new Date(now + 60_000)), 'muted');
  assert.equal(line(base, new Date(now - 60_000)), 'standby');
  assert.equal(
    line({ ...base, PowerBoxConnected: false, GraceRemainingSeconds: 30 }),
    'noPowerBox'
  );
  assert.equal(line({ ...base, GraceRemainingSeconds: 75, Armed: true }), 'grace');
  assert.equal(
    alarmUtils.alarmStatusLine({ ...base, GraceRemainingSeconds: 75 }, null, now).params.time,
    '1:15'
  );
  assert.equal(line({ ...base, Armed: true }), 'armed');
  assert.equal(line(base), 'standby');
  assert.equal(alarmUtils.alarmStatusLine(null), null);
});

test('history entries that may be excluded', () => {
  assert.equal(
    alarmUtils.canExcludeEntry({ Origin: 'Log', Outcome: 'Beeped', Key: 'Foo.cs|Bar|baz' }),
    true
  );
  assert.equal(
    alarmUtils.canExcludeEntry({ Origin: 'Test', Outcome: 'Beeped', Key: 'test' }),
    false
  );
  assert.equal(
    alarmUtils.canExcludeEntry({ Origin: 'Log', Outcome: 'Excluded', Key: 'Foo.cs|Bar|baz' }),
    false
  );
  assert.equal(alarmUtils.outcomeTone('Beeped'), 'danger');
  assert.equal(alarmUtils.outcomeTone('BeepFailed'), 'warn');
  assert.equal(alarmUtils.outcomeTone('Throttled'), 'muted');
});

test('unchanged live data is not written again', async (t) => {
  stubRoutes(t, (c) => {
    if (c.url.endsWith('/status')) return ok({ Enabled: true, Armed: false });
    if (c.url.endsWith('/history'))
      return ok({ Entries: [{ Id: 1, Key: 'k', Outcome: 'Beeped' }] });
    return ok({});
  });
  const s = resetStore();
  s.settings = SETTINGS;
  await s.refreshLive();
  const status = s.status;
  const history = s.history;
  await s.refreshLive();
  assert.equal(s.status, status);
  assert.equal(s.history, history);
});

test('quick taps work on the current settings, not on the ones at the tap', async (t) => {
  const sent = [];
  stubRoutes(t, (c) => {
    if (c.method === 'get') return ok({ Settings: SETTINGS, Stored: true, Defaults: SETTINGS });
    const body = JSON.parse(c.data);
    sent.push(body);
    const s = usePinsAlarmStore().settings;
    const merged = { ...s, ...body, Categories: { ...s.Categories, ...(body.Categories ?? {}) } };
    return ok({ Settings: merged, Stored: true });
  });
  const s = resetStore();
  s.settings = { ...SETTINGS, Exclusions: ['A', 'B'] };
  // two removals before the first answer: neither comes back
  await Promise.all([s.removeExclusion('A'), s.removeExclusion('B')]);
  assert.deepEqual(s.settings.Exclusions, []);
  // a double tap on a toggle toggles twice
  await Promise.all([
    s.saveSettings((x) => ({ Enabled: !x.Enabled })),
    s.saveSettings((x) => ({ Enabled: !x.Enabled })),
  ]);
  assert.equal(s.settings.Enabled, true);
  assert.deepEqual(sent.slice(-2), [{ Enabled: false }, { Enabled: true }]);
});

test('a cancelled save is reported as cancelled, without an error', async (t) => {
  stubRoutes(t, () => ok({}));
  rawHttp.defaults.adapter = async (config) => {
    throw new axios.CanceledError('canceled', 'ERR_CANCELED', config);
  };
  const s = resetStore();
  s.settings = SETTINGS;
  assert.equal(await s.saveSettings({ Volume: 20 }), 'cancelled');
  assert.equal(s.saveError, null);
  assert.equal(s.settings.Volume, 50);
});
