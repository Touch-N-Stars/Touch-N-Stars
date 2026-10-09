import test from 'node:test';
import assert from 'node:assert/strict';
import {
  installBrowserGlobals,
  freshPinia,
  lastSocket,
  resetSockets,
} from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { useNativeGuiderStore } = await import('@/store/nativeGuiderStore');
const { useToastStore } = await import('@/store/toastStore');
const { useSettingsStore } = await import('@/store/settingsStore');
const { apiStore } = await import('@/store/store');
const { default: apiService } = await import('@/services/apiService');

function setup(t) {
  resetSockets();
  freshPinia();
  const settingsStore = useSettingsStore();
  settingsStore.connection.ip = '10.0.0.5';
  settingsStore.connection.port = 5000;
  apiStore().isTnsPluginConnected = true;
  const store = useNativeGuiderStore();
  t.after(() => store.stopFeed());
  return store;
}

function stubApi(t, stubs) {
  const originals = Object.fromEntries(Object.keys(stubs).map((k) => [k, apiService[k]]));
  Object.assign(apiService, stubs);
  t.after(() => Object.assign(apiService, originals));
}

test('clearing the graph removes steps and markers while guiding and live updates continue', (t) => {
  const store = setup(t);
  store.status = { state: 'Guiding' };
  store.calibration = { raAngleDeg: 12 };
  store.stats = { session: { rmsTotalArcsec: 0.7 } };
  store.steps = [{ frame: 1 }];
  store.markers = [{ kind: 'dither' }];
  store.alerts = [{ code: 301 }];

  store.clearGraph();

  assert.deepEqual(store.steps, []);
  assert.deepEqual(store.markers, []);
  assert.equal(store.state, 'Guiding');
  assert.deepEqual(store.calibration, { raAngleDeg: 12 });
  assert.deepEqual(store.stats, { session: { rmsTotalArcsec: 0.7 } });
  assert.deepEqual(store.alerts, [{ code: 301 }]);

  store.handleMessage({ type: 'step', payload: { frame: 2, raArcsec: 0.2 } });
  store.handleMessage({ type: 'dither', timestamp: '2026-10-07T12:00:00Z', payload: {} });
  assert.equal(store.steps.length, 1);
  assert.equal(store.steps[0].frame, 2);
  assert.equal(store.markers.length, 1);
  assert.equal(store.markers[0].kind, 'dither');
});

test('a clear survives an in-flight history response and subsequent reconnect history loads', async (t) => {
  const store = setup(t);
  let resolveSteps;
  let requests = 0;
  stubApi(t, {
    getNativeGuiderSteps: () => {
      requests++;
      return new Promise((resolve) => (resolveSteps = resolve));
    },
    getNativeGuiderAlerts: async () => [],
    getNativeGuiderCalibration: async () => null,
  });
  const pending = store.loadSteps();
  store.clearGraph();
  store.handleMessage({ type: 'step', payload: { frame: 8 } });
  resolveSteps([{ frame: 7 }]);
  await pending;
  await store.loadHistory();
  assert.equal(requests, 1);
  assert.deepEqual(store.steps, [{ frame: 8 }]);
});

