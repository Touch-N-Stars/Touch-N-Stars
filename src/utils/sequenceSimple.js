// Read-only view model for the simple sequence view.
//
// The simple view shows the loaded /sequence/current tree as a list of targets with their
// exposure rows. It never rebuilds the tree: every row keeps a reference to the raw items, so
// edits go through the same sequence/set calls as the full editor and anything the simple
// view does not understand stays untouched.

import { collectDsoContainers } from './sequenceTargets';
import { switchFilterName } from './sequenceFilter';

export const SMART_EXPOSURE_TYPE = 'NINA.Sequencer.SequenceItem.Imaging.SmartExposure';
export const TAKE_MANY_EXPOSURES_TYPE = 'NINA.Sequencer.SequenceItem.Imaging.TakeManyExposures';
export const START_AREA_TYPE = 'NINA.Sequencer.Container.StartAreaContainer';
export const END_AREA_TYPE = 'NINA.Sequencer.Container.EndAreaContainer';
export const MERIDIAN_FLIP_TRIGGER_TYPE = 'NINA.Sequencer.Trigger.MeridianFlip.MeridianFlipTrigger';
export const DITHER_AFTER_EXPOSURES_TYPE = 'NINA.Sequencer.Trigger.Guider.DitherAfterExposures';
export const COOL_CAMERA_TYPE = 'NINA.Sequencer.SequenceItem.Camera.CoolCamera';
export const WARM_CAMERA_TYPE = 'NINA.Sequencer.SequenceItem.Camera.WarmCamera';
export const UNPARK_SCOPE_TYPE = 'NINA.Sequencer.SequenceItem.Telescope.UnparkScope';
export const PARK_SCOPE_TYPE = 'NINA.Sequencer.SequenceItem.Telescope.ParkScope';
export const SLEW_TYPE = 'NINA.Sequencer.SequenceItem.Telescope.SlewScopeToRaDec';
export const CENTER_TYPE = 'NINA.Sequencer.SequenceItem.Platesolving.Center';
export const CENTER_AND_ROTATE_TYPE = 'NINA.Sequencer.SequenceItem.Platesolving.CenterAndRotate';
export const START_GUIDING_TYPE = 'NINA.Sequencer.SequenceItem.Guider.StartGuiding';
export const RUN_AUTOFOCUS_TYPE = 'NINA.Sequencer.SequenceItem.Autofocus.RunAutofocus';
export const AF_AFTER_FILTER_CHANGE_TYPE =
  'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterFilterChange';
export const AF_AFTER_TIME_TYPE = 'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterTimeTrigger';
export const AF_AFTER_EXPOSURES_TYPE = 'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterExposures';
export const AF_AFTER_TEMPERATURE_TYPE =
  'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterTemperatureChangeTrigger';
export const AF_AFTER_HFR_TYPE =
  'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterHFRIncreaseTrigger';

// How a target is approached. Exactly one of these is active at a time; 'off' means none.
export const SLEW_MODE_TYPES = {
  slew: SLEW_TYPE,
  center: CENTER_TYPE,
  centerAndRotate: CENTER_AND_ROTATE_TYPE,
};

// The order new optional items are placed in, per area. The steps of a target come before
// its exposures, like in NINA's own target template.
export const START_ORDER = [COOL_CAMERA_TYPE, UNPARK_SCOPE_TYPE];
export const END_ORDER = [WARM_CAMERA_TYPE, PARK_SCOPE_TYPE];
export const TARGET_ORDER = [
  [SLEW_TYPE, CENTER_TYPE, CENTER_AND_ROTATE_TYPE],
  START_GUIDING_TYPE,
  RUN_AUTOFOCUS_TYPE,
  [SMART_EXPOSURE_TYPE, TAKE_MANY_EXPOSURES_TYPE],
];

// Target steps the simple view shows as switches, so they are not listed as "other steps".
const TARGET_STEP_TYPES = new Set([
  SLEW_TYPE,
  CENTER_TYPE,
  CENTER_AND_ROTATE_TYPE,
  START_GUIDING_TYPE,
  RUN_AUTOFOCUS_TYPE,
]);

const EXPOSURE_ROW_TYPES = new Set([SMART_EXPOSURE_TYPE, TAKE_MANY_EXPOSURES_TYPE]);

