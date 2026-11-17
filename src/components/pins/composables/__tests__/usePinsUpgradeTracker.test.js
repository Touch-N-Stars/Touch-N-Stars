import test from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';
import { installBrowserGlobals } from '../../../../test-helpers/browserEnv.js';

installBrowserGlobals();
window.localStorage = globalThis.localStorage;

// Import AFTER the globals exist: the service's transitive imports touch browser APIs.
const { default: apiPinsService } = await import('@/services/apiPinsService');
const { createPinsUpgradeTracker, usePinsUpgradeTracker, clearStoredUpgradeTracking } =
  await import('@/components/pins/composables/usePinsUpgradeTracker');
const { setAppBackgrounded } = await import('@/utils/appLifecycle');

const POLL_INTERVAL_MS = 3000;
// Node runs a setTimeout of 0 after 1 ms.
const FIRST_POLL_MS = 1;
const RIG_A = '10.0.0.1';
const RIG_B = '10.0.0.2';
const settle = () => new Promise((resolve) => setImmediate(resolve));

function httpError(status, data = {}) {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data };
  return error;
}

function networkError() {
  const error = new Error('Network Error');
  error.code = 'ERR_NETWORK';
  return error;
}

/**
 * A tracker wired to a fake pins store and a scripted daemon. `daemon.respond` decides
 * what each GET /jobs/{id} returns; `daemon.latestCalls` counts /jobs/latest requests.
 */
function setup(t, { ip = RIG_A, status = 'Idle', activeOperation = null, reachable = true } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  setAppBackgrounded(false);
  clearStoredUpgradeTracking();

  const daemon = {
    calls: [],
    latestCalls: 0,
    respond: (id) => ({ jobId: id, status: 'running' }),
  };
  const originalGet = apiPinsService.getPinsDaemonJob;
  const originalLatest = apiPinsService.getPinsDaemonLatestJob;
  apiPinsService.getPinsDaemonJob = async (id) => {
    daemon.calls.push(id);
    const result = daemon.respond(id);
    if (result instanceof Error) throw result;
    return result;
  };
  apiPinsService.getPinsDaemonLatestJob = async () => {
    daemon.latestCalls++;
    return { jobId: 'unrelated-time-sync', status: 'success', exitCode: 0, startedAt: 9e9 };
  };

  const state = {
    ip,
    reachable,
    status: ref(status),
    activeOperation: ref(activeOperation),
    jobId: ref(null),
    logs: [],
  };
  const pinsStore = {
    setCurrentJobId(id) {
      state.jobId.value = id;
    },
    setActiveOperation(op) {
      state.activeOperation.value = op;
    },
  };
  const tracker = createPinsUpgradeTracker({
    t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    appendLog: (message) => state.logs.push(message),
    pinsStore,
    status: state.status,
    jobId: state.jobId,
    activeOperation: state.activeOperation,
    getIp: () => state.ip,
    shouldWaitForApiRecovery: () => !state.reachable,
  });

  t.after(() => {
    tracker.stopUpgradePolling();
    apiPinsService.getPinsDaemonJob = originalGet;
    apiPinsService.getPinsDaemonLatestJob = originalLatest;
    setAppBackgrounded(false);
    clearStoredUpgradeTracking();
  });

  async function tick(ms) {
    t.mock.timers.tick(ms);
    await settle();
    await settle();
  }

  // What the Update tab does on "Start Upgrade" once POST /upgrade answered.
  function startUpgrade(id = 'job-1') {
    state.status.value = 'Running';
    state.activeOperation.value = 'upgrade';
    tracker.resetUpgradeForNewRun();
    tracker.beginUpgradeTrackingFromStart(state.ip, id, { jobId: id, status: 'started' });
  }

  return { tracker, daemon, state, tick, startUpgrade };
}

function storedRecord() {
  return {
    id: localStorage.getItem('lastUpgradeJobId'),
    host: localStorage.getItem('lastUpgradeJobHost'),
    result: JSON.parse(localStorage.getItem('lastUpgradeJobResult') || 'null'),
  };
}

