// How fast the camera cools down and warms up, chosen once per profile in the simple mode.
// The minutes go to NINA's profile (CameraSettings-CoolingDuration / -WarmingDuration), so the
// auto-cool on connect and the camera page use the same values.
//
// NINA ramps the setpoint linearly over the given minutes, so a cool-down never takes less than
// that. 0 sets the target at once; current CMOS cameras limit their cooler power themselves.
// Warming always gets a ramp: a sensor that warms up too fast can fog or frost its window.
// NINA's own default (0 / 0) matches no preset, so a fresh profile is asked.
export const COOLING_PRESETS = [
  { id: 'fast', cool: 0, warm: 5 },
  { id: 'gentle', cool: 5, warm: 10 },
  { id: 'veryGentle', cool: 10, warm: 15 },
];

export const CUSTOM_COOLING_ID = 'custom';

// The warm-up at the end of the night when the profile has no ramp of its own.
export const FALLBACK_WARM_UP_MINUTES = 10;

function minutes(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The id of the preset that matches the profile's camera settings, or 'custom'. */
export function matchCoolingPreset(cameraSettings) {
  const cool = minutes(cameraSettings?.CoolingDuration);
  const warm = minutes(cameraSettings?.WarmingDuration);
  const preset = COOLING_PRESETS.find((p) => p.cool === cool && p.warm === warm);
  return preset ? preset.id : CUSTOM_COOLING_ID;
}

/**
 * Whether the profile holds a cooling timing of its own: one that matches no preset and is not
 * NINA's untouched default. Only such values are worth offering to keep.
 */
export function hasOwnCoolingTiming(cameraSettings) {
  const cool = minutes(cameraSettings?.CoolingDuration);
  const warm = minutes(cameraSettings?.WarmingDuration);
  if (cool === null || warm === null) return false;
  if (cool === 0 && warm === 0) return false;
  return matchCoolingPreset(cameraSettings) === CUSTOM_COOLING_ID;
}

/** Warm-up minutes for the end of the night: the profile's ramp, or a gentle default. */
export function warmUpMinutes(cameraSettings) {
  const warm = minutes(cameraSettings?.WarmingDuration);
  return warm > 0 ? warm : FALLBACK_WARM_UP_MINUTES;
}
