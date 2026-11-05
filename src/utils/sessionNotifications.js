/**
 * Pure helpers for the session notification feature (#1492): the pinsdaemon notify
 * relay buffers rig events with a sequence number (`seq`) per daemon run (`bootId`).
 * The app keeps a cursor { bootId, lastSeq } so it can tell which events the user
 * has not seen yet, both for the Android background monitor and for the catch-up
 * summary after a resume.
 */

export const SEVERITIES = ['info', 'success', 'warning', 'error'];

export function severityRank(severity) {
  const index = SEVERITIES.indexOf(severity);
  return index === -1 ? 0 : index;
}

export function severityAtLeast(severity, minimum) {
  return severityRank(severity) >= severityRank(minimum);
}

/** True when the payload comes from a daemon that has the notify relay. */
export function isRelayResponse(payload) {
  return (
    !!payload &&
    typeof payload.bootId === 'string' &&
    Number.isFinite(payload.lastSeq) &&
    Array.isArray(payload.events)
  );
}

/**
 * The `since` to ask the daemon for: the cursor's seq when it belongs to the daemon
 * run (and rig) we talk to, otherwise 0 - after a daemon restart every buffered
 * event is new.
 */
export function sinceForCursor(cursor, { bootId, host } = {}) {
  if (!cursor || !Number.isFinite(cursor.lastSeq)) return 0;
  if (host && cursor.host && cursor.host !== host) return 0;
  if (bootId && cursor.bootId && cursor.bootId !== bootId) return 0;
  return Math.max(0, cursor.lastSeq);
}

/** Cursor after a /notifications response was consumed. */
export function advanceCursor(cursor, payload, host) {
  const events = payload?.events || [];
  const newest = events.reduce((max, event) => Math.max(max, event.seq || 0), 0);
  const sameRun = cursor?.bootId === payload.bootId && cursor?.host === host;
  return {
    host,
    bootId: payload.bootId,
    lastSeq: Math.max(newest, payload.lastSeq ?? 0, sameRun ? cursor.lastSeq || 0 : 0),
  };
}

/**
 * Summary of what happened while the user was away. Returns null when nothing at or
 * above `minSeverity` arrived. `worst` decides the toast type.
 */
export function summarizeMissedEvents(events, minSeverity = 'warning') {
  const relevant = (events || []).filter((event) => severityAtLeast(event.severity, minSeverity));
  if (relevant.length === 0) return null;
  const worst = relevant.reduce(
    (current, event) =>
      severityRank(event.severity) > severityRank(current) ? event.severity : current,
    relevant[0].severity
  );
  return {
    count: relevant.length,
    worst,
    // Newest first, a handful is enough for a toast.
    latest: relevant.slice(-3).reverse(),
  };
}

export function toastTypeForSeverity(severity) {
  return severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info';
}

/** iOS only runs the background provider on these Wi-Fi networks (NEAppPushManager.matchSSIDs). */
export const MAX_RIG_SSIDS = 10;

/**
 * Wi-Fi networks this rig was reached on: the stored ones plus newly seen ones, newest
 * first, without duplicates or empty names.
 */
export function mergeSsids(stored, found) {
  const result = [];
  for (const ssid of [...(found || []), ...(stored || [])]) {
    const name = typeof ssid === 'string' ? ssid.trim() : '';
    if (name && !result.includes(name)) result.push(name);
  }
  return result.slice(0, MAX_RIG_SSIDS);
}

/** SSIDs the PINS daemon reports in GET /wifi/status (client Wi-Fi and its own hotspot). */
export function ssidsFromWifiStatus(status) {
  if (!status || typeof status !== 'object') return [];
  const names = [status.ssid, ...(status.connections || []).map((entry) => entry?.ssid)];
  return names.filter((name) => typeof name === 'string' && name.trim());
}