function seedStorage({ id = 'job-1', host = RIG_A, result } = {}) {
  if (id) localStorage.setItem('lastUpgradeJobId', id);
  if (host) localStorage.setItem('lastUpgradeJobHost', host);
  if (result) localStorage.setItem('lastUpgradeJobResult', JSON.stringify(result));
}

// --- Polling cadence (kept from the previous suite) --------------------------------

test('polls the upgrade job on the regular interval', async (t) => {
  const { daemon, tick, startUpgrade } = setup(t);

  startUpgrade();
  await tick(FIRST_POLL_MS);
  assert.equal(daemon.calls.length, 1);

  await tick(POLL_INTERVAL_MS);
  assert.equal(daemon.calls.length, 2);
});

test('holds the job poll while backgrounded and picks it up on foreground', async (t) => {
  const { daemon, tick, startUpgrade } = setup(t);
  setAppBackgrounded(true);

  startUpgrade();
  await tick(FIRST_POLL_MS);
  await tick(POLL_INTERVAL_MS * 3);
  assert.equal(daemon.calls.length, 0);

  // Still a full interval away: the first poll has no delay, and holding it with that same
  // delay would spin the timer through the whole background phase.
  setAppBackgrounded(false);
  await tick(POLL_INTERVAL_MS - 1);
  assert.equal(daemon.calls.length, 0);

  await tick(1);
  assert.equal(daemon.calls.length, 1);
});

// --- Lifecycle -----------------------------------------------------------------------

