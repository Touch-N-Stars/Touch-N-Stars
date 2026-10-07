import apiService from '@/services/apiService';

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
