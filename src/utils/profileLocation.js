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