test('the feed dials /ws/internal-guider on the plugin port and applies messages', async (t) => {
  const store = setup(t);
  stubApi(t, {
    getNativeGuiderSteps: async () => [],
    getNativeGuiderAlerts: async () => [],
    getNativeGuiderCalibration: async () => null,
  });
  store.startFeed();
  const socket = lastSocket();
  assert.equal(socket.url, 'ws://10.0.0.5:5000/ws/internal-guider');
  socket.emitOpen();
  assert.equal(store.wsConnected, true);

  socket.emitMessage(
    JSON.stringify({
      type: 'hello',
      timestamp: '2026-09-23T21:00:00Z',
      payload: { available: true, connected: true, deviceId: 'InternalGuider', isNative: true },
    })
  );
  assert.equal(store.isAvailable, true);

  socket.emitMessage(
    JSON.stringify({
      type: 'step',
      timestamp: '2026-09-23T21:00:01Z',
      payload: { frame: 7, raArcsec: 0.2, decArcsec: -0.1 },
    })
  );
  assert.equal(store.steps.length, 1);
  assert.equal(store.steps[0].frame, 7);

  socket.emitMessage(
    JSON.stringify({ type: 'frame', timestamp: 'x', payload: { frameNumber: 42 } })
  );
  assert.equal(store.latestFrameNumber, 42);

  socket.emitMessage(
    JSON.stringify({ type: 'dither', timestamp: '2026-09-23T21:00:02Z', payload: { dx: 1 } })
  );
  assert.equal(store.markers.length, 1);
  assert.equal(store.markers[0].kind, 'dither');

  socket.emitClose();
  assert.equal(store.wsConnected, false);
});

test('critical alerts toast once, info alerts do not', (t) => {
  const store = setup(t);
  const toast = useToastStore();
  const shown = [];
  t.mock.method(toast, 'showToast', (options) => shown.push(options));

  const critical = {
    timestamp: '2026-09-23T21:00:00Z',
    code: 301,
    severity: 'Critical',
    title: 'Star lost',
    explanation: 'Clouds?',
    fix: 'Wait or pick another star.',
  };
  store.handleMessage({ type: 'alert', timestamp: critical.timestamp, payload: critical });
  store.handleMessage({ type: 'alert', timestamp: critical.timestamp, payload: critical });
  store.handleMessage({
    type: 'alert',
    timestamp: critical.timestamp,
    payload: { ...critical, severity: 'Info', code: 1 },
  });

  assert.equal(store.alerts.length, 3);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].type, 'error');
  assert.match(shown[0].title, /star lost/i);
  assert.match(shown[0].message, /Wait or pick another star/);
});

test('state, settle, calibration and stats messages update the status', (t) => {
  const store = setup(t);
  store.status = { state: 'Looping', isSettling: false };

  store.handleMessage({ type: 'state', payload: 'Guiding' });
  assert.equal(store.state, 'Guiding');

  store.handleMessage({ type: 'settle', payload: { status: 'settling' } });
  assert.equal(store.isSettling, true);
  store.handleMessage({
    type: 'settle',
    timestamp: '2026-09-23T21:00:00Z',
    payload: { status: 'done' },
  });
  assert.equal(store.isSettling, false);
  assert.equal(store.markers.at(-1).kind, 'settled');

  store.handleMessage({ type: 'calibration', payload: { step: 'West 3/12' } });
  assert.equal(store.calibrationProgress.step, 'West 3/12');
  store.handleMessage({
    type: 'calibration',
    timestamp: '2026-09-23T21:00:00Z',
    payload: { raAngleDeg: 12, decAngleDeg: 101 },
  });
  assert.equal(store.calibration.raAngleDeg, 12);
  assert.equal(store.calibrationProgress, null);

  store.handleMessage({ type: 'stats', payload: { window: { rmsTotalArcsec: 0.7 } } });
  assert.equal(store.windowStats.rmsTotalArcsec, 0.7);
});

test('failed background actions are toasted with the backend reason', (t) => {
  const store = setup(t);
  const toast = useToastStore();
  const shown = [];
  t.mock.method(toast, 'showToast', (options) => shown.push(options));

  store.handleMessage({
    type: 'action',
    payload: { action: 'start-guiding', success: false, error: 'Calibration failed' },
  });
  store.handleMessage({ type: 'action', payload: { action: 'dither', success: true } });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, 'Start guiding failed', 'the action named in the UI language');
  assert.equal(shown[0].message, 'Calibration failed');

  store.handleMessage({
    type: 'action',
    payload: { action: 'future-action', success: false, error: 'Nope' },
  });
  assert.equal(shown[1].title, 'future-action failed');
});

