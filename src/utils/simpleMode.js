// Pure helpers of the PINS simple mode (no Vue, no stores) so they can be unit tested with
// node --test. The simple mode home page feeds them a plain snapshot of the stores.
import { binColumns, cumulative, percentile } from '@/utils/rawImage/histogramView';
import { MAD_SCALE, maxAdu } from '@/utils/rawImage/stretch';

/** Navigation entries the simple mode keeps, in the order it shows them. */
// Five entries fit a 390 px phone without scrolling. Targets are picked in the sky atlas
// (`skyview`), which also slews, centers and hands the target to the plan; the framing page
// and the monitor stay one tap away from the home page.
export const SIMPLE_NAV_ITEMS = ['home', 'camera', 'skyview', 'sequence', 'settings'];

/** Whether a nav entry (core id or `plugin-<id>`) is hidden while the simple mode is active. */
export function isHiddenInSimpleMode(id) {
  return !SIMPLE_NAV_ITEMS.includes(id);
}

/** Flex order of a nav entry while the simple mode is active. */
export function simpleNavOrder(id) {
  const index = SIMPLE_NAV_ITEMS.indexOf(id);
  return index === -1 ? 99 : index;
}

const NIGHT_ROLLOVER_HOURS = 12;

/**
 * The night a moment belongs to, as the local date of its evening ("YYYY-MM-DD"). A night runs
 * from noon to noon, so 23:00 and 03:00 of one session share a key.
 */
