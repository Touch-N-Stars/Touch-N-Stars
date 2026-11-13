import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '@/test-helpers/browserEnv.js';

installBrowserGlobals();
freshPinia();
const { default: apiService } = await import('@/services/apiService');
const { doneMessageKey, useSecureObservatoryStore } = await import('../secureObservatoryStore.js');
const { useToastStore } = await import('../toastStore.js');

// One Pinia for the whole file (apiService caches its store references); reset per test.
const store = useSecureObservatoryStore();
const toast = useToastStore();

const status = (state, steps = []) => ({
  supported: true,
  status: { state, startedAt: `start-${state}-${steps.length}`, steps },
});

function reset() {
  store.stopPolling();
  store.$reset();
  toast.$reset();
}

test('a plugin without the endpoint is reported as unsupported', async (t) => {
  reset();
  t.mock.method(apiService, 'secureObservatoryStatus', async () => ({
    supported: false,
    status: null,
  }));

  store.openDialog();
  await store.refresh();

  assert.equal(store.supported, false);
  assert.equal(store.status, null);
});

test('start sends the chosen steps and polls while it runs', async (t) => {
  reset();
  let sent;
  t.mock.method(apiService, 'secureObservatoryStart', async (options) => {
    sent = options;
    return status('running', [{ id: 'park_mount', state: 'running', message: '' }]);
  });

  await store.start({ park: true, closeDome: false });

  assert.deepEqual(sent, { park: true, closeDome: false });
  assert.equal(store.running, true);
  assert.ok(store.pollTimer, 'polls while running');
  store.stopPolling();
});

test('a start the server refuses shows an error', async (t) => {
  reset();
  t.mock.method(apiService, 'secureObservatoryStart', async () => ({
    supported: true,
    status: null,
    error: 'boom',
  }));

  await store.start({});

  assert.equal(store.error, 'boom');
  assert.equal(store.running, false);
});

test('the end of a run is toasted once when the dialog is closed', async () => {
  reset();
  store.apply(status('running', [{ id: 'park_mount', state: 'running' }]));
  store.apply({
    supported: true,
    status: { state: 'done', startedAt: 'run-1', steps: [{ id: 'park_mount', state: 'done' }] },
  });

  assert.equal(store.pollTimer, null);
  assert.equal(toast.type, 'success');
  assert.equal(toast.newMessage, true);

  toast.$reset();
  store.apply(status('running'));
  store.apply({ supported: true, status: { state: 'done', startedAt: 'run-1', steps: [] } });
  assert.equal(toast.newMessage, false, 'the same run is not reported twice');
  store.stopPolling();
});

test('a failed run stays on screen and names the failed steps', async () => {
  reset();
  store.apply(status('running'));
  store.apply({
    supported: true,
    status: {
      state: 'failed',
      startedAt: 'run-2',
      steps: [
        { id: 'park_mount', state: 'failed', message: 'x' },
        { id: 'close_dome', state: 'failed', message: 'y' },
      ],
    },
  });

  assert.equal(toast.type, 'error');
  assert.equal(toast.autoClose, false);
  assert.match(toast.message, /park/i);
  assert.match(toast.message, /dome/i);
});

test('with the dialog open the result is not toasted', async () => {
  reset();
  store.showDialog = true;
  store.apply(status('running'));
  store.apply({ supported: true, status: { state: 'done', startedAt: 'run-3', steps: [] } });

  assert.equal(toast.newMessage, false);
});

test('a run where every step was skipped says nothing was connected', () => {
  assert.equal(
    doneMessageKey({ steps: [{ state: 'skipped' }, { state: 'skipped' }] }),
    'components.secureObservatory.result.nothing'
  );
  assert.equal(
    doneMessageKey({ steps: [{ state: 'skipped' }, { state: 'done' }] }),
    'components.secureObservatory.result.done'
  );
  assert.equal(doneMessageKey({ steps: [] }), 'components.secureObservatory.result.done');
});