test('critical alerts toast in the UI language, the backend text as fallback', (t) => {
  const store = setup(t);
  const toast = useToastStore();
  const shown = [];
  t.mock.method(toast, 'showToast', (options) => shown.push(options));

  store.handleMessage({
    type: 'alert',
    payload: {
      timestamp: '2026-09-23T21:00:00Z',
      code: 402,
      codeName: 'CameraFailed',
      severity: 'Critical',
      title: 'backend title',
      explanation: 'backend explanation',
      fix: 'backend fix',
    },
  });
  assert.equal(shown[0].title, 'Guide camera failed');
  assert.match(shown[0].message, /^The guide camera could not deliver frames/);
  assert.doesNotMatch(shown[0].message, /backend/);
});

test('runAction toasts the error and releases the pending flag', async (t) => {
  const store = setup(t);
  const toast = useToastStore();
  const shown = [];
  t.mock.method(toast, 'showToast', (options) => shown.push(options));
  const error = new Error('The guider rejected pause in state Looping.');
  error.status = 409;
  stubApi(t, {
    nativeGuiderAction: async () => {
      throw error;
    },
  });

  const ok = await store.runAction('pause', {}, { title: 'Pause failed' });
  assert.equal(ok, false);
  assert.equal(store.pendingAction, null);
  assert.equal(shown[0].title, 'Pause failed');
  assert.equal(shown[0].message, error.message);
});

test('refreshStatus maps the pollable status and loads history on first availability', async (t) => {
  const store = setup(t);
  let historyLoads = 0;
  stubApi(t, {
    getNativeGuiderStatus: async () => ({
      available: true,
      connected: true,
      deviceId: 'InternalGuider',
      isNative: true,
      status: { state: 'Guiding', frameNumber: 12, isCalibrated: true },
    }),
    getNativeGuiderSteps: async () => {
      historyLoads++;
      return [{ frame: 1 }, { frame: 2 }];
    },
    getNativeGuiderAlerts: async () => [],
    getNativeGuiderCalibration: async () => ({ raAngleDeg: 5 }),
  });

  await store.refreshStatus();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.state, 'Guiding');
  assert.equal(store.isCalibrated, true);
  assert.equal(store.latestFrameNumber, 12);
  assert.equal(historyLoads, 1);
  assert.equal(store.steps.length, 2);

  await store.refreshStatus();
  assert.equal(historyLoads, 1);
});

function reconnectSetting(value) {
  return { name: 'PulseOutput', value, type: 'enum', requiresReconnect: true };
}

test('changing a reconnect setting while connected asks for a reconnect, which reconnects', async (t) => {
  const store = setup(t);
  store.summary = { ...store.summary, connected: true };
  store.settings = [reconnectSetting('')];
  const calls = [];
  stubApi(t, {
    setNativeGuiderSetting: async (name, value) => reconnectSetting(value),
    guiderAction: async (action) => {
      calls.push(action);
      return { Success: true };
    },
    getNativeGuiderSettings: async () => ({
      connected: true,
      settings: [reconnectSetting('Mount')],
    }),
  });
  await store.saveSetting('PulseOutput', 'Mount');
  assert.equal(store.reconnectNeeded, true);
  await store.reconnectGuider();
  assert.deepEqual(calls, ['disconnect', 'connect?to=InternalGuider']);
  assert.equal(store.reconnectNeeded, false);
  assert.equal(store.reconnectError, null);
});

// --- Guiding Coach -------------------------------------------------------------------

function coachSession(overrides = {}) {
  return {
    phase: 'Complete',
    sessionId: 's1',
    findings: [
      {
        id: 'drift.minMove',
        code: 'drift.minMove',
        step: 'Drift',
        severity: 'info',
        changes: [{ name: 'RaMinMove', value: '0.2', currentValue: '0' }],
        applied: false,
      },
    ],
    trials: [{ id: 'B', kind: 'suggestion', settings: [{ name: 'RaAggression', value: '0.6' }] }],
    report: {
      id: 'r1',
      grade: 'good',
      findings: [{ id: 'drift.minMove', code: 'drift.minMove', applied: false }],
      trials: [{ id: 'B' }],
    },
    ...overrides,
  };
}

