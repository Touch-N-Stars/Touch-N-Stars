// Beginner presets for NINA's meridian flip timing (Options > Imaging > Auto Meridian Flip).
// Each preset answers "how far can the mount track past the meridian?" with the three
// minute values NINA needs. Per the NINA docs, a pause before the meridian is only for
// equipment that cannot pass it, and min < max gives a flip window without downtime.

import { localSiderealTimeDeg } from '@/utils/astronomy';

export const MERIDIAN_FLIP_PRESETS = [
  { id: 'barely', pause: 2, min: 0, max: 2 },
  { id: 'few', pause: 0, min: 5, max: 15 },
  { id: 'lots', pause: 0, min: 10, max: 30 },
];

export const CUSTOM_PRESET_ID = 'custom';

// Returns the id of the preset whose minute values equal the stored settings, or 'custom'.
export function matchPreset(settings) {
  if (!settings) return CUSTOM_PRESET_ID;
  const preset = MERIDIAN_FLIP_PRESETS.find(
    (p) =>
      Number(settings.PauseTimeBeforeMeridian) === p.pause &&
      Number(settings.MinutesAfterMeridian) === p.min &&
      Number(settings.MaxMinutesAfterMeridian) === p.max
  );
  return preset ? preset.id : CUSTOM_PRESET_ID;
}

// 'pierEast' / 'pierWest' are real answers; 'pierUnknown' or a missing field are not.
export function isPierSideKnown(sideOfPier) {
  return sideOfPier === 'pierEast' || sideOfPier === 'pierWest';
}

// Profile writes for a preset as [settingKey, value] pairs. UseSideOfPier is only touched
// while the mount is connected, because only then do we know whether it reports a side.
export function presetProfileChanges(presetId, mountInfo) {
  const preset = MERIDIAN_FLIP_PRESETS.find((p) => p.id === presetId);
  if (!preset) return [];

  const changes = [
    ['MeridianFlipSettings-PauseTimeBeforeMeridian', preset.pause],
    ['MeridianFlipSettings-MinutesAfterMeridian', preset.min],
    ['MeridianFlipSettings-MaxMinutesAfterMeridian', preset.max],
    ['MeridianFlipSettings-Recenter', true],
  ];
  if (mountInfo?.Connected) {
    changes.push(['MeridianFlipSettings-UseSideOfPier', isPierSideKnown(mountInfo.SideOfPier)]);
  }
  return changes;
}

// --- When the plan will flip -------------------------------------------------------------------

// The sky turns once in a sidereal day (23 h 56 min 4 s), so one hour of hour angle passes in
// slightly less than one hour of clock time.
const SIDEREAL_HOUR_MS = 3600000 * 0.9972695663;
const MINUTE_MS = 60000;

function finiteNumber(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

/**
 * The meridian transit of a target closest to `atMs` (within ±12 sidereal hours).
 * @param {number} raDeg right ascension in degrees
 * @param {number} lonDeg site longitude, east positive (as in the NINA profile)
 * @param {number} atMs
 */
export function nearestTransitMs(raDeg, lonDeg, atMs) {
  const hourAngle =
    ((((localSiderealTimeDeg(new Date(atMs), lonDeg) - raDeg) % 360) + 540) % 360) - 180;
  return atMs - (hourAngle / 15) * SIDEREAL_HOUR_MS;
}

/**
 * The first meridian flip the plan runs into, from the targets' estimated imaging times and
 * the profile's flip settings. A target needs a flip when it is imaged east of the meridian
 * and the imaging goes on until the flip is due: the pause before the meridian when one is set,
 * otherwise the earliest flip time. A target first imaged after its transit is taken on the
 * west side right away.
 *
 * @param {{ raDeg: number|null, startMs: number, endMs: number }[]} targets in plan order,
 *   only those with pictures left
 * @param {{ lonDeg: number, settings: object }} options settings:
 *   the profile's MeridianFlipSettings
 * @returns {{ index: number, meridianMs: number, pauseMs: number|null, earliestMs: number,
 *   latestMs: number } | null} null when no target of the plan crosses the meridian
 */
export function plannedMeridianFlip(targets, { lonDeg, settings }) {
  const lon = finiteNumber(lonDeg);
  if (lon === null || !Array.isArray(targets)) return null;
  const pause = Math.max(0, finiteNumber(settings?.PauseTimeBeforeMeridian) ?? 0);
  const min = Math.max(0, finiteNumber(settings?.MinutesAfterMeridian) ?? 0);
  // NINA treats a latest time below the earliest one as equal to it.
  const max = Math.max(min, finiteNumber(settings?.MaxMinutesAfterMeridian) ?? 0);

  for (let index = 0; index < targets.length; index++) {
    const { raDeg, startMs, endMs } = targets[index] ?? {};
    const ra = finiteNumber(raDeg);
    if (ra === null || !Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    if (endMs <= startMs) continue;
    const meridianMs = nearestTransitMs(ra, lon, startMs);
    const pauseMs = pause > 0 ? meridianMs - pause * MINUTE_MS : null;
    const earliestMs = meridianMs + min * MINUTE_MS;
    const dueMs = pauseMs ?? earliestMs;
    if (startMs < meridianMs && endMs > dueMs) {
      return { index, meridianMs, pauseMs, earliestMs, latestMs: meridianMs + max * MINUTE_MS };
    }
  }
  return null;
}
