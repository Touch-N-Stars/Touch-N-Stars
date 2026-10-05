/**
 * Wire protocol of the AAPA Controller NINA plugin's WebSocket server
 * (AAPAWebSocketServer.cs, Fleck, default port 8081).
 *
 * Kept free of Vue/Pinia so it can be unit-tested in plain Node.
 */

export const DEFAULT_WS_PORT = 8081;
export const LOG_LIMIT = 300;

/**
 * Every setting the server reports in `state.settings` and accepts via
 * `{ action: 'set' }`. Keys are the exact server property names (note
 * `MaxCorrectionDeg`, which differs from the NINA setting `MaxCorrectionDegrees`).
 * `type` mirrors the C# conversion in UpdateSetting(): int / double / long / bool.
 */
export const SETTINGS_GROUPS = [
  {
    id: 'autopilot',
    fields: [
      { key: 'ToleranceDegrees', type: 'double', step: 0.001, min: 0 },
      { key: 'SettleTimeSeconds', type: 'int', step: 1, min: 0 },
      { key: 'MaxIterations', type: 'int', step: 1, min: 0 },
      { key: 'MaxCorrectionDeg', type: 'double', step: 0.01, min: 0 },
      { key: 'MotionTimeoutSeconds', type: 'int', step: 1, min: 1 },
    ],
  },
  {
    id: 'geometry',
    fields: [
      { key: 'StepsPerRevolution', type: 'int', step: 1, min: 1 },
      { key: 'AzimuthMicrosteps', type: 'int', step: 1, min: 1 },
      { key: 'AltitudeMicrosteps', type: 'int', step: 1, min: 1 },
      { key: 'AzimuthGearRatio', type: 'double', step: 0.001, min: 0 },
      { key: 'AltitudeGearRatio', type: 'double', step: 0.001, min: 0 },
      { key: 'ReverseAzimuth', type: 'bool' },
      { key: 'ReverseAltitude', type: 'bool' },
      { key: 'AzimuthBacklash', type: 'int', step: 1, min: 0 },
      { key: 'AltitudeBacklash', type: 'int', step: 1, min: 0 },
    ],
  },
  {
    id: 'motor',
    fields: [
      { key: 'AzimuthSpeed', type: 'int', step: 1, min: 1 },
      { key: 'AltitudeSpeed', type: 'int', step: 1, min: 1 },
      { key: 'AzimuthAccel', type: 'int', step: 1, min: 1 },
      { key: 'AltitudeAccel', type: 'int', step: 1, min: 1 },
    ],
  },
  {
    id: 'limits',
    fields: [
      { key: 'MinYLimit', type: 'long', step: 1 },
      { key: 'MaxYLimit', type: 'long', step: 1 },
    ],
  },
];

/** Server settings edited next to the action that uses them, not on the settings tab. */
export const ACTION_FIELDS = {
  NudgeDegrees: { key: 'NudgeDegrees', type: 'double', step: 0.01, min: 0 },
  CalibrationSteps: { key: 'CalibrationSteps', type: 'int', step: 100 },
};

const FIELD_BY_KEY = {
  ...Object.fromEntries(
    SETTINGS_GROUPS.flatMap((group) => group.fields.map((field) => [field.key, field]))
  ),
  ...ACTION_FIELDS,
};

export function getSettingField(key) {
  return FIELD_BY_KEY[key] ?? null;
}

/**
 * Convert raw input into the value the server expects for `key`.
 * Returns `null` when the input is not a valid value of that type, so the
 * caller can reject it instead of sending garbage the server would log as error.
 */
export function coerceSettingValue(key, raw) {
  const type = FIELD_BY_KEY[key]?.type ?? (typeof raw === 'boolean' ? 'bool' : 'double');
  if (type === 'bool') return Boolean(raw);

  // Accept a decimal comma as typed on German/French keyboards.
  const num =
    typeof raw === 'number'
      ? raw
      : Number(
          String(raw ?? '')
            .trim()
            .replace(',', '.')
        );
  if (String(raw ?? '').trim() === '' || !Number.isFinite(num)) return null;

  if (type === 'int' || type === 'long') {
    if (!Number.isInteger(num)) return null;
    if (type === 'int' && Math.abs(num) > 2147483647) return null;
  }
  const min = FIELD_BY_KEY[key]?.min;
  if (min !== undefined && num < min) return null;
  return num;
}