test('coach and hint messages update the coach state and the active hint', (t) => {
  const store = setup(t);
  let historyLoads = 0;
  stubApi(t, {
    getNativeGuiderCoachHistory: async () => {
      historyLoads++;
      return [{ id: 'r1' }];
    },
  });

  store.handleMessage({
    type: 'coach',
    payload: { phase: 'Running', step: 'Drift', progress: 0.3 },
  });
  assert.equal(store.coachPhase, 'Running');
  assert.equal(store.coachRunning, true);
  assert.equal(historyLoads, 0);

  // A completed session refreshes the history once.
  store.handleMessage({ type: 'coach', payload: coachSession() });
  store.handleMessage({ type: 'coach', payload: coachSession() });
  assert.equal(store.coachRunning, false);
  assert.equal(historyLoads, 1);

  store.handleMessage({
    type: 'hint',
    payload: { id: 'hint.lowSnr', code: 'hint.lowSnr', severity: 'warning', timestamp: 'x' },
  });
  store.handleMessage({
    type: 'hint',
    payload: { id: 'hint.seeingBound', code: 'hint.seeingBound', severity: 'good' },
  });
  assert.equal(store.hints.length, 2);
  assert.equal(store.currentHint.id, 'hint.lowSnr', 'the more severe hint wins');
});

test('the status poll is the source of truth for hints and the running flag', async (t) => {
  const store = setup(t);
  store.hints = [{ id: 'stale', severity: 'warning' }];
  stubApi(t, {
    getNativeGuiderStatus: async () => ({
      available: true,
      connected: true,
      status: {
        state: 'Guiding',
        coachRunning: true,
        hints: [{ id: 'hint.raOscillation', code: 'hint.raOscillation', severity: 'warning' }],
      },
    }),
    getNativeGuiderSteps: async () => [],
    getNativeGuiderAlerts: async () => [],
    getNativeGuiderCalibration: async () => null,
  });

  await store.refreshStatus();

  assert.deepEqual(
    store.hints.map((h) => h.id),
    ['hint.raOscillation']
  );
  assert.equal(store.coachRunning, true);
  assert.equal(store.currentHint.id, 'hint.raOscillation');
});

test('startCoach passes the options and returns the localized rejection code', async (t) => {
  const store = setup(t);
  const sent = [];
  stubApi(t, {
    startNativeGuiderCoach: async (options) => {
      sent.push(options);
      const error = new Error('Another coach session is running.');
      error.status = 409;
      error.messageCode = 'coach.busy';
      throw error;
    },
  });

  const result = await store.startCoach({ steps: ['Drift'], driftSeconds: 300 });

  assert.deepEqual(sent, [{ steps: ['Drift'], driftSeconds: 300 }]);
  assert.equal(result.ok, false);
  assert.equal(result.messageCode, 'coach.busy');
  assert.deepEqual(result.messageParameters, {});
  assert.equal(result.message, 'Another coach session is running.');
  assert.equal(store.coachPending, null);
});

test('startCoach applies the accepted status', async (t) => {
  const store = setup(t);
  stubApi(t, {
    startNativeGuiderCoach: async () => ({
      action: 'coach-start',
      status: { phase: 'Running', step: 'CameraCheck' },
    }),
    getNativeGuiderStatus: async () => null,
  });

  const result = await store.startCoach({});

  assert.equal(result.ok, true);
  assert.equal(store.coach.step, 'CameraCheck');
  assert.equal(store.coachRunning, true);
});

