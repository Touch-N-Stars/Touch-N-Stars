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
 * The database the PINS image ships. It is copied in as plain files (/opt/astap, linked into
 * /usr/share/astap/data), not as a package, so the daemon - which only looks at dpkg - never
 * reports it. It is shown as installed anyway, even though that cannot be proven from here.
 */
export const PINS_IMAGE_DATABASE = 'D80';

// The denser D-series databases serve every field the lighter ones are recommended for.
const COVERED_BY = { D50: ['D80'], D05: ['D80', 'D50'] };

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
 * The daemon's package list plus the image database, always marked installed.
 * @param {object[]|null} packages
 * @returns {object[]}
 */
export function withImageDatabase(packages) {
  const list = Array.isArray(packages) ? packages : [];
  const isImage = (pkg) => String(pkg?.databaseId || '').toUpperCase() === PINS_IMAGE_DATABASE;
  if (list.some(isImage)) {
    return list.map((pkg) => (isImage(pkg) ? { ...pkg, installed: true } : pkg));
  }
  return [
    ...list,
    { databaseId: PINS_IMAGE_DATABASE, label: PINS_IMAGE_DATABASE, installed: true },
  ];
}

/** True when the recommended database or a denser one that serves the same fields is installed. */
export function isRecommendationCovered(recommendedId, installedIds) {
  const ids = new Set((installedIds || []).map((id) => String(id).toUpperCase()));
  return ids.has(recommendedId) || (COVERED_BY[recommendedId] || []).some((id) => ids.has(id));
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

const ASTAP_INSTALL_COMMAND = /install-astap-star-database\.sh\s+(\S+)\s*$/;

/**
 * The database a daemon job installs ("sudo -n …/install-astap-star-database.sh D05" -> "D05"),
 * or null when the job is not a star database install. /jobs/latest returns whatever job ran
 * last on the rig, an upgrade or a Wi-Fi change just as well.
 */
export function astapJobDatabaseId(job) {
  const match = String(job?.command ?? '').match(ASTAP_INSTALL_COMMAND);
  return match ? match[1] : null;
}
