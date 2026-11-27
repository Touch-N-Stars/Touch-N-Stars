import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { useFlatassistantStore } = await import('@/store/flatassistantStore');

// ninaAPI's /flats/status as polled by the legacy (non plugin-side) flat run.
const ninaStatus = (overrides) => ({
  State: 'Running',
  TotalIterations: 20,
  CompletedIterations: 5,
  CurrentADU: 30000,
  ...overrides,
});

// Answers the given statuses one per poll and repeats the last one.
function statusSequence(...statuses) {
  let i = 0;
  return async () => ({ Response: statuses[Math.min(i++, statuses.length - 1)] });
}

function setup() {
  freshPinia();
  const flatsStore = useFlatassistantStore();
  flatsStore.startManagedRun('flats');
  return flatsStore;
}

test('a failed run ends at once and carries the reason', async () => {
  const flatsStore = setup();
  const result = await flatsStore.waitForCompletion(
    statusSequence(ninaStatus(), ninaStatus({ State: 'Failed', Error: 'No valid exposure' })),
    0
  );
  assert.equal(result.error, 'No valid exposure');
  assert.equal(result.completed, 5);
  assert.equal(result.total, 20);
  assert.equal(flatsStore.workflowStopRequested, false);
});

test('a run cancelled elsewhere counts as a stop', async () => {
  const flatsStore = setup();
  const result = await flatsStore.waitForCompletion(
    statusSequence(ninaStatus(), ninaStatus({ State: 'Cancelled' })),
    0
  );
  assert.equal(result.error, null);
  assert.equal(flatsStore.workflowStopRequested, true);

  flatsStore.commitRunOutcome({ type: 'flats', ...result, success: false, lastADU: null });
  assert.equal(flatsStore.lastRunOutcome.type, 'warning');
  assert.equal(flatsStore.lastRunOutcome.message, 'Stopped early - 5 of 20 flats captured');
});

test('a run cancelled before its first flat is a stop, not a failed exposure search', async () => {
  const flatsStore = setup();
  // As seen on PINS: ninaAPI zeroes the counts once the run is cancelled.
  const result = await flatsStore.waitForCompletion(
    statusSequence(
      ninaStatus({ TotalIterations: 3, CompletedIterations: 0 }),
      ninaStatus({ State: 'Cancelled', TotalIterations: -1, CompletedIterations: -1 })
    ),
    0
  );
  flatsStore.commitRunOutcome({ type: 'flats', ...result, success: false, lastADU: null });
  assert.equal(flatsStore.lastRunOutcome.type, 'warning');
  assert.equal(flatsStore.lastRunOutcome.message, 'Stopped early - 0 of 3 flats captured');
});

test('a stale Failed state of an earlier run does not end the new one', async () => {
  const flatsStore = setup();
  const result = await flatsStore.waitForCompletion(
    statusSequence(
      ninaStatus({ State: 'Failed', Error: 'old run' }),
      ninaStatus(),
      ninaStatus({ State: 'Finished', CompletedIterations: 20 })
    ),
    0
  );
  assert.equal(result.error, null);
  assert.equal(result.status.State, 'Finished');
});

test('the outcome of a failed run names the backend reason', () => {
  const flatsStore = setup();
  flatsStore.commitRunOutcome({
    type: 'flats',
    completed: 0,
    total: 20,
    success: false,
    lastADU: null,
    error: 'Camera not connected',
  });
  assert.equal(flatsStore.lastRunOutcome.type, 'error');
  assert.equal(
    flatsStore.lastRunOutcome.message,
    'Could not determine valid exposure. Camera not connected'
  );
});
