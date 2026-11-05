import test from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';
import { installBrowserGlobals } from '../../../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the service's transitive imports touch browser APIs.
const { default: apiPinsService } = await import('@/services/apiPinsService');
const { usePinsUpgradeTracker } =
  await import('@/components/pins/composables/usePinsUpgradeTracker');
const { setAppBackgrounded } = await import('@/utils/appLifecycle');

const POLL_INTERVAL_MS = 3000;
// Node runs a setTimeout of 0 after 1 ms.
const FIRST_POLL_MS = 1;
const settle = () => new Promise((resolve) => setImmediate(resolve));

function startTracker(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  setAppBackgrounded(false);

  const counter = { polls: 0 };
  const original = apiPinsService.getPinsDaemonJob;
  apiPinsService.getPinsDaemonJob = async () => {
    counter.polls++;
    return { jobId: 'job-1', status: 'running' };
  };

  const jobId = ref('');
  const tracker = usePinsUpgradeTracker({
    t: (key) => key,
    appendLog() {},
    pinsStore: {
      setCurrentJobId(id) {
        jobId.value = id;
      },
      setActiveOperation() {},
    },
    status: ref(''),
    jobId,
    activeOperation: ref(''),
    getIp: () => '10.0.0.1',
  });
  t.after(() => {
    tracker.stopUpgradePolling();
    apiPinsService.getPinsDaemonJob = original;
    setAppBackgrounded(false);
  });
  return { counter, tracker };
}

test('polls the upgrade job on the regular interval', async (t) => {
  const { counter, tracker } = startTracker(t);

  tracker.beginUpgradeTrackingFromStart('10.0.0.1', 'job-1', null);
  t.mock.timers.tick(FIRST_POLL_MS);
  await settle();
  assert.equal(counter.polls, 1);

  t.mock.timers.tick(POLL_INTERVAL_MS);
  await settle();
  assert.equal(counter.polls, 2);
});

test('holds the job poll while backgrounded and picks it up on foreground', async (t) => {
  const { counter, tracker } = startTracker(t);
  setAppBackgrounded(true);

  tracker.beginUpgradeTrackingFromStart('10.0.0.1', 'job-1', null);
  t.mock.timers.tick(FIRST_POLL_MS);
  t.mock.timers.tick(POLL_INTERVAL_MS * 3);
  await settle();
  assert.equal(counter.polls, 0);

  // Still a full interval away: the first poll has no delay, and holding it with that same
  // delay would spin the timer through the whole background phase.
  setAppBackgrounded(false);
  t.mock.timers.tick(POLL_INTERVAL_MS - 1);
  await settle();
  assert.equal(counter.polls, 0);

  t.mock.timers.tick(1);
  await settle();
  assert.equal(counter.polls, 1);
});
