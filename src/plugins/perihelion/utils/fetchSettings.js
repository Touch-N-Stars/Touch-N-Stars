import perihelionApi from './perihelionClient';
import { getUrls } from '@/services/api/core';

/**
 * Perihelion's own persisted settings -- stored via PluginOptionsAccessor on the plugin side.
 * Take effect on next use, not just on next NINA/PINS restart.
 *
 * @returns {Promise<{ eqmodRaRateCorrection: boolean, quickTrackReapplyIntervalSeconds: number, cometMagnitudeThreshold: number, maxComets: number, asteroidMagnitudeThreshold: number, maxAsteroids: number }>}
 */
export async function fetchSettings() {
  const { PERIHELION_URL } = getUrls();
  const response = await perihelionApi.get(`${PERIHELION_URL}/settings`);
  return {
    eqmodRaRateCorrection: response.data.EqmodRaRateCorrection,
    quickTrackReapplyIntervalSeconds: response.data.QuickTrackReapplyIntervalSeconds,
    cometMagnitudeThreshold: response.data.CometMagnitudeThreshold,
    maxComets: response.data.MaxComets,
    asteroidMagnitudeThreshold: response.data.AsteroidMagnitudeThreshold,
    maxAsteroids: response.data.MaxAsteroids,
  };
}

const FIELD_MAP = {
  eqmodRaRateCorrection: 'EqmodRaRateCorrection',
  quickTrackReapplyIntervalSeconds: 'QuickTrackReapplyIntervalSeconds',
  cometMagnitudeThreshold: 'CometMagnitudeThreshold',
  maxComets: 'MaxComets',
  asteroidMagnitudeThreshold: 'AsteroidMagnitudeThreshold',
  maxAsteroids: 'MaxAsteroids',
};

/**
 * Only sends fields actually present in `settings` -- the backend applies a partial update, so
 * omitted fields keep their persisted value.
 * @param {Partial<{ eqmodRaRateCorrection: boolean, quickTrackReapplyIntervalSeconds: number, cometMagnitudeThreshold: number, maxComets: number, asteroidMagnitudeThreshold: number, maxAsteroids: number }>} settings
 * @returns {Promise<boolean>} whether the save succeeded
 */
export async function saveSettings(settings) {
  const { PERIHELION_URL } = getUrls();
  const body = {};
  for (const [key, wireKey] of Object.entries(FIELD_MAP)) {
    if (settings[key] !== undefined) body[wireKey] = settings[key];
  }
  const response = await perihelionApi.post(`${PERIHELION_URL}/settings`, body);
  return response.data.Success === true;
}
