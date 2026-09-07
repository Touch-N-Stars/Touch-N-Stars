import axios from 'axios';
import i18n from '@/i18n';
import { getUrls } from '@/services/api/core';

/**
 * When comet elements were last actually fetched from MPC, when asteroid elements were last
 * fetched from JPL, and when the explicit "Refresh COBS" action last completed a full sweep --
 * each null if never done. Backs the Browse tab's status lines (see CometOrbits.cs's,
 * AsteroidOrbits.cs's, and CometActivity.cs's own on-disk caches for the plugin-side half of
 * this).
 *
 * @returns {Promise<{ cometsLastSyncedUtc: Date | null, asteroidsLastSyncedUtc: Date | null, cobsLastRefreshedUtc: Date | null }>}
 */
export async function fetchSyncStatus() {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.get(`${PERIHELION_URL}/sync/status`);
  return {
    cometsLastSyncedUtc: response.data.CometsLastSyncedUtc
      ? new Date(response.data.CometsLastSyncedUtc)
      : null,
    asteroidsLastSyncedUtc: response.data.AsteroidsLastSyncedUtc
      ? new Date(response.data.AsteroidsLastSyncedUtc)
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

/**
 * Same explicit-sync contract as syncComets above, for the curated asteroid list -- always
 * fetches current elements for every tracked asteroid from JPL's Small-Body Database right now,
 * regardless of the passive 24h cache window on the plugin side.
 *
 * @returns {Promise<{ ok: boolean, message: string, lastSyncedUtc: Date | null }>}
 */
export async function syncAsteroids() {
  const { PERIHELION_URL } = getUrls();
  try {
    const response = await axios.post(`${PERIHELION_URL}/sync/asteroids`);
    return {
      ok: response.data.Success,
      message: response.data.Message,
      lastSyncedUtc: response.data.AsteroidsLastSyncedUtc
        ? new Date(response.data.AsteroidsLastSyncedUtc)
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
