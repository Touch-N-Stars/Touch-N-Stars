import apiService from '@/services/apiService';
import { buildPerihelionSequence } from './buildPerihelionSequence';

/**
 * "Add to Sequence" — builds a real NINA sequence for the given target and loads it into the
 * Advanced Sequencer via the app's own existing POST /sequence/load route (already wrapped as
 * sequenceLoadJson) — the same mechanism OryxAstro's own "Send to PINS" button already uses,
 * just built here instead of on the website.
 *
 * Deliberately does NOT also start the sequence: loading only, and leaving Start to the user
 * in NINA's own sequencer, means they can review/customize the built container (add dithering,
 * change the imaging loop, reorder items, etc.) before anything actually runs on the mount.
 *
 * @param {object} target - see buildPerihelionSequence's own param docs.
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function sendPerihelionSequence(target) {
  const root = buildPerihelionSequence(target);
  try {
    await apiService.sequenceLoadJson(JSON.stringify(root));
  } catch (error) {
    return { ok: false, message: describeError(error, 'Could not load the sequence') };
  }

  return { ok: true, message: 'Sequence loaded — review and start it in the sequencer' };
}

function describeError(error, fallback) {
  // Mirrors the {Error, Success, StatusCode} envelope ninaAPI's own routes return on failure
  // (e.g. "Sequence is not initialized", "Sequence is already running") -- surface that
  // message directly when present, since it's usually more actionable than a generic one.
  const apiMessage = error?.response?.data?.Error;
  return apiMessage ? `${fallback}: ${apiMessage}` : `${fallback}: ${error?.message ?? 'unknown error'}`;
}
