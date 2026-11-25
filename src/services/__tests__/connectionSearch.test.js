import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { searchBackends } = await import('@/services/connectionSearch');
const { normalizeMdnsService } = await import('@/utils/mdnsServices');

const DAEMON = '_pinsdaemon._tcp';
const PLUGIN = '_touchnstars._tcp';
const daemonService = (name, ip) =>
  normalizeMdnsService({ name, hosts: [ip], txt: { ip, backendPort: '5000' } }, DAEMON);
const pluginService = (name, ip, port = 5000) =>
  normalizeMdnsService({ name: `touchnstars_${name}`, hosts: [ip], port, txt: { ip } }, PLUGIN);

/** A network: rigs by host, plugin servers by host:port, announced services. */
function network({ rigs = {}, servers = [], services = [], refused = false } = {}) {
  const log = { rigProbes: [], scans: [], bound: [] };
  return {
    log,
    async probeRig({ host }) {
      log.rigProbes.push(host);
      if (!rigs[host]) throw new Error('timeout');
      return { host, health: { rigId: rigs[host] } };
    },
    async probeServer(host, port) {
      if (!servers.includes(`${host}:${port}`)) throw new Error('timeout');
    },
    async discover(types) {
      log.scans.push(...types);
      return { services: services.filter((s) => types.includes(s.sourceType)), failed: refused };
    },
    async bindWifi(host, task) {
      log.bound.push(host);
      return task();
    },
  };
}

const RIG = { rigId: 'pins-503ce', ip: '192.168.1.20', candidateHosts: ['192.168.1.20'] };

test('a rig that answers at its address ends the search', async () => {
  const net = network({ rigs: { '192.168.1.20': 'pins-503ce' } });
  const result = await searchBackends({
    kind: 'pins',
    instance: RIG,
    currentHost: RIG.ip,
    ...net,
  });
  assert.deepEqual(result, { boxAnswers: true, own: null, found: [], refused: false });
  assert.deepEqual(net.log.rigProbes, ['192.168.1.20']);
});

test('the own rig is found on its hotspot, with the Wi-Fi bound for the question', async () => {
  const net = network({ rigs: { '10.42.0.1': 'pins-503ce' } });
  const result = await searchBackends({ kind: 'pins', instance: RIG, currentHost: RIG.ip, ...net });
  assert.equal(result.own.host, '10.42.0.1');
  assert.deepEqual(result.found, []);
  assert.deepEqual(net.log.bound, ['10.42.0.1']);
});

test('the own rig is found at a new address it announces', async () => {
  const net = network({
    rigs: { '192.168.1.77': 'pins-503ce' },
    services: [daemonService('pins-503ce', '192.168.1.77')],
  });
  const result = await searchBackends({ kind: 'pins', instance: RIG, currentHost: RIG.ip, ...net });
  assert.equal(result.own.host, '192.168.1.77');
});

test('another rig is only offered, once, even at the address of the own one', async () => {
  const net = network({
    rigs: { '192.168.1.20': 'pins-other', '10.42.0.1': 'pins-other' },
  });
  const result = await searchBackends({ kind: 'pins', instance: RIG, currentHost: RIG.ip, ...net });
  assert.equal(result.boxAnswers, false);
  assert.equal(result.own, null);
  assert.deepEqual(result.found, [
    { kind: 'pins', label: 'pins-other', host: '192.168.1.20', port: 5000, rigId: 'pins-other' },
  ]);
});

test('a backend known as NINA is never asked as PINS', async () => {
  const net = network({
    rigs: { '10.42.0.1': 'pins-503ce' },
    servers: ['192.168.1.9:5000'],
    services: [
      pluginService('Observatory', '192.168.1.9'),
      // Announced, but nothing answers there (any more)
      pluginService('Gone', '192.168.1.10'),
      // The address that does not answer
      pluginService('Old', '192.168.1.30'),
    ],
  });
  const result = await searchBackends({
    kind: 'nina',
    instance: { backendKind: 'nina' },
    currentHost: '192.168.1.30',
    currentPort: 5000,
    ...net,
  });
  assert.deepEqual(net.log.rigProbes, []);
  assert.deepEqual(net.log.bound, []);
  assert.deepEqual(net.log.scans, [PLUGIN]);
  assert.deepEqual(result.found, [
    { kind: 'nina', label: 'Observatory', host: '192.168.1.9', port: 5000, rigId: '' },
  ]);
});

test('a rig announcing daemon and plugin server is one find', async () => {
  const net = network({
    rigs: { '192.168.1.40': 'pins-a' },
    servers: ['192.168.1.40:5000'],
    services: [daemonService('pins-a', '192.168.1.40'), pluginService('pins-a', '192.168.1.40')],
  });
  const result = await searchBackends({ kind: 'unknown', currentHost: '', ...net });
  assert.deepEqual(
    result.found.map(({ kind, host }) => [kind, host]),
    [['pins', '192.168.1.40']]
  );
});

test('a refused scan is reported', async () => {
  const net = network({ refused: true });
  const result = await searchBackends({ kind: 'pins', instance: RIG, currentHost: RIG.ip, ...net });
  assert.equal(result.refused, true);
});
