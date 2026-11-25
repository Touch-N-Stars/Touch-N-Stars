// Read-only view model for the simple sequence view.
//
// The simple view shows the loaded /sequence/current tree as a list of targets with their
// exposure rows. It never rebuilds the tree: every row keeps a reference to the raw items, so
// edits go through the same sequence/set calls as the full editor and anything the simple
// view does not understand stays untouched.

import { collectDsoContainers } from './sequenceTargets';
import { chosenFilterName } from './sequenceFilter';

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
export const SET_TRACKING_TYPE = 'NINA.Sequencer.SequenceItem.Telescope.SetTracking';
export const WAIT_FOR_SUN_TYPE = 'NINA.Sequencer.SequenceItem.Utility.WaitForSunAltitude';
export const LOOP_CONDITION_TYPE = 'NINA.Sequencer.Conditions.LoopCondition';
export const SUN_CONDITION_TYPE = 'NINA.Sequencer.Conditions.SunAltitudeCondition';
export const ALTITUDE_CONDITION_TYPE = 'NINA.Sequencer.Conditions.AltitudeCondition';
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
// Cooling before the wait for darkness, so the camera is cold when the first picture can start;
// unparking after it, so the mount does not stand there tracking.
export const START_ORDER = [COOL_CAMERA_TYPE, WAIT_FOR_SUN_TYPE, UNPARK_SCOPE_TYPE];
// Park before the warm-up: NINA's warm-up waits for its whole ramp, and the mount would track
// on for that long after the last picture.
export const END_ORDER = [PARK_SCOPE_TYPE, WARM_CAMERA_TYPE];
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
 *
 * resumable: the next start takes the pictures missing from a finished or skipped row too (the
 * simple mode, see stepsToReopen()): the count was raised, or dawn cut the row off. Otherwise
 * such a row is done, the sequencer does not run it again.
 */
