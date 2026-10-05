import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTINGS_GROUPS,
  buildCalibrateMessage,
  buildConnectMessage,
  buildNudgeMessage,
  buildSetMessage,
  classifyMessage,
  classifyTppaMessage,
  coerceSettingValue,
  deriveFromLog,
  initialDerivedState,
  resolveRunState,
  supportsCommand,
} from '@/plugins/aapa/utils/aapaProtocol';

function replay(lines) {
  return lines.reduce((state, line) => deriveFromLog(state, line), initialDerivedState());
}

// Keys of `settings` in AAPAWebSocketServer.GetStateJson().
const SERVER_SETTING_KEYS = [
  'ToleranceDegrees',
  'SettleTimeSeconds',
  'MaxIterations',
  'MaxCorrectionDeg',
  'MotionTimeoutSeconds',
  'StepsPerRevolution',
  'AzimuthMicrosteps',
  'AltitudeMicrosteps',
  'AzimuthGearRatio',
  'AltitudeGearRatio',
  'ReverseAzimuth',
  'ReverseAltitude',
  'AzimuthBacklash',
  'AltitudeBacklash',
  'AzimuthSpeed',
  'AltitudeSpeed',
  'AzimuthAccel',
  'AltitudeAccel',
  'MinYLimit',
  'MaxYLimit',
  'CalibrationSteps',
  'NudgeDegrees',
];

test('settings tab plus control/calibration tabs cover every server setting', () => {
  const keys = SETTINGS_GROUPS.flatMap((g) => g.fields.map((f) => f.key));
  // CalibrationSteps and NudgeDegrees are edited next to the action that uses them.
  assert.deepEqual(
    [...keys, 'CalibrationSteps', 'NudgeDegrees'].sort(),
    [...SERVER_SETTING_KEYS].sort()
  );
});

test('command payloads match the server format', () => {
  assert.deepEqual(buildSetMessage('MaxIterations', 5), {
    action: 'set',
    property: 'MaxIterations',
    value: 5,
  });
  assert.deepEqual(buildConnectMessage('  '), {
    action: 'command',
    command: 'Connect',
    port: '',
  });
  assert.deepEqual(buildConnectMessage('192.168.1.50'), {
    action: 'command',
    command: 'Connect',
    port: '192.168.1.50',
  });
  assert.deepEqual(buildNudgeMessage('alt', -1, 0.25), {
    action: 'command',
    command: 'NUDGE_ALT_NEG',
    degrees: 0.25,
  });
  assert.deepEqual(buildNudgeMessage('az', 1, 'x'), { action: 'command', command: 'NUDGE_AZ_POS' });
  assert.deepEqual(buildCalibrateMessage('az', 5000), {
    action: 'command',
    command: 'CALIBRATE_AZ',
    steps: 5000,
  });
});

test('coerceSettingValue enforces the C# types', () => {
  assert.equal(coerceSettingValue('MaxIterations', '12'), 12);
  assert.equal(coerceSettingValue('MaxIterations', '1.5'), null);
  assert.equal(coerceSettingValue('ToleranceDegrees', '0,02'), 0.02);
  assert.equal(coerceSettingValue('ToleranceDegrees', ''), null);
  assert.equal(coerceSettingValue('ToleranceDegrees', '-1'), null);
  assert.equal(coerceSettingValue('MinYLimit', '-100000'), -100000);
  assert.equal(coerceSettingValue('ReverseAzimuth', true), true);
  assert.equal(coerceSettingValue('AzimuthSpeed', '3000000000'), null);
  assert.equal(coerceSettingValue('CalibrationSteps', '2500.5'), null);
  assert.equal(coerceSettingValue('NudgeDegrees', '0.25'), 0.25);
});

test('classifyMessage separates state, log and noise', () => {
  assert.equal(classifyMessage({ type: 'state', isConnected: true }).kind, 'state');
  assert.deepEqual(classifyMessage({ type: 'log', message: '[12:00:00] hi' }), {
    kind: 'log',
    message: '[12:00:00] hi',
  });
  assert.equal(classifyMessage({ status: 'CONNECTED' }).kind, 'ignore');
  assert.equal(classifyMessage('plain text').kind, 'ignore');
});

