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
