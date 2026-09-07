import axios from 'axios';
import i18n from '@/i18n';
import { getUrls } from '@/services/api/core';

/**
 * When comet elements were last actually fetched from MPC, and when the explicit "Refresh COBS"
 * action last completed a full sweep -- either null if never done. Backs the Browse tab's
 * combined "Comets synced X ago · COBS refreshed X ago" status line (see CometOrbits.cs's and
 * CometActivity.cs's own on-disk caches for the plugin-side half of this).
 *
 * @returns {Promise<{ cometsLastSyncedUtc: Date | null, cobsLastRefreshedUtc: Date | null }>}
 */
export async function fetchSyncStatus() {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.get(`${PERIHELION_URL}/sync/status`);
  return {
    cometsLastSyncedUtc: response.data.CometsLastSyncedUtc
      ? new Date(response.data.CometsLastSyncedUtc)
      : null,
    cobsLastRefreshedUtc: response.data.CobsLastRefreshedUtc
      ? new Date(response.data.CobsLastRefreshedUtc)
      : null,
  };
}

/**
 * Explicit "download comets now" action -- always attempts a live fetch (unlike the passive
 * stale-cache fallback the rest of the plugin uses) and reports whether it actually worked, since
 * a user pressing a sync button deserves a real answer rather than a silent no-op.
 *
 * @returns {Promise<{ ok: boolean, message: string, lastSyncedUtc: Date | null }>}
 */
export async function syncComets() {
  const { PERIHELION_URL } = getUrls();
  try {
    const response = await axios.post(`${PERIHELION_URL}/sync/comets`);
    return {
      ok: response.data.Success,
      message: response.data.Message,
      lastSyncedUtc: response.data.CometsLastSyncedUtc
        ? new Date(response.data.CometsLastSyncedUtc)
        : null,
    };
  } catch (error) {
    return {
      ok: false,
      message: error?.message ?? i18n.global.t('perihelion.status.syncFailed'),
      lastSyncedUtc: null,
    };
  }
}
