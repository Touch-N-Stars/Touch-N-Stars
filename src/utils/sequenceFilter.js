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
