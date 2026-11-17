// Planning helpers for the real meridian flip test.
//
// The test lets NINA flip for real: the user drives the scope by hand to a point a few
// minutes east of the meridian, then a sequence waits in exposure-sized steps while NINA's
// MeridianFlipTrigger decides when to flip. There is no goto to the start point on purpose:
// a mount with a preferred pier side (OnStep "East") takes the post-flip side for any goto
// within its meridian limit, while a plain axis move never changes the pier side.
// Everything here is computed in the mount's own frame (its sidereal time and site
// latitude): the hour angle the mount believes in is what decides its pier side.

import { angularSeparationDeg, clampValue, normalizeDeg360, toDeg, toRad } from './astronomy';
import { isPierSideKnown } from './meridianFlipPresets';

export const FLIP_TEST_MIN_ALTITUDE_DEG = 20;
export const FLIP_TEST_MIN_SUN_SEPARATION_DEG = 45;
// Least time between the start point and the earliest flip: room to load and start the
// sequence before NINA wants to flip. The start may lie inside the pause before the
// meridian (NINA stops tracking right away) or even past the meridian when the flip comes
// later: a plain axis move keeps the side of pier before the flip.
export const FLIP_TEST_LEAD_MINUTES = 1;
// Room for the flip slew, settling and recentering after the flip time.
const FLIP_DURATION_MINUTES = 3;
// The wait loop runs well past the latest flip time; the app stops it after the flip.
const WAIT_MARGIN_MINUTES = 15;

const PATH_STEP_HOURS = 0.1;

export function altitudeDeg(hourAngleHours, decDeg, latDeg) {
  const ha = toRad(hourAngleHours * 15);
  const dec = toRad(decDeg);
  const lat = toRad(latDeg);
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  return toDeg(Math.asin(clampValue(sinAlt, -1, 1)));
}

// Hour angle in hours, -12..12: negative east of the meridian.
export function hourAngleHours(lstHours, raHours) {
  return ((((lstHours - raHours) % 24) + 36) % 24) - 12;
}

// Side of pier before the flip: NINA's MeridianFlip.ExpectedPierSide for any point east of
// the meridian.
export const PIER_SIDE_BEFORE_FLIP = 'pierWest';

// RA (degrees) of the point at the given hour angle for the given local sidereal time.
function raAtHourAngle(lstHours, hourAngle) {
  return normalizeDeg360((lstHours - hourAngle) * 15);
}

// Lead time, number of wait steps and the expected duration for the flip settings and
// exposure length, counted from a start point minutesToMeridian before the meridian
// (negative past it; the minimum lead when the start point is not known yet). NINA flips after the first
// exposure that ends inside the window, so the latest flip lands at min + one exposure,
// capped at max. With a pause before the meridian NINA stops tracking and flips at min.
export function planFlipTest(flipSettings, exposureSeconds, minutesToMeridian) {
  const pause = Math.max(0, Number(flipSettings?.PauseTimeBeforeMeridian) || 0);
  const min = Math.max(0, Number(flipSettings?.MinutesAfterMeridian) || 0);
  const max = Math.max(min, Number(flipSettings?.MaxMinutesAfterMeridian) || 0);
  const exposureMinutes = Math.max(1, Number(exposureSeconds) || 0) / 60;

  const leadMinutes = FLIP_TEST_LEAD_MINUTES;
  const startMinutes = Number.isFinite(minutesToMeridian) ? minutesToMeridian : leadMinutes;
  const latestFlipMinutes = pause > 0 ? min : Math.min(max, min + exposureMinutes);
  const waitTotalMinutes = Math.max(0, startMinutes) + max + exposureMinutes + WAIT_MARGIN_MINUTES;
  const minutesToLatestFlip = Math.max(leadMinutes, startMinutes + latestFlipMinutes);

  return {
    leadMinutes,
    earliestFlipMinutes: min,
    latestFlipMinutes,
    expectedMinutes: Math.ceil(minutesToLatestFlip + FLIP_DURATION_MINUTES),
    waitCount: Math.ceil(waitTotalMinutes / exposureMinutes),
    // Last hour angle the scope reaches: the latest flip plus the flip itself.
    haToHours: (Math.max(max, latestFlipMinutes) + FLIP_DURATION_MINUTES) / 60,
  };
}