// Statuses after which an item will not take any more frames in this run.
const DONE_STATUSES = new Set(['FINISHED', 'SKIPPED', 'DISABLED']);

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Readable name of a sequence item, the same fallback the full editor uses. */
export function itemDisplayName(item) {
  if (item?.Name) return item.Name;
  const short = item?.FullTypeName?.split('.')?.at(-1) ?? '';
  return short.replace(/([A-Z])/g, ' $1').trim();
}

// Time added to every frame in the estimates: download, saving and guider settle. A fixed
// typical value instead of a setting; slewing, centering and focusing stay unaccounted.
export const FRAME_OVERHEAD_SECONDS = 5;

/**
 * One exposure row (Smart Exposure or Take Many Exposures), or null for any other item.
 *
 * filterItem, exposureItem and loopCondition are the raw children whose Ids the editor
 * writes to; filterItem is null for Take Many Exposures, which has no filter switch.
 * overheadSeconds is added to every frame (download, saving, guider settle).
 */
export function exposureRow(item, overheadSeconds = 0) {
  if (!EXPOSURE_ROW_TYPES.has(item?.FullTypeName)) return null;

  const isSmart = item.FullTypeName === SMART_EXPOSURE_TYPE;
  const filterItem = isSmart
    ? (item.Items?.find((i) => i.FullTypeName?.includes('SwitchFilter')) ?? null)
    : null;
  const exposureItem = isSmart
    ? (item.Items?.find((i) => i.FullTypeName?.includes('TakeExposure')) ?? null)
    : (item.Items?.[0] ?? null);
  const loopCondition = isSmart
    ? (item.Conditions?.find((c) => c.FullTypeName?.includes('LoopCondition')) ?? null)
    : (item.Conditions?.[0] ?? null);

  const exposureTime = toNumber(exposureItem?.ExposureTime);
  const frameSeconds = exposureTime + Math.max(toNumber(overheadSeconds), 0);
  const iterations = toNumber(loopCondition?.Iterations);
  const completed = Math.min(toNumber(loopCondition?.CompletedIterations), iterations);
  const remaining = DONE_STATUSES.has(item.Status) ? 0 : Math.max(iterations - completed, 0);

  return {
    id: item.Id,
    item,
    isSmart,
    status: item.Status,
    enabled: item.Status !== 'DISABLED',
    filterItem,
    exposureItem,
    loopCondition,
    filterName: switchFilterName(filterItem),
    exposureTime,
    gain: exposureItem?.Gain,
    offset: exposureItem?.Offset,
    imageType: exposureItem?.ImageType ?? '',
    binning: binningLabel(exposureItem?.Binning),
    iterations,
    completed,
    totalSeconds: item.Status === 'DISABLED' ? 0 : iterations * frameSeconds,
    remainingSeconds: remaining * frameSeconds,
  };
}

/** "2x2" for a binning object or string, "1x1" when unset. */
export function binningLabel(binning) {
  if (!binning) return '1x1';
  if (typeof binning === 'string') {
    const n = parseInt(binning, 10);
    return Number.isFinite(n) ? `${n}x${n}` : binning;
  }
  return `${binning.X ?? 1}x${binning.Y ?? 1}`;
}

/**
 * Exposure rows of a DSO container plus the direct children the simple view neither shows
 * as rows nor as switches. Only direct children are read: a nested container counts as one
 * "other" step, even if it holds exposures itself.
 */
export function summarizeDsoContainer(container, overheadSeconds = 0) {
  const rows = [];
  const otherItems = [];
  for (const child of container?.Items ?? []) {
    const row = exposureRow(child, overheadSeconds);
    if (row) rows.push(row);
    else if (!TARGET_STEP_TYPES.has(child?.FullTypeName)) otherItems.push(child);
  }
  return {
    rows,
    otherItems,
    totalSeconds: rows.reduce((sum, r) => sum + r.totalSeconds, 0),
    remainingSeconds: rows.reduce((sum, r) => sum + r.remainingSeconds, 0),
  };
}

/**
 * Every DSO container of the tree with its summary, plus the totals over all of them.
 *
 * With nowMs, every target also gets the clock times it is expected to run: targets are
 * imaged one after the other, each starting when the remaining frames of the previous one
 * are done. A finished target has startMs === endMs.
 */
