import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: apiService } = await import('@/services/apiService');
const { useFlatassistantStore } = await import('@/store/flatassistantStore');
const { useToastStore } = await import('@/store/toastStore');
const { useSettingsStore } = await import('@/store/settingsStore');

const original = {
  flatMultiStatus: apiService.flatMultiStatus,
  flatRunConfirmCover: apiService.flatRunConfirmCover,
};

function setup(statusResponder) {
  freshPinia();
  apiService.flatMultiStatus = statusResponder;
  return useFlatassistantStore();
}

test.afterEach(() => {
  Object.assign(apiService, original);
});

const runStatus = (overrides) => ({
  Workflow: 2,
  RunId: 'run-1',
  State: 'Running',
  Type: 'flats',
  Phase: 'flats',
  StopRequested: false,
  WaitingForCover: false,
  TotalIterations: 20,
  CompletedIterations: 5,
  TotalFilters: 2,
  CompletedFilters: 0,
  CurrentFilterName: 'L',
  CurrentADU: 30000,
  BitDepth: 16,
  DarkCount: 0,
  Filters: [
    { FilterId: 0, FilterName: 'L', State: 'running', Completed: 5, Count: 20, DarkState: 'none' },
    { FilterId: 1, FilterName: 'R', State: 'pending', Completed: 0, Count: 20, DarkState: 'none' },
  ],
  ...overrides,
});

test('a 404 marks the plugin as having no plugin-side flat run', async () => {
  const flatsStore = setup(async () => {
    const error = new Error('Not found');
    error.response = { status: 404 };
    throw error;
  });
  assert.equal(await flatsStore.detectServerWorkflow(), false);
  assert.equal(flatsStore.serverWorkflow, false);
});

test('a network error leaves the detection open', async () => {
  const flatsStore = setup(async () => {
    throw new Error('timeout');
  });
  assert.equal(await flatsStore.detectServerWorkflow(), false);
  assert.equal(flatsStore.serverWorkflow, null);
});

test('the older PINS status without Workflow keeps the legacy path', async () => {
  const flatsStore = setup(async () => ({ Response: { State: 'Finished', TotalIterations: -1 } }));
  assert.equal(await flatsStore.detectServerWorkflow(), false);
  assert.equal(flatsStore.serverWorkflow, false);
});

test('a running plugin-side run drives status, filter name and per-filter results', async () => {
  const flatsStore = setup(async () => ({ Response: runStatus() }));
  assert.equal(await flatsStore.detectServerWorkflow(), true);
  assert.equal(flatsStore.status.State, 'Running');
  assert.equal(flatsStore.currentRunType, 'flats-multi');
  assert.equal(flatsStore.currentFilterName, 'L');
  assert.equal(flatsStore.currentADU, 30000);
  assert.deepEqual(flatsStore.filterResults, { 0: null, 1: null });
  assert.equal(flatsStore.lastRun, null);
});

test('a finished run is reported exactly once, also after the app was closed', async () => {
  let status = runStatus();
  const flatsStore = setup(async () => ({ Response: status }));
  await flatsStore.fetchServerRunStatus({ force: true });

  status = runStatus({
    State: 'Finished',
    Phase: 'done',
    Filters: [
      {
        FilterId: 0,
        FilterName: 'L',
        State: 'success',
        Completed: 20,
        Count: 20,
        DarkState: 'none',
      },
      {
        FilterId: 1,
        FilterName: 'R',
        State: 'success',
        Completed: 20,
        Count: 20,
        DarkState: 'none',
      },
    ],
  });
  await flatsStore.fetchServerRunStatus({ force: true });
  assert.equal(flatsStore.lastRun?.success, true);
  assert.equal(flatsStore.lastRun?.total, 40);
  assert.deepEqual(flatsStore.filterResults, { 0: 'success', 1: 'success' });
  assert.equal(useSettingsStore().flats.lastSeenRunId, 'run-1');

  // Fresh app start: the same finished run must not be reported again.
  const reported = useSettingsStore().flats.lastSeenRunId;
  const restarted = setup(async () => ({ Response: status }));
  useSettingsStore().flats.lastSeenRunId = reported;
  await restarted.fetchServerRunStatus({ force: true });
  assert.equal(restarted.lastRun, null);
});

test('the cover question is asked once per run and the answer goes to the plugin', async () => {
  const answers = [];
  const flatsStore = setup(async () => ({
    Response: runStatus({ Phase: 'waiting-for-cover', WaitingForCover: true, Type: 'darks' }),
  }));
  apiService.flatRunConfirmCover = async (confirmed) => {
    answers.push(confirmed);
    return { Success: true };
  };

  await flatsStore.fetchServerRunStatus({ force: true });
  await flatsStore.fetchServerRunStatus({ force: true });

  const toastStore = useToastStore();
  assert.equal(toastStore.isConfirmation, true);
  toastStore.confirmAction();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(answers, [true]);
  assert.equal(flatsStore.currentRunType, 'darks');
});

test('the outcome reports flats and darks as two sentences', () => {
  const flatsStore = setup(async () => ({ Response: runStatus() }));
  flatsStore.commitRunOutcome({
    type: 'flats-multi',
    completed: 40,
    total: 40,
    success: true,
    lastADU: null,
    failedFilterNames: [],
    darks: { completed: 4, total: 4, skipped: false },
  });
  assert.equal(flatsStore.lastRunOutcome.type, 'success');
  assert.equal(flatsStore.lastRunOutcome.message, 'Done - 40 flats captured. 4 darks captured.');
});

test('incomplete darks turn a successful flat run into a warning', () => {
  const flatsStore = setup(async () => ({ Response: runStatus() }));
  flatsStore.commitRunOutcome({
    type: 'flats',
    completed: 20,
    total: 20,
    success: true,
    lastADU: null,
    failedFilterNames: [],
    darks: { completed: 1, total: 2, skipped: false },
  });
  assert.equal(flatsStore.lastRunOutcome.type, 'warning');
  assert.match(flatsStore.lastRunOutcome.message, /Darks: 1 of 2 captured\.$/);
});
