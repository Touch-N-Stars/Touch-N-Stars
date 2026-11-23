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
 * Property and value that select `name` on a SwitchFilter item via /sequence/set.
 * `filterNames` is the slot-ordered list the index is taken from on the PINS shape.
 */
export function switchFilterUpdate(item, filterNames, name) {
  if (usesSlotIndex(item)) {
    return { property: 'SelectedFilter', value: filterNames.indexOf(name) + 1 };
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
