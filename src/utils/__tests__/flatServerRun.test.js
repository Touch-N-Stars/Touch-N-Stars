import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isServerWorkflowStatus,
  mapFilterResults,
  buildServerRunSummary,
} from '@/utils/flatServerRun';

const filter = (overrides) => ({
  FilterId: 0,
  FilterName: 'L',
  State: 'success',
  Completed: 20,
  Count: 20,
  LastADU: 30000,
  DarkState: 'none',
  DarkCompleted: 0,
  DarkCount: 0,
  ...overrides,
});

test('isServerWorkflowStatus() only accepts the plugin-side run', () => {
  assert.equal(isServerWorkflowStatus({ Workflow: 2, State: 'Idle' }), true);
  // The older PINS multi-mode status has no Workflow field.
  assert.equal(isServerWorkflowStatus({ State: 'Finished', TotalIterations: -1 }), false);
  assert.equal(isServerWorkflowStatus(null), false);
});

test('mapFilterResults() keeps final states and clears pending/running ones', () => {
  assert.deepEqual(
    mapFilterResults([
      filter({ FilterId: 0, State: 'success' }),
      filter({ FilterId: 1, State: 'dim' }),
      filter({ FilterId: 2, State: 'running' }),
      filter({ FilterId: 3, State: 'pending' }),
      filter({ FilterId: null, State: 'success' }),
    ]),
    { 0: 'success', 1: 'dim', 2: null, 3: null }
  );
});

test('buildServerRunSummary() reports a successful single-filter run', () => {
  const summary = buildServerRunSummary({ Filters: [filter()], DarkCount: 0, CurrentADU: 31000.4 });
  assert.equal(summary.type, 'flats');
  assert.equal(summary.success, true);
  assert.equal(summary.completed, 20);
  assert.equal(summary.total, 20);
  assert.equal(summary.lastADU, 31000);
  assert.equal(summary.darks, null);
});

test('buildServerRunSummary() names failed filters of a multi-filter run', () => {
  const summary = buildServerRunSummary(
    {
      Filters: [
        filter({ FilterId: 0, FilterName: 'L' }),
        filter({ FilterId: 1, FilterName: 'Ha', State: 'dim', Completed: 0 }),
        filter({ FilterId: 2, FilterName: 'OIII', State: 'failed', Completed: 0 }),
      ],
      DarkCount: 0,
    },
    { dimLabel: 'too dim', brightLabel: 'too bright' }
  );
  assert.equal(summary.type, 'flats-multi');
  assert.equal(summary.success, false);
  assert.equal(summary.completed, 20);
  assert.equal(summary.total, 60);
  assert.deepEqual(summary.failedFilterNames, ['Ha (too dim)', 'OIII']);
});

test('buildServerRunSummary() counts darks only for filters whose flats succeeded', () => {
  const summary = buildServerRunSummary({
    DarkCount: 10,
    Filters: [
      filter({ FilterId: 0, DarkState: 'success', DarkCompleted: 10, DarkCount: 10 }),
      filter({ FilterId: 1, State: 'bright', DarkState: 'skipped', DarkCount: 10 }),
      filter({ FilterId: 2, DarkState: 'stopped', DarkCompleted: 4, DarkCount: 10 }),
    ],
  });
  assert.deepEqual(summary.darks, { completed: 14, total: 20, skipped: false });
});

test('buildServerRunSummary() flags darks the user declined to cover for', () => {
  const summary = buildServerRunSummary({
    DarkCount: 10,
    Filters: [filter({ DarkState: 'skipped', DarkCount: 10 })],
  });
  assert.equal(summary.darks.skipped, true);
});