export function summarizeTargets(tree, { overheadSeconds = 0, nowMs = null } = {}) {
  let cursor = nowMs;
  const targets = collectDsoContainers(tree).map((container) => {
    const summary = { container, ...summarizeDsoContainer(container, overheadSeconds) };
    if (cursor !== null) {
      summary.startMs = cursor;
      cursor += summary.remainingSeconds * 1000;
      summary.endMs = cursor;
    }
    return summary;
  });
  return {
    targets,
    totalSeconds: targets.reduce((sum, t) => sum + t.totalSeconds, 0),
    remainingSeconds: targets.reduce((sum, t) => sum + t.remainingSeconds, 0),
    endMs: cursor,
  };
}

/** The first top-level container of the given type, or null. */
export function findAreaContainer(tree, fullTypeName) {
  return (tree ?? []).find((item) => item?.FullTypeName === fullTypeName) ?? null;
}

/**
 * Names of the enabled entries of a list, for a one-line read-only summary. Entries of the
 * types in `excludeTypes` are left out because the simple view shows them as switches.
 */
export function enabledItemNames(items, excludeTypes = []) {
  return (items ?? [])
    .filter((i) => i?.Status !== 'DISABLED' && !excludeTypes.includes(i?.FullTypeName))
    .map(itemDisplayName);
}

/** The first entry of the given type, or null. */
export function findByType(items, fullTypeName) {
  return (items ?? []).find((i) => i?.FullTypeName === fullTypeName) ?? null;
}

/** Whether an optional item exists and is switched on. */
export function isActive(item) {
  return !!item && item.Status !== 'DISABLED';
}

/** The active approach of a target: 'off', 'slew', 'center' or 'centerAndRotate'. */
export function slewMode(container) {
  // The most thorough one wins if a sequence happens to contain several.
  for (const mode of ['centerAndRotate', 'center', 'slew']) {
    if (isActive(findByType(container?.Items, SLEW_MODE_TYPES[mode]))) return mode;
  }
  return 'off';
}

/**
 * Where a new item of `fullTypeName` goes in `container`, as the arguments of sequence/add:
 * { targetId, insertAfter }. `order` lists the known types (an entry may be an array of
 * types sharing a rank). A new item goes before the first known item ranked after it, else
 * after the last known item ranked before it. When no known item is there, `fallback` puts
 * it at the 'top' or the 'bottom' of the container. Unknown items are never reordered.
 */
export function insertionPoint(container, fullTypeName, order, fallback = 'bottom') {
  const rankOf = (type) =>
    order.findIndex((entry) => (Array.isArray(entry) ? entry.includes(type) : entry === type));
  const rank = rankOf(fullTypeName);
  const items = container?.Items ?? [];

  const later = items.find((i) => rankOf(i?.FullTypeName) > rank);
  if (later) return { targetId: later.Id, insertAfter: false };

  const earlier = items.filter((i) => {
    const r = rankOf(i?.FullTypeName);
    return r >= 0 && r <= rank;
  });
  if (earlier.length) return { targetId: earlier.at(-1).Id, insertAfter: true };

  if (!items.length) return { targetId: container.Id, insertAfter: null };
  return fallback === 'top'
    ? { targetId: items[0].Id, insertAfter: false }
    : { targetId: items.at(-1).Id, insertAfter: true };
}

/**
 * The dither triggers built into Smart Exposures anywhere in the tree that still dither
 * (AfterExposures > 0). They are zeroed when the global dither trigger is switched on, so a
 * frame is never dithered twice.
 */
export function collectSmartExposureDithers(tree) {
  const result = [];
  const walk = (items) => {
    for (const item of items ?? []) {
      if (item?.FullTypeName === SMART_EXPOSURE_TYPE) {
        for (const trigger of item.Triggers ?? []) {
          if (
            trigger?.FullTypeName === DITHER_AFTER_EXPOSURES_TYPE &&
            toNumber(trigger.AfterExposures) > 0
          ) {
            result.push(trigger);
          }
        }
      }
      walk(item?.Items);
    }
  };
  walk(tree);
  return result;
}

/** Compact duration: "2 h 05 min", "45 min", "30 s". Rounded up to whole minutes above 60 s. */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(toNumber(seconds)));
  if (s < 60) return `${s} s`;
  const totalMinutes = Math.ceil(s / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

/** Local clock time "HH:MM" of a timestamp, or '' without one. */
export function formatClock(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
