import axios from 'axios';
import { getUrls } from '@/services/api/core';

/**
 * Fetches today's comet/asteroid list (name, magnitude, RA/Dec) from Perihelion's own server --
 * see OrbitalTracking.ListBrowseObjectsAsync on the plugin side for how it's computed. The
 * panel deliberately does NOT compute this itself in JS: it and the Perihelion plugin run on
 * the same Pi, so there's no internet-round-trip reason to duplicate the orbital math a second
 * time in a second language (see CLAUDE.md's "Quick Track" architecture section).
 *
 * @returns {Promise<Array<{ id: string, name: string, objectType: 'Comet'|'Asteroid', magnitude: number|null, raHours: number, decDeg: number }>>}
 */
export async function fetchBrowseObjects() {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.get(`${PERIHELION_URL}/objects`);
  return response.data.map((o) => ({
    id: o.Id,
    name: o.Name,
    objectType: o.ObjectType,
    magnitude: o.Magnitude,
    raHours: o.RaHours,
    decDeg: o.DecDeg,
  }));
}
