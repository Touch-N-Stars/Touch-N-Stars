/**
 * Whether the NINA profile holds a real location. A fresh profile sits at exactly 0/0 (a spot
 * in the Atlantic nobody observes from); polar alignment refuses to start with it.
 */
export function hasProfileLocation(profileInfo) {
  const settings = profileInfo?.AstrometrySettings;
  if (!settings) return true; // unknown yet - do not warn on a profile that is still loading
  const lat = Number(settings.Latitude);
  const lon = Number(settings.Longitude);
  return !(lat === 0 && lon === 0);
}

/**
 * The sync direction the location dropdown shows for the profile value.
 *
 * On PINS it suggests "sync to telescope" while the profile has no location yet: NINA sends
 * the location to the mount only when it connects, and "sync to telescope" is what makes
 * saving the location reconnect a connected mount (location.js saveCoordinates). That covers
 * PROMPT (the connect dialog has not been answered yet) and NOSYNC (the dialog recommends
 * "no sync" while there is nothing to send) - the first location set then reaches the mount.
 * PROMPT has no entry in the dropdown either way. On NINA the dropdown is hidden and PROMPT
 * keeps meaning "no sync".
 *
 * @param {string} raw - TelescopeSettings.TelescopeLocationSyncDirection
 * @param {boolean} isPINS
 * @param {boolean} [hasLocation=true] - hasProfileLocation() of the profile
 */
export function syncDirectionForSelect(raw, isPINS, hasLocation = true) {
  if (isPINS && !hasLocation && (raw === 'PROMPT' || raw === 'NOSYNC')) return 'TOTELESCOPE';
  if (raw && raw !== 'PROMPT') return raw;
  return raw === 'PROMPT' && isPINS ? 'TOTELESCOPE' : 'NOSYNC';
}

/**
 * How far the mount's site may sit from the profile's before the location counts as not
 * applied, in degrees. Many mounts store the site coarser than NINA checks it (0.001°): the
 * classic LX200 protocol takes whole arc minutes (0.0167°), the Alpaca sky simulator rounds to
 * 0.01°. 0.02° (about 2 km) covers that and still catches a location that never arrived.
 */
export const MOUNT_SITE_TOLERANCE_DEG = 0.02;

/**
 * Whether the mount's site differs from the profile's location beyond what mounts round away.
 * Missing values do not count as a difference.
 *
 * @param {{latitude?: number|null, longitude?: number|null}} profile
 * @param {{latitude?: number|null, longitude?: number|null}} mount
 */
export function mountSiteDiffers(profile, mount) {
  return ['latitude', 'longitude'].some((key) => {
    const a = profile?.[key];
    const b = mount?.[key];
    if (a === null || a === undefined || b === null || b === undefined) return false;
    if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return false;
    return Math.abs(Number(a) - Number(b)) > MOUNT_SITE_TOLERANCE_DEG;
  });
}

/**
 * Whether a NINA notification is its "Unable to set mount latitude to {0} and longitude to
 * {1}!" error. NINA sends it in the language of the backend, so it is recognised by its
 * numbers: the profile's latitude and longitude rounded to three places, written with a
 * decimal point or comma.
 *
 * @param {string} message
 * @param {{latitude: number, longitude: number}} profile
 */
export function isMountLocationSyncError(message, profile) {
  if (typeof message !== 'string') return false;
  const lat = Number(profile?.latitude);
  const lon = Number(profile?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  const numbers = (message.match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((text) =>
    Number(text.replace(',', '.'))
  );
  const mentions = (value) =>
    numbers.some((n) => Math.abs(n - Math.round(value * 1000) / 1000) < 1e-9);
  return numbers.length === 2 && mentions(lat) && mentions(lon);
}
