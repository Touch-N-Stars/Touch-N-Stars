import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { useSequenceV2Store } = await import('@/store/sequenceV2Store');
const { useSequenceStore } = await import('@/store/sequenceStore');
const { default: apiService } = await import('@/services/apiService');

const DSO = 'NINA.Sequencer.Container.DeepSkyObjectContainer';

function dso(id, status = 'CREATED') {
  return { Id: id, FullTypeName: DSO, Status: status, Items: [] };
}

function tree(dsos) {
  return [
    { Id: 'root', GlobalTriggers: [] },
    {
      Id: 'targets',
      FullTypeName: 'NINA.Sequencer.Container.TargetAreaContainer',
      Items: dsos,
    },
  ];
}

// The endpoints are swapped on the apiService facade; refresh() is replaced with a callback
// that plays the backend's part (apiStore().isBackendReachable is false in tests, so the
// real refresh would not reload anything).
function setup({ duplicate = async () => ({ Success: true }), afterRefresh = () => {} } = {}) {
  freshPinia();
  const store = useSequenceV2Store();
  store.data = tree([dso('m31'), dso('m42'), dso('m45')]);
  store.refresh = async () => afterRefresh(store);

  const calls = [];
  const original = {
    sequenceDuplicate: apiService.sequenceDuplicate,
    sequenceMove: apiService.sequenceMove,
  };
  apiService.sequenceDuplicate = async (...args) => {
    calls.push({ name: 'sequenceDuplicate', args });
    return duplicate(...args);
  };
  apiService.sequenceMove = async (...args) => {
    calls.push({ name: 'sequenceMove', args });
    return { Success: true };
  };
  const restore = () => Object.assign(apiService, original);
  return { store, calls, restore };
}

test('copyDsoTarget returns the Id of the container that appeared', async (t) => {
  const { store, calls, restore } = setup({
    afterRefresh: (s) => s.data[1].Items.splice(1, 0, dso('m31-copy')),
  });
  t.after(restore);

  const result = await store.copyDsoTarget('m31');

  assert.deepEqual(result, { ok: true, id: 'm31-copy' });
  assert.deepEqual(calls, [{ name: 'sequenceDuplicate', args: ['m31'] }]);
});

test('copyDsoTarget reports a rejected duplicate', async (t) => {
  const { store, restore } = setup({
    duplicate: async () => ({ Success: false, Error: 'nope' }),
  });
  t.after(restore);

  assert.deepEqual(await store.copyDsoTarget('m31'), { ok: false, error: 'nope' });
});

test('copyDsoTarget fails when no new container shows up', async (t) => {
  const { store, restore } = setup();
  t.after(restore);

  assert.deepEqual(await store.copyDsoTarget('m31'), { ok: false });
});

test('copyDsoTarget is refused while the controls are locked', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);
  useSequenceStore().sequenceControlsLocked = true;

  assert.deepEqual(await store.copyDsoTarget('m31'), { ok: false, locked: true });
  assert.deepEqual(calls, []);
});

test('moveDsoTarget moves before the previous and after the next target', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);

  await store.moveDsoTarget('m42', -1);
  await store.moveDsoTarget('m42', 1);

  assert.deepEqual(calls, [
    { name: 'sequenceMove', args: ['m42', 'm31', false] },
    { name: 'sequenceMove', args: ['m42', 'm45', true] },
  ]);
});

test('moveDsoTarget does nothing at the ends of the list or for a running target', async (t) => {
  const { store, calls, restore } = setup();
  t.after(restore);
  store.data[1].Items[2].Status = 'RUNNING';

  await store.moveDsoTarget('m31', -1);
  await store.moveDsoTarget('m45', 1);
  await store.moveDsoTarget('m45', -1);
  await store.moveDsoTarget('unknown', 1);

  assert.deepEqual(calls, []);
});
