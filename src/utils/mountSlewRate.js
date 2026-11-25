// src/utils/mountSlewRate.js

/**
 * Derives the mount's top speed in °/s from what its INDI driver reports, so the user does
 * not have to know `TelescopeSettings-IndiMaxSlewRateDps`.
 *
 * What PINS does with that value (NINA.INDI/Devices/INDITelescope.cs): INDI drivers with a
 * TELESCOPE_SLEW_RATE switch only name their speeds ("800x", "Max"). PINS reports the
 * configured value as the top axis rate - polar alignment derives its move durations from
 * it - and uses it for labels it cannot read a number from ("Max" = value, "Half" = value / 2).
 * It does not limit how fast the driver slews.
 *
 * Shape of the capability: GET /api/indi/mount/slew-rates (PINS' SlewRateCapability).
 */

// PINS' SlewRateKind enum, serialized as a number.
export const SLEW_RATE_KIND = Object.freeze({ NONE: 0, DISCRETE: 1, CONTINUOUS: 2 });

// The degrees per second PINS assumes for 1x (INDITelescope.SiderealDegPerSec).
const SIDEREAL_DPS = 1 / 240;

// Same pattern PINS uses to read a sidereal multiple out of a switch label.
const MULTIPLIER = /([\d.]+)\s*[xX×]/;
// PINS computes these from the configured value itself - using them would be circular.
const RELATIVE_LABEL = /max|half/i;

/**
 * @param {object|null} capability Response of GET indi/mount/slew-rates
 * @returns {{ status: 'derived', dps: number, label: string }
 *   | { status: 'notNeeded' }
 *   | { status: 'unknown' }}
 *   derived   - the driver names its speeds as sidereal multiples; dps is the top one
 *   notNeeded - the driver reports a continuous rate in °/s or has no rate control at all;
 *               PINS does not use the configured value then
 *   unknown   - discrete speeds without numbers (libindi's default "Guide … Max")
 */
export function deriveMaxSlewRate(capability) {
  const kind = Number(capability?.Kind);
  if (kind !== SLEW_RATE_KIND.DISCRETE) {
    // Continuous drivers report their range in °/s, drivers without rate control run at a
    // fixed speed: in both cases PINS takes its numbers from the driver, not the profile.
    return kind === SLEW_RATE_KIND.CONTINUOUS || kind === SLEW_RATE_KIND.NONE
      ? { status: 'notNeeded' }
      : { status: 'unknown' };
  }

  let best = null;
  for (const option of Array.isArray(capability.Options) ? capability.Options : []) {
    // Only the label: libindi's default switches are *named* "1x".."4x" as plain indices
    // while their labels read "Guide".."Max" - the name is no multiple of anything.
    const label = typeof option?.Label === 'string' ? option.Label.trim() : '';
    if (!label || RELATIVE_LABEL.test(label)) continue;
    const match = label.match(MULTIPLIER);
    if (!match) continue;
    const multiple = Number.parseFloat(match[1]);
    if (!Number.isFinite(multiple) || multiple <= 0) continue;
    const dps = multiple * SIDEREAL_DPS;
    if (!best || dps > best.dps) best = { dps, label };
  }

  if (!best) return { status: 'unknown' };
  return { status: 'derived', dps: Math.round(best.dps * 100) / 100, label: best.label };
}

/** True when the profile value is far enough from the derived one to be worth a write. */
export function slewRateDiffers(current, derived) {
  const value = Number(current);
  return !Number.isFinite(value) || Math.abs(value - derived) >= 0.01;
}
