import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceStatusRows } from '../mcpDeviceStatus.js';

test('status preserves connected/disconnected devices and translated names', () => {
  const result = {
    devices: [
      { device: 'camera', connected: false },
      { device: 'mount', connected: true },
    ],
  };
  const before = JSON.stringify(result);
  const rows = deviceStatusRows(result);
  assert.equal(rows[0].connected, false);
  assert.equal(rows[1].connected, true);
  assert.equal(rows[0].labelKey, 'components.connectEquipment.camera.name');
  assert.equal(JSON.stringify(result), before);
});

test('every standard MCP device has a label', () => {
  const names = [
    'camera',
    'mount',
    'focuser',
    'filter_wheel',
    'guider',
    'rotator',
    'flat_device',
    'dome',
    'switch',
    'weather',
    'safety_monitor',
  ];
  const rows = deviceStatusRows({ devices: names.map((device) => ({ device, connected: false })) });
  assert.equal(rows.length, 11);
  assert.ok(rows.every((row) => row.labelKey));
});

test('missing or malformed flags stay unknown rather than claiming a connection', () => {
  for (const connected of [undefined, null, 'false', 'true', 1, 0]) {
    assert.equal(
      deviceStatusRows({ devices: [{ device: 'camera', connected }] })[0].connected,
      null
    );
  }
  assert.deepEqual(
    deviceStatusRows({ isError: true, devices: [{ device: 'camera', connected: true }] }),
    []
  );
  assert.deepEqual(deviceStatusRows({}), []);
  assert.deepEqual(deviceStatusRows({ devices: [null, {}, { device: 42 }] }), []);
});

test('unfamiliar devices retain a text label without inheriting object keys', () => {
  const rows = deviceStatusRows({ devices: [{ device: 'constructor', connected: false }] });
  assert.equal(rows[0].labelKey, null);
  assert.equal(rows[0].name, 'constructor');
});
