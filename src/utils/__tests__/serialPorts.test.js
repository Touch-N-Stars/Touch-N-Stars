import test from 'node:test';
import assert from 'node:assert/strict';

const { physicalSerialPorts, autoSerialPort, serialPortLabel } =
  await import('@/utils/serialPorts');

// What availableSerialPorts() makes of one plugged-in FTDI adapter.
const ONE_DEVICE = [
  { Port: '/dev/ttyUSB0', Description: 'FT232R' },
  { Port: '', Description: '', separator: true, label: '─── by-id ───' },
  { Port: '/dev/serial/by-id/usb-FTDI_FT232R-if00-port0', Description: '' },
  { Port: '', Description: '', separator: true, label: '─── by-path ───' },
  { Port: '/dev/serial/by-path/platform-xhci-usb-0:1:1.0-port0', Description: '' },
];

test('lists every device once, without the by-id and by-path links', () => {
  assert.deepEqual(physicalSerialPorts(ONE_DEVICE), [
    { Port: '/dev/ttyUSB0', Description: 'FT232R' },
  ]);
});

test('copes with a missing list', () => {
  assert.deepEqual(physicalSerialPorts(undefined), []);
});

test('takes the only device when no port is set', () => {
  assert.equal(autoSerialPort(physicalSerialPorts(ONE_DEVICE), ''), '/dev/ttyUSB0');
});

test('never replaces a port the profile already has', () => {
  assert.equal(autoSerialPort(physicalSerialPorts(ONE_DEVICE), '/dev/onstep'), null);
});

test('asks when several devices are plugged in', () => {
  const ports = [{ Port: '/dev/ttyUSB0' }, { Port: '/dev/ttyACM0' }];
  assert.equal(autoSerialPort(ports, ''), null);
});

test('names the device next to the port when the backend knows it', () => {
  assert.equal(
    serialPortLabel({ Port: '/dev/ttyUSB0', Description: 'FT232R' }),
    '/dev/ttyUSB0 – FT232R'
  );
  assert.equal(serialPortLabel({ Port: '/dev/ttyACM0', Description: '' }), '/dev/ttyACM0');
});
