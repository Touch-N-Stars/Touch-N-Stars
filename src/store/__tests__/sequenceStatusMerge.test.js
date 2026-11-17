import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { useSequenceV2Store } = await import('@/store/sequenceV2Store');
const { apiStore } = await import('@/store/store');
const { default: apiService } = await import('@/services/apiService');
const { useToastStore } = await import('@/store/toastStore');

function tree() {
  return [
    { Id: 'id_1', GlobalTriggers: [{ Id: 'id_2', Status: 'CREATED' }] },
    {
      Id: 'id_3',
      Items: [
        {
          Id: 'id_4',
          Status: 'CREATED',
          Items: [{ Id: 'id_5', Status: 'CREATED', CompletedIterations: 0 }],
          Conditions: [{ Id: 'id_6', Status: 'CREATED', RemainingTime: '01:00:00' }],
        },
      ],
    },
  ];
}

// Swaps facade endpoints for the duration of one test. The facade is a plain object,
// so the stores pick the replacements up directly.
function mockApi(t, overrides) {
  const original = {};
  const calls = [];
  for (const [name, impl] of Object.entries(overrides)) {
    original[name] = apiService[name];
    apiService[name] = async (...args) => {
      calls.push(name);
      return impl(...args);
    };
  }
  t.after(() => Object.assign(apiService, original));
  return calls;
}

function setup() {
  freshPinia();
  apiStore().isBackendReachable = true;
  return useSequenceV2Store();
}

function notFound() {
  const error = new Error('404');
  error.response = { status: 404, data: '<html></html>' };
  throw error;
}

test('an unchanged revision only merges status and runtime fields by Id', async (t) => {
  const store = setup();
  store.data = tree();
  store.loaded = true;
  store.revision = 'rev-a';
  const heldItem = store.findById('id_5');

  const calls = mockApi(t, {
    fetchSequenceStatus: () => ({
      Revision: 'rev-a',
      Items: [
        { Id: 'id_5', Status: 'RUNNING', CompletedIterations: 3 },
        { Id: 'id_6', Status: 'RUNNING', RemainingTime: '00:59:58' },
        { Id: 'id_2', Status: 'FINISHED' },
        { Id: 'unknown', Status: 'RUNNING' },
      ],
    }),
    fetchSequenceCurrent: () => assert.fail('no reload for an unchanged structure'),
  });

  await store.fetchStatusUpdate();

  assert.deepEqual(calls, ['fetchSequenceStatus']);
  assert.equal(store.findById('id_5'), heldItem, 'existing objects are updated in place');
  assert.equal(heldItem.Status, 'RUNNING');
  assert.equal(heldItem.CompletedIterations, 3);
  assert.equal(store.findById('id_6').RemainingTime, '00:59:58');
  assert.equal(store.findById('id_2').Status, 'FINISHED', 'global triggers are reached too');
});

test('a changed revision reloads the tree and stores the new revision', async (t) => {
  const store = setup();
  store.data = tree();
  store.loaded = true;
  store.revision = 'rev-a';

  const reloaded = tree();
  reloaded[1].Items.push({ Id: 'id_7', Status: 'CREATED' });
  const calls = mockApi(t, {
    fetchSequenceStatus: () => ({
      Revision: 'rev-b',
      Items: [{ Id: 'id_7', Status: 'RUNNING' }],
    }),
    fetchSequenceCurrent: () => reloaded,
  });

  await store.fetchStatusUpdate();

  assert.deepEqual(calls, ['fetchSequenceStatus', 'fetchSequenceCurrent']);
  assert.equal(store.revision, 'rev-b');
  assert.equal(store.findById('id_7').Status, 'RUNNING', 'status is merged into the new tree');
});

test('a failed reload keeps the old revision so the next tick tries again', async (t) => {
  const store = setup();
  store.data = tree();
  store.loaded = true;
  store.revision = 'rev-a';

  mockApi(t, {
    fetchSequenceStatus: () => ({ Revision: 'rev-b', Items: [] }),
    fetchSequenceCurrent: () => {
      throw new Error('network');
    },
  });

  await store.fetchStatusUpdate();

  assert.equal(store.revision, 'rev-a');
});

test('refresh() forces a reload even when the revision did not change', async (t) => {
  const store = setup();
  store.data = tree();
  store.loaded = true;
  store.revision = 'rev-a';

  const calls = mockApi(t, {
    fetchSequenceStatus: () => ({ Revision: 'rev-a', Items: [] }),
    fetchSequenceCurrent: () => tree(),
  });

  // An own property edit keeps the structure (and so the revision) unchanged
  await store.refresh();

  assert.deepEqual(calls, ['fetchSequenceStatus', 'fetchSequenceCurrent']);
  assert.equal(store.revision, 'rev-a');
});

test('a plugin without /sequence/status falls back to the ninaAPI json tree', async (t) => {
  const store = setup();
  store.data = tree();
  store.loaded = true;

  const calls = mockApi(t, {
    fetchSequenceStatus: notFound,
    sequenceAction: () => ({ Response: tree() }),
  });

  await store.fetchStatusUpdate();
  await store.fetchStatusUpdate();

  assert.equal(store.statusEndpointSupported, false);
  assert.deepEqual(
    calls,
    ['fetchSequenceStatus', 'sequenceAction', 'sequenceAction'],
    'the missing endpoint is probed only once'
  );
});

