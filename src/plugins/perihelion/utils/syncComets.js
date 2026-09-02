import axios from 'axios';
import { getUrls } from '@/services/api/core';

/**
 * When comet elements were last actually fetched from MPC -- null if never synced. Backs the
 * Browse tab's "last synced: X ago" indicator, matching NINA Orbitals' own per-object-type
 * download screen (see CometOrbits.cs's own on-disk cache for the plugin-side half of this).
 *
 * @returns {Promise<Date | null>}
 */
export async function fetchSyncStatus() {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.get(`${PERIHELION_URL}/sync/status`);
  return response.data.CometsLastSyncedUtc ? new Date(response.data.CometsLastSyncedUtc) : null;
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
    return { ok: false, message: error?.message ?? 'Sync failed', lastSyncedUtc: null };
  }
}
