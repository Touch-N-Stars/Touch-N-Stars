// Pure helpers of the PINS alarm card (no Vue, unit-tested). The box beeps the PowerBox by itself
// on critical events; its alarm API lives in the Touch'N'Stars plugin (PinsAlarmController.cs).

export const ALARM_CATEGORIES = [
  'Errors',
  'Guiding',
  'Mount',
  'Safety',
  'PowerBox',
  'Disk',
  'Warnings',
];

// Mirror of AlarmSettings.Validate() in the plugin (keep in sync). Volume is offered up to 50 only:
// the buzzer duty is min(volume, 50) %, so 50..100 all sound the same.
export const ALARM_LIMITS = {
  Volume: { min: 1, max: 50, step: 5 },
  ToneMs: { min: 50, max: 2000, step: 50 },
  PauseMs: { min: 100, max: 5000, step: 100 },
  BurstSeconds: { min: 1, max: 30, step: 1 },
  GraceMinutes: { min: 0, max: 30, step: 1 },
  ThrottleMinutes: { min: 1, max: 240, step: 5 },
};

export const MAX_EXCLUSIONS = 50;
export const SILENCE_MINUTES = 30;

/** A request cancelled by the app (resume abort): no error to show. */
export function isCancelled(error) {
  return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';
}

/**
 * The box has no alarm API (a plugin from before it): unknown plugin routes answer with an HTML 404,
 * the alarm API itself always answers with its JSON envelope.
 */
export function isAlarmApiMissing(error) {
  const response = error?.response;
  if (response?.status !== 404) return false;
  const data = response.data;
  return !(data && typeof data === 'object' && 'Success' in data);
}

/** The server's error text of a failed request, if any. */
export function serverError(error) {
  const data = error?.response?.data;
  return data && typeof data === 'object' && typeof data.Error === 'string' ? data.Error : '';
}

/**
 * Result of a test beep: { kind: 'ok', tones } | { kind: 'noPowerBox' } | { kind: 'notSupported' } |
 * { kind: 'failed', reason } | { kind: 'unreachable' } | { kind: 'cancelled' }.
 * The plugin answers 404 (no PowerBox), 400 (beep not available, or invalid preview values),
 * 500 (the PowerBox did not beep), 503 (shutting down).
 */
export function classifyTestResult(responseOrError) {
  if (responseOrError && !responseOrError.isAxiosError && 'Success' in responseOrError) {
    return { kind: 'ok', tones: responseOrError.Response?.Tones ?? 0 };
  }
  const error = responseOrError;
  if (isCancelled(error)) return { kind: 'cancelled' };
  const status = error?.response?.status;
  if (!status) return { kind: 'unreachable' };
  if (status === 404 && !isAlarmApiMissing(error)) return { kind: 'noPowerBox' };
  if (status === 400 && /not available/i.test(serverError(error))) return { kind: 'notSupported' };
  return { kind: 'failed', reason: serverError(error) || `HTTP ${status}` };
}

/** Why an exclusion cannot be added: 'tooShort' | 'tooLong' | 'duplicate' | 'tooMany', or null. */
export function validateExclusion(text, list = []) {
  const value = (text ?? '').trim();
  if (value.length < 2) return 'tooShort';
  if (value.length > 200) return 'tooLong';
  if (list.some((e) => e.toLowerCase() === value.toLowerCase())) return 'duplicate';
  if (list.length >= MAX_EXCLUSIONS) return 'tooMany';
  return null;
}

/**
 * A UTC time of the box as a Date. The plugin writes DateTimes without an offset; the box's clock is
 * corrected by `offsetMs` (box minus phone, from timeSync) so the phone shows its own time.
 */
export function parseServerUtc(value, offsetMs = 0) {
  if (!value || typeof value !== 'string') return null;
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms - offsetMs) : null;
}

/** m:ss */
export function formatMinutesSeconds(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The status line: { key, params, tone } with tone 'ok' | 'warn' | 'danger' | 'muted'.
 * First match wins: off, shutting down, muted, no PowerBox, start-up grace, active, waiting.
 * `mutedUntil` is the mute end as a phone Date (see parseServerUtc).
 */
export function alarmStatusLine(status, mutedUntil, nowMs = Date.now()) {
  if (!status) return null;
  if (!status.Enabled) return { key: 'disabled', params: {}, tone: 'muted' };
  if (status.ShuttingDown) return { key: 'shuttingDown', params: {}, tone: 'muted' };
  if (mutedUntil && mutedUntil.getTime() > nowMs) {
    return {
      key: 'muted',
      params: { time: mutedUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      tone: 'warn',
    };
  }
  if (status.PowerBoxConnected === false) return { key: 'noPowerBox', params: {}, tone: 'warn' };
  if (status.GraceRemainingSeconds > 0) {
    return {
      key: 'grace',
      params: { time: formatMinutesSeconds(status.GraceRemainingSeconds) },
      tone: 'muted',
    };
  }
  if (status.Armed) return { key: 'armed', params: {}, tone: 'ok' };
  return { key: 'standby', params: {}, tone: 'muted' };
}

/** Badge colour of a history outcome: 'danger' | 'warn' | 'muted'. */
export function outcomeTone(outcome) {
  if (outcome === 'Beeped') return 'danger';
  if (outcome === 'NoPowerBox' || outcome === 'BeepFailed') return 'warn';
  return 'muted';
}

/** History entries that may get a "never beep for this" action: not tests, not excluded yet. */
export function canExcludeEntry(entry) {
  return (
    !!entry &&
    entry.Origin !== 'Test' &&
    entry.Outcome !== 'Excluded' &&
    typeof entry.Key === 'string' &&
    entry.Key.trim().length >= 2 &&
    entry.Key.trim().length <= 200
  );
}
