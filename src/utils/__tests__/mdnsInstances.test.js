import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PINS_DAEMON_SERVICE_TYPE,
  baseRigName,
  mergeDiscoveredServices,
} from '../mdnsInstances.js';

const TNS = '_touchnstars._tcp';

test('baseRigName drops only the counter mDNS appends on a name clash', () => {
  assert.equal(baseRigName('pins-503ce-2'), 'pins-503ce');
  assert.equal(baseRigName('My NINA (2)'), 'My NINA');
  assert.equal(baseRigName('pins-503ce'), 'pins-503ce');
  // A rig id is five hex characters: never mistaken for a counter.
  assert.equal(baseRigName('pins-12345'), 'pins-12345');
  assert.equal(baseRigName(undefined), '');
});

test('the two announcements of one PINS rig become one entry with the daemon source', () => {
  const merged = mergeDiscoveredServices([
    {
      label: 'pins-503ce',
      ip: '192.168.2.129',
      port: 5000,
      sourceType: TNS,
      hosts: ['192.168.2.129'],
    },
    {
      label: 'pins-503ce-2',
      ip: '192.168.2.129',
      port: 5000,
      sourceType: PINS_DAEMON_SERVICE_TYPE,
      hosts: ['192.168.2.129'],
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].label, 'pins-503ce');
  assert.equal(merged[0].sourceType, PINS_DAEMON_SERVICE_TYPE);
});

test('an IPv6 link-local twin is merged by name and the IPv4 address is kept', () => {
  const v6 = 'fe80::57a5:8230:1668:e065%wlan0';
  const merged = mergeDiscoveredServices([
    {
      label: 'pins-503ce',
      ip: '192.168.2.129',
      port: 5000,
      sourceType: TNS,
      hosts: ['192.168.2.129'],
    },
    {
      label: 'pins-503ce-2',
      ip: v6,
      port: 5000,
      sourceType: PINS_DAEMON_SERVICE_TYPE,
      hosts: [v6],
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].ip, '192.168.2.129');
  assert.equal(merged[0].sourceType, PINS_DAEMON_SERVICE_TYPE);
  assert.deepEqual(merged[0].hosts, ['192.168.2.129', v6]);
});

test('different rigs, or one host with two backends on different ports, stay apart', () => {
  const merged = mergeDiscoveredServices([
    { label: 'pins-503ce', ip: '192.168.2.129', port: 5000, sourceType: TNS },
    { label: 'pins-6ea8a', ip: '192.168.2.120', port: 5000, sourceType: TNS },
    { label: 'Observatory', ip: '192.168.2.50', port: 5000, sourceType: TNS },
    { label: 'Observatory', ip: '192.168.2.50', port: 5001, sourceType: TNS },
    { label: 'no address', ip: '', port: 5000, sourceType: TNS },
  ]);
  assert.deepEqual(
    merged.map((s) => `${s.label}@${s.ip}:${s.port}`),
    [
      'pins-503ce@192.168.2.129:5000',
      'pins-6ea8a@192.168.2.120:5000',
      'Observatory@192.168.2.50:5000',
      'Observatory@192.168.2.50:5001',
    ]
  );
});
