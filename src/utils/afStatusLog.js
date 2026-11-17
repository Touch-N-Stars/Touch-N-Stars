// The autofocus status card shows the last few progress lines of the running
// (or just finished) autofocus run. They are derived from the log window held in
// logStore on every render instead of being collected incrementally inside the
// component: the component is unmounted whenever the reconnect splash covers the
// page (every app resume), and an incremental collector started empty after the
// remount and only showed lines that arrived afterwards.

/**
 * Classifies a NINA log message for the autofocus status card.
 *
 * Returns 'move', 'exposure', 'complete', 'failed' or null for unrelated lines.
 * 'AutoFocus complete' matches NINA's "AutoFocus completed" and HocusFocus'
 * "AutoFocus completed with focuser starting at ...".
 */
export function classifyAfLogMessage(message) {
  if (typeof message !== 'string') return null;
  if (message.includes('Moving Focuser to position')) return 'move';
  if (message.includes('Starting Exposure')) return 'exposure';
  if (message.includes('AutoFocus complete')) return 'complete';
  if (message.includes('AutoFocus did not complete successfully')) return 'failed';
  return null;
}

function isFinish(kind) {
  return kind === 'complete' || kind === 'failed';
}

/**
 * Picks the last `max` relevant entries of the current autofocus run from a log
 * window, oldest first, as `{ timestamp, message, kind }`.
 *
 * NINA's own autofocus writes no start line, so a run is delimited by the end
 * line of the previous one: the current run starts with the first exposure after
 * the last finish line. Focuser moves between a finish line and that exposure
 * (the restore move after a failed run, manual moves) stay with the finished run.
 */
export function selectAfStatusEntries(logs, max = 3) {
  if (!Array.isArray(logs)) return [];

  const relevant = [];
  logs.forEach((log, index) => {
    const kind = classifyAfLogMessage(log?.message);
    if (!kind) return;
    const time = new Date(log.timestamp).getTime();
    if (!Number.isFinite(time)) return;
    relevant.push({ timestamp: log.timestamp, message: log.message, kind, time, index });
  });
  // The backend's order is not guaranteed, so sort by time; the original index
  // keeps lines with identical timestamps in a deterministic order.
  relevant.sort((a, b) => a.time - b.time || a.index - b.index);

  let runStart = 0;
  let afterFinish = false;
  relevant.forEach((entry, i) => {
    if (isFinish(entry.kind)) {
      afterFinish = true;
    } else if (afterFinish && entry.kind === 'exposure') {
      runStart = i;
      afterFinish = false;
    }
  });

  return relevant
    .slice(Math.max(runStart, relevant.length - max))
    .map(({ timestamp, message, kind }) => ({ timestamp, message, kind }));
}
