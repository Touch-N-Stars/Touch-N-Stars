import apiService from '@/services/apiService';
import { buildPerihelionSequence } from './buildPerihelionSequence';

/**
 * "Add to Sequence" — builds a real NINA sequence for the given target and hands it to the
 * Advanced Sequencer to run. Reuses the app's own existing routes (no new backend needed):
 * POST /sequence/load (already wrapped as sequenceLoadJson) then GET /sequence/start (already
 * wrapped as sequenceAction('start')) — the same mechanism OryxAstro's own "Send to PINS"
 * button already uses, just built here instead of on the website.
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

  try {
    await apiService.sequenceAction('start');
  } catch (error) {
    return { ok: false, message: describeError(error, 'Sequence loaded but could not be started') };
  }

  return { ok: true, message: 'Sequence loaded and started' };
}

function describeError(error, fallback) {
  // Mirrors the {Error, Success, StatusCode} envelope ninaAPI's own routes return on failure
  // (e.g. "Sequence is not initialized", "Sequence is already running") -- surface that
  // message directly when present, since it's usually more actionable than a generic one.
  const apiMessage = error?.response?.data?.Error;
  return apiMessage ? `${fallback}: ${apiMessage}` : `${fallback}: ${error?.message ?? 'unknown error'}`;
}
