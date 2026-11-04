import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterTabsForMode,
  firstVisibleRoute,
  isEasyMode,
  isNavItemInMode,
  isTabInMode,
  mergeSubsetOrder,
  normalizeAppMode,
  resolveActiveTab,
} from '@/utils/appMode';

const tabs = (...values) => values.map((value) => ({ value }));

test('a missing or unknown mode counts as expert', () => {
  assert.equal(normalizeAppMode(undefined), 'expert');
  assert.equal(normalizeAppMode('simple'), 'expert');
  assert.equal(normalizeAppMode('easy'), 'easy');
  assert.equal(isEasyMode(undefined), false);
});

test('the expert view offers every navbar item', () => {
  for (const id of ['framing', 'dome', 'about', 'plugin-telescopius']) {
    assert.equal(isNavItemInMode(id, 'expert'), true);
    assert.equal(isNavItemInMode(id, undefined), true);
  }
});

test('easy mode keeps the session items, PINS, the sky atlas and Livestack', () => {
  for (const id of [
    'equipment',
    'camera',
    'autofocus',
    'mount',
    'guider',
    'sequence',
    'monitoring',
    'flats',
    'skyview',
    'pins',
    'plugin-livestack',
    'settings',
  ]) {
    assert.equal(isNavItemInMode(id, 'easy'), true, id);
  }
});

test('easy mode hides device pages, framing, about and other plugins', () => {
  for (const id of [
    'dome',
    'flat',
    'switch',
    'filter',
    'rotator',
    'framing',
    'about',
    'plugin-telescopius',
  ]) {
    assert.equal(isNavItemInMode(id, 'easy'), false, id);
  }
});

test('tabs stay complete in the expert view', () => {
  const items = tabs('showMount', 'showSettings', 'showOnStepX');
  assert.equal(filterTabsForMode('mount', items, 'expert'), items);
});

test('easy mode narrows the tabs of each page', () => {
  const mount = tabs('showMount', 'showSlew', 'showTppa', 'showSettings', 'showOnStepX');
  assert.deepEqual(
    filterTabsForMode('mount', mount, 'easy').map((tab) => tab.value),
    ['showMount', 'showSlew', 'showTppa']
  );

  const focus = tabs('showFocus', 'showSettings', 'showInspector', 'showTilter');
  assert.deepEqual(
    filterTabsForMode('focus', focus, 'easy').map((tab) => tab.value),
    ['showFocus', 'showSettings']
  );

  const settings = tabs(
    'connection',
    'interface',
    'image',
    'filter',
    'equipment',
    'plugins',
    'plateSolver',
    'meridianFlip',
    'system',
    'pins'
  );
  assert.deepEqual(
    filterTabsForMode('settings', settings, 'easy').map((tab) => tab.value),
    ['connection', 'interface', 'image', 'filter', 'system', 'pins']
  );
});

test('easy mode keeps only the autofocus values in the focus settings', () => {
  const items = tabs('general', 'autofocus', 'crop_and_stars', 'backlash', 'advanced');
  assert.deepEqual(
    filterTabsForMode('focusSettings', items, 'easy').map((tab) => tab.value),
    ['autofocus']
  );
});

test('easy mode drops the analysis tabs of the native guider, never the incidents', () => {
  const phone = tabs(
    'frame',
    'graph',
    'stats',
    'calibration',
    'log',
    'coach',
    'incidents',
    'settings'
  );
  assert.deepEqual(
    filterTabsForMode('nativeGuider', phone, 'easy').map((tab) => tab.value),
    ['frame', 'graph', 'coach', 'incidents', 'settings']
  );

  const wide = tabs('dashboard', 'coach', 'incidents', 'settings');
  assert.deepEqual(filterTabsForMode('nativeGuider', wide, 'easy'), wide);
});

test('a tab remembered from the expert view is recognised as hidden', () => {
  assert.equal(isTabInMode('nativeGuider', 'stats', 'easy'), false);
  assert.equal(isTabInMode('nativeGuider', 'stats', 'expert'), true);
  assert.equal(isTabInMode('nativeGuider', 'graph', 'easy'), true);
});

test('a hidden active tab falls back to the first one', () => {
  const items = tabs('showMount', 'showSlew');
  assert.equal(resolveActiveTab(items, 'showSlew'), 'showSlew');
  assert.equal(resolveActiveTab(items, 'showSettings'), 'showMount');
});

test('the start route skips items the mode or the user hides', () => {
  const routes = { framing: '/framing', dome: '/dome', camera: '/camera' };
  const order = ['framing', 'dome', 'camera'];

  assert.equal(firstVisibleRoute(routes, order, [], 'expert'), '/framing');
  assert.equal(firstVisibleRoute(routes, order, [], 'easy'), '/camera');
  assert.equal(firstVisibleRoute(routes, order, ['camera'], 'easy'), undefined);
});

test('reordering a subset keeps every other entry in its slot', () => {
  const full = ['equipment', 'dome', 'camera', 'framing', 'mount'];

  assert.deepEqual(mergeSubsetOrder(full, ['mount', 'equipment', 'camera']), [
    'mount',
    'dome',
    'equipment',
    'framing',
    'camera',
  ]);
});

test('reordering appends ids the stored order does not know yet', () => {
  assert.deepEqual(mergeSubsetOrder(['camera', 'dome'], ['plugin-livestack', 'camera']), [
    'plugin-livestack',
    'dome',
    'camera',
  ]);
});