export function buildSetMessage(property, value) {
  return { action: 'set', property, value };
}

export function buildCommandMessage(command, extra = {}) {
  return { action: 'command', command, ...extra };
}

/** `port` empty means "auto-scan all serial ports"; an IP address connects over Wi-Fi. */
export function buildConnectMessage(port) {
  return buildCommandMessage('Connect', { port: (port ?? '').trim() });
}

/** Nudge commands carry the step size; the server falls back to MaxCorrectionDeg without it. */
export function buildNudgeMessage(axis, direction, degrees) {
  const command = `NUDGE_${axis === 'alt' ? 'ALT' : 'AZ'}_${direction < 0 ? 'NEG' : 'POS'}`;
  const deg = Number(degrees);
  return Number.isFinite(deg) && deg > 0
    ? buildCommandMessage(command, { degrees: deg })
    : buildCommandMessage(command);
}

export function buildCalibrateMessage(axis, steps) {
  const command = axis === 'alt' ? 'CALIBRATE_ALT' : 'CALIBRATE_AZ';
  const n = Number(steps);
  return Number.isInteger(n) && n !== 0
    ? buildCommandMessage(command, { steps: n })
    : buildCommandMessage(command);
}

/**
 * Classify an incoming server message.
 * @returns {{ kind: 'state', state: object } | { kind: 'log', message: string } | { kind: 'ignore' }}
 */
export function classifyMessage(message) {
  if (!message || typeof message !== 'object') return { kind: 'ignore' };
  if (message.type === 'state') return { kind: 'state', state: message };
  if (message.type === 'log' && typeof message.message === 'string') {
    return { kind: 'log', message: message.message };
  }
  // `{"status":"CONNECTED"}` is broadcast to every client whenever any client
  // connects; it carries no information for us.
  return { kind: 'ignore' };
}

/** Strip the `[HH:mm:ss] ` prefix the server adds in BroadcastLog(). */
export function stripLogTimestamp(line) {
  return String(line ?? '').replace(/^\[\d{1,2}:\d{2}:\d{2}\]\s*/, '');
}

function parseLocaleNumber(text) {
  return Number(String(text).replace(',', '.'));
}

// The server formats numbers with NINA's current culture, so a German Windows
// writes "+0,1234". Both separators are accepted.
const NUM = '([+-]?\\d+(?:[.,]\\d+)?)';
const ITERATION_RE = /^Iteration (\d+):/;
const ERROR_RE = new RegExp(`Az:\\s*${NUM}°,?\\s+Alt:\\s*${NUM}°`);

/**
 * The current protocol does not report the Auto-Pilot or calibration state, so
 * both are derived from the log lines the plugin emits (AutoPilotController.cs,
 * AAPACore.cs, RatioCalibrationController.cs). This is a heuristic: a client that
 * connects mid-run does not know a run is active until the next marker line.
 * Explicit state fields (`autoPilotRunning`, `calibrationRunning`, ...) win over
 * this whenever the server sends them - see resolveRunState().
 *
 * @param {object} prev - { autoPilotRunning, autoPilotIteration, calibrationRunning, lastError }
 * @param {string} line - log line, with or without timestamp
 * @returns {object} next derived state (new object, prev untouched)
 */