export function exposureRow(item, overheadSeconds = 0, { resumable = false } = {}) {
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
  const done = resumable ? item.Status === 'DISABLED' : DONE_STATUSES.has(item.Status);
  const remaining = done ? 0 : Math.max(iterations - completed, 0);

  return {
    id: item.Id,
    item,
    isSmart,
    status: item.Status,
    enabled: item.Status !== 'DISABLED',
    filterItem,
    exposureItem,
    loopCondition,
    filterName: chosenFilterName(filterItem),
    exposureTime,
    gain: exposureItem?.Gain,
    offset: exposureItem?.Offset,
    imageType: exposureItem?.ImageType ?? '',
    binning: binningLabel(exposureItem?.Binning),
    iterations,
    completed,
    frameSeconds,
    remainingFrames: remaining,
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
export function summarizeDsoContainer(container, overheadSeconds = 0, { resumable = false } = {}) {
  const rows = [];
  const otherItems = [];
  // A target the plan is through with keeps CREATED rows when dawn interrupted it, and pictures
  // added to it do not run either.
  const passed = !resumable && DONE_STATUSES.has(container?.Status);
  for (const child of container?.Items ?? []) {
    const row = exposureRow(child, overheadSeconds, { resumable });
    if (row && passed) Object.assign(row, { remainingFrames: 0, remainingSeconds: 0 });
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

/** How many of the rows' remaining pictures fit into the given time, taken row by row. */
function framesWithin(rows, seconds) {
  let left = seconds;
  let frames = 0;
  for (const row of rows) {
    if (!row.remainingFrames || row.frameSeconds <= 0) continue;
    const fit = Math.min(row.remainingFrames, Math.floor(left / row.frameSeconds + 1e-6));
    frames += fit;
    left -= fit * row.frameSeconds;
    if (fit < row.remainingFrames) break;
  }
  return frames;
}

/**
 * Every DSO container of the tree with its summary, plus the totals over all of them.
 *
 * With nowMs, every target also gets the clock times it is expected to run: targets are
 * imaged one after the other, each starting when the remaining frames of the previous one
 * are done. A finished target has startMs === endMs.
 *
 * notBeforeMs: the plan waits for darkness until then. limitAt(container, startMs) is when a
 * target that starts at startMs is cut off (dawn, or too low), null without a limit; see
 * planWindow() in planLimits.js. Targets carry it as limitMs and end there at the latest.
 * framesLeft / framesFit: pictures still to take, and how many of them the limits leave time for.
 */
export function summarizeTargets(
  tree,
  { overheadSeconds = 0, nowMs = null, resumable = false, notBeforeMs = null, limitAt = null } = {}
) {
  let cursor = nowMs === null ? null : Math.max(nowMs, notBeforeMs ?? nowMs);
  const targets = collectDsoContainers(tree).map((container) => {
    const summary = {
      container,
      ...summarizeDsoContainer(container, overheadSeconds, { resumable }),
    };
    summary.framesLeft = summary.rows.reduce((sum, r) => sum + r.remainingFrames, 0);
    summary.framesFit = summary.framesLeft;
    if (cursor !== null) {
      summary.startMs = cursor;
      summary.endMs = cursor + summary.remainingSeconds * 1000;
      summary.limitMs = limitAt?.(container, cursor) ?? null;
      if (summary.limitMs !== null && summary.endMs > summary.limitMs) {
        summary.endMs = Math.max(cursor, summary.limitMs);
        summary.framesFit = framesWithin(summary.rows, (summary.endMs - cursor) / 1000);
      }
      cursor = summary.endMs;
    }
    return summary;
  });
  const total = (key) => targets.reduce((sum, t) => sum + t[key], 0);
  return {
    targets,
    totalSeconds: total('totalSeconds'),
    remainingSeconds: total('remainingSeconds'),
    framesLeft: total('framesLeft'),
    framesFit: total('framesFit'),
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

/**
 * The closing steps a plan should run on its own but does not: parking always, the warm-up
 * only with a camera that cools. Without them a plan left alone ends with the mount tracking
 * on past the meridian into the tripod or pier, and the camera cold until someone ends the
 * night. Empty when the tree has no end area (nothing to switch on there).
 */
export function missingEndSteps(tree, { canCool = false } = {}) {
  const endArea = findAreaContainer(tree, END_AREA_TYPE);
  if (!endArea) return [];
  return END_ORDER.filter(
    (type) =>
      (type === PARK_SCOPE_TYPE || (type === WARM_CAMERA_TYPE && canCool)) &&
      !isActive(findByType(endArea.Items, type))
  );
}

// Statuses an item does not run from again: the sequencer only picks up CREATED ones.
const RAN_STATUSES = new Set(['FINISHED', 'SKIPPED', 'FAILED']);

/**
 * The items whose reset makes a plan that already ran to its end prepare and close the night
 * again. A new target added to such a plan runs, but "park" and "warm up" keep their FINISHED
 * from the first run and are skipped, so the mount tracks on (seen on PINS). Every item is listed:
 * newer plugins reset the following ones along with the first, the one on PINS images does not
 * (seen: unparking stayed FINISHED, and the slew failed on the parked mount). Empty when the plan
 * has not reached its end area; see stepsToReopen() for a stopped plan.
 * @returns {string[]} item Ids
 */
export function itemsToRearm(tree) {
  const ran = (areaType) =>
    (findAreaContainer(tree, areaType)?.Items ?? []).filter((item) =>
      RAN_STATUSES.has(item?.Status)
    );
  const closing = ran(END_AREA_TYPE);
  if (!closing.length) return [];
  return [...ran(START_AREA_TYPE), ...closing].map((item) => item.Id);
}

/**
 * What has to be opened again, one item at a time, before a plan continues: stopping it keeps the
 * FINISHED of "slew and center" and "start guiding", so the remaining pictures were taken
 * unguided wherever the telescope stood by then (seen on PINS). Per target with pictures left:
 * - the target itself, or pictures added to a finished target never run
 * - its approach, guiding and autofocus steps
 * - its unfinished rows with their filter change and exposure: the first picture would be taken
 *   in whatever filter is in, a row stopped while dithering (both FINISHED) would just end, and a
 *   row that is through (count raised, cut off by dawn) would not run at all
 * `start` adds cooling, the wait for darkness and unparking, which a plan stopped last night needs
 * again tonight. The rest of the start area, and everything a target holds beyond that, stays as
 * it is.
 * @returns {string[]} item Ids
 */
export function stepsToReopen(tree, { start = true } = {}) {
  const ran = (item) => RAN_STATUSES.has(item?.Status);
  const ids = [];
  if (start) {
    for (const item of findAreaContainer(tree, START_AREA_TYPE)?.Items ?? []) {
      const type = item?.FullTypeName;
      if ((START_ORDER.includes(type) || type === SET_TRACKING_TYPE) && ran(item))
        ids.push(item.Id);
    }
  }
  for (const { container, rows, framesLeft } of summarizeTargets(tree, { resumable: true })
    .targets) {
    if (framesLeft <= 0) continue;
    if (ran(container)) ids.push(container.Id);
    for (const item of container.Items ?? []) {
      if (TARGET_STEP_TYPES.has(item?.FullTypeName) && ran(item)) ids.push(item.Id);
    }
    for (const row of rows) {
      if (row.remainingFrames <= 0) continue;
      if (ran(row.item)) ids.push(row.id);
      ids.push(...(row.item.Items ?? []).filter(ran).map((item) => item.Id));
    }
  }
  return ids;
}

/**
 * The "once" loops (see needsSingleRun()) of targets with pictures left that already count as
 * done: they have to start over, or the target ends before its first picture.
 * @returns {string[]} condition Ids
 */
export function loopsToRestart(tree) {
  return summarizeTargets(tree, { resumable: true })
    .targets.filter((target) => target.framesLeft > 0)
    .flatMap((target) => target.container.Conditions ?? [])
    .filter(
      (c) =>
        c?.FullTypeName === LOOP_CONDITION_TYPE &&
        isActive(c) &&
        toNumber(c.Iterations) === 1 &&
        toNumber(c.CompletedIterations) >= 1
    )
    .map((c) => c.Id);
}

/**
 * Whether a target needs a "loop once" condition before it gets a limit (dawn, altitude). In NINA
 * a condition means "repeat while it holds": alone, a limit would take the pictures over and over
 * until dawn. All conditions have to hold, so with the loop the target ends after its count or at
 * the limit, whichever comes first (seen on PINS). A target that has conditions already is looped
 * by the user's own design and only gets the limit on top.
 */
export function needsSingleRun(container) {
  return !(container?.Conditions ?? []).some(isActive);
}

/**
 * The plan's wait for darkness and the two tracking items around it: the mount must not track for
 * hours while it waits. `stop` is the last "tracking off" before the wait, `resume` the first
 * "tracking on" after it. Each null when missing.
 */
export function darknessWait(tree) {
  const items = findAreaContainer(tree, START_AREA_TYPE)?.Items ?? [];
  const index = items.findIndex((i) => i?.FullTypeName === WAIT_FOR_SUN_TYPE);
  if (index < 0) return { wait: null, stop: null, resume: null };
  const tracking = (i) => i?.FullTypeName === SET_TRACKING_TYPE;
  const stopped = (i) => i.TrackingMode === 'Stopped';
  return {
    wait: items[index],
    stop: items.filter((i, n) => n < index && tracking(i) && stopped(i)).at(-1) ?? null,
    resume: items.find((i, n) => n > index && tracking(i) && !stopped(i)) ?? null,
  };
}

/** The limits a target stops at: `{ sun, altitude }`, the condition items or null. */
export function targetLimits(container) {
  return {
    sun: findByType(container?.Conditions, SUN_CONDITION_TYPE),
    altitude: findByType(container?.Conditions, ALTITUDE_CONDITION_TYPE),
  };
}

function isLight(row) {
  return !row.imageType || String(row.imageType).toUpperCase() === 'LIGHT';
}

/**
 * The number of pictures per row for an imaging time: every filter gets the same share of it, and
 * at least one picture. Pictures already taken stay on top.
 * @param {object[]} rows exposureRow() entries
 * @returns {{ row: object, frames: number, iterations: number }[]}
 */
export function framesForTime(rows, seconds) {
  const usable = (rows ?? []).filter(
    (r) => r.enabled && r.loopCondition?.Id && r.frameSeconds > 0 && isLight(r)
  );
  const share = Math.max(0, toNumber(seconds)) / Math.max(1, usable.length);
  return usable.map((row) => {
    const frames = Math.max(1, Math.floor(share / row.frameSeconds + 1e-6));
    return { row, frames, iterations: row.completed + frames };
  });
}

/** What the plan does after its last picture: `{ park, warm }`. */
export function endOfPlan(tree) {
  const items = findAreaContainer(tree, END_AREA_TYPE)?.Items;
  return {
    park: isActive(findByType(items, PARK_SCOPE_TYPE)),
    warm: isActive(findByType(items, WARM_CAMERA_TYPE)),
  };
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
