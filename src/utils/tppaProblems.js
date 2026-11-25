// Why a three-point polar alignment cannot start. The TPPA socket never reports an error: a
// failed validation (no location) ends the run without a message. Failed plate solves during a
// run are normal (TPPA retries them), so they are not reported as a problem here.
// Pure helpers, so the TPPA page and its tests share them.

// "Failed validation: Category: , Item: PolarAlignment, Rate: 3, Distance: 10 - <reason>"
const VALIDATION_PATTERN = /Failed validation:.*Item:\s*PolarAlignment\b.*? - (.+)$/is;

/**
 * What blocks a start for sure, known before anything is sent: 'noLocation', 'noDatabase'
 * or null. NINA refuses the first one only in its log; the second makes every solve fail.
 */
export function tppaStartBlocker({ hasLocation, databaseMissing }) {
  if (hasLocation === false) return 'noLocation';
  if (databaseMissing === true) return 'noDatabase';
  return null;
}

/**
 * The reason NINA logged for refusing to start the alignment, from log lines written after
 * `sinceMs` (host clock, like the log timestamps). Null when there is none.
 * @param {{ message: string, timestamp: string }[]} logs
 */
export function tppaValidationError(logs, sinceMs) {
  if (!Array.isArray(logs)) return null;
  for (const log of logs) {
    if (typeof log?.message !== 'string') continue;
    const time = new Date(log.timestamp).getTime();
    if (!Number.isFinite(time) || !(time >= sinceMs)) continue;
    const match = VALIDATION_PATTERN.exec(log.message);
    if (match) return match[1].trim();
  }
  return null;
}
