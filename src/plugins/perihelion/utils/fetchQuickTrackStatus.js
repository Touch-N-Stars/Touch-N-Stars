import axios from 'axios';
import { getUrls } from '@/services/api/core';

/**
 * Live state of whatever Quick Track session is currently running -- in particular the real
 * RA/Dec rate last computed and sent, not just whether a toggle was on when the session started.
 * Lets the Track tab show ground truth instead of trusting stale local state, and is the
 * unambiguous way to confirm the mount actually received a comet-specific rate.
 *
 * @returns {Promise<{
 *   active: boolean,
 *   objectType: string|null,
 *   targetName: string|null,
 *   guiding: boolean,
 *   autoReapplyMinutes: number|null,
 *   startedUtc: string|null,
 *   lastAppliedUtc: string|null,
 *   lastRaArcsecPerSec: number|null,
 *   lastDecArcsecPerSec: number|null,
 *   lastApplySucceeded: boolean,
 *   lastError: string|null,
 * }>}
 */
export async function fetchQuickTrackStatus() {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.get(`${PERIHELION_URL}/status`);
  const body = response.data;
  return {
    active: !!body.Active,
    objectType: body.ObjectType ?? null,
    targetName: body.TargetName ?? null,
    guiding: !!body.Guiding,
    autoReapplyMinutes: body.AutoReapplyMinutes ?? null,
    startedUtc: body.StartedUtc ?? null,
    lastAppliedUtc: body.LastAppliedUtc ?? null,
    lastRaArcsecPerSec: body.LastRaArcsecPerSec ?? null,
    lastDecArcsecPerSec: body.LastDecArcsecPerSec ?? null,
    lastApplySucceeded: !!body.LastApplySucceeded,
    lastError: body.LastError ?? null,
  };
}
