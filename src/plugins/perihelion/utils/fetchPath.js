import axios from 'axios';
import { getUrls } from '@/services/api/core';

/**
 * Fetches the object's real path against the fixed stars for the next `days` nights, from
 * Perihelion's GET /objects/path route (OrbitalTracking.ComputeOrbitalPathAsync).
 *
 * @param {{ objectType: 'Comet'|'Asteroid', targetName: string }} target
 * @param {number} [days]
 * @returns {Promise<Array<{ date: string, raHours: number, decDeg: number }>>}
 */
export async function fetchPath(target, days = 10) {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.get(`${PERIHELION_URL}/objects/path`, {
    params: { objectType: target.objectType, targetName: target.targetName, days },
  });
  return response.data.map((p) => ({ date: p.Date, raHours: p.RaHours, decDeg: p.DecDeg }));
}
