import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();
freshPinia();
const { default: axios } = await import('axios');
const { default: apiPinsService } = await import('@/services/apiPinsService');
const { useSettingsStore } = await import('@/store/settingsStore');
const settings = useSettingsStore();
settings.connection.ip = '10.42.0.1';

test('missed notifications are read from the daemon with a since cursor', async (t) => {
  let call;
  t.mock.method(axios, 'get', async (url, config) => {
    call = { url, config };
    return { data: { bootId: 'b1', lastSeq: 7, events: [] } };
  });
  const result = await apiPinsService.getPinsNotifications(4, 50);
  assert.equal(call.url, 'http://10.42.0.1:8000/notifications');
  assert.deepEqual(call.config.params, { since: 4, limit: 50 });
  assert.match(call.config.headers.Authorization, /^Bearer /);
  assert.equal(result.lastSeq, 7);
});

test('settings updates go to the daemon as a partial PUT', async (t) => {
  let call;
  t.mock.method(axios, 'put', async (url, data, config) => {
    call = { url, data, config };
    return { data: { includeSystem: false, ntfy: { hasToken: true } } };
  });
  await apiPinsService.updatePinsNotificationSettings({ includeSystem: false });
  assert.equal(call.url, 'http://10.42.0.1:8000/notifications/settings');
  assert.deepEqual(call.data, { includeSystem: false });
  assert.match(call.config.headers.Authorization, /^Bearer /);
});

test('test notifications carry severity, message and delay', async (t) => {
  let call;
  t.mock.method(axios, 'post', async (url, data) => {
    call = { url, data };
    return { data: { delaySeconds: 10, event: null } };
  });
  await apiPinsService.sendPinsTestNotification({
    severity: 'warning',
    message: 'hi',
    delaySeconds: 10,
  });
  assert.equal(call.url, 'http://10.42.0.1:8000/notifications/test');
  assert.deepEqual(call.data, { severity: 'warning', delaySeconds: 10, message: 'hi' });
});

test('the stream URL is the ws:// variant of the daemon URL', () => {
  assert.equal(
    apiPinsService.getPinsNotificationStreamUrl(),
    'ws://10.42.0.1:8000/notifications/stream'
  );
});
