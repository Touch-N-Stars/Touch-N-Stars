import axios from 'axios';
import { getUrls } from '@/services/api/core';

/**
 * Real, observer-reported "last seen" brightness for a comet -- a cross-check against the
 * predicted magnitude already shown elsewhere (see CometActivity.cs's own doc comment for real
 * verified cases where the two disagreed by 4+ magnitudes during an outburst). Comet-only;
 * don't call this for an asteroid.
 *
 * @returns {Promise<{ available: boolean, mostRecentDateUtc: Date|null, mostRecentMagnitude: number|null, recentAverageMagnitude: number|null, observationCount: number }>}
 */
export async function fetchCometActivity(targetName) {
  const { PERIHELION_URL } = getUrls();
  const response = await axios.get(`${PERIHELION_URL}/objects/activity`, { params: { targetName } });
  return {
    available: response.data.Available,
    mostRecentDateUtc: response.data.MostRecentDateUtc ? new Date(response.data.MostRecentDateUtc) : null,
    mostRecentMagnitude: response.data.MostRecentMagnitude,
    recentAverageMagnitude: response.data.RecentAverageMagnitude,
    observationCount: response.data.ObservationCount,
  };
}
