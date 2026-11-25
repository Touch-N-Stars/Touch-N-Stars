// Ranking of targets for one night, shared by the ObservationPlaner plugin and the simple mode's
// "visible tonight" list. Pure functions only: no store, no network, no Vue.
import {
  clampValue as clamp,
  equatorialToAltAz,
  getMoonDataForTarget,
  getSunAltitudeDeg,
} from '@/utils/astronomy';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// Plugin default: a target counts as visible from 20° up.
export const DEFAULT_MIN_ALT_DEG = 20;
// Simple mode: 30° matches the guider warning, low targets are poor first targets.
export const SIMPLE_MIN_ALT_DEG = 30;
// Nautical twilight: the sky is dark enough to start, and beginners set up in that light anyway.
export const NIGHT_SUN_ALT_DEG = -12;

/**
 * Parses a right ascension. Returns the value as given for numbers and plain numeric strings,
 * and HOURS for sexagesimal text ("HH:MM:SS", "HH MM SS", "HHhMMmSSs"); the caller multiplies
 * by 15 to get degrees.
 */
export function parseRaHours(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;

  const s = String(v).trim();
  if (!s) return null;

  const n = Number(s.replace(',', '.'));
  if (Number.isFinite(n)) return n;

  const cleaned = s
    .toLowerCase()
    .replace(/[h]/g, ':')
    .replace(/[m]/g, ':')
    .replace(/[s]/g, '')
    .replace(/\s+/g, ':')
    .replace(/::+/g, ':')
    .replace(/[^0-9:+-]/g, ':');

  const parts = cleaned.split(':').filter(Boolean).slice(0, 3);
  if (!parts.length) return null;

  const hh = Number(parts[0]);
  const mm = parts.length > 1 ? Number(parts[1]) : 0;
  const ss = parts.length > 2 ? Number(parts[2]) : 0;
  if (![hh, mm, ss].every(Number.isFinite)) return null;

  return hh + mm / 60 + ss / 3600;
}

/** Parses a declination ("+DD:MM:SS", "DD MM SS", "DDdMMmSSs" or a number) to degrees. */
export function parseDecDeg(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;

  const s = String(v).trim();
  if (!s) return null;

  const n = Number(s.replace(',', '.'));
  if (Number.isFinite(n)) return n;

  const sign = s.startsWith('-') ? -1 : 1;

  const cleaned = s
    .toLowerCase()
    .replace(/[d°]/g, ':')
    .replace(/[m]/g, ':')
    .replace(/[s]/g, '')
    .replace(/\s+/g, ':')
    .replace(/::+/g, ':')
    .replace(/[^0-9:+-]/g, ':');

  const parts = cleaned.split(':').filter(Boolean).slice(0, 3);
  if (!parts.length) return null;

  const dd = Math.abs(Number(parts[0]));
  const mm = parts.length > 1 ? Number(parts[1]) : 0;
  const ss = parts.length > 2 ? Number(parts[2]) : 0;
  if (![dd, mm, ss].every(Number.isFinite)) return null;

  return sign * (dd + mm / 60 + ss / 3600);
}

/** Altitude samples of a fixed RA/Dec between start and end, plus the highest one. */
export function buildTrack(raDeg, decDeg, start, end, stepMin, latDeg, lonDeg) {
  const msStep = Math.max(2, stepMin) * MINUTE_MS;
  const points = [];
  let best = { altDeg: -999, azDeg: 0, time: new Date(start) };

  for (let t = start.getTime(); t <= end.getTime(); t += msStep) {
    const dt = new Date(t);
    const { altDeg, azDeg } = equatorialToAltAz(raDeg, decDeg, dt, latDeg, lonDeg);
    points.push({ time: dt, altDeg, azDeg });
    if (altDeg > best.altDeg) best = { altDeg, azDeg, time: dt };
  }
  return { points, best };
}

/**
 * Tonight score of a target: how high it gets, for how long it stays above `minAltDeg`, minus a
 * moon penalty that grows with illumination and shrinks with distance. Needs `target.track`.
 */
