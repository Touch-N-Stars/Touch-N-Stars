// Image types NINA writes for the frames of a flat assistant run. The plugin-side run saves its
// dark flats as DARK, NINA's own trained dark flats use DARKFLAT.
const FLAT_TYPES = new Set(['FLAT']);
const DARK_TYPES = new Set(['DARK', 'DARKFLAT']);

/**
 * Formats a flat exposure time in seconds. Flats are often a few milliseconds, so short
 * values keep three significant digits instead of being rounded to 0.00.
 */
export function formatFlatExposure(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds >= 10) return seconds.toFixed(1);
  if (seconds >= 1) return seconds.toFixed(2);
  return String(Number(seconds.toPrecision(3)));
}

/**
 * Exposure time of the newest flat (or dark flat) in the image history, formatted for
 * display, or null when the newest frame is of another type or carries no exposure.
 */
export function lastFlatExposure(history, darks = false) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const entry = history[history.length - 1];
  const types = darks ? DARK_TYPES : FLAT_TYPES;
  if (!types.has(String(entry?.ImageType ?? '').toUpperCase())) return null;
  if (entry.ExposureTime === null || entry.ExposureTime === undefined) return null;
  return formatFlatExposure(Number(entry.ExposureTime));
}