test('auto-pilot run is derived from the log lines', () => {
  const running = replay([
    '[21:00:00] Auto-Pilot started.',
    '[21:00:01] Iteration 3: waiting for TPPA measurement...',
    '[21:00:05] Iteration 3: Az: +0,1234°  Alt: -0.0500°',
    '[21:00:05] Correction: Az: +120 steps (+0.1234°)  Alt: -50 steps (-0.0500°)',
  ]);
  assert.equal(running.autoPilotRunning, true);
  assert.equal(running.autoPilotIteration, 3);
  assert.deepEqual(running.lastError, { azDeg: 0.1234, altDeg: -0.05 });

  const stopped = deriveFromLog(running, '[21:01:00] Auto-Pilot stopped.');
  assert.equal(stopped.autoPilotRunning, false);
  assert.equal(
    deriveFromLog(running, 'Auto-Pilot: no TPPA data received. Is TPPA running?').autoPilotRunning,
    false
  );
});

test('calibration run is derived from the log lines', () => {
  const running = replay([
    'Starting Azimuth ratio calibration. Moving 10000 steps.',
    'Initial error -> Az: 0.1000°, Alt: 0.2000°',
  ]);
  assert.equal(running.calibrationRunning, true);
  assert.deepEqual(running.lastError, { azDeg: 0.1, altDeg: 0.2 });
  assert.equal(deriveFromLog(running, 'Calibration successful!').calibrationRunning, false);
  assert.equal(
    deriveFromLog(running, 'Timeout waiting for final TPPA error.').calibrationRunning,
    false
  );
});

test('explicit server fields win over the log heuristic', () => {
  const derived = { ...initialDerivedState(), autoPilotRunning: true, autoPilotIteration: 2 };
  assert.equal(resolveRunState({}, derived).autoPilotRunning, true);
  const resolved = resolveRunState(
    { autoPilotRunning: false, autoPilotIteration: 7, azErrorDeg: 0.01, altErrorDeg: -0.02 },
    derived
  );
  assert.equal(resolved.autoPilotRunning, false);
  assert.equal(resolved.autoPilotIteration, 7);
  assert.deepEqual(resolved.lastError, { azDeg: 0.01, altDeg: -0.02 });
});

test('optional commands are only offered when the server lists them', () => {
  assert.equal(supportsCommand({}, 'STOP'), false);
  assert.equal(supportsCommand({ supportedCommands: ['STOP'] }, 'STOP'), true);
});

test('classifyTppaMessage() maps the TPPA socket acknowledgements', () => {
  assert.equal(classifyTppaMessage({ Response: 'started procedure' }).kind, 'started');
  assert.equal(classifyTppaMessage({ Response: 'stopped procedure' }).kind, 'stopped');
  assert.equal(classifyTppaMessage({ Response: 'paused procedure' }).kind, 'paused');
  assert.equal(classifyTppaMessage({ Response: 'resumed procedure' }).kind, 'resumed');
  assert.equal(classifyTppaMessage({ Response: 'something else' }).kind, 'other');
  assert.equal(classifyTppaMessage(null).kind, 'other');
});

test('classifyTppaMessage() extracts the alignment error and progress', () => {
  assert.deepEqual(
    classifyTppaMessage({ Response: { AzimuthError: 0.1, AltitudeError: -0.2, TotalError: 0.25 } }),
    { kind: 'reading', reading: { azDeg: 0.1, altDeg: -0.2, totalDeg: 0.25 } }
  );
  assert.deepEqual(classifyTppaMessage({ Response: { Status: 'Paused', Progress: 0 } }), {
    kind: 'progress',
    status: 'Paused',
  });
  assert.deepEqual(classifyTppaMessage({ Error: 'No camera', Response: '' }), {
    kind: 'error',
    error: 'No camera',
  });
});