test('applying coach actions marks them applied and reloads the settings', async (t) => {
  const store = setup(t);
  store.coach = coachSession();
  const applied = [];
  let settingsLoads = 0;
  stubApi(t, {
    applyNativeGuiderCoachActions: async (ids) => {
      applied.push(ids);
      return { applied: ids };
    },
    getNativeGuiderSettings: async () => {
      settingsLoads++;
      return { connected: true, settings: [] };
    },
  });

  const ok = await store.applyCoachActions(['drift.minMove', 'trial:B']);

  assert.equal(ok, true);
  assert.deepEqual(applied, [['drift.minMove', 'trial:B']]);
  assert.equal(store.coach.findings[0].applied, true);
  assert.equal(store.coach.report.findings[0].applied, true);
  assert.equal(store.coach.trials[0].applied, true);
  assert.equal(store.coach.report.trials[0].applied, true);
  assert.equal(settingsLoads, 1);
});

test('a failed coach call is toasted with the backend reason', async (t) => {
  const store = setup(t);
  const toast = useToastStore();
  const shown = [];
  t.mock.method(toast, 'showToast', (options) => shown.push(options));
  stubApi(t, {
    skipNativeGuiderCoachStep: async () => {
      throw new Error('No Guiding Coach session is running.');
    },
  });

  const ok = await store.skipCoachStep({ title: 'Skipping failed' });

  assert.equal(ok, false);
  assert.equal(shown[0].title, 'Skipping failed');
  assert.equal(shown[0].message, 'No Guiding Coach session is running.');
  assert.equal(store.coachPending, null);
});

test('dismissing a hint hides it at once, also when the guider no longer knows it', async (t) => {
  const store = setup(t);
  store.hints = [
    { id: 'hint.lowSnr', severity: 'warning' },
    { id: 'hint.seeingBound', severity: 'good' },
  ];
  const dismissed = [];
  stubApi(t, {
    dismissNativeGuiderHint: async (id) => {
      dismissed.push(id);
      const error = new Error('The hint is no longer active.');
      error.status = 409;
      throw error;
    },
  });

  await store.dismissHint(store.hints[0]);

  assert.deepEqual(dismissed, ['hint.lowSnr']);
  assert.equal(store.currentHint.id, 'hint.seeingBound');
});

test('loading the coach without a native guider is not an error', async (t) => {
  const store = setup(t);
  stubApi(t, {
    getNativeGuiderCoach: async () => {
      const error = new Error('No guider is connected.');
      error.status = 409;
      throw error;
    },
  });

  await store.loadCoach();

  assert.equal(store.coach, null);
  assert.equal(store.coachError, null);
});

test('the newer of status poll and coach status decides whether the coach runs', (t) => {
  const store = setup(t);
  store.setCoach({ phase: 'Running', step: 'Drift' });
  store.status = { state: 'Guiding', coachRunning: false };
  store.lastStatusAt = store.coachUpdatedAt - 1000;
  assert.equal(store.coachRunning, true, 'a start is ahead of the last poll');

  store.lastStatusAt = store.coachUpdatedAt + 1000;
  assert.equal(store.coachRunning, false, 'a later poll ends a stale running session');

  store.status = { state: 'Guiding', coachRunning: true };
  assert.equal(store.coachRunning, true);
});

test('applying a hint goes through coach/apply, hides the hint and reloads the settings', async (t) => {
  const store = setup(t);
  const hint = { id: 'hint.raOscillation', severity: 'warning', timestamp: 'x' };
  store.hints = [hint];
  const applied = [];
  let settingsLoads = 0;
  stubApi(t, {
    applyNativeGuiderCoachActions: async (ids) => {
      applied.push(ids);
      return { applied: ids };
    },
    getNativeGuiderSettings: async () => {
      settingsLoads++;
      return { connected: true, settings: [] };
    },
  });

  assert.equal(await store.applyHint(hint), true);

  assert.deepEqual(applied, [['hint.raOscillation']]);
  assert.equal(store.currentHint, null);
  assert.equal(settingsLoads, 1);
});

// --- Flight recorder (incidents) ---------------------------------------------------------------

