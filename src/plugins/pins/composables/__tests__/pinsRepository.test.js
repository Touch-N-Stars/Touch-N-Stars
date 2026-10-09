import test from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';
import { installBrowserGlobals, freshPinia } from '@/test-helpers/browserEnv.js';

installBrowserGlobals();
freshPinia();
const { default: apiPinsService } = await import('@/services/apiPinsService');
const { usePinsRepository } = await import('../usePinsRepository.js');

function controller() {
  const status = ref('Idle');
  const logs = [];
  const operations = [];
  let refreshes = 0;
  return {
    status,
    logs,
    operations,
    get refreshes() {
      return refreshes;
    },
    ...usePinsRepository({
      t: (key) => key,
      status,
      pinsStore: { setActiveOperation: (operation) => operations.push(operation) },
      appendLog: (line) => logs.push(line),
      refreshPackages: async () => {
        refreshes += 1;
      },
    }),
  };
}

test('successful switch waits for job then reloads actual channel and package lists', async (t) => {
  const calls = [];
  t.mock.method(apiPinsService, 'setPinsRepository', async (channel) => {
    calls.push(channel);
    return { jobId: 'repo-1' };
  });
  t.mock.method(apiPinsService, 'getPinsDaemonJob', async () => ({
    status: 'success',
    exitCode: 0,
  }));
  t.mock.method(apiPinsService, 'getPinsRepository', async () => ({ channel: 'unstable' }));
  const state = controller();
  await state.switchRepository('unstable');
  assert.equal(state.status.value, 'Success');
  assert.equal(state.repository.value.channel, 'unstable');
  assert.equal(state.repositorySwitching.value, false);
  assert.equal(state.refreshes, 1);
  assert.deepEqual(calls, ['unstable']);
  assert.deepEqual(state.operations, ['repository']);
});

test('failed jobs reload rolled-back status and retain a visible error', async (t) => {
  t.mock.method(apiPinsService, 'setPinsRepository', async () => ({ jobId: 'repo-2' }));
  t.mock.method(apiPinsService, 'getPinsDaemonJob', async () => ({
    status: 'failed',
    exitCode: 100,
  }));
  t.mock.method(apiPinsService, 'getPinsRepository', async () => ({ channel: 'trixie' }));
  const state = controller();
  await state.switchRepository('unstable');
  assert.equal(state.status.value, 'Failed');
  assert.equal(state.repository.value.channel, 'trixie');
  assert.match(state.repositoryError.value, /SwitchFailed/);
  assert.equal(state.refreshes, 1);
});

test('older daemons disable switching with an actionable message', async (t) => {
  t.mock.method(apiPinsService, 'getPinsRepository', async () => {
    throw Object.assign(new Error('Not Found'), { response: { status: 404 } });
  });
  const state = controller();
  await state.loadRepository();
  assert.equal(state.repository.value, null);
  assert.match(state.repositoryError.value, /Unavailable/);
});

test('an active package job prevents concurrent repository changes', async (t) => {
  let calls = 0;
  t.mock.method(apiPinsService, 'setPinsRepository', async () => {
    calls += 1;
  });
  const state = controller();
  state.status.value = 'Running';
  await state.switchRepository('unstable');
  assert.equal(calls, 0);
});