test('Running -> Success stops the spinner and records the result', async (t) => {
  const { tracker, daemon, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  await tick(FIRST_POLL_MS);
  assert.equal(state.status.value, 'Running');

  daemon.respond = (id) => ({ jobId: id, status: 'success', exitCode: 0 });
  await tick(POLL_INTERVAL_MS);

  assert.equal(state.status.value, 'Success');
  assert.equal(tracker.isUpgradePolling.value, false);
  assert.equal(storedRecord().result.status, 'success');
  const polls = daemon.calls.length;
  await tick(POLL_INTERVAL_MS * 5);
  assert.equal(daemon.calls.length, polls, 'no polling after a final result');
});

test('Running -> Failed shows the exit code and releases the controls', async (t) => {
  const { tracker, daemon, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  daemon.respond = (id) => ({ jobId: id, status: 'failed', exitCode: 100 });
  await tick(FIRST_POLL_MS);

  assert.equal(state.status.value, 'Failed');
  assert.equal(tracker.upgradeExitCode.value, 100);
  assert.equal(tracker.isUpgradePolling.value, false);
});

for (const [finalStatus, uiStatus, exitCode] of [
  ['success', 'Success', 0],
  ['failed', 'Failed', 100],
]) {
  test(`Running -> daemon restart -> ${finalStatus} is not reported as a failure early`, async (t) => {
    const { tracker, daemon, state, tick, startUpgrade } = setup(t);
    startUpgrade();
    await tick(FIRST_POLL_MS);

    // pinsdaemon restarts during its own package update: connection refused for a while.
    daemon.respond = () => networkError();
    await tick(POLL_INTERVAL_MS);
    await tick(2000);
    await tick(4000);
    await tick(8000);
    assert.equal(state.status.value, 'Running');
    assert.equal(tracker.isUpgradePolling.value, true);

    // Back up: the new daemon answers from the persisted record, first still running.
    daemon.respond = (id) => ({ jobId: id, status: 'running' });
    await tick(16000);
    assert.equal(state.status.value, 'Running');

    daemon.respond = (id) => ({ jobId: id, status: finalStatus, exitCode });
    await tick(POLL_INTERVAL_MS);
    assert.equal(state.status.value, uiStatus);
    assert.equal(tracker.upgradeExitCode.value, exitCode);
  });
}

test('a 5xx while the daemon starts up is retried, not treated as failure', async (t) => {
  const { daemon, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  daemon.respond = () => httpError(502);
  await tick(FIRST_POLL_MS);
  await tick(2000);
  assert.equal(state.status.value, 'Running');

  daemon.respond = (id) => ({ jobId: id, status: 'success', exitCode: 0 });
  await tick(4000);
  assert.equal(state.status.value, 'Success');
});

test('a stale record settled by the daemon as unknown ends in Unknown, not a spinner', async (t) => {
  const { tracker, daemon, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  daemon.respond = (id) => ({
    jobId: id,
    status: 'unknown',
    exitCode: null,
    errorCode: 'UPGRADE_OUTCOME_UNKNOWN',
    errorMessage: 'The upgrade process is no longer running and did not record a result.',
  });
  await tick(FIRST_POLL_MS);

  assert.equal(state.status.value, 'Unknown');
  assert.equal(state.activeOperation.value, 'upgrade');
  assert.equal(tracker.isUpgradePolling.value, false);
  assert.equal(storedRecord().id, null, 'nothing left to resume');
  assert.ok(state.logs.some((line) => line.includes('did not record a result')));
});

// --- 404 and unrelated jobs ----------------------------------------------------------

test('/jobs/{id} 404 retries, then ends Unknown without adopting /jobs/latest', async (t) => {
  const { tracker, daemon, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  daemon.respond = () => httpError(404, { detail: 'Job not found' });

  await tick(FIRST_POLL_MS);
  assert.equal(state.status.value, 'Running', 'a single 404 may be a torn read');
  await tick(2000);
  await tick(4000);

  assert.equal(state.status.value, 'Unknown');
  assert.equal(tracker.isUpgradePolling.value, false);
  assert.equal(daemon.latestCalls, 0, 'never falls back to the latest daemon job');
  assert.notEqual(state.jobId.value, 'unrelated-time-sync');
});

test('a 404 followed by the record reappearing keeps tracking the same job', async (t) => {
  const { daemon, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  daemon.respond = () => httpError(404);
  await tick(FIRST_POLL_MS);

  daemon.respond = (id) => ({ jobId: id, status: 'success', exitCode: 0 });
  await tick(2000);
  assert.equal(state.status.value, 'Success');
  assert.equal(state.jobId.value, 'job-1');
});

test('an answer for a different job id is never interpreted as the upgrade', async (t) => {
  const { daemon, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  daemon.respond = () => ({ jobId: 'other-job', status: 'success', exitCode: 0 });
  await tick(FIRST_POLL_MS);

  assert.equal(state.status.value, 'Unknown');
  assert.notEqual(state.jobId.value, 'other-job');
});

test('401 ends in Unknown rather than claiming the upgrade failed', async (t) => {
  const { tracker, daemon, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  daemon.respond = () => httpError(401, { detail: 'Invalid token' });
  await tick(FIRST_POLL_MS);

  assert.equal(state.status.value, 'Unknown');
  assert.equal(tracker.isUpgradePolling.value, false);
});

// --- Restore (reload, remount, PINS re-detection) -----------------------------------

test('stored terminal result while the UI still shows Running applies the result', async (t) => {
  // The original hang: the old restore cleared the job id, left Running, and polled nothing.
  const { tracker, daemon, state, tick } = setup(t, {
    status: 'Running',
    activeOperation: 'upgrade',
  });
  seedStorage({ result: { jobId: 'job-1', status: 'success', exitCode: 0 } });

  tracker.restoreUpgradeState();
  await tick(POLL_INTERVAL_MS);

  assert.equal(state.status.value, 'Success');
  assert.equal(daemon.calls.length, 0);
});

test('stored failed result while the UI shows Running shows Failed with its exit code', async (t) => {
  const { tracker, state } = setup(t, { status: 'Running', activeOperation: 'upgrade' });
  seedStorage({ result: { jobId: 'job-1', status: 'failed', exitCode: 2 } });

  tracker.restoreUpgradeState();

  assert.equal(state.status.value, 'Failed');
  assert.equal(tracker.upgradeExitCode.value, 2);
});

test('reload while running resumes polling the saved job', async (t) => {
  const { tracker, daemon, state, tick } = setup(t);
  seedStorage({ result: { jobId: 'job-1', status: 'running' } });

  tracker.restoreUpgradeState();
  assert.equal(state.status.value, 'Running');
  await tick(FIRST_POLL_MS);
  assert.deepEqual(daemon.calls, ['job-1']);

  daemon.respond = (id) => ({ jobId: id, status: 'success', exitCode: 0 });
  await tick(POLL_INTERVAL_MS);
  assert.equal(state.status.value, 'Success');
});

test('reload after success does not restart the spinner', async (t) => {
  const { tracker, daemon, state, tick } = setup(t);
  seedStorage({ result: { jobId: 'job-1', status: 'success', exitCode: 0 } });

  tracker.restoreUpgradeState();
  await tick(POLL_INTERVAL_MS);

  assert.equal(state.status.value, 'Idle');
  assert.equal(daemon.calls.length, 0);
  assert.equal(storedRecord().id, null);
});

test('reload after failure reports Failed once, then forgets it', async (t) => {
  const { tracker, state } = setup(t);
  seedStorage({ result: { jobId: 'job-1', status: 'failed', exitCode: 100 } });

  tracker.restoreUpgradeState();
  assert.equal(state.status.value, 'Failed');
  assert.equal(tracker.upgradeExitCode.value, 100);
  assert.equal(storedRecord().result, null);
});

test('repeated restores never wipe a Failed result the UI is showing', async (t) => {
  // The wizard step remounts as soon as the overlay closes; it used to reset Failed to Idle.
  const { tracker, daemon, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  daemon.respond = (id) => ({ jobId: id, status: 'failed', exitCode: 100 });
  await tick(FIRST_POLL_MS);

  tracker.restoreUpgradeState();
  tracker.restoreUpgradeState();

  assert.equal(state.status.value, 'Failed');
  assert.equal(tracker.upgradeExitCode.value, 100);
});

test('success recorded while the API is still down keeps the recovery overlay state', async (t) => {
  const { tracker, state } = setup(t, { reachable: false });
  seedStorage({ result: { jobId: 'job-1', status: 'success', exitCode: 0 } });

  tracker.restoreUpgradeState();

  assert.equal(state.status.value, 'Success');
  assert.equal(state.activeOperation.value, 'upgrade');
});

test('restore while already tracking is a no-op', async (t) => {
  const { tracker, daemon, tick, startUpgrade } = setup(t);
  startUpgrade();
  await tick(FIRST_POLL_MS);

  tracker.restoreUpgradeState();
  await tick(FIRST_POLL_MS);
  assert.equal(daemon.calls.length, 1, 'no second poller');
});

test('Running with no saved job id ends Unknown instead of spinning', async (t) => {
  const { tracker, state } = setup(t, { status: 'Running', activeOperation: 'upgrade' });

  tracker.restoreUpgradeState();

  assert.equal(state.status.value, 'Unknown');
});

test('a job id cleared under a running poll ends Unknown, not a silent stop', async (t) => {
  const { tracker, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  await tick(FIRST_POLL_MS);

  state.jobId.value = null;
  localStorage.removeItem('lastUpgradeJobId');
  await tick(POLL_INTERVAL_MS);

  assert.equal(state.status.value, 'Unknown');
  assert.equal(tracker.isUpgradePolling.value, false);
});

// --- Rigs ----------------------------------------------------------------------------

test("another rig's saved upgrade is never resumed or touched", async (t) => {
  const { tracker, daemon, state, tick } = setup(t, { ip: RIG_B });
  seedStorage({ host: RIG_A, result: { jobId: 'job-1', status: 'running' } });

  tracker.restoreUpgradeState();
  await tick(POLL_INTERVAL_MS);

  assert.equal(state.status.value, 'Idle');
  assert.equal(daemon.calls.length, 0);
  assert.equal(storedRecord().id, 'job-1', 'kept for when rig A is selected again');
});

test('switching rigs mid-upgrade stops tracking without claiming a result', async (t) => {
  const { tracker, daemon, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  await tick(FIRST_POLL_MS);

  state.ip = RIG_B;
  await tick(POLL_INTERVAL_MS);

  assert.equal(daemon.calls.length, 1);
  assert.equal(state.status.value, 'Idle');
  assert.equal(tracker.isUpgradePolling.value, false);
  assert.equal(storedRecord().host, RIG_A);
});

// --- Races and duplicates ------------------------------------------------------------

test('a response arriving after tracking was abandoned is ignored', async (t) => {
  const { tracker, daemon, state, tick, startUpgrade } = setup(t);
  let release;
  daemon.respond = (id) =>
    new Promise((resolve) => (release = () => resolve({ jobId: id, status: 'running' })));
  apiPinsService.getPinsDaemonJob = async (id) => daemon.respond(id);
  startUpgrade();
  await tick(FIRST_POLL_MS);

  // Overlay "Close": App.vue resets the store and storage while the request is in flight.
  state.status.value = 'Idle';
  state.activeOperation.value = null;
  state.jobId.value = null;
  clearStoredUpgradeTracking();
  release();
  await settle();
  await tick(POLL_INTERVAL_MS);

  assert.equal(state.status.value, 'Idle', 'the overlay does not come back');
  assert.equal(tracker.isUpgradePolling.value, false);
});

test('409 from POST /upgrade attaches to the running upgrade instead of failing', async (t) => {
  const { tracker, daemon, state, tick } = setup(t);
  const conflict = httpError(409, {
    detail: { message: 'A system upgrade is already running.', jobId: 'job-running' },
  });

  assert.equal(tracker.adoptRunningUpgrade(RIG_A, conflict), true);
  await tick(FIRST_POLL_MS);

  assert.equal(state.status.value, 'Running');
  assert.deepEqual(daemon.calls, ['job-running']);
  assert.equal(tracker.adoptRunningUpgrade(RIG_A, httpError(500)), false);
});

test('the socket closing never hands the upgrade to the generic final-status check', async (t) => {
  const { tracker, daemon, state, tick, startUpgrade } = setup(t);
  startUpgrade();
  await tick(FIRST_POLL_MS);

  assert.equal(tracker.handleUpgradeWsClosed(RIG_A), true);
  await tick(FIRST_POLL_MS);
  assert.equal(daemon.calls.length, 2, 'polls right away');

  daemon.respond = (id) => ({ jobId: id, status: 'failed', exitCode: 1 });
  await tick(POLL_INTERVAL_MS);
  assert.equal(tracker.handleUpgradeWsClosed(RIG_A), true, 'still owned after the final result');
  assert.equal(state.status.value, 'Failed');
});

test('after a final result the controls are released for a new run', async (t) => {
  const { tracker, daemon, state, tick, startUpgrade } = setup(t);
  for (const finalStatus of ['failed', 'unknown', 'success']) {
    startUpgrade(`job-${finalStatus}`);
    daemon.respond = (id) => ({ jobId: id, status: finalStatus, exitCode: 1 });
    await tick(FIRST_POLL_MS);
    assert.notEqual(state.status.value, 'Running', `${finalStatus} leaves the button enabled`);
    assert.equal(tracker.isUpgradePolling.value, false);
  }
});

test('usePinsUpgradeTracker shares one tracker across the Update tab and the wizard', () => {
  const options = {
    t: (key) => key,
    appendLog() {},
    pinsStore: { setCurrentJobId() {}, setActiveOperation() {} },
    status: ref('Idle'),
    jobId: ref(null),
    activeOperation: ref(null),
    getIp: () => RIG_A,
  };
  assert.equal(usePinsUpgradeTracker(options), usePinsUpgradeTracker({ ...options }));
});
