// PINS always runs as the fixed system user "pi", so this path is a stable constant across
// every PINS installation. The equivalent NINA/Windows path (%LOCALAPPDATA%\NINA\Logs) varies
// per Windows user account and cannot be resolved from the frontend without backend support,
// so the "last 10 NINA logs" feature is intentionally PINS-only for now.
export const PINS_NINA_LOG_PATH = '/home/pi/.local/share/NINA/Logs';
export const PINS_INTERNAL_GUIDER_LOG_PATH = '/home/pi/.local/share/NINA/InternalGuider/Logs';

export const DIAGNOSTICS_STATUS = {
  IDLE: 'idle',
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
};

export const DIAGNOSTICS_DEFAULTS = {
  journalLines: 2000,
  dmesgLines: 4000,
  minLines: 100,
  maxLines: 50000,
  pollIntervalMs: 2000,
  maxPollingDurationMs: 30 * 60 * 1000,
};

/**
 * @typedef {Object} DiagnosticsSection
 * @property {string} key
 * @property {string} label
 * @property {boolean} enabled
 */

/**
 * Normalize backend options into UI-safe defaults.
 * @param {any} raw
 * @returns {{sections: DiagnosticsSection[], journalLines: number, dmesgLines: number}}
 */
export function normalizeDiagnosticsOptions(raw) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const defaults = payload.defaults && typeof payload.defaults === 'object' ? payload.defaults : {};

  const baseSections =
    (Array.isArray(payload.sections) && payload.sections) ||
    (Array.isArray(payload.options) && payload.options) ||
    [];

  const sections = baseSections
    .map((section) => {
      if (typeof section === 'string') {
        return {
          key: section,
          label: section,
          enabled: true,
        };
      }

      if (!section || typeof section !== 'object') {
        return null;
      }

      const key = String(section.key || section.id || section.name || '').trim();
      if (!key) {
        return null;
      }

      const label = String(section.label || section.title || key).trim();
      const enabled =
        typeof section.defaultEnabled === 'boolean'
          ? section.defaultEnabled
          : typeof section.enabled === 'boolean'
            ? section.enabled
            : true;

      return {
        key,
        label,
        enabled,
      };
    })
    .filter(Boolean);

  return {
    sections,
    journalLines: normalizeLineCount(defaults.journalLines ?? payload.journalLines),
    dmesgLines: normalizeLineCount(defaults.dmesgLines ?? payload.dmesgLines, 4000),
  };
}

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
export function normalizeLineCount(value, fallback = 2000) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return clamp(parsed, DIAGNOSTICS_DEFAULTS.minLines, DIAGNOSTICS_DEFAULTS.maxLines);
}

/**
 * @param {{sections: DiagnosticsSection[], journalLines: number|string, dmesgLines: number|string}} params
 * @returns {{isValid: boolean, errors: {sections?: string, journalLines?: string, dmesgLines?: string}}}
 */
export function validateDiagnosticsConfig(params) {
  const errors = {};
  const sections = Array.isArray(params.sections) ? params.sections : [];
  const selectedCount = sections.filter((s) => Boolean(s.enabled)).length;
  if (selectedCount === 0) {
    errors.sections = 'At least one section must be selected.';
  }

  const journalLines = Number(params.journalLines);
  if (
    !Number.isInteger(journalLines) ||
    journalLines < DIAGNOSTICS_DEFAULTS.minLines ||
    journalLines > DIAGNOSTICS_DEFAULTS.maxLines
  ) {
    errors.journalLines = `journalLines must be between ${DIAGNOSTICS_DEFAULTS.minLines} and ${DIAGNOSTICS_DEFAULTS.maxLines}.`;
  }

  const dmesgLines = Number(params.dmesgLines);
  if (
    !Number.isInteger(dmesgLines) ||
    dmesgLines < DIAGNOSTICS_DEFAULTS.minLines ||
    dmesgLines > DIAGNOSTICS_DEFAULTS.maxLines
  ) {
    errors.dmesgLines = `dmesgLines must be between ${DIAGNOSTICS_DEFAULTS.minLines} and ${DIAGNOSTICS_DEFAULTS.maxLines}.`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * @param {{sections: DiagnosticsSection[], journalLines: number|string, dmesgLines: number|string}} params
 * @returns {Record<string, boolean|number>}
 */
export function buildDiagnosticsPayload(params) {
  const sections = Array.isArray(params.sections) ? params.sections : [];
  const payload = sections.reduce((acc, section) => {
    acc[section.key] = Boolean(section.enabled);
    return acc;
  }, {});

  payload.journalLines = Number(params.journalLines);
  payload.dmesgLines = Number(params.dmesgLines);
  return payload;
}

/**
 * @param {any} status
 * @returns {boolean}
 */
export function isTerminalArchiveStatus(status) {
  return status === DIAGNOSTICS_STATUS.SUCCESS || status === DIAGNOSTICS_STATUS.FAILED;
}

/**
 * @param {Object} current
 * @param {any} response
 * @param {{nowMs?: number, maxDurationMs?: number}} options
 */
export function applyArchiveStatusTransition(current, response, options = {}) {
  const nowMs = Number(options.nowMs ?? Date.now());
  const maxDurationMs = Number(options.maxDurationMs ?? DIAGNOSTICS_DEFAULTS.maxPollingDurationMs);

  const next = {
    ...current,
    error: null,
  };

  const backendStatus = String(response?.status || '').toLowerCase();
  if (
    backendStatus === DIAGNOSTICS_STATUS.QUEUED ||
    backendStatus === DIAGNOSTICS_STATUS.RUNNING ||
    backendStatus === DIAGNOSTICS_STATUS.SUCCESS ||
    backendStatus === DIAGNOSTICS_STATUS.FAILED
  ) {
    next.status = backendStatus;
  }

  if (response?.downloadUrl) {
    next.downloadUrl = response.downloadUrl;
  }
  if (response?.pollUrl) {
    next.pollUrl = response.pollUrl;
  }

  if (next.status === DIAGNOSTICS_STATUS.FAILED) {
    next.error = response?.error || response?.message || 'Diagnostics archive failed.';
    next.finishedAt = nowMs;
    return next;
  }

  if (next.status === DIAGNOSTICS_STATUS.SUCCESS) {
    next.finishedAt = nowMs;
    return next;
  }

  if (next.startedAt && nowMs - next.startedAt > maxDurationMs) {
    next.status = DIAGNOSTICS_STATUS.TIMEOUT;
    next.error = 'Diagnostics archive polling timed out.';
    next.finishedAt = nowMs;
    return next;
  }

  return next;
}

/**
 * @param {Object} runState
 */
export function getDiagnosticsUiStatus(runState) {
  const status = runState?.status || DIAGNOSTICS_STATUS.IDLE;
  if (status === DIAGNOSTICS_STATUS.SUCCESS) {
    return { kind: 'success', canDownload: true, isBusy: false };
  }
  if (status === DIAGNOSTICS_STATUS.FAILED || status === DIAGNOSTICS_STATUS.TIMEOUT) {
    return { kind: 'failed', canDownload: false, isBusy: false };
  }
  if (status === DIAGNOSTICS_STATUS.QUEUED || status === DIAGNOSTICS_STATUS.RUNNING) {
    return { kind: 'running', canDownload: false, isBusy: true };
  }
  return { kind: 'idle', canDownload: false, isBusy: false };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
