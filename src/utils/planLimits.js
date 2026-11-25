// The clock side of a plan's limits in the simple mode: when the wait for darkness is over, and
// when a target is cut off because the sun comes up or the target gets too low. PINS decides both
// itself while the plan runs; this only predicts it for the estimates. Pure functions.

import { equatorialToAltAz, getSunAltitudeDeg } from '@/utils/astronomy';
import { NIGHT_SUN_ALT_DEG } from '@/utils/tonightPicks';
import { dsoContainerDecDegrees, dsoContainerRaDegrees } from '@/utils/sequenceTargets';
import {
  darknessWait,
  findByType,
  isActive,
  targetLimits,
  ALTITUDE_CONDITION_TYPE,
  SUN_CONDITION_TYPE,
} from '@/utils/sequenceSimple';

/** Sun altitudes the plan offers as "dark", from bright to fully dark. */
export const DARK_SUN_ALTITUDES = [-6, -9, -12, -15, -18];
/** Below this a target is cut off unless the user picks another altitude. */
export const MIN_TARGET_ALT_DEG = 20;

const STEP_MS = 5 * 60000;
const DAY_MS = 24 * 3600000;

function finiteOrNull(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

/** `{ lat, lon }` from the profile, or null without a usable location. */
export function siteFromProfile(profileInfo) {
  const lat = finiteOrNull(profileInfo?.AstrometrySettings?.Latitude);
  const lon = finiteOrNull(profileInfo?.AstrometrySettings?.Longitude);
  return lat === null || lon === null ? null : { lat, lon };
}

/**
 * The first moment from fromMs on (within 24 h) at which test(ms) holds, to the second, or null.
 * fromMs itself when it already holds.
 */
function firstMoment(fromMs, test) {
  if (test(fromMs)) return fromMs;
  for (let t = fromMs + STEP_MS; t <= fromMs + DAY_MS; t += STEP_MS) {
    if (!test(t)) continue;
    let before = t - STEP_MS;
    let after = t;
    while (after - before > 1000) {
      const middle = (before + after) / 2;
      if (test(middle)) after = middle;
      else before = middle;
    }
    return after;
  }
  return null;
}

const sunAlt = (ms, site) => getSunAltitudeDeg(new Date(ms), site.lat, site.lon);

/** When the sun is at or below sunAltDeg from fromMs on, or null when it does not get that dark. */
export function darkFrom(fromMs, sunAltDeg, site) {
  return firstMoment(fromMs, (ms) => sunAlt(ms, site) <= sunAltDeg);
}

/** When the sun is above sunAltDeg from fromMs on, or null (polar night). */
export function darkUntil(fromMs, sunAltDeg, site) {
  return firstMoment(fromMs, (ms) => sunAlt(ms, site) > sunAltDeg);
}

/**
 * The darkness the plan waits for by default: nautical twilight, or the darkest it gets within
 * the next day when the summer night stays brighter. Null when it never gets dark at all. Without
 * a location nautical twilight is assumed.
 */
export function defaultDarkness(nowMs, site) {
  if (!site) return NIGHT_SUN_ALT_DEG;
  return (
    DARK_SUN_ALTITUDES.filter((alt) => alt >= NIGHT_SUN_ALT_DEG)
      .reverse()
      .find((alt) => darkFrom(nowMs, alt, site) !== null) ?? null
  );
}

// Same rule as NINA's altitude condition: a rising target is not cut off, however low it is.
function tooLow(ms, raDeg, decDeg, minAltDeg, site) {
  const at = (t) => equatorialToAltAz(raDeg, decDeg, new Date(t), site.lat, site.lon).altDeg;
  const altitude = at(ms);
  return altitude < minAltDeg && at(ms + 60000) <= altitude;
}

/**
 * When a target that starts at startMs is cut off (startMs when at once) and why: 'light' or
 * 'low'. Null when never.
 * @returns {{ ms: number, by: 'light'|'low' } | null}
 */
export function targetLimit(container, startMs, site) {
  if (!site) return null;
  const { sun, altitude } = targetLimits(container);
  const moments = [];
  const sunOffset = finiteOrNull(sun?.Offset);
  if (isActive(sun) && sunOffset !== null) {
    moments.push({ ms: darkUntil(startMs, sunOffset, site), by: 'light' });
  }
  const minAlt = finiteOrNull(altitude?.Offset);
  const ra = dsoContainerRaDegrees(container);
  const dec = dsoContainerDecDegrees(container);
  if (isActive(altitude) && minAlt !== null && Number.isFinite(ra) && Number.isFinite(dec)) {
    const ms = firstMoment(startMs, (at) => tooLow(at, ra, dec, minAlt, site));
    moments.push({ ms, by: 'low' });
  }
  const known = moments.filter((moment) => moment.ms !== null);
  return known.length ? known.reduce((a, b) => (b.ms < a.ms ? b : a)) : null;
}

/** When a target that starts at startMs is cut off, null when never. See targetLimit(). */
export function targetLimitAt(container, startMs, site) {
  return targetLimit(container, startMs, site)?.ms ?? null;
}

/**
 * The plan's window for summarizeTargets(): `notBeforeMs` (when the wait for darkness ends, null
 * when nothing is waited for), `limitAt` and `limitOf` (with the reason), `noDarkness` when the
 * plan would wait in vain, and `darkMs`: when it gets dark if the plan waited (null: dark already,
 * or unknown).
 *
 * running: while the plan runs a wait that is through does not come again; a plan that does not
 * run waits with its next start (stepsToReopen()).
 */
export function planWindow(tree, { nowMs, site, running = false }) {
  if (!site) {
    return {
      notBeforeMs: null,
      noDarkness: false,
      darkMs: null,
      limitAt: null,
      limitOf: () => null,
    };
  }
  const { wait } = darknessWait(tree);
  const offset = finiteOrNull(wait?.Offset);
  const dusk = darkFrom(nowMs, offset ?? NIGHT_SUN_ALT_DEG, site);
  const pending =
    isActive(wait) && (!running || wait.Status === 'CREATED' || wait.Status === 'RUNNING');
  let notBeforeMs = null;
  let noDarkness = false;
  if (pending && offset !== null) {
    noDarkness = dusk === null;
    notBeforeMs = dusk !== null && dusk > nowMs ? dusk : null;
  }
  return {
    notBeforeMs,
    noDarkness,
    darkMs: dusk !== null && dusk > nowMs ? dusk : null,
    limitOf: (container, startMs) => targetLimit(container, startMs, site),
    limitAt: (container, startMs) => targetLimitAt(container, startMs, site),
  };
}

/**
 * Whether the limits ended a plan before its last picture: the plan is through with every target
 * that has pictures left, and none of them may run now (dawn came, or it is too low). A fresh plan
 * in daylight and one the user stopped are not: their targets are still CREATED.
 * @param {object} summary summarizeTargets() with resumable
 */
export function planCutOff(summary, nowMs, site) {
  const open = (summary?.targets ?? []).filter((target) => target.framesLeft > 0);
  if (!open.length || !site) return false;
  return open.every((target) => {
    if (!['FINISHED', 'SKIPPED'].includes(target.container.Status)) return false;
    const limit = targetLimitAt(target.container, nowMs, site);
    return limit !== null && limit <= nowMs;
  });
}

/**
 * The limits of the plan as the switches show them: the wait for darkness and, over all targets,
 * the stop at dawn and below an altitude. `startDarkness` / `endDarkness` are the sun altitudes the
 * plan begins and ends at, null when it has none yet.
 */
export function planLimitState(tree, containers) {
  const { wait } = darknessWait(tree);
  const conditions = (type) =>
    containers.map((c) => findByType(c?.Conditions, type)).filter(Boolean);
  const suns = conditions(SUN_CONDITION_TYPE);
  const altitudes = conditions(ALTITUDE_CONDITION_TYPE);
  const all = (type) =>
    containers.length > 0 && containers.every((c) => isActive(findByType(c?.Conditions, type)));
  return {
    waits: isActive(wait),
    stopsAtDawn: all(SUN_CONDITION_TYPE),
    stopsWhenLow: all(ALTITUDE_CONDITION_TYPE),
    startDarkness: finiteOrNull(wait?.Offset),
    endDarkness: finiteOrNull((suns.find(isActive) ?? suns[0])?.Offset),
    minAltitude: finiteOrNull((altitudes.find(isActive) ?? altitudes[0])?.Offset),
    // The user switched it off before: new targets must not bring it back.
    dawnDeclined: suns.some((c) => !isActive(c)) && !suns.some(isActive),
    lowDeclined: altitudes.some((c) => !isActive(c)) && !altitudes.some(isActive),
  };
}

/**
 * The sun altitude a target may end at: never below the one the plan starts at. N.I.N.A.'s
 * condition knows no dusk and dawn, a target that starts at -6 degrees with a limit of -12 ends at
 * once.
 */
export function clampEndDarkness(endDarkness, startDarkness, waits) {
  return waits && startDarkness !== null ? Math.max(endDarkness, startDarkness) : endDarkness;
}
