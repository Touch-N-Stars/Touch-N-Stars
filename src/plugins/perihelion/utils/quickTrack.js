import axios from 'axios';
import { getUrls } from '@/services/api/core';

/**
 * "Quick Track" — calls Perihelion's own standalone server directly (see
 * PerihelionApiServer/PerihelionApiController on the plugin side), bypassing the Advanced
 * Sequencer entirely so it never disturbs whatever sequence is currently loaded there. Sets
 * the mount's (and optionally the guider's) custom tracking rate right now, for manual/visual
 * use -- not a substitute for "Add to Sequence" (see sendPerihelionSequence.js).
 *
 * @param {object} target
 * @param {'comet'|'asteroid'} target.objectType
 * @param {string} target.targetName
 * @param {boolean} target.guiding - also apply the guider shift rate.
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function startQuickTrack(target) {
  const { PERIHELION_URL } = getUrls();
  try {
    const response = await axios.post(`${PERIHELION_URL}/track`, {
      ObjectType: target.objectType === 'comet' ? 'Comet' : 'Asteroid',
      TargetName: target.targetName,
      Guiding: !!target.guiding,
    });
    const body = response.data;
    return { ok: !!body?.Success, message: body?.Message ?? 'No response message' };
  } catch (error) {
    return { ok: false, message: error?.response?.data?.Message ?? error?.message ?? 'Could not reach Perihelion' };
  }
}

/**
 * Undoes what Quick Track did: back to sidereal tracking, and stops any guider shift.
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function stopQuickTrack() {
  const { PERIHELION_URL } = getUrls();
  try {
    const response = await axios.post(`${PERIHELION_URL}/stop`);
    const body = response.data;
    return { ok: !!body?.Success, message: body?.Message ?? 'No response message' };
  } catch (error) {
    return { ok: false, message: error?.response?.data?.Message ?? error?.message ?? 'Could not reach Perihelion' };
  }
}
