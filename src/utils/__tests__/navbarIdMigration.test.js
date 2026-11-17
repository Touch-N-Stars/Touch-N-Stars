import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateNavbarIds } from '../navbarIdMigration.js';

test('renames the old PINS plugin id in order and hidden items', () => {
  const navbar = {
    itemOrder: ['equipment', 'plugin-pins', 'settings'],
    hiddenItems: ['plugin-pins'],
  };

  assert.equal(migrateNavbarIds(navbar), true);
  assert.deepEqual(navbar.itemOrder, ['equipment', 'pins', 'settings']);
  assert.deepEqual(navbar.hiddenItems, ['pins']);
});

test('keeps the first position when both ids are present', () => {
  const navbar = { itemOrder: ['plugin-pins', 'camera', 'pins'], hiddenItems: [] };

  assert.equal(migrateNavbarIds(navbar), true);
  assert.deepEqual(navbar.itemOrder, ['pins', 'camera']);
});

test('leaves current settings untouched', () => {
  const navbar = { itemOrder: ['pins', 'plugin-livestack'], hiddenItems: ['about'] };
  const order = navbar.itemOrder;

  assert.equal(migrateNavbarIds(navbar), false);
  assert.equal(navbar.itemOrder, order);
});

test('tolerates missing or malformed navbar state', () => {
  assert.equal(migrateNavbarIds(null), false);
  assert.equal(migrateNavbarIds({}), false);
  assert.equal(migrateNavbarIds({ itemOrder: 'x' }), false);
});