export function nightKey(date = new Date()) {
  const shifted = new Date(date.getTime() - NIGHT_ROLLOVER_HOURS * 3600 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whether a timestamp (ms, ISO string or Date) falls into the given night. */
export function isInNight(timestamp, key) {
  if (timestamp === null || timestamp === undefined || timestamp === '') return false;
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  return nightKey(date) === key;
}

/**
 * The step marks that still apply: marks of an earlier night are dropped.
 * @param {{ night?: string, marks?: Record<string, 'done'|'skipped'> }} stored
 */
export function marksForNight(stored, key) {
  if (!stored || stored.night !== key || !stored.marks) return {};
  return { ...stored.marks };
}

// Guider states that count as "doing something" before steady guiding.
const GUIDER_BUSY_STATES = [
  'Calibrating',
  'Looping',
  'Selected',
  'Settling',
  'Reacquiring',
  'Paused',
  'LostLock',
];

// How close the sensor has to be to the target to count as cooled. Some drivers (and the
// simulators) report the cooler as on without the sensor ever getting there.
const COOLED_TOLERANCE_C = 1;

/** Whether the sensor reached the cooling target. */
export function isCooled(temperature, targetTemp) {
  if (!Number.isFinite(temperature) || !Number.isFinite(targetTemp)) return false;
  return Math.abs(temperature - targetTemp) <= COOLED_TOLERANCE_C;
}

// How far the cooler's setpoint has to sit above the cooling target to count as a warm-up ramp.
const WARM_UP_SETPOINT_MARGIN_C = 0.5;

/**
 * Whether the camera is warming up rather than cooling. The camera store knows a warm-up it
 * started itself; after a reload, or for a warm-up started elsewhere, the setpoint gives it
 * away. A ramp's setpoint leads the sensor: above it and above the cooling target means
 * warming. (A cool-down ramp also starts with the setpoint above the target, but below the
 * sensor temperature.)
 */
export function isWarmingUp({ coolingState, setPoint, temperature, targetTemp }) {
  if (coolingState === 'warming') return true;
  const sp = finiteOrNull(setPoint);
  const temp = finiteOrNull(temperature);
  if (sp === null || temp === null || !Number.isFinite(targetTemp)) return false;
  return sp > targetTemp + WARM_UP_SETPOINT_MARGIN_C && sp > temp + WARM_UP_SETPOINT_MARGIN_C;
}

// The cooler is on but holds a temperature other than the target, with no ramp running: cooling
// to the target was never started (seen with a fresh profile: the camera held -6 °C while the
// step said "running -6 °C -> -10 °C" for good). Unknown values keep the old "running".
function holdsOtherTemperature({ ramping, setPoint, targetTemp }) {
  const sp = finiteOrNull(setPoint);
  if (ramping !== false || sp === null || !Number.isFinite(targetTemp)) return false;
  return !isCooled(sp, targetTemp);
}

function markStatus(mark) {
  return mark === 'done' || mark === 'skipped' ? mark : 'open';
}

/**
 * The steps of the night in their order, each with a status: done | running | open | skipped.
 * What the devices report wins over a manual mark, except that a step marked done stays done.
 *
 * @param {object} s snapshot
 * @param {boolean} s.allConnected every device of the profile is connected
 * @param {boolean} s.hasEquipment the profile has at least one device
 * @param {{ connected: boolean, canCool: boolean, coolerOn: boolean, warming?: boolean, ramping?: boolean, setPoint?: number, temperature: number, targetTemp: number }} s.camera
 * @param {{ connected: boolean, parked: boolean, tracking: boolean, slewing: boolean }} s.mount
 * @param {{ connected: boolean, afRunning: boolean, afDoneTonight: boolean }} s.focuser
 * @param {{ inProfile: boolean, state: string }} s.guider
 * @param {{ running: boolean, targets: number, totalSeconds: number, remainingSeconds: number }} s.sequence
 * @param {boolean} s.tppaRunning
 * @param {Record<string, 'done'|'skipped'>} s.marks
 */
// The order follows the night. Focus comes before polar alignment and the target: both
// plate-solve, and plate solving needs sharp stars.
export function nightSteps(s) {
  const marks = s.marks ?? {};
  const steps = [];

  steps.push({
    id: 'connect',
    status: s.hasEquipment && s.allConnected ? 'done' : 'open',
  });

  if (s.camera?.canCool) {
    let status = markStatus(marks.cool);
    if (s.camera.warming) {
      // Warming up ends the night (or was asked for on purpose): the cooling is behind us,
      // and a "running" step would pull the user back to the top of the list.
      if (marks.end === 'done' && status === 'open') status = 'done';
    } else if (s.camera.coolerOn) {
      if (isCooled(s.camera.temperature, s.camera.targetTemp)) status = 'done';
      else if (holdsOtherTemperature(s.camera)) status = status === 'skipped' ? 'skipped' : 'open';
      else status = 'running';
    }
    steps.push({ id: 'cool', status });
  }

  {
    let status = 'open';
    if (s.mount?.connected && !s.mount.parked && s.mount.tracking) status = 'done';
    else if (s.mount?.connected && s.mount.slewing) status = 'running';
    steps.push({ id: 'mount', status });
  }

  {
    let status = markStatus(marks.focus);
    if (s.focuser?.afRunning) status = 'running';
    else if (s.focuser?.afDoneTonight) status = 'done';
    steps.push({ id: 'focus', status });
  }

  {
    let status = markStatus(marks.polar);
    if (s.tppaRunning && status !== 'done') status = 'running';
    steps.push({ id: 'polar', status });
  }

  {
    let status = markStatus(marks.target);
    if (s.mount?.slewing && status !== 'done') status = 'running';
    steps.push({ id: 'target', status });
  }

  if (s.guider?.inProfile) {
    let status = markStatus(marks.guide);
    if (s.guider.state === 'Guiding') status = 'done';
    else if (GUIDER_BUSY_STATES.includes(s.guider.state)) status = 'running';
    else if (status === 'done') status = 'open'; // guiding stopped: a stale "done" would lie
    steps.push({ id: 'guide', status });
  }

  {
    let status = 'open';
    if (s.sequence?.running) status = 'running';
    // A target without exposures has nothing left either, but nothing was taken.
    else if (s.sequence?.totalSeconds > 0 && s.sequence.remainingSeconds <= 0) status = 'done';
    steps.push({ id: 'capture', status });
  }

  steps.push({ id: 'end', status: marks.end === 'done' ? 'done' : 'open' });

  return steps;
}

/**
 * The step the user should look at now: the first open one. A running step (cooling, an
 * autofocus run) needs no hand and stays expanded on its own, so the highlight moves on to what
 * can be done meanwhile - the cooling text says "carry on", and the highlight used to stay
 * behind. Only when nothing is open does a running step count. Null once everything is through,
 * and once the night was ended: the parked mount must not ask to be made ready again.
 */
export function currentStepId(steps) {
  if (steps.find((step) => step.id === 'end')?.status === 'done') return null;
  return (
    steps.find((step) => step.status === 'open')?.id ??
    steps.find((step) => step.status === 'running')?.id ??
    null
  );
}

/** Steps the app cannot read from the devices, so the user marks them done by hand. */
export const MARKABLE_STEPS = ['polar', 'target', 'focus'];

/** Steps a session can do without; the user may skip them. */
export const SKIPPABLE_STEPS = ['cool', 'polar', 'target', 'focus', 'guide'];

/**
 * The end-of-night actions that apply right now, in the order they have to run: the sequence
 * stops before guiding (it may still need it), guiding before the mount parks.
 */
export function endNightActions({ sequenceRunning, guiding, mountUnparked, coolerOn }) {
  const actions = [];
  if (sequenceRunning) actions.push('stopSequence');
  if (guiding) actions.push('stopGuiding');
  if (mountUnparked) actions.push('parkMount');
  if (coolerOn) actions.push('warmCamera');
  return actions;
}

function finiteOrNull(value) {
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

// A preview and a history entry that arrive this close together are the same frame: a plan
// exposure (or a plate solve) shows up as the camera's preview and as a saved picture.
export const SAME_SHOT_MS = 20000;

/**
 * The picture the home page shows: whichever is newer of the camera's last preview (a test
 * picture, a capture on the camera page) and the newest saved picture of the image history
 * (sequence frames, saved snapshots). When both are the same frame, the saved picture wins:
 * it knows its target, exposure and filter.
 *
 * @param {object} p
 * @param {{ url: string, atMs: number, own?: boolean } | null} p.preview the preview, when it
 *   arrived, and whether it is a test picture taken on the home page (never saved, so it cannot
 *   be the same frame as a saved one)
 * @param {object[] | null} p.history store.imageHistoryInfo
 * @param {(entry: object, index: number) => boolean} [p.isDeleted] hides deleted entries
 * @param {number|null} [p.historyArrivedAtMs] when the newest history entry showed up on this
 *   device (browser clock, like preview.atMs); compared instead of the entry's own date, which
 *   comes from the rig's clock
 * @returns {{ source: 'preview', atMs: number } | { source: 'history', index: number, atMs: number, entry: object } | null}
 */
export function latestPicture({ preview, history, isDeleted = () => false, historyArrivedAtMs }) {
  let latest = null;
  const list = Array.isArray(history) ? history : [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i] && !isDeleted(list[i], i)) {
      const atMs = Date.parse(list[i].Date);
      latest = {
        source: 'history',
        index: i,
        atMs: Number.isFinite(atMs) ? atMs : 0,
        entry: list[i],
      };
      break;
    }
  }
  if (preview?.url && latest && !preview.own) {
    const historyAt = Number.isFinite(historyArrivedAtMs) ? historyArrivedAtMs : latest.atMs;
    if (Math.abs(preview.atMs - historyAt) <= SAME_SHOT_MS) return latest;
  }
  if (preview?.url && (!latest || preview.atMs >= latest.atMs)) {
    return { source: 'preview', atMs: preview.atMs };
  }
  return latest;
}

/**
 * HFR and star count of the last `max` saved pictures that have them, oldest first, for the
 * sharpness trend on the home page. A rising HFR means focus drifts or the sky gets worse.
 */
export function hfrSeries(history, max = 30, isDeleted = () => false) {
  const list = Array.isArray(history) ? history : [];
  const points = [];
  for (let i = list.length - 1; i >= 0 && points.length < max; i--) {
    const entry = list[i];
    if (!entry || isDeleted(entry, i)) continue;
    const hfr = finiteOrNull(entry.HFR);
    if (hfr === null || hfr <= 0) continue;
    points.push({ hfr, stars: finiteOrNull(entry.Stars) });
  }
  return points.reverse();
}

// --- Phases of the night -------------------------------------------------------------------

/**
 * Which part of the night the home page is in; it decides what the page puts first.
 * - prepare: getting the rig ready (the steps lead)
 * - imaging: the plan takes pictures (guiding, sharpness and star shape lead)
 * - finished: the plan has nothing left, the night is not ended yet
 * - ended: the night was ended on this page
 *
 * @param {{ id: string, status: string }[]} steps from nightSteps()
 */
export function nightPhase(steps) {
  const status = (id) => steps.find((step) => step.id === id)?.status;
  if (status('end') === 'done') return 'ended';
  if (status('capture') === 'running') return 'imaging';
  if (status('capture') === 'done') return 'finished';
  return 'prepare';
}

/**
 * What the rig is busy with while the plan runs, most telling first: an autofocus run or a
 * slew (centering, meridian flip) pauses the pictures, a calibrating or settling guider
 * delays the next one.
 * @returns {'autofocus'|'slewing'|'calibrating'|'settling'|'exposing'|'busy'}
 */
export function imagingActivity({ afRunning, slewing, guiderState, settling, exposing }) {
  if (afRunning) return 'autofocus';
  if (slewing) return 'slewing';
  if (guiderState === 'Calibrating') return 'calibrating';
  if (settling || guiderState === 'Settling') return 'settling';
  if (exposing) return 'exposing';
  return 'busy';
}

// Guide RMS as a share of the imaging pixel scale. Below half a pixel the guiding is invisible
// in the picture, up to one pixel it softens the stars a little, beyond that it shows.
const GUIDING_GOOD_RATIO = 0.5;
const GUIDING_OK_RATIO = 1;

/**
 * Rates the total guide RMS against the imaging scale.
 * @returns {{ level: 'good'|'ok'|'poor'|null, ratio: number|null }} level null when the RMS
 *   or the scale is unknown
 */
export function rateGuiding(rmsArcsec, imageScaleArcsec) {
  const rms = finiteOrNull(rmsArcsec);
  const scale = finiteOrNull(imageScaleArcsec);
  if (rms === null || rms <= 0 || scale === null || scale <= 0) return { level: null, ratio: null };
  const ratio = rms / scale;
  const level = ratio <= GUIDING_GOOD_RATIO ? 'good' : ratio <= GUIDING_OK_RATIO ? 'ok' : 'poor';
  return { level, ratio };
}

// Earlier pictures of the same filter the newest one is compared with.
const HFR_BASELINE_FRAMES = 10;
const HFR_MIN_BASELINE = 3;
// How much larger than usual the HFR may get before it counts as drifting.
const HFR_OK_RISE = 0.1;
const HFR_POOR_RISE = 0.25;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The newest saved picture's HFR against the median of the pictures before it in the same
 * filter (filters focus differently, so they are not mixed). A growing HFR means focus drifts,
 * dew forms or clouds come in.
 *
 * @param {object[]|null} history store.imageHistoryInfo
 * @returns {{ hfr: number, stars: number|null, filter: string, baseline: number|null,
 *   change: number|null, level: 'good'|'ok'|'poor'|null } | null} null without any HFR yet
 */
export function hfrHealth(history, isDeleted = () => false) {
  const list = Array.isArray(history) ? history : [];
  let latest = null;
  const earlier = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const entry = list[i];
    if (!entry || isDeleted(entry, i)) continue;
    const hfr = finiteOrNull(entry.HFR);
    if (hfr === null || hfr <= 0) continue;
    if (!latest) {
      latest = { hfr, stars: finiteOrNull(entry.Stars), filter: entry.Filter ?? '' };
      continue;
    }
    if ((entry.Filter ?? '') !== latest.filter) continue;
    earlier.push(hfr);
    if (earlier.length >= HFR_BASELINE_FRAMES) break;
  }
  if (!latest) return null;
  if (earlier.length < HFR_MIN_BASELINE) {
    return { ...latest, baseline: null, change: null, level: null };
  }
  const baseline = median(earlier);
  const change = (latest.hfr - baseline) / baseline;
  const level = change <= HFR_OK_RISE ? 'good' : change <= HFR_POOR_RISE ? 'ok' : 'poor';
  return { ...latest, baseline, change, level };
}

