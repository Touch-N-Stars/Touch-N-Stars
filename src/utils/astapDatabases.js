// Pure helpers around the ASTAP star databases the PINS daemon installs
// (/packages/astap/stardatabases). No Vue, no stores, so they can be unit tested.

// The ranges ASTAP documents for its databases (hnsky.org/astap.htm, astap_rpm.htm):
// D50 covers fields of 0.2° to 10°, D05 (the smallest of the D series, ~100 MB instead of
// ~900 MB) is enough from 0.6° on, W08 is for very wide fields above 20°. G05 was added for
// wide-field solving; it fills the gap between D50's 10° and W08's 20°.
const D05_MIN_FOV_DEG = 0.6;
const WIDE_MIN_FOV_DEG = 10;
const VERY_WIDE_MIN_FOV_DEG = 20;

/** What to install when the field of view is unknown: D50 covers most telescopes. */
export const DEFAULT_ASTAP_DATABASE = 'D50';

/**
 * The smaller side of the image in degrees - the value ASTAP calls its field of view.
 * @returns {number|null} null when an input is missing or not positive
 */
export function fieldOfViewDeg({ focalLengthMm, pixelSizeUm, widthPx, heightPx }) {
  const focal = Number(focalLengthMm);
  const pixel = Number(pixelSizeUm);
  const side = Math.min(Number(widthPx), Number(heightPx));
  if (!(focal > 0) || !(pixel > 0) || !(side > 0)) return null;
  const sensorMm = (side * pixel) / 1000;
  return (2 * Math.atan(sensorMm / (2 * focal)) * 180) / Math.PI;
}

/** The database that suits a field of view (degrees); the default when it is unknown. */
export function recommendAstapDatabase(fovDeg) {
  if (!Number.isFinite(fovDeg) || fovDeg <= 0) return DEFAULT_ASTAP_DATABASE;
  if (fovDeg >= VERY_WIDE_MIN_FOV_DEG) return 'W08';
  if (fovDeg >= WIDE_MIN_FOV_DEG) return 'G05';
  if (fovDeg >= D05_MIN_FOV_DEG) return 'D05';
  return 'D50';
}

/**
 * Whether any star database is installed, from the daemon's package list (requested with
 * onlyNotInstalled=false). Null when the daemon does not say: older daemons list packages
 * without an `installed` flag, and a guess would warn about a database that is there.
 * @param {object[]|null} packages
 * @returns {boolean|null}
 */
export function hasInstalledAstapDatabase(packages) {
  if (!Array.isArray(packages) || packages.length === 0) return null;
  if (!packages.some((pkg) => typeof pkg?.installed === 'boolean')) return null;
  return packages.some((pkg) => pkg?.installed === true);
}
