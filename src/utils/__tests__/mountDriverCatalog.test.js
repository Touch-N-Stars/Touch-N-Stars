import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONNECTION_IDS,
  MOUNT_DRIVERS,
  MOUNT_MODELS,
  compactSearchText,
  driverAvailability,
  findPackageAsset,
  mountDriverLabel,
  mountVendors,
  searchMountModels,
} from '../mountDriverCatalog.js';

const ids = (query) => searchMountModels(query).map((model) => model.id);

test('every spelling of an EQ6 finds the EQ6-R Pro first', () => {
  for (const query of [
    'EQ6',
    'eq6',
    'eq 6',
    'EQ-6',
    'EQ6-R',
    'eq6r',
    'skywatcher eq6',
    'Sky-Watcher EQ6',
    'sky watcher eq6-r pro',
  ]) {
    assert.equal(ids(query)[0], 'sw-eq6r', query);
  }
});

test('EQ6 lists the EQ6 family and nothing else', () => {
  assert.deepEqual(ids('eq6'), ['sw-eq6r', 'sw-eq6', 'sw-azeq6']);
  // "EQ6-R" is specific enough to leave the older EQ6 out.
  assert.deepEqual(ids('EQ6-R'), ['sw-eq6r']);
});

test('the vendor alone lists all of its mounts', () => {
  const skywatcher = MOUNT_MODELS.filter((m) => m.vendor === 'Sky-Watcher').map((m) => m.id);
  assert.deepEqual(ids('skywatcher'), skywatcher);
  assert.deepEqual(ids('Sky-Watcher'), skywatcher);
});

test('common mounts are found by their usual short names', () => {
  assert.equal(ids('HEQ5')[0], 'sw-heq5');
  assert.equal(ids('heq-5')[0], 'sw-heq5');
  assert.equal(ids('AZ-EQ6')[0], 'sw-azeq6');
  assert.equal(ids('star adventurer gti')[0], 'sw-sagti');
  assert.equal(ids('CEM40')[0], 'io-cem');
  assert.equal(ids('cem 40')[0], 'io-cem');
  assert.equal(ids('AM5')[0], 'zwo-am');
  assert.equal(ids('zwo am5')[0], 'zwo-am');
  assert.equal(ids('AVX')[0], 'cel-avx');
  assert.equal(ids('Advanced VX')[0], 'cel-avx');
  assert.equal(ids('CGX')[0], 'cel-cgx');
  assert.equal(ids('cgem ii')[0], 'cel-cgem2');
});

test('a Sky-Watcher EQ mount is not mistaken for the alt-az driver', () => {
  const eq6 = MOUNT_MODELS.find((m) => m.id === 'sw-eq6r');
  const drivers = eq6.connections.map((c) => c.driver);
  assert.deepEqual(drivers, ['indi_eqmod_telescope', 'indi_synscan_telescope']);
  assert.ok(!drivers.includes('indi_skywatcherAltAzMount'));
});

test('no match and too-short queries return nothing', () => {
  assert.deepEqual(ids('xyz123'), []);
  assert.deepEqual(ids(''), []);
  assert.deepEqual(ids('e'), []);
  assert.deepEqual(ids('  '), []);
});

test('matches never span two separate names', () => {
  // "pro" + "eq5" both exist in the EQ5 entry but "proeq5" is no name of anything.
  assert.deepEqual(ids('proeq5'), []);
});

test('catalog is consistent: known drivers, known connections, unique ids', () => {
  const seen = new Set();
  for (const model of MOUNT_MODELS) {
    assert.ok(!seen.has(model.id), `duplicate id ${model.id}`);
    seen.add(model.id);
    assert.ok(model.connections.length > 0, model.id);
    for (const connection of model.connections) {
      assert.ok(CONNECTION_IDS.includes(connection.id), `${model.id}: ${connection.id}`);
      assert.ok(MOUNT_DRIVERS[connection.driver], `${model.id}: ${connection.driver}`);
    }
  }
});

test('the locales describe every connection type', async () => {
  const { readFile } = await import('node:fs/promises');
  const en = JSON.parse(await readFile(new URL('../../locales/en.json', import.meta.url), 'utf8'));
  const connections = en.components.mountDriverFinder.connections;
  for (const id of CONNECTION_IDS) {
    assert.ok(connections[id]?.title, `${id}.title`);
    assert.ok(connections[id]?.hint, `${id}.hint`);
  }
});

test('driverAvailability tells installed, installable and unavailable apart', () => {
  const installed = ['indi_synscan_telescope', 'indi_lx200am5'];
  assert.equal(driverAvailability('indi_synscan_telescope', installed), 'installed');
  assert.equal(driverAvailability('indi_eqmod_telescope', installed), 'installable');
  assert.equal(driverAvailability('indi_eqmod_telescope', ['indi_eqmod_telescope']), 'installed');
  assert.equal(driverAvailability('indi_ioptronv3_telescope', installed), 'unavailable');
  assert.equal(driverAvailability('indi_eqmod_telescope', null), 'installable');
});

test('findPackageAsset matches the package name exactly', () => {
  const packages = [
    { name: 'indi-eqmod-extra', assetName: 'indi-eqmod-extra_1.0_arm64.deb' },
    { name: 'indi-eqmod', assetName: 'indi-eqmod_1.3-30_arm64.deb' },
  ];
  assert.equal(findPackageAsset('indi-eqmod', packages).assetName, 'indi-eqmod_1.3-30_arm64.deb');
  assert.equal(findPackageAsset('indi-missing', packages), null);
  assert.equal(findPackageAsset('indi-eqmod', undefined), null);
});

test('helpers', () => {
  assert.equal(compactSearchText('Sky Watcher EQ6-R Pro'), 'skywatchereq6rpro');
  assert.equal(mountDriverLabel('indi_eqmod_telescope'), 'EQMod Mount');
  assert.equal(mountDriverLabel('indi_unknown'), 'indi_unknown');
  assert.equal(mountVendors()[0], 'Sky-Watcher');
  assert.equal(new Set(mountVendors()).size, mountVendors().length);
});
