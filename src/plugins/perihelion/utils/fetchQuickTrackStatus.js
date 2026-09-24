import perihelionApi from './perihelionClient';
import { getUrls } from '@/services/api/core';

/**
 * Live state of whatever Quick Track session is currently running -- in particular the
 * RA/Dec rate last computed and sent, not just whether a toggle was on when the session started.
 * Lets the Track tab show ground truth instead of trusting stale local state, and is the
 * unambiguous way to confirm the mount actually received a comet-specific rate.
 *
 * @returns {Promise<{
 *   active: boolean,
 *   objectType: string|null,
 *   targetName: string|null,
 *   guiding: boolean,
 *   autoReapplySeconds: number|null,
 *   startedUtc: string|null,
 *   lastAppliedUtc: string|null,
 *   lastRaArcsecPerSec: number|null,
 *   lastDecArcsecPerSec: number|null,
 *   lastApplySucceeded: boolean,
 *   lastError: string|null,
 *   stopReason: string|null,
 *   guidingError: string|null,
 *   guidingOnlyFallback: boolean,
 * }>}
 */
export async function fetchQuickTrackStatus() {
  const { PERIHELION_URL } = getUrls();
  const response = await perihelionApi.get(`${PERIHELION_URL}/status`);
  const body = response.data;
  return {
    active: !!body.Active,
    objectType: body.ObjectType ?? null,
    targetName: body.TargetName ?? null,
    guiding: !!body.Guiding,
    autoReapplySeconds: body.AutoReapplySeconds ?? null,
    startedUtc: body.StartedUtc ?? null,
    lastAppliedUtc: body.LastAppliedUtc ?? null,
    lastRaArcsecPerSec: body.LastRaArcsecPerSec ?? null,
    lastDecArcsecPerSec: body.LastDecArcsecPerSec ?? null,
    lastApplySucceeded: !!body.LastApplySucceeded,
    lastError: body.LastError ?? null,
    // Null for a plain manual stop -- set when Quick Track stopped itself, in particular the
    // meridian safety cutoff (see the Perihelion repo's QuickTrackReapply.CheckMeridian).
    stopReason: body.StopReason ?? null,
    // Independent of lastApplySucceeded/lastError -- a guiding hiccup (no PHD2, no lock star)
    // doesn't make the mount's own tracking-rate application read as failed. Null when guiding
    // is off, or its last attempt succeeded.
    guidingError: body.GuidingError ?? null,
    // True when the mount's driver can't take a custom base tracking rate at all, so Perihelion
    // fell back to guiding-only shift tracking (PHD2's own mechanism) instead -- the Windows
    // panel already surfaces this, TNS previously didn't map the field at all.
    guidingOnlyFallback: !!body.GuidingOnlyFallback,
  };
}