export function deriveFromLog(prev, line) {
  const next = { ...prev };
  const text = stripLogTimestamp(line);

  if (text.startsWith('Auto-Pilot started')) {
    next.autoPilotRunning = true;
    next.autoPilotIteration = 0;
  } else if (
    /^Auto-Pilot (stopped|cancelled|finished|error)/.test(text) ||
    text.startsWith('Auto-Pilot:')
  ) {
    next.autoPilotRunning = false;
  }

  const iteration = ITERATION_RE.exec(text);
  if (iteration) {
    next.autoPilotRunning = true;
    next.autoPilotIteration = Number(iteration[1]);
  }

  // "Iteration N: Az: +0.1234°  Alt: -0.0500°" (PolarAlignmentError.ToString) and the
  // calibration's "Initial/Final error -> Az: 0.1234°, Alt: ..." both carry a reading.
  // A "Correction: Az: +12 steps (...)" line does not match: there the number is not followed by °.
  const error = ERROR_RE.exec(text);
  if (error) {
    next.lastError = {
      azDeg: parseLocaleNumber(error[1]),
      altDeg: parseLocaleNumber(error[2]),
    };
  }

  if (/^Starting \w+ ratio calibration/.test(text)) {
    next.calibrationRunning = true;
  } else if (
    /^(Calibration (successful|cancelled|Error)|Timeout waiting for (initial|final) TPPA error|Error delta too small|Steps to move cannot be 0|AAPA is not connected)/.test(
      text
    )
  ) {
    next.calibrationRunning = false;
  }

  return next;
}

export function initialDerivedState() {
  return {
    autoPilotRunning: false,
    autoPilotIteration: null,
    calibrationRunning: false,
    lastError: null,
  };
}

/**
 * Merge explicit server fields over the log-derived state. Fields are
 * feature-detected on the payload: the protocol extensions proposed in
 * docs/features/aapa-plugin.md are used as soon as a server sends them.
 */
export function resolveRunState(serverState, derived) {
  const s = serverState ?? {};
  const has = (key) => Object.prototype.hasOwnProperty.call(s, key);
  return {
    autoPilotRunning: has('autoPilotRunning')
      ? Boolean(s.autoPilotRunning)
      : derived.autoPilotRunning,
    autoPilotIteration: has('autoPilotIteration')
      ? s.autoPilotIteration
      : derived.autoPilotIteration,
    calibrationRunning: has('calibrationRunning')
      ? Boolean(s.calibrationRunning)
      : derived.calibrationRunning,
    lastError:
      has('azErrorDeg') && has('altErrorDeg')
        ? { azDeg: s.azErrorDeg, altDeg: s.altErrorDeg }
        : derived.lastError,
  };
}

/** Commands the current protocol lacks; the UI shows them only when the server advertises them. */
export function supportsCommand(serverState, command) {
  const list = serverState?.supportedCommands;
  return Array.isArray(list) && list.includes(command);
}

/**
 * Classify a message from the Advanced API's /v2/tppa socket (TPPASocket.cs). The socket
 * acknowledges every start/stop/pause/resume request to all clients, then pushes the
 * alignment error and progress while TPPA runs. It never reports a failed start: a TPPA
 * that cannot run simply goes quiet, which the caller has to catch with a timeout.
 *
 * @returns {{ kind: 'started'|'stopped'|'paused'|'resumed'|'reading'|'progress'|'error'|'other',
 *   reading?: { azDeg: number, altDeg: number, totalDeg: number }, status?: string, error?: string }}
 */
export function classifyTppaMessage(message) {
  if (!message || typeof message !== 'object') return { kind: 'other' };
  if (typeof message.Error === 'string' && message.Error !== '') {
    return { kind: 'error', error: message.Error };
  }
  const response = message.Response;
  if (typeof response === 'string') {
    const kind = {
      'started procedure': 'started',
      'stopped procedure': 'stopped',
      'paused procedure': 'paused',
      'resumed procedure': 'resumed',
    }[response];
    return { kind: kind ?? 'other' };
  }
  if (response && typeof response === 'object') {
    const { AzimuthError, AltitudeError, TotalError } = response;
    if (Number.isFinite(AzimuthError) && Number.isFinite(AltitudeError)) {
      return {
        kind: 'reading',
        reading: {
          azDeg: AzimuthError,
          altDeg: AltitudeError,
          totalDeg: Number.isFinite(TotalError)
            ? TotalError
            : Math.hypot(AzimuthError, AltitudeError),
        },
      };
    }
    if (typeof response.Status === 'string') return { kind: 'progress', status: response.Status };
  }
  return { kind: 'other' };
}
