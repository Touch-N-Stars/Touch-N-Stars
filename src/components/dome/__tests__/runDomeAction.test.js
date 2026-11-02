import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: apiService } = await import('@/services/apiService');
const { useToastStore } = await import('@/store/toastStore');
const { runDomeAction } = await import('@/components/dome/runDomeAction');

const originalDomeAction = apiService.domeAction;
test.afterEach(() => {
  apiService.domeAction = originalDomeAction;
});

function run(response) {
  freshPinia();
  apiService.domeAction = async () => response;
  const statusClass = { value: '' };
  return runDomeAction('close', statusClass, 'components.dome.control.errors.close').then(() => ({
    statusClass,
    toastStore: useToastStore(),
  }));
}

test('a refused dome action flashes red and toasts the server reason', async () => {
  const { statusClass, toastStore } = await run({
    Success: false,
    StatusCode: 409,
    Error: 'Shutter is closing',
  });
  assert.equal(statusClass.value, 'glow-red');
  assert.equal(toastStore.newMessage, true);
  assert.equal(toastStore.message, 'Shutter is closing');
});

test('a dome action canceled on app resume shows neither a failure nor a success', async () => {
  const { statusClass, toastStore } = await run({
    Success: false,
    StatusCode: 499,
    Error: 'Request canceled',
  });
  assert.equal(statusClass.value, '');
  assert.equal(toastStore.newMessage, false);
});

test('an accepted dome action flashes green', async () => {
  const { statusClass, toastStore } = await run({ Success: true, Response: 'Closing' });
  assert.equal(statusClass.value, 'glow-green');
  assert.equal(toastStore.newMessage, false);
});