// Checks the position the user drove the scope to. From there the scope tracks up to
// plan.haToHours; along that whole path it must stay above FLIP_TEST_MIN_ALTITUDE_DEG and
// FLIP_TEST_MIN_SUN_SEPARATION_DEG from the sun. pierOk is null when the mount reports no
// side of pier; that does not block the start. Returns null without mount time or site.
export function checkStartPosition({ lstHours, raHours, decDeg, latDeg, sideOfPier, sun, plan }) {
  if (![lstHours, raHours, decDeg, latDeg, sun?.raDeg, sun?.decDeg].every(Number.isFinite)) {
    return null;
  }
  const ha = hourAngleHours(lstHours, raHours);
  const minutesToMeridian = -ha * 60;

  const pathHourAngles = [];
  for (let h = ha; h < plan.haToHours; h += PATH_STEP_HOURS) pathHourAngles.push(h);
  pathHourAngles.push(plan.haToHours);

  let minAltitudeDeg = Infinity;
  let minSunSeparationDeg = Infinity;
  for (const h of pathHourAngles) {
    minAltitudeDeg = Math.min(minAltitudeDeg, altitudeDeg(h, decDeg, latDeg));
    const separation = angularSeparationDeg(
      raAtHourAngle(lstHours, h),
      decDeg,
      sun.raDeg,
      sun.decDeg
    );
    minSunSeparationDeg = Math.min(minSunSeparationDeg, separation);
  }

  const minutesToFlip = minutesToMeridian + plan.earliestFlipMinutes;
  const leadOk = minutesToFlip >= plan.leadMinutes;
  const pierOk = isPierSideKnown(sideOfPier) ? sideOfPier === PIER_SIDE_BEFORE_FLIP : null;
  const altitudeOk = minAltitudeDeg >= FLIP_TEST_MIN_ALTITUDE_DEG;
  const sunOk = minSunSeparationDeg >= FLIP_TEST_MIN_SUN_SEPARATION_DEG;
  return {
    minutesToMeridian,
    minutesToFlip,
    leadOk,
    pierOk,
    altitudeOk,
    sunOk,
    ready: leadOk && pierOk !== false && altitudeOk && sunOk,
  };
}

// Beyond this time to the flip, driving west shortens the wait.
const START_WINDOW_MINUTES = 15;
// Near the pole the tube points at the pole before and after the flip, so the test shows
// neither tripod clearance nor cable reach. NINA flips there all the same.
const POLE_ZONE_DEG = 75;

// Which way to drive, in sky directions: ra 'east' lowers the hour angle, dec 'north'
// raises the declination, decReason says why ('altitude' or 'sun'). null where that axis is
// fine; the time to the flip needs RA only. nearPole asks for a hint, not a move. No
// suggestion while the scope is on the post-flip side: no plain axis move leads back from
// there without a pole crossing.
export function suggestSkyMoves({ check, decDeg, latDeg, sunDecDeg, leadMinutes }) {
  if (!check || check.pierOk === false) {
    return { ra: null, dec: null, decReason: null, nearPole: false };
  }
  let dec = null;
  let decReason = null;
  if (!check.altitudeOk) {
    dec = decDeg < latDeg ? 'north' : 'south';
    decReason = 'altitude';
  } else if (!check.sunOk) {
    dec = decDeg >= sunDecDeg ? 'north' : 'south';
    decReason = 'sun';
  }

  let ra = null;
  if (!check.leadOk) ra = 'east';
  else if (check.minutesToFlip > leadMinutes + START_WINDOW_MINUTES) ra = 'west';
  return { ra, dec, decReason, nearPole: Math.abs(decDeg) > POLE_ZONE_DEG };
}

const SIDEREAL_HOURS_PER_MS = 1.00273791 / 3600000;
const MIN_RA_MOVE_HOURS = 0.002;
const MIN_DEC_MOVE_DEG = 0.03;

