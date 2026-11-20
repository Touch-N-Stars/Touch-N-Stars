// Pure helpers of the PINS simple mode (no Vue, no stores) so they can be unit tested with
// node --test. The simple mode home page feeds them a plain snapshot of the stores.

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
 * @param {{ connected: boolean, canCool: boolean, coolerOn: boolean, temperature: number, targetTemp: number }} s.camera
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
    if (s.camera.coolerOn) {
      status = isCooled(s.camera.temperature, s.camera.targetTemp) ? 'done' : 'running';
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
 * The step the user should look at now: the first one that is neither done nor skipped.
 * Null once everything is through.
 */
export function currentStepId(steps) {
  return steps.find((step) => step.status !== 'done' && step.status !== 'skipped')?.id ?? null;
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

/**
 * The picture the home page shows: whichever is newer of the camera's last preview (a test
 * picture, a capture on the camera page) and the newest saved picture of the image history
 * (sequence frames, saved snapshots).
 *
 * @param {object} p
 * @param {{ url: string, atMs: number } | null} p.preview the preview and when it arrived
 * @param {object[] | null} p.history store.imageHistoryInfo
 * @param {(entry: object, index: number) => boolean} [p.isDeleted] hides deleted entries
 * @returns {{ source: 'preview', atMs: number } | { source: 'history', index: number, atMs: number, entry: object } | null}
 */
export function latestPicture({ preview, history, isDeleted = () => false }) {
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
