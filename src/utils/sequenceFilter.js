// SwitchFilter comes in two shapes, depending on the NINA build behind the plugin:
// - PINS fork: SelectedFilter (1-based slot index) plus FilterNames and ComboBoxText.
// - Official NINA: only Filter, a FilterInfo object (null = keep the current filter).
//   /sequence/set looks the filter up by name in the active profile there, and a write to
//   SelectedFilter fails with "Property 'SelectedFilter' not found".
// The shape is read from the item itself, not from the runtime mode.

function usesSlotIndex(item) {
  return (
    item != null && ('SelectedFilter' in item || 'ComboBoxText' in item || 'FilterNames' in item)
  );
}

/** Name of the filter a SwitchFilter item selects, or '' for none / the current filter. */
export function switchFilterName(item) {
  if (!item) return '';
  if (item.ComboBoxText) return item.ComboBoxText;
  const filter = item.Filter;
  if (typeof filter === 'string') return filter;
  return filter?.Name ?? '';
}

/**
 * Name of the filter a SwitchFilter item was set to, or '' while it keeps the current filter.
 * PINS stores that choice as a localized text in brackets, "(Current)"; a filter name cannot
 * look like that there, NINA turns every bracket in it into an underscore.
 */
export function chosenFilterName(item) {
  const name = switchFilterName(item);
  return item?.ComboBoxText && /^\(.*\)$/.test(name) ? '' : name;
}

/**
 * True when nothing was ever chosen on the PINS shape. That is not "keep the current filter":
 * the run then moves the wheel to its first slot (measured 2026-11-24).
 */
export function isFilterUnset(item) {
  return usesSlotIndex(item) && !item.ComboBoxText;
}

/** True when an item can be set back to "keep the current filter". */
export function canKeepCurrentFilter(item) {
  return usesSlotIndex(item);
}

/**
 * The entry of `filterNames` that `name` stands for, or `name` itself. PINS stores the name as
 * an identifier ("Ha 3nm" becomes "Ha_3nm"), while wheel and profile list it as entered.
 */
export function matchFilterName(filterNames, name) {
  if (!name || filterNames.includes(name)) return name;
  const identifier = (n) => n?.replace(/\W/g, '_').replace(/^(?=\d)/, '_');
  return filterNames.find((n) => identifier(n) === name) ?? name;
}

/**
 * Property and value that select `name` on a SwitchFilter item via /sequence/set; '' keeps the
 * current filter (see canKeepCurrentFilter()).
 * `filterNames` is the slot-ordered list the index is taken from on the PINS shape.
 */
export function switchFilterUpdate(item, filterNames, name) {
  if (usesSlotIndex(item)) {
    const index = filterNames.indexOf(name);
    // PINS fills an item's filter list once and not again when a wheel connects later. A slot
    // missing in that list is silently stored as "(Current)"; the name is looked up in the
    // wheel instead.
    const unknownToItem = Array.isArray(item.FilterNames) && !item.FilterNames.includes(name);
    if (index >= 0 && unknownToItem && 'ComboBoxText' in item) {
      return { property: 'ComboBoxText', value: name };
    }
    return { property: 'SelectedFilter', value: index + 1 };
  }
  return { property: 'Filter', value: name };
}

/**
 * The filter names a SwitchFilter item can choose from, in slot order. Sources in order: the
 * item itself, the connected filter wheel, then the active profile. The profile keeps the list
 * available while the wheel is disconnected, e.g. when planning during the day.
 */
export function filterNameChoices(item, filterInfo, profileInfo) {
  if (item?.FilterNames?.length) return item.FilterNames;
  const wheel = filterInfo?.AvailableFilters?.map((f) => f.Name) ?? [];
  if (wheel.length) return wheel;
  return profileInfo?.FilterWheelSettings?.FilterWheelFilters?.map((f) => f.Name) ?? [];
}

/**
 * The filter a new exposure row of a target should start with: the first one, in wheel order,
 * that no other row of the target uses yet. Null when every filter is taken or there is none,
 * so the row keeps NINA's "current filter".
 */
export function nextUnusedFilter(filterNames, usedNames) {
  const used = new Set(usedNames ?? []);
  return (filterNames ?? []).find((name) => name && !used.has(name)) ?? null;
}
