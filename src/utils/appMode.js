// Easy and expert view. Everything here is presentation only: easy mode narrows what is offered,
// it never blocks a route and never touches the stored navbar customization.

export const APP_MODES = ['easy', 'expert'];

// Navbar ids offered in easy mode. Anything else, including every other plugin, is expert only.
const EASY_NAV_ITEMS = new Set([
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
]);

const EASY_TABS = {
  mount: new Set(['showMount', 'showSlew', 'showTppa']),
  focus: new Set(['showFocus', 'showSettings']),
  focusSettings: new Set(['autofocus']),
  settings: new Set(['connection', 'interface', 'image', 'filter', 'system', 'pins']),
  // Phone tabs plus the wide dashboard, which keeps its statistics, calibration and log cards.
  nativeGuider: new Set(['dashboard', 'frame', 'graph', 'coach', 'incidents', 'settings']),
};

// Older persisted settings have no mode yet; they stay in the expert view.
export function normalizeAppMode(mode) {
  return mode === 'easy' ? 'easy' : 'expert';
}

export function isEasyMode(mode) {
  return normalizeAppMode(mode) === 'easy';
}

export function isNavItemInMode(id, mode) {
  return !isEasyMode(mode) || EASY_NAV_ITEMS.has(id);
}

/**
 * @param {keyof typeof EASY_TABS} page
 * @param {string} tab
 * @param {string} mode
 */
export function isTabInMode(page, tab, mode) {
  return !isEasyMode(mode) || EASY_TABS[page].has(tab);
}

/**
 * @param {keyof typeof EASY_TABS} page
 * @param {{ value: string }[]} items
 * @param {string} mode
 */
export function filterTabsForMode(page, items, mode) {
  if (!isEasyMode(mode)) return items;
  return items.filter((item) => isTabInMode(page, item.value, mode));
}

// The tab to show once `items` changed: the active one while it still exists, else the first.
export function resolveActiveTab(items, active) {
  return items.some((item) => item.value === active) ? active : items[0]?.value;
}

/**
 * First route the navbar offers, for when the start page itself is hidden.
 * @param {Record<string, string>} routesById
 * @param {string[]} order
 * @param {string[]} hidden
 * @param {string} mode
 * @returns {string|undefined}
 */
export function firstVisibleRoute(routesById, order, hidden, mode) {
  const id = order.find(
    (entry) => routesById[entry] && !hidden.includes(entry) && isNavItemInMode(entry, mode)
  );
  return routesById[id];
}

/**
 * Applies a reorder of a subset of the navbar to the full stored order. Entries outside the
 * subset keep their slot, otherwise sorting in easy mode would drop them from the order that is
 * mirrored to the rig.
 * @param {string[]} fullOrder
 * @param {string[]} subsetOrder
 * @returns {string[]}
 */
export function mergeSubsetOrder(fullOrder, subsetOrder) {
  const subset = new Set(subsetOrder);
  const queue = [...subsetOrder];
  const merged = fullOrder.map((id) => (subset.has(id) ? queue.shift() : id));
  // Ids the stored order does not know yet, e.g. a newly loaded plugin.
  return [...merged, ...queue];
}
