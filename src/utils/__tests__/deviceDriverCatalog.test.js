import test from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_BRANDS, brandAvailability, driverListTypes } from '../deviceDriverCatalog.js';

test('each brand appears once per device type and names an INDI driver', () => {
  for (const brands of Object.values(DEVICE_BRANDS)) {
    assert.equal(new Set(brands.map((b) => b.brand)).size, brands.length);
    for (const entry of brands) {
      assert.match(entry.driver, /^indi_[a-z0-9_]+$/);
      if (entry.package) assert.match(entry.package, /^indi-[a-z0-9-]+$/);
    }
  }
});

test('brandAvailability prefers the installed driver over its package', () => {
  const zwo = DEVICE_BRANDS.filterwheel.find((b) => b.brand === 'ZWO');
  assert.equal(brandAvailability(zwo, ['indi_asi_wheel']), 'installed');
  assert.equal(brandAvailability(zwo, []), 'installable');
  const core = DEVICE_BRANDS.filterwheel.find((b) => !b.package);
  assert.equal(brandAvailability(core, []), 'unavailable');
  assert.equal(brandAvailability(null, []), null);
});

test('a driver PINS filed under camera counts as installed', () => {
  // indi_asi_focuser as registered on a PINS that got indi-asi for the camera first
  const lists = { focuser: ['indi_ieaf_focus'], camera: ['indi_asi_ccd', 'indi_asi_focuser'] };
  const installed = driverListTypes('focuser').flatMap((type) => lists[type]);
  const eaf = DEVICE_BRANDS.focuser.find((b) => b.brand === 'ZWO EAF');
  assert.equal(brandAvailability(eaf, installed), 'installed');
  assert.deepEqual(driverListTypes('camera'), ['camera']);
});
