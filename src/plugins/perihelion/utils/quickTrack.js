import perihelionApi from './perihelionClient';
import { getUrls } from '@/services/api/core';
import { describePerihelionResponse, describePerihelionError } from './perihelionResult';

/**
 * "Quick Track" — calls Perihelion's own standalone server directly (see
 * PerihelionApiServer/PerihelionApiController on the plugin side), bypassing the Advanced
 * Sequencer entirely so it never disturbs whatever sequence is currently loaded there. Sets
 * the mount's (and optionally the guider's) custom tracking rate right now, for manual/visual
 * use -- not a substitute for "Add to Sequence" (see addTargetToSequence.js).
 *
 * @param {object} target
 * @param {'comet'|'asteroid'} target.objectType
 * @param {string} target.targetName
 * @param {boolean} target.guiding - also apply the guider shift rate.
 * @param {number|null} [target.autoReapplyIntervalSeconds] - re-apply (recompute + re-set) the
 *   rate on this interval (seconds), entirely server-side in the Perihelion plugin -- keeps the
 *   rate accurate through a long unattended session as the object's true angular rate drifts.
 *   Omit/null to disable (the previous run's own timer, if any, is always stopped either way).
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function startQuickTrack(target) {
  const { PERIHELION_URL } = getUrls();
  try {
    const response = await perihelionApi.post(`${PERIHELION_URL}/track`, {
      ObjectType: target.objectType === 'comet' ? 'Comet' : 'Asteroid',
      TargetName: target.targetName,
      Guiding: !!target.guiding,
      AutoReapplySeconds: target.autoReapplyIntervalSeconds || null,
    });
    return describePerihelionResponse(response.data);
  } catch (error) {
    return describePerihelionError(error);
  }
}

/**
 * Undoes what Quick Track did: back to sidereal tracking, and stops any guider shift.
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function stopQuickTrack() {
  const { PERIHELION_URL } = getUrls();
  try {
    const response = await perihelionApi.post(`${PERIHELION_URL}/stop`);
    return describePerihelionResponse(response.data);
  } catch (error) {
    return describePerihelionError(error);
  }
}
