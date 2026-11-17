import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '@/test-helpers/browserEnv.js';

installBrowserGlobals();
freshPinia();
const {
  buildHotspotSavePayload,
  normalizeBandOrAuto,
  normalizeChannelInput,
  extractBackendErrorDetail,
} = await import('../usePinsHotspot.js');
const { dedupeWifiNetworks } = await import('../usePinsWifi.js');
const { normalizeNinaPackages } = await import('../usePinsPackages.js');

test('hotspot payload requires an 8 to 63 character password', () => {
  assert.deepEqual(buildHotspotSavePayload({ password: 'short', band: 'auto', channel: '' }), {
    errorKey: 'plugins.pins.logs.hotspotPasswordInvalidLength',
  });
  assert.deepEqual(buildHotspotSavePayload({ password: 'x'.repeat(64) }), {
    errorKey: 'plugins.pins.logs.hotspotPasswordInvalidLength',
  });
  assert.deepEqual(buildHotspotSavePayload({ password: '  ' }), {
    errorKey: 'plugins.pins.logs.hotspotPasswordInvalidLength',
  });
});

test('hotspot payload rejects a non-numeric channel', () => {
  assert.deepEqual(buildHotspotSavePayload({ password: 'secret123', channel: '0' }), {
    errorKey: 'plugins.pins.logs.hotspotChannelInvalid',
  });
  assert.deepEqual(buildHotspotSavePayload({ password: 'secret123', channel: '6a' }), {
    errorKey: 'plugins.pins.logs.hotspotChannelInvalid',
  });
});

test('hotspot payload sends band and channel only when set', () => {
  assert.deepEqual(
    buildHotspotSavePayload({ password: ' secret123 ', band: 'auto', channel: '' }),
    {
      payload: { password: 'secret123' },
    }
  );
  assert.deepEqual(
    buildHotspotSavePayload({ password: 'secret123', band: '5GHz', channel: ' 36 ' }),
    {
      payload: { password: 'secret123', band: '5GHz', channel: 36 },
    }
  );
});

test('hotspot values from the daemon are normalized for the form', () => {
  assert.equal(normalizeBandOrAuto(' 2.4GHz '), '2.4GHz');
  assert.equal(normalizeBandOrAuto('6GHz'), 'auto');
  assert.equal(normalizeBandOrAuto(null), 'auto');
  assert.equal(normalizeChannelInput(11), '11');
  assert.equal(normalizeChannelInput(0), '');
  assert.equal(normalizeChannelInput(null), '');
  assert.equal(normalizeChannelInput('1.5'), '');
});

test('backend error detail prefers the response body', () => {
  assert.equal(extractBackendErrorDetail({ response: { data: ' boom ' } }), 'boom');
  assert.equal(extractBackendErrorDetail({ response: { data: { message: 'm' } } }), 'm');
  assert.equal(extractBackendErrorDetail({ response: { data: { detail: 'd' } } }), 'd');
  assert.equal(extractBackendErrorDetail({ message: 'fallback' }), 'fallback');
  assert.equal(extractBackendErrorDetail(null), 'Unknown error');
});

test('wifi scan keeps one entry per SSID, drops hidden ones, strongest first', () => {
  const result = dedupeWifiNetworks([
    { ssid: 'Home', signal_strength: 40 },
    { ssid: '', signal_strength: 99 },
    { ssid: 'Field', signal_strength: 80 },
    { ssid: 'Home', signal_strength: 90 },
  ]);
  assert.deepEqual(
    result.map((n) => [n.ssid, n.signal_strength]),
    [
      ['Field', 80],
      ['Home', 40],
    ]
  );
  assert.deepEqual(dedupeWifiNetworks(null), []);
});

test('NINA package list is normalized from the daemon payload', () => {
  assert.deepEqual(
    normalizeNinaPackages({
      plugins: [
        { packageName: 'pins-plugin-livestack', installed: 1, installedVersion: '1.0' },
        { installed: true },
        { packageName: 'pins-plugin-alpaca', installed: false, availableVersion: '' },
      ],
    }),
    [
      {
        packageName: 'pins-plugin-livestack',
        installed: true,
        installedVersion: '1.0',
        availableVersion: null,
      },
      {
        packageName: 'pins-plugin-alpaca',
        installed: false,
        installedVersion: null,
        availableVersion: null,
      },
    ]
  );
  assert.deepEqual(
    normalizeNinaPackages({
      plugins: [
        { packageName: 'pins-plugin-joko', installed: true },
        { packageName: 'pins-plugin-orbitals', installed: false },
        { packageName: 'pins-plugin-ninaapi', installed: true },
        { packageName: 'pins-plugin-touch-n-stars', installed: true },
        { packageName: 'pins-plugin-pins', installed: true },
      ],
    }),
    []
  );
  assert.deepEqual(normalizeNinaPackages({}), []);
  assert.deepEqual(normalizeNinaPackages(null), []);
});
