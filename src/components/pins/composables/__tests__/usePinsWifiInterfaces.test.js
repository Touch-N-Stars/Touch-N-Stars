import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveWifiInterfaceSelection } from '../wifiInterfaceSelection.js';

test('a removed optional USB adapter collapses both roles onto internal Wi-Fi', () => {
  const selection = resolveWifiInterfaceSelection([{ interface: 'wlan0' }], 'wlan0', 'wlan1');

  assert.deepEqual(selection, {
    clientInterface: 'wlan0',
    hotspotInterface: 'wlan0',
  });
});

test('a connected USB adapter keeps the configured dual-adapter roles', () => {
  const selection = resolveWifiInterfaceSelection(
    [{ interface: 'wlan0' }, { interface: 'wlan1' }],
    'wlan0',
    'wlan1'
  );

  assert.deepEqual(selection, {
    clientInterface: 'wlan0',
    hotspotInterface: 'wlan1',
  });
});