/**
 * The light frames saved in the given night: count and summed exposure, for the summary once
 * the plan is through.
 */
export function nightFrames(history, key, isDeleted = () => false) {
  const list = Array.isArray(history) ? history : [];
  let frames = 0;
  let seconds = 0;
  const hfrs = [];
  list.forEach((entry, i) => {
    if (!entry || isDeleted(entry, i)) return;
    if (String(entry.ImageType ?? '').toUpperCase() !== 'LIGHT') return;
    if (!isInNight(entry.Date, key)) return;
    frames += 1;
    seconds += finiteOrNull(entry.ExposureTime) ?? 0;
    const hfr = finiteOrNull(entry.HFR);
    if (hfr !== null && hfr > 0) hfrs.push(hfr);
  });
  return { frames, seconds, medianHfr: hfrs.length ? median(hfrs) : null };
}

/**
 * Where the running plan stands: the target and exposure row being worked on, from
 * summarizeTargets(). The RUNNING status wins; between two items (a slew, a filter change)
 * the first target and row with frames left stand in.
 *
 * @returns {{ container: object, row: object|null, endMs: number|undefined } | null}
 */
export function runningPlanPosition(summary) {
  const targets = summary?.targets ?? [];
  const target =
    targets.find((t) => t.container?.Status === 'RUNNING') ??
    targets.find((t) => t.remainingSeconds > 0) ??
    null;
  if (!target) return null;
  const row =
    target.rows.find((r) => r.status === 'RUNNING') ??
    target.rows.find((r) => r.enabled && r.remainingSeconds > 0) ??
    null;
  return { container: target.container, row, endMs: target.endMs };
}