export function calculateTonightScore(target, moon, { minAltDeg = DEFAULT_MIN_ALT_DEG } = {}) {
  const samples = Array.isArray(target?.track?.samples)
    ? target.track.samples
    : Array.isArray(target?.track?.points)
      ? target.track.points
      : [];

  if (!samples.length) return 0;

  // A) Altitude factor
  const maxAlt = target.track.best?.altDeg ?? 0;
  const altitudeFactor = clamp(maxAlt / 90, 0, 1);

  // B) Visibility duration
  const visibleSamples = samples.filter((s) => (s?.altDeg ?? -999) >= minAltDeg).length;

  const smRaw = target.track.sampleMinutes ?? 5;
  const sampleMinutes = Number.isFinite(smRaw) ? smRaw : Number(smRaw) || 5;

  const visibilityHours = (visibleSamples * sampleMinutes) / 60;

  // C) Moon penalty
  let moonPenalty = 0;
  if (moon) {
    const illumination = clamp(moon.illumination ?? 0, 0, 1);
    const separationDeg = moon.separationDeg ?? 180;
    const separationFactor = clamp((separationDeg - 30) / 90, 0, 1);

    const typeFactor =
      {
        galaxy: 1.0,
        nebula: 0.8,
        planetary_nebula: 0.3,
        cluster: 0.2,
        widefield: 1.2,
        unknown: 0.7,
      }[target?.type] ?? 0.7;

    moonPenalty = illumination * (1 - separationFactor) * typeFactor * 2.0;
  }

  // Favorite bonus
  const favoriteBonus = target?.source === 'favorite' ? 1.15 : 1.0;

  const score = altitudeFactor * visibilityHours * favoriteBonus - moonPenalty;
  return Math.max(0, score);
}

/**
 * The dark part of the current night, from the sun's altitude.
 *
 * - Sun already below `sunAltDeg`: the night is under way, so the window starts now and ends at
 *   the next sunrise past that altitude (the running night counts, not the next one).
 * - Otherwise it starts when the sun next drops below it and ends when it comes back up.
 * - Polar night (the sun never comes back within 24 h): the window is capped at 12 h.
 * - No dark period within the next 24 h (midnight sun, short summer nights at high latitude):
 *   null, the caller shows "no dark night".
 */
export function findNightWindow(now, latDeg, lonDeg, { sunAltDeg = NIGHT_SUN_ALT_DEG } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null;
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return null;

  const stepMs = 5 * MINUTE_MS;
  const horizonMs = 24 * HOUR_MS;
  const isDark = (ms) => getSunAltitudeDeg(new Date(ms), latDeg, lonDeg) < sunAltDeg;

  const t0 = now.getTime();
  let startMs = null;
  if (isDark(t0)) {
    startMs = t0;
  } else {
    for (let t = t0 + stepMs; t <= t0 + horizonMs; t += stepMs) {
      if (isDark(t)) {
        startMs = t;
        break;
      }
    }
  }
  if (startMs == null) return null;

  let endMs = null;
  for (let t = startMs + stepMs; t <= startMs + horizonMs; t += stepMs) {
    if (!isDark(t)) {
      endMs = t;
      break;
    }
  }
  if (endMs == null) endMs = startMs + 12 * HOUR_MS;

  return { start: new Date(startMs), end: new Date(endMs) };
}

/** Turns the seed catalogue (RA in hours as text, Dec in degrees as text) into plain targets. */
export function normalizeCatalogTargets(seed) {
  const arr = Array.isArray(seed?.targets) ? seed.targets : [];
  return arr
    .filter((t) => t && typeof t === 'object')
    .map((t, idx) => {
      const raHours = parseRaHours(t.ra);
      const raDeg = raHours == null ? null : raHours * 15;
      const decDeg = parseDecDeg(t.dec);
      const catalog = typeof t.catalog === 'string' ? t.catalog : '';
      const name = t.name || catalog || `Target ${idx + 1}`;
      return {
        id: catalog || name,
        name,
        catalog,
        type: t.type || 'unknown',
        raDeg,
        decDeg,
      };
    })
    .filter((t) => Number.isFinite(t.raDeg) && Number.isFinite(t.decDeg));
}

/**
 * The best targets for one window, best first. Targets that never reach `minAltDeg` or score
 * zero are left out.
 */
export function rankTonightPicks(
  targets,
  { start, end, latDeg, lonDeg, limit = 8, minAltDeg = SIMPLE_MIN_ALT_DEG, sampleMinutes = 10 }
) {
  if (!Array.isArray(targets) || !start || !end) return [];
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return [];

  const picks = [];
  for (const t of targets) {
    if (!Number.isFinite(t?.raDeg) || !Number.isFinite(t?.decDeg)) continue;
    const track = buildTrack(t.raDeg, t.decDeg, start, end, sampleMinutes, latDeg, lonDeg);
    const maxAltDeg = track.best.altDeg;
    if (maxAltDeg < minAltDeg) continue;

    const withTrack = { ...t, track: { ...track, sampleMinutes } };
    const moon = getMoonDataForTarget(t.raDeg, t.decDeg, track.best.time);
    const score = calculateTonightScore(withTrack, moon, { minAltDeg });
    if (score <= 0) continue;

    const visibleSamples = track.points.filter((p) => p.altDeg >= minAltDeg).length;
    picks.push({
      id: t.id,
      name: t.name,
      catalog: t.catalog,
      type: t.type,
      raDeg: t.raDeg,
      decDeg: t.decDeg,
      maxAltDeg,
      bestTime: track.best.time,
      visibleHours: (visibleSamples * sampleMinutes) / 60,
      score,
    });
  }

  picks.sort((a, b) => b.score - a.score);
  return picks.slice(0, Math.max(0, limit));
}