const SUMMARY = {
  id: '20260926-021300-StarLost',
  start: '2026-09-26T02:13:00Z',
  end: '2026-09-26T02:16:00Z',
  kind: 'StarLost',
  kinds: ['StarLost'],
  endReason: 'recovered',
  kept: false,
};

test('incident messages track the recording, add saved incidents and remove deleted ones', (t) => {
  const store = setup(t);
  const reloads = [];
  t.mock.method(store, 'scheduleIncidentsReload', (delay) => reloads.push(delay));
  localStorage.removeItem('nativeGuider.incidents.lastSeen');
  store.incidentsLastSeen = 0;

  store.handleMessage({
    type: 'incident',
    timestamp: SUMMARY.start,
    payload: { action: 'started', id: SUMMARY.id, summary: null },
  });
  assert.equal(store.incidentRecordingId, SUMMARY.id);
  assert.equal(store.unseenIncidents, 0);

  store.handleMessage({
    type: 'incident',
    timestamp: SUMMARY.end,
    payload: { action: 'saved', id: SUMMARY.id, summary: SUMMARY },
  });
  assert.equal(store.incidentRecordingId, null);
  assert.deepEqual(
    store.incidents.map((i) => i.id),
    [SUMMARY.id]
  );
  assert.equal(store.unseenIncidents, 1);
  assert.equal(reloads.length, 1);

  // Opening the tab clears the badge and remembers it per browser.
  store.markIncidentsSeen();
  assert.equal(store.unseenIncidents, 0);
  assert.equal(
    localStorage.getItem('nativeGuider.incidents.lastSeen'),
    String(Date.parse(SUMMARY.end))
  );

  // Saved again (a repeat joined it): replaced, not duplicated, and unseen again.
  store.handleMessage({
    type: 'incident',
    timestamp: 'x',
    payload: {
      action: 'saved',
      id: SUMMARY.id,
      summary: { ...SUMMARY, end: '2026-09-26T02:30:00Z', occurrences: 2, ongoing: true },
    },
  });
  assert.equal(store.incidents.length, 1);
  assert.equal(store.incidents[0].occurrences, 2);
  assert.equal(store.unseenIncidents, 1);

  store.handleMessage({
    type: 'incident',
    timestamp: 'x',
    payload: { action: 'deleted', id: SUMMARY.id, summary: null },
  });
  assert.deepEqual(store.incidents, []);
});

test('a manual mark reports its saved incident once, a refused mark its reason', async (t) => {
  const store = setup(t);
  t.mock.method(store, 'scheduleIncidentsReload', () => {});
  const notes = [];
  stubApi(t, {
    markNativeGuiderIncident: async (note) => {
      notes.push(note);
      if (note === 'refuse') {
        const error = new Error('Not guiding or calibrating');
        error.status = 409;
        throw error;
      }
      return { id: 'm1' };
    },
  });

  const saved = [];
  const result = await store.markIncident('wind', { onSaved: (s) => saved.push(s) });
  assert.deepEqual(result, { ok: true, id: 'm1' });
  assert.equal(store.incidentRecordingId, 'm1');

  const summary = { ...SUMMARY, id: 'm1', kind: 'Manual', note: 'wind' };
  store.handleIncidentEvent({ action: 'saved', id: 'm1', summary });
  store.handleIncidentEvent({ action: 'saved', id: 'm1', summary });
  assert.deepEqual(saved, [summary]);

  const refused = await store.markIncident('refuse');
  assert.equal(refused.ok, false);
  assert.equal(refused.message, 'Not guiding or calibrating');
  assert.deepEqual(notes, ['wind', 'refuse']);
});

test('stopping the feed drops marks still waiting for their incident', async (t) => {
  const store = setup(t);
  t.mock.method(store, 'scheduleIncidentsReload', () => {});
  stubApi(t, { markNativeGuiderIncident: async () => ({ id: 'm2' }) });
  const saved = [];
  await store.markIncident('gust', { onSaved: (s) => saved.push(s) });
  store.startFeed();
  store.stopFeed();
  store.handleIncidentEvent({ action: 'saved', id: 'm2', summary: { ...SUMMARY, id: 'm2' } });
  assert.deepEqual(saved, [], 'no Replay toast for a mark of a feed that was stopped');
});

