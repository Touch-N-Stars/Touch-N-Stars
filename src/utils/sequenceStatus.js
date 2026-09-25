// Status and issues the sequence editor shows for an item of the /sequence/current tree.
//
// Some instructions are NINA containers that the editor draws as a single card and whose
// children it never shows: Take Many Exposures is a loop around one Take Exposure, Smart
// Exposure adds a filter switch and a dither trigger, the flat instructions run their own
// exposure loops. NINA marks such a container FINISHED once its loop has run out, no matter
// whether the instructions inside it failed -- with the default "continue on error" every
// exposure can fail and the card still reads FINISHED. The validation issues sit on the hidden
// children as well. The helpers below fold both into the card.

export const COMPOSITE_ITEM_TYPES = new Set([
  'NINA.Sequencer.SequenceItem.Imaging.SmartExposure',
  'NINA.Sequencer.SequenceItem.Imaging.TakeManyExposures',
  'NINA.Sequencer.SequenceItem.FlatDevice.AutoBrightnessFlat',
  'NINA.Sequencer.SequenceItem.FlatDevice.AutoExposureFlat',
  'NINA.Sequencer.SequenceItem.FlatDevice.SkyFlat',
  'NINA.Sequencer.SequenceItem.FlatDevice.TrainedDarkFlatExposure',
  'NINA.Sequencer.SequenceItem.FlatDevice.TrainedFlatExposure',
]);

export function isCompositeItem(item) {
  return COMPOSITE_ITEM_TYPES.has(item?.FullTypeName);
}

function hiddenEntities(item) {
  const result = [];
  const walk = (entity) => {
    for (const child of [
      ...(entity?.Items ?? []),
      ...(entity?.Triggers ?? []),
      ...(entity?.Conditions ?? []),
    ]) {
      if (child?.Status === 'DISABLED') continue;
      result.push(child);
      walk(child);
    }
  };
  walk(item);
  return result;
}

/**
 * The item's status, except that a composite item which finished with a failed hidden
 * instruction reads FAILED.
 *
 * The children are reset on every loop iteration, so what is left after the run is the state
 * of the last one. That is enough for a validation failure, which repeats on every iteration.
 */
export function displayStatus(item) {
  const status = item?.Status;
  if (status !== 'FINISHED' || !isCompositeItem(item)) return status;
  return hiddenEntities(item).some((child) => child.Status === 'FAILED') ? 'FAILED' : status;
}

/** The item's validation issues, for a composite item together with those of its children. */
export function displayIssues(item) {
  const issues = [...(item?.Issues ?? [])];
  if (isCompositeItem(item)) {
    for (const child of hiddenEntities(item)) {
      if (Array.isArray(child.Issues)) issues.push(...child.Issues);
    }
  }
  return [...new Set(issues)];
}
