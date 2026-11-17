// Nav entries that moved from a plugin into the core app keep the position and hidden
// state the user gave them under the old plugin id.
const LEGACY_NAV_IDS = {
  'plugin-pins': 'pins',
};

function renameIds(ids) {
  if (!Array.isArray(ids)) return { ids, changed: false };

  let changed = false;
  const renamed = [];
  for (const id of ids) {
    const next = LEGACY_NAV_IDS[id] ?? id;
    if (next !== id) changed = true;
    // The new id may already be present (e.g. appended by the settings screen) - keep the first.
    if (renamed.includes(next)) {
      changed = true;
      continue;
    }
    renamed.push(next);
  }
  return { ids: renamed, changed };
}

/**
 * Rewrites legacy plugin nav ids in place.
 * @param {{ itemOrder?: string[], hiddenItems?: string[] }} navbar
 * @returns {boolean} true when something was rewritten and should be saved
 */
export function migrateNavbarIds(navbar) {
  if (!navbar || typeof navbar !== 'object') return false;

  const order = renameIds(navbar.itemOrder);
  const hidden = renameIds(navbar.hiddenItems);
  if (order.changed) navbar.itemOrder = order.ids;
  if (hidden.changed) navbar.hiddenItems = hidden.ids;
  return order.changed || hidden.changed;
}