test('keep, delete and delete-all update the list; failures are toasted', async (t) => {
  const store = setup(t);
  t.mock.method(store, 'scheduleIncidentsReload', () => {});
  const toast = useToastStore();
  const shown = [];
  t.mock.method(toast, 'showToast', (options) => shown.push(options));
  const kept = { ...SUMMARY, id: 'b', kept: true };
  store.incidents = [
    { ...SUMMARY, id: 'a' },
    { ...SUMMARY, id: 'b' },
    { ...SUMMARY, id: 'c' },
  ];
  stubApi(t, {
    keepNativeGuiderIncident: async (id, value) => ({ ...kept, id, kept: value }),
    deleteNativeGuiderIncident: async (id) => {
      if (id === 'missing') throw new Error('Unknown incident');
      return { deleted: true };
    },
    deleteAllNativeGuiderIncidents: async () => ({ deleted: 1 }),
  });

  assert.equal(await store.keepIncident('b', true), true);
  assert.equal(store.incidents.find((i) => i.id === 'b').kept, true);

  store.replayIncidentId = 'a';
  assert.equal(await store.deleteIncident('a'), true);
  assert.deepEqual(
    store.incidents.map((i) => i.id),
    ['b', 'c']
  );
  assert.equal(store.replayIncidentId, null);

  assert.equal(await store.deleteIncident('missing', { title: 'Incident action failed' }), false);
  assert.equal(shown.at(-1).title, 'Incident action failed');
  assert.equal(shown.at(-1).message, 'Unknown incident');
  assert.equal(store.incidentPending, null);

  assert.equal(await store.deleteAllIncidents(), 1);
  assert.deepEqual(
    store.incidents.map((i) => i.id),
    ['b']
  );
});

test('the incident list loads with its budget; without a native guider it is empty, no error', async (t) => {
  const store = setup(t);
  let available = true;
  stubApi(t, {
    getNativeGuiderIncidents: async () => {
      if (!available) {
        const error = new Error('No native guider');
        error.status = 409;
        throw error;
      }
      return {
        incidents: [SUMMARY],
        enabled: true,
        recordingId: 'r1',
        usedBytes: 312e6,
        budgetBytes: 1e9,
        maxIncidents: 50,
      };
    },
  });

  await store.loadIncidents();
  assert.equal(store.incidents.length, 1);
  assert.equal(store.incidentRecordingId, 'r1');
  assert.equal(store.incidentList.budgetBytes, 1e9);
  assert.equal(store.incidentList.incidents, undefined);

  available = false;
  await store.loadIncidents();
  assert.equal(store.incidentsError, null);
  assert.equal(store.incidentsLoading, false);
});

