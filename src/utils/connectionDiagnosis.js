// What the connection page tells the user while the backend does not answer. Pure, so every
// situation is testable; the facts come from the store (issue) and connectionSearch.js.

// A quick reconnect after the app was in the background routinely takes up to ~12 s.
export const HELP_AFTER_SECONDS = 15;
// The rig answers but PINS does not: booting takes one to two minutes.
export const PINS_START_SECONDS = 120;

/** What kind of backend the selected instance is, as far as the app has ever seen it. */
export function backendKind({ instance, seenKind, host, hotspotHost }) {
  if (instance?.rigId) return 'pins';
  if (instance?.backendKind) return instance.backendKind;
  if (seenKind) return seenKind;
  return host && host === hotspotHost ? 'pins' : 'unknown';
}

/**
 * @param {object} facts
 * @param {{ type: string }|null} facts.issue  why the last attempt failed (store.connectionIssue)
 * @param {'pins'|'nina'|'unknown'} facts.kind
 * @param {number} facts.elapsed  seconds without a connection
 * @param {boolean} facts.boxAnswers  the rig's daemon answers at the configured address
 * @param {Array} facts.found  other rigs or computers the search found
 * @returns {'update'|'pinsStarting'|'pinsDown'|'found'|'searching'|'apiMissing'|'liveBlocked'|
 *   'rigSilent'|'ninaSilent'|'silent'}
 */
export function diagnoseConnection({ issue, kind, elapsed, boxAnswers = false, found = [] }) {
  const type = issue?.type;
  if (type === 'tnsVersion' || type === 'apiVersion') return 'update';

  // A short outage stays "connecting". The daemon answering says nothing yet: right after the
  // tab or app returns from the background it answers before the app's own check is through.
  if (found.length === 0 && elapsed < HELP_AFTER_SECONDS) return 'searching';

  if (type !== 'liveUpdates' && (boxAnswers || (type === 'api' && kind === 'pins'))) {
    return elapsed < PINS_START_SECONDS ? 'pinsStarting' : 'pinsDown';
  }

  if (found.length > 0) return 'found';
  if (type === 'api') return 'apiMissing';
  if (type === 'liveUpdates') return 'liveBlocked';
  return { pins: 'rigSilent', nina: 'ninaSilent' }[kind] ?? 'silent';
}