/** Columns of the small histogram on the home page. */
export const HISTOGRAM_COLUMNS = 80;

// The view spans the sky background: from a few sigma below the median up to where 99 % of
// the pixels are. Stars and saturated pixels lie beyond and are reported as numbers (max and
// its count); including them, as the camera page's zoom does up to 99.95 %, squeezes the
// background into one spike as soon as a frame has a few bright stars.
const VIEW_SIGMA = 8;
const VIEW_PERCENTILE = 0.99;
const VIEW_MIN_WIDTH = 64;

/**
 * The small histogram of the newest picture and its extremes, from the plugin's raw image
 * (parseRawImage()): exact per-channel statistics and a 65536-bin histogram over the full
 * frame. Channels are summed into one curve; min and max carry how many pixels sit there -
 * many pixels at the maximum are saturated stars, many at the minimum a clipped background.
 *
 * @returns {{ bins: number[], lo: number, hi: number, min: number, max: number,
 *   minCount: number, maxCount: number, saturated: boolean } | null}
 */
export function histogramSummary(raw, columns = HISTOGRAM_COLUMNS) {
  const meta = raw?.meta;
  const histograms = raw?.histograms;
  const stats = Array.isArray(meta?.stats) ? meta.stats : [];
  if (!histograms?.length || stats.length === 0) return null;
  const sum = new Float64Array(histograms[0].length);
  for (const histogram of histograms) {
    for (let v = 0; v < histogram.length; v++) sum[v] += histogram[v];
  }
  const cum = cumulative(sum);
  const min = Math.round(Math.min(...stats.map((s) => s.min)));
  const max = Math.round(Math.max(...stats.map((s) => s.max)));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  const median = Math.min(...stats.map((s) => s.median));
  const sigma = Math.max(1, Math.max(...stats.map((s) => s.mad)) * MAD_SCALE);
  let lo = Math.max(min, Math.floor(median - VIEW_SIGMA * sigma));
  let hi = Math.max(percentile(cum, VIEW_PERCENTILE), Math.ceil(median + VIEW_SIGMA * sigma)) + 1;
  hi = Math.min(hi, sum.length);
  if (hi - lo < VIEW_MIN_WIDTH) {
    lo = Math.max(0, Math.floor((lo + hi - VIEW_MIN_WIDTH) / 2));
    hi = Math.min(sum.length, lo + VIEW_MIN_WIDTH);
  }

  // Whole ADU per column: with a fractional width some columns collect one value more than
  // their neighbours and the curve turns into a comb.
  const perColumn = Math.ceil((hi - lo) / columns);
  hi = Math.min(sum.length, lo + perColumn * columns);
  lo = hi - perColumn * columns;

  return {
    bins: Array.from(binColumns(cum, lo, hi, columns)),
    lo,
    hi,
    min,
    max,
    minCount: sum[min] ?? 0,
    maxCount: sum[max] ?? 0,
    saturated: max >= maxAdu(meta.bitDepth),
  };
}
