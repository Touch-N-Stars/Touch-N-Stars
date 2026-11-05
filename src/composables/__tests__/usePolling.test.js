import test from 'node:test';
import assert from 'node:assert/strict';
import { usePolling } from '@/composables/usePolling';
import { setAppBackgrounded } from '@/utils/appLifecycle';
import {
  advanceIntervals,
  mountComposable,
  setBackgrounded,
} from '../../test-helpers/pollingTestEnv.js';

const INTERVAL_MS = 1000;

function setup(t, options) {
  t.mock.timers.enable({ apis: ['setInterval'] });
  setAppBackgrounded(false);

  const counter = { calls: 0 };
  const { result: poller, unmount } = mountComposable(() =>
    usePolling(() => counter.calls++, INTERVAL_MS, options)
  );
  t.after(() => {
    unmount();
    setAppBackgrounded(false);
  });
  return { counter, poller, unmount };
}

const advance = (t, intervals) => advanceIntervals(t, INTERVAL_MS, intervals);

test('polls immediately on mount and stops on unmount', async (t) => {
  const { counter, unmount } = setup(t);
  assert.equal(counter.calls, 1);

  await advance(t, 2);
  assert.equal(counter.calls, 3);

  unmount();
  await advance(t, 2);
  assert.equal(counter.calls, 3);
});

test('pauses while the app is backgrounded', async (t) => {
  const { counter, poller } = setup(t);
  const before = counter.calls;

  await setBackgrounded(true);
  await advance(t, 3);

  assert.equal(counter.calls, before);
  assert.equal(poller.isRunning(), false);
});

test('resumes on foreground on the regular interval, without an immediate tick', async (t) => {
  // An immediate tick would start before App.vue aborts stale requests on resume, and the
  // aborted request resolves as an empty response that callers write into their stores.
  const { counter, poller } = setup(t, { immediate: true });
  await setBackgrounded(true);
  const before = counter.calls;

  await setBackgrounded(false);
  assert.equal(poller.isRunning(), true);
  assert.equal(counter.calls, before);

  await advance(t);
  assert.equal(counter.calls, before + 1);
});

test('foreground does not start a poller that was never started', async (t) => {
  const { counter, poller } = setup(t, { autoStart: false, immediate: false });

  await setBackgrounded(true);
  await setBackgrounded(false);
  await advance(t, 2);

  assert.equal(poller.isRunning(), false);
  assert.equal(counter.calls, 0);
});

test('foreground does not revive a poller stopped by the caller', async (t) => {
  const { counter, poller } = setup(t);
  poller.stop();
  const before = counter.calls;

  await setBackgrounded(true);
  await setBackgrounded(false);
  await advance(t, 2);

  assert.equal(poller.isRunning(), false);
  assert.equal(counter.calls, before);
});

test('start() while backgrounded waits for the foreground', async (t) => {
  const { counter, poller } = setup(t, { autoStart: false, immediate: false });
  await setBackgrounded(true);

  poller.start();
  await advance(t, 2);
  assert.equal(poller.isRunning(), false);
  assert.equal(counter.calls, 0);

  await setBackgrounded(false);
  await advance(t);
  assert.equal(counter.calls, 1);
});

test('foreground does not revive a poller unmounted while backgrounded', async (t) => {
  const { counter, poller, unmount } = setup(t);
  await setBackgrounded(true);
  unmount();
  const before = counter.calls;

  await setBackgrounded(false);
  await advance(t, 2);

  assert.equal(poller.isRunning(), false);
  assert.equal(counter.calls, before);
});