test('a reconnected feed reloads the history and toasts a critical alert missed meanwhile', async (t) => {
  const store = setup(t);
  const toast = useToastStore();
  const shown = [];
  t.mock.method(toast, 'showToast', (options) => shown.push(options));
  const old = { code: 1, codeName: 'Info', severity: 'Info', timestamp: '2026-10-09T20:00:00Z' };
  const missed = {
    code: 301,
    codeName: 'StarLost',
    severity: 'Critical',
    title: 'Star lost',
    timestamp: '2026-10-09T20:05:00Z',
  };
  let history = [old];
  stubApi(t, {
    getNativeGuiderSteps: async () => [],
    getNativeGuiderAlerts: async () => history,
    getNativeGuiderCalibration: async () => null,
  });

  store.handleMessage({ type: 'hello', payload: { available: true, connected: true } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.historyLoaded, true);
  assert.equal(shown.length, 0, 'the first load is history, not news');

  // App in background: the alert was raised while the socket was closed.
  history = [old, missed];
  store.handleMessage({ type: 'hello', payload: { available: true, connected: true } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.alerts.length, 2);
  assert.equal(shown.length, 1);
  assert.match(shown[0].title, /star lost/i);

  // A heartbeat is no reconnect: nothing is reloaded or toasted again.
  store.handleMessage({ type: 'heartbeat', payload: { available: true, connected: true } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(shown.length, 1);
});

test('steps that arrive while the history loads are kept', async (t) => {
  const store = setup(t);
  let release;
  stubApi(t, {
    getNativeGuiderSteps: () =>
      new Promise((resolve) => {
        release = () => resolve([{ frame: 1 }, { frame: 2 }]);
      }),
  });
  const loading = store.loadSteps();
  store.handleMessage({ type: 'step', payload: { frame: 3 } });
  release();
  await loading;
  assert.deepEqual(
    store.steps.map((s) => s.frame),
    [1, 2, 3]
  );
});

test('an older status answer does not undo a newer state event or a newer poll', async (t) => {
  const store = setup(t);
  const answers = [];
  stubApi(t, {
    getNativeGuiderStatus: () => new Promise((resolve) => answers.push(resolve)),
  });
  const guiding = { available: true, connected: true, status: { state: 'Guiding' } };

  const first = store.refreshStatus();
  store.handleMessage({ type: 'state', payload: 'Stopped' });
  answers[0](guiding);
  await first;
  assert.equal(store.state, 'Stopped', 'the state event after the request wins');

  const older = store.refreshStatus();
  const newer = store.refreshStatus();
  answers[2]({ available: true, connected: true, status: { state: 'Looping' } });
  await newer;
  answers[1](guiding);
  await older;
  assert.equal(store.state, 'Looping', 'the newest poll wins');
});

test('a dark run that stops reporting is released, and cancel frees the UI', async (t) => {
  const store = setup(t);
  stubApi(t, { cancelNativeGuiderDarks: async () => null });

  store.handleMessage({ type: 'darks', payload: { status: 'capturing', index: 2, total: 9 } });
  assert.equal(store.darksRunning, true);
  store.expireStaleDarks(Date.now() + 60 * 1000);
  assert.equal(store.darksRunning, true, 'still within the progress interval');
  store.expireStaleDarks(Date.now() + 4 * 60 * 1000);
  assert.equal(store.darksRunning, false);

  store.handleMessage({ type: 'darks', payload: { status: 'capturing', index: 1, total: 9 } });
  await store.cancelDarks();
  assert.equal(store.darksRunning, false);
});

test('a cancelled dark build request (app resume) is not toasted', async (t) => {
  const store = setup(t);
  const toast = useToastStore();
  const shown = [];
  t.mock.method(toast, 'showToast', (options) => shown.push(options));
  stubApi(t, {
    buildNativeGuiderDarks: async () => {
      const error = new Error('Request cancelled');
      error.cancelled = true;
      throw error;
    },
  });
  assert.equal(await store.buildDarks({}), false);
  assert.equal(shown.length, 0);
});

test('stopping the feed forgets the session; a new connection clears "reconnect needed"', async (t) => {
  const store = setup(t);
  store.startFeed();
  store.summary = { ...store.summary, available: true, connected: true };
  store.status = { state: 'Guiding' };
  store.steps = [{ frame: 1 }];
  store.historyLoaded = true;
  store.reconnectNeeded = true;

  store.stopFeed();
  assert.equal(store.status, null);
  assert.deepEqual(store.steps, []);
  assert.equal(store.summary.available, false);
  assert.equal(store.historyLoaded, false);
  assert.equal(store.reconnectNeeded, false);

  store.reconnectNeeded = true;
  stubApi(t, {
    getNativeGuiderStatus: async () => ({ available: true, connected: true, status: null }),
    getNativeGuiderSteps: async () => [],
    getNativeGuiderAlerts: async () => [],
    getNativeGuiderCalibration: async () => null,
  });
  await store.refreshStatus();
  assert.equal(store.reconnectNeeded, false);
});
