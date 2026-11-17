import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../../../test-helpers/browserEnv.js';

installBrowserGlobals();
freshPinia();

const { default: apiPinsService } = await import('@/services/apiPinsService');
const { pollJobUntilFinished } = await import('../pinsJobPolling.js');

test('job polling can tolerate configured transient request failures', async (t) => {
  let attempts = 0;
  t.mock.method(apiPinsService, 'getPinsDaemonJob', async () => {
    attempts += 1;
    if (attempts <= 2) throw new Error('temporary disconnect');
    return { status: 'completed' };
  });

  const result = await pollJobUntilFinished('localization-1', {
    intervalMs: 0,
    maxAttempts: 3,
    maxConsecutiveErrors: 2,
  });

  assert.equal(result.success, true);
  assert.equal(attempts, 3);
});

test('job polling still rejects after the configured error tolerance is exceeded', async (t) => {
  t.mock.method(apiPinsService, 'getPinsDaemonJob', async () => {
    throw new Error('connection unavailable');
  });

  await assert.rejects(
    pollJobUntilFinished('localization-2', {
      intervalMs: 0,
      maxAttempts: 3,
      maxConsecutiveErrors: 1,
    }),
    /connection unavailable/
  );
});
