import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { useMeridianFlipTestStore } = await import('@/store/meridianFlipTestStore');
const { default: apiService } = await import('@/services/apiService');

const RUN = {
  startedAt: 1,
  runPlan: { expectedMinutes: 9, waitCount: 30 },
  pierBefore: 'pierWest',
};
const TEST_STATE = [
  { GlobalTriggers: [{ Name: 'Meridianflip_Trigger', Status: 'CREATED' }] },
  {
    Name: 'Targets_Container',
    Items: [{ Name: 'TNS meridian flip test_Container', Status: 'RUNNING' }],
  },
];

function setup(t, state) {
  freshPinia();
  localStorage.clear();
  const original = apiService.sequenceAction;
  apiService.sequenceAction = async () => ({ Success: true, Response: state });
  t.after(() => (apiService.sequenceAction = original));
  return useMeridianFlipTestStore();
}

test('restore reopens a test that NINA still runs', async (t) => {
  const store = setup(t, TEST_STATE);
  store.saveRun(RUN);

  await store.restore();

  assert.equal(store.visible, true);
  assert.deepEqual(store.resumeRun, RUN);
});

test('restore forgets a test whose sequence no longer runs', async (t) => {
  const finished = JSON.parse(JSON.stringify(TEST_STATE).replace('RUNNING', 'FINISHED'));
  const store = setup(t, finished);
  store.saveRun(RUN);

  await store.restore();

  assert.equal(store.visible, false);
  freshPinia();
  await useMeridianFlipTestStore().restore();
  assert.equal(useMeridianFlipTestStore().visible, false);
});

test('restore leaves a foreign running sequence alone', async (t) => {
  const store = setup(t, [
    { Name: 'Targets_Container', Items: [{ Name: 'M31', Status: 'RUNNING' }] },
  ]);
  store.saveRun(RUN);

  await store.restore();

  assert.equal(store.visible, false);
});

test('restore does nothing without a remembered run', async (t) => {
  const store = setup(t, TEST_STATE);

  await store.restore();

  assert.equal(store.visible, false);
});
