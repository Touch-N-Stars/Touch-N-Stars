import apiService from '@/services/apiService';
import { altAzToEquatorial } from '@/utils/astronomy';

// The plugin's own defaults (NINA.Plugins.PolarAlignment, Properties/Settings.settings), used
// when the TNS plugin is too old to report them (tppa/options, TPPAController).
const TPPA_DEFAULT_OFFSETS = { azimuthOffsetDeg: 1, altitudeOffsetDeg: 2 };

/**
 * Where TPPA starts by itself: the celestial pole plus the plugin's azimuth and altitude
 * offsets, the same formula as the PolarAlignment instruction's constructor.
 * @returns {{ altDeg: number, azDeg: number, raDeg: number, decDeg: number }} RA/Dec of date
 */
export function tppaStartCoordinates({
  latDeg,
  lonDeg,
  azimuthOffsetDeg,
  altitudeOffsetDeg,
  date,
}) {
  const azDeg = (latDeg > 0 ? 0 : 180) + azimuthOffsetDeg;
  const altDeg = Math.abs(latDeg) + altitudeOffsetDeg;
  return { altDeg, azDeg, ...altAzToEquatorial(altDeg, azDeg, date, latDeg, lonDeg) };
}

/**
 * True when the app should slew to TPPA's start position instead of TPPA itself: on PINS,
 * whenever TPPA would slew there. On NINA (Windows) TPPA keeps doing it: its dockable there
 * may hold a start position the user typed in, which the app's slew would ignore, and the
 * dockable keeps the "start from current position" of the message, so a later start from
 * NINA's own window would no longer slew.
 */
export function tppaSlewsToStart(settings, api) {
  return (
    !!api.isPINS &&
    !settings.StartFromCurrentPosition &&
    !settings.ManualMode &&
    !!api.mountInfo?.Connected
  );
}

async function loadTppaOffsets() {
  try {
    const options = (await apiService.getTppaOptions())?.Options;
    const azimuth = Number(options?.DefaultAzimuthOffset?.Value);
    const altitude = Number(options?.DefaultAltitudeOffset?.Value);
    if (Number.isFinite(azimuth) && Number.isFinite(altitude)) {
      return { azimuthOffsetDeg: azimuth, altitudeOffsetDeg: altitude };
    }
  } catch {
    // TNS plugins older than the TPPA controller: fall back to TPPA's defaults.
  }
  return TPPA_DEFAULT_OFFSETS;
}

/**
 * Slew to TPPA's start position from the app and let TPPA start from there.
 *
 * TPPA computes its start position once, when NINA loads the plugin, from the latitude the
 * profile had at that moment - and converts it with that latitude too. A location set later
 * in the same session (setup wizard on a fresh rig, where it was 0/0) made TPPA slew to
 * "Alt 2°, Az 181°" of a site on the equator, which is 46° below the horizon at 48° N.
 * The start message cannot fix that: it can override altitude and azimuth, not the latitude
 * they are converted with. So the app computes the same position from the current profile.
 *
 * @param {object} settings - tppaStore.settings
 * @param {object} api - apiStore(): mountInfo, profileInfo
 * @returns {Promise<object>} the settings to build the start message from
 * @throws when the slew fails; nothing has been sent to TPPA then
 */
export async function slewToTppaStart(settings, api) {
  if (!tppaSlewsToStart(settings, api)) return settings;

  const site = api.profileInfo?.AstrometrySettings ?? {};
  const target = tppaStartCoordinates({
    latDeg: Number(site.Latitude),
    lonDeg: Number(site.Longitude),
    ...(await loadTppaOffsets()),
    date: new Date(),
  });
  // The slew endpoint takes J2000 while the target is of date: a few tenths of a degree near
  // the pole, irrelevant for where the alignment starts.
  const response = await apiService.slewAndCenter(target.raDeg, target.decDeg, false);
  if (!response?.Success) throw new Error(response?.Error || 'Slew to the start position failed');

  // TPPA switches tracking on only when it slews to the start itself.
  try {
    await apiService.setTrackingMode(0);
  } catch (error) {
    console.warn('Could not switch tracking on before TPPA:', error);
  }
  return { ...settings, StartFromCurrentPosition: true };
}

/**
 * Build the `start-alignment` message for the /v2/tppa socket from the rig-shared
 * TPPA settings. Shared by the TPPA page and the AAPA plugin's one-button flow.
 *
 * @param {object} settings - tppaStore.settings
 * @param {object} api - apiStore(): isPINS, mountInfo, currentApiVersion, checkVersionNewerOrEqual
 */
export function buildTppaStartMessage(settings, api) {
  const message = { Action: 'start-alignment' };

  if (api.isPINS) {
    // PINS manages its own alignment settings via the PINS API – only send ManualMode and StartFromCurrentPosition
    message.StartFromCurrentPosition = settings.StartFromCurrentPosition || false;
  } else {
    // NINA: direction for the second and third point (moving the mount east or west along RA)
    message.EastDirection = settings.EastDirection;
    message.StartFromCurrentPosition = settings.StartFromCurrentPosition || 'false';
  }

  if (
    !api.mountInfo?.Connected &&
    api.checkVersionNewerOrEqual(api.currentApiVersion, '2.2.10.0')
  ) {
    // Without a mount TPPA can only run in manual mode
    message.ManualMode = true;
  } else {
    message.ManualMode = settings.ManualMode;
  }

  if (settings.ExposureTime !== null) message.ExposureTime = settings.ExposureTime;
  if (settings.Gain !== null) message.Gain = settings.Gain;
  if (settings.Filter) message.Filter = settings.Filter;
  if (settings.Binning) message.Binning = settings.Binning;

  return message;
}

/** Unpark the mount before an alignment; a failure is logged and the start goes on. */
export async function unparkMountForTppa(api) {
  if (!api.mountInfo?.AtPark) return;
  try {
    await apiService.mountAction('unpark');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error) {
    console.error('Error unparking mount before TPPA:', error);
  }
}
