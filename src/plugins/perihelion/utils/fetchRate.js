import axios from 'axios';
import { getUrls } from '@/services/api/core';

/**
 * Fetches the object's current RA/Dec rate and the derived "seconds until a 1px drift relative
 * to the background stars" figure, from Perihelion's GET /objects/rate route
 * (PerihelionApiController.GetRate) -- the same numbers and formula the native Windows panel's
 * own Position section already shows (RateText/MaxExposureText), just not previously exposed
 * here at all. maxExposureSeconds comes back null when the connected profile's camera/telescope
 * settings (pixel size, focal length) aren't fully configured, same as the Windows panel.
 *
 * @param {{ objectType: 'Comet'|'Asteroid', targetName: string }} target
 * @returns {Promise<{ raArcsecPerSec: number, decArcsecPerSec: number, maxExposureSeconds: number|null }>}
 */
export async function fetchRate(target) {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.get(`${PERIHELION_URL}/objects/rate`, {
    params: { objectType: target.objectType, targetName: target.targetName },
  });
  return {
    raArcsecPerSec: response.data.RaArcsecPerSec,
    decArcsecPerSec: response.data.DecArcsecPerSec,
    maxExposureSeconds: response.data.MaxExposureSeconds,
  };
}
