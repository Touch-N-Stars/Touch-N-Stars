import axios from 'axios';
import { getUrls } from '@/services/api/core';

function mapBrowseObjects(data) {
  return data.map((o) => ({
    id: o.Id,
    name: o.Name,
    objectType: o.ObjectType,
    magnitude: o.Magnitude,
    // Comet-only, both null for an asteroid or a comet COBS has no reports for -- see
    // OrbitalTracking.BrowseObject's own comment for why the predicted Magnitude above can be
    // badly wrong during a real outburst, which is exactly why this rides along in the same
    // list response rather than needing a second per-object fetch.
    observedMagnitude: o.ObservedMagnitude,
    observedAverageMagnitude: o.ObservedAverageMagnitude,
    raHours: o.RaHours,
    decDeg: o.DecDeg,
  }));
}

/**
 * Fetches today's comet/asteroid list (name, magnitude, RA/Dec) from Perihelion's own server --
 * see OrbitalTracking.ListBrowseObjectsAsync on the plugin side for how it's computed. The
 * panel deliberately does NOT compute this itself in JS: it and the Perihelion plugin run on
 * the same Pi, so there's no internet-round-trip reason to duplicate the orbital math a second
 * time in a second language (see CLAUDE.md's "Quick Track" architecture section).
 *
 * observedMagnitude/observedAverageMagnitude come back null here even for comets COBS has real
 * data for -- real hardware feedback showed waiting on COBS at all before the list could render
 * felt slow (14-16s measured for 14 comets on a cold cache), so this now returns predicted-only
 * data instantly, and PerihelionView's own fillCobsInBackground() fills in real observed-
 * brightness badges afterward, one comet at a time via GET /objects/activity (fetchCometActivity),
 * so they pop in without blocking the initial render. refreshCobs() below is the only call that
 * still returns real COBS data inline, since blocking IS the point of that explicit action.
 *
 * @returns {Promise<Array<{ id: string, name: string, objectType: 'Comet'|'Asteroid', magnitude: number|null, observedMagnitude: number|null, observedAverageMagnitude: number|null, raHours: number, decDeg: number }>>}
 */
export async function fetchBrowseObjects() {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.get(`${PERIHELION_URL}/objects`);
  return mapBrowseObjects(response.data);
}

/**
 * Explicit "Refresh COBS" action -- bypasses CometActivity's own 2h TTL on the plugin side for
 * every comet in the list, unlike the passive fetchBrowseObjects() above which is happy with a
 * disk-loaded or still-fresh cache. Same response shape, so the caller can just replace its
 * object list from this directly. This is a real several-seconds-to-tens-of-seconds round trip
 * (one COBS lookup per comet, throttled) -- deliberately a separate, user-initiated action
 * rather than something that rides along with Sync Now (comet elements), which is a single fast
 * MPC file fetch. See CLAUDE.md/OrbitalTracking.ListBrowseObjectsAsync's own forceRefreshCobs
 * doc comment for the full reasoning.
 *
 * @returns {Promise<Array<{ id: string, name: string, objectType: 'Comet'|'Asteroid', magnitude: number|null, observedMagnitude: number|null, observedAverageMagnitude: number|null, raHours: number, decDeg: number }>>}
 */
export async function refreshCobs() {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.post(`${PERIHELION_URL}/objects/refresh-cobs`);
  return mapBrowseObjects(response.data);
}