// Learns from a held button whether it moves the sky the expected way (1) or the opposite
// way (-1), e.g. with a reversed axis in the profile or an ASCOM driver with another sign.
// Samples are { timeMs, haHours, decDeg }. Returns null when the move was too small to
// tell or ran near the pole, where the sky direction of the Dec axis flips.
export function observedAxisSense(before, after, button) {
  if (!before || !after) return null;
  if (Math.abs(before.decDeg) > 80 || Math.abs(after.decDeg) > 80) return null;
  if (button === 'east' || button === 'west') {
    // Tracking alone lets the hour angle grow at the sidereal rate.
    const drift = (after.timeMs - before.timeMs) * SIDEREAL_HOURS_PER_MS;
    let move = after.haHours - before.haHours - drift;
    move = ((((move + 12) % 24) + 24) % 24) - 12;
    if (Math.abs(move) < MIN_RA_MOVE_HOURS) return null;
    const expected = button === 'east' ? -1 : 1;
    return Math.sign(move) === expected ? 1 : -1;
  }
  if (button === 'north' || button === 'south') {
    const move = after.decDeg - before.decDeg;
    if (Math.abs(move) < MIN_DEC_MOVE_DEG) return null;
    const expected = button === 'north' ? 1 : -1;
    return Math.sign(move) === expected ? 1 : -1;
  }
  return null;
}

const OPPOSITE = { east: 'west', west: 'east', north: 'south', south: 'north' };

// The button that moves the sky in skyDirection, given the learned sense of its axis.
export function buttonForSkyMove(skyDirection, sense) {
  if (!skyDirection) return null;
  return sense === -1 ? OPPOSITE[skyDirection] : skyDirection;
}

// True when any item, condition or trigger in a /sequence/state response is running.
export function isSequenceRunning(state) {
  if (Array.isArray(state)) return state.some(isSequenceRunning);
  if (!state || typeof state !== 'object') return false;
  if (state.Status === 'RUNNING') return true;
  return Object.values(state).some((v) => typeof v === 'object' && isSequenceRunning(v));
}

// Status of the flip trigger in a /sequence/state response of the test sequence, which
// carries exactly one global trigger. NINA keeps it RUNNING through the flip slew,
// settling and recentering, so leaving RUNNING marks the end of the flip.
export function flipTriggerStatus(state) {
  if (!Array.isArray(state)) return null;
  const block = state.find((entry) => Array.isArray(entry?.GlobalTriggers));
  return block?.GlobalTriggers?.[0]?.Status ?? null;
}

// NINA logs each flip step as "Meridian Flip - <step>" (English, independent of the UI
// language) and marks a failure with "... after meridian flip error", while the trigger
// itself still ends as FINISHED. This reads the most recent flip from a log list
// (any order) and names the step that ran right before the error.
const FLIP_STEP_PATTERNS = [
  ['recenter', /recenter/i],
  ['autofocus', /auto ?focus/i],
  ['settle', /settl/i],
  ['slew', /scope will flip|pier side|slew/i],
];

export function analyzeFlipLog(entries) {
  const flipLines = (Array.isArray(entries) ? entries : [])
    .filter((e) => typeof e?.message === 'string' && e.message.startsWith('Meridian Flip - '))
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  // No findLastIndex: it needs Safari 15.4, the app still targets iOS 15.
  let start = -1;
  flipLines.forEach((e, i) => {
    if (e.message.includes('Initializing Meridian Flip')) start = i;
  });
  if (start < 0) return { found: false, failed: false, failedStep: null };

  const run = flipLines.slice(start);
  const errorIndex = run.findIndex((e) => /after meridian flip error/i.test(e.message));
  if (errorIndex < 0) return { found: true, failed: false, failedStep: null };

  const before = run.slice(0, errorIndex).reverse();
  for (const entry of before) {
    const match = FLIP_STEP_PATTERNS.find(([, pattern]) => pattern.test(entry.message));
    if (match) return { found: true, failed: true, failedStep: match[0] };
  }
  return { found: true, failed: true, failedStep: 'unknown' };
}

// Outcome of the pier side comparison: 'changed', 'unchanged', or 'unknown' when the
// mount did not report a real side before and after.
export function comparePierSides(before, after) {
  if (!isPierSideKnown(before) || !isPierSideKnown(after)) return 'unknown';
  return before === after ? 'unchanged' : 'changed';
}
