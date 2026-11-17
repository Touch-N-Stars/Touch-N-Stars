import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionForDisplay } from '../connection.js';

const defaults = { transport: 'wifi', address: 'mlastrorpa.local', usbSelection: 'auto' };

test('unloaded status does not flash a draft Wi-Fi connection', () => {
  assert.deepEqual(connectionForDisplay({}, defaults), { transport: '', address: '' });
});

test('reopening a connected USB panel overrides fresh Wi-Fi defaults', () => {
  assert.deepEqual(
    connectionForDisplay({ connected: true, usbDevicePath: '/dev/ttyUSB1' }, defaults),
    { transport: 'usb', address: '/dev/ttyUSB1' }
  );
});

test('connected Wi-Fi displays the actual backend address, not the draft hostname', () => {
  assert.deepEqual(
    connectionForDisplay(
      { connected: true, transport: 'wifi', connectionAddress: 'rpa.example' },
      { ...defaults, transport: 'usb' }
    ),
    { transport: 'wifi', address: 'rpa.example' }
  );
});

test('disconnected controls retain editable draft choices', () => {
  assert.deepEqual(connectionForDisplay({ connected: false }, defaults), {
    transport: 'wifi',
    address: 'mlastrorpa.local',
  });
});
