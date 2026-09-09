import axios from 'axios';
import { getUrls } from '@/services/api/core';

/**
 * Perihelion's own persisted settings (EqmodRaRateCorrection, QuickTrackReapplyIntervalSeconds)
 * -- stored via PluginOptionsAccessor on the plugin side, same as Port. Unlike Port, both take
 * effect on the very next use (Quick Track start, tracking-rate application), not just on the
 * next NINA/PINS restart.
 *
 * @returns {Promise<{ eqmodRaRateCorrection: boolean, quickTrackReapplyIntervalSeconds: number }>}
 */
export async function fetchSettings() {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.get(`${PERIHELION_URL}/settings`);
  return {
    eqmodRaRateCorrection: response.data.EqmodRaRateCorrection,
    quickTrackReapplyIntervalSeconds: response.data.QuickTrackReapplyIntervalSeconds,
  };
}

/**
 * @param {{ eqmodRaRateCorrection: boolean, quickTrackReapplyIntervalSeconds: number }} settings
 * @returns {Promise<boolean>} whether the save succeeded
 */
export async function saveSettings(settings) {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.post(`${PERIHELION_URL}/settings`, {
    EqmodRaRateCorrection: settings.eqmodRaRateCorrection,
    QuickTrackReapplyIntervalSeconds: settings.quickTrackReapplyIntervalSeconds,
  });
  return response.data.Success === true;
}