// Older PINS images: the endpoint is missing, and depending on the server the answer is not
// always a clean 404. Anything that is not the endpoint's own JSON must lead to the fallback.
for (const [label, answer] of [
  ['an HTML page with 200', () => '<!doctype html><html></html>'],
  [
    'an HTML error page with 500',
    () => {
      const error = new Error('500');
      error.response = { status: 500, data: '<html>error</html>' };
      throw error;
    },
  ],
]) {
  test(`${label} from /sequence/status switches to the fallback`, async (t) => {
    const store = setup();
    store.data = tree();
    store.loaded = true;

    const calls = mockApi(t, {
      fetchSequenceStatus: answer,
      sequenceAction: () => ({ Response: tree() }),
    });

    await store.fetchStatusUpdate();

    assert.equal(store.statusEndpointSupported, false);
    assert.deepEqual(calls, ['fetchSequenceStatus', 'sequenceAction']);
  });
}

test('a JSON error from /sequence/status (e.g. no sequence loaded) is transient', async (t) => {
  const store = setup();
  store.data = tree();
  store.loaded = true;

  const calls = mockApi(t, {
    fetchSequenceStatus: () => {
      const error = new Error('400');
      error.response = { status: 400, data: { Success: false, Error: 'No sequence loaded' } };
      throw error;
    },
    sequenceAction: () => assert.fail('no fallback for an answer from the endpoint itself'),
  });

  await store.fetchStatusUpdate();

  assert.equal(store.statusEndpointSupported, null);
  assert.deepEqual(calls, ['fetchSequenceStatus']);
});

test('PINS never probes for the sequence editor', async (t) => {
  freshPinia();
  const store = apiStore();
  store.isTnsPluginConnected = true;
  store.isPINS = true;
  const calls = mockApi(t, { probeSequenceEditorSupport: () => true });

  await store.checkSequenceEditorSupport();

  assert.deepEqual(calls, []);
  assert.equal(store.sequenceEditorAvailable, true);
});

test('a transient status error neither reloads nor switches to the fallback', async (t) => {
  const store = setup();
  store.data = tree();
  store.loaded = true;
  store.revision = 'rev-a';

  const calls = mockApi(t, {
    fetchSequenceStatus: () => {
      throw new Error('timeout');
    },
    sequenceAction: () => assert.fail('no fallback on a transient error'),
  });

  await store.fetchStatusUpdate();

  assert.deepEqual(calls, ['fetchSequenceStatus']);
  assert.equal(store.statusEndpointSupported, null);
});

// --- feature detection -------------------------------------------------------

function setupProbe() {
  freshPinia();
  const store = apiStore();
  store.isTnsPluginConnected = true;
  return store;
}

test('the sequence editor is available on NINA once the probe succeeds', async (t) => {
  const store = setupProbe();
  const calls = mockApi(t, { probeSequenceEditorSupport: () => true });

  assert.equal(store.sequenceEditorDetectionPending, true);
  await store.checkSequenceEditorSupport();
  await store.checkSequenceEditorSupport();

  assert.equal(store.sequenceEditorAvailable, true);
  assert.deepEqual(calls, ['probeSequenceEditorSupport'], 'a positive result latches');
});

test('an older plugin keeps the legacy view and is not re-probed every cycle', async (t) => {
  const store = setupProbe();
  store.pinsCheckResolvedOnce = true;
  const calls = mockApi(t, { probeSequenceEditorSupport: () => false });

  await store.checkSequenceEditorSupport();
  await store.checkSequenceEditorSupport();

  assert.equal(store.sequenceEditorAvailable, false);
  assert.equal(store.sequenceEditorDetectionPending, false);
  assert.deepEqual(calls, ['probeSequenceEditorSupport']);
});

test('no answer from the probe leaves the result open for the next cycle', async (t) => {
  const store = setupProbe();
  const calls = mockApi(t, { probeSequenceEditorSupport: () => null });

  await store.checkSequenceEditorSupport();
  await store.checkSequenceEditorSupport();

  assert.equal(store.sequenceEditorSupported, null);
  assert.equal(calls.length, 2);
});

test('PINS always uses the sequence editor', () => {
  const store = setupProbe();
  store.isPINS = true;

  assert.equal(store.sequenceEditorAvailable, true);
  assert.equal(store.sequenceEditorDetectionPending, false);
});

test('clearAllStates() drops the probe result', () => {
  const store = setupProbe();
  store.sequenceEditorSupported = true;

  store.clearAllStates();

  assert.equal(store.sequenceEditorSupported, null);
});

// --- property edits ---------------------------------------------------------------

function rejectedWith(message) {
  const error = new Error('400');
  error.response = { status: 400, data: { Success: false, Error: message } };
  throw error;
}

test('a rejected property edit is reported instead of silently reverting', async (t) => {
  const store = setup();
  store.data = tree();
  store.loaded = true;
  mockApi(t, {
    sequenceSetProperty: () => rejectedWith("'X' is not a valid value for 'SelectedMode'"),
    fetchSequenceStatus: () => ({ Revision: 'rev-a', Items: [] }),
    fetchSequenceCurrent: () => tree(),
  });

  const ok = await store.setProperty('id_5', 'SelectedMode', 'X');

  const toast = useToastStore();
  assert.equal(ok, false);
  assert.equal(toast.type, 'error');
  assert.match(toast.message, /not a valid value/);
});

test('an accepted property edit shows no error', async (t) => {
  const store = setup();
  store.data = tree();
  store.loaded = true;
  mockApi(t, {
    sequenceSetProperty: () => ({ Success: true }),
    fetchSequenceStatus: () => ({ Revision: 'rev-a', Items: [] }),
    fetchSequenceCurrent: () => tree(),
  });

  const ok = await store.setProperty('id_5', 'ExposureTime', 30);

  assert.equal(ok, true);
  assert.equal(useToastStore().newMessage, false);
});

test('missing field metadata (older plugin) falls back to null without logging', async (t) => {
  const store = setup();
  mockApi(t, { sequenceFetchFields: notFound });

  assert.equal(await store.fetchEditableFields('id_5'), null);
});
