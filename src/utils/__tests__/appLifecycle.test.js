import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTick, ref } from 'vue';
import { setAppBackgrounded, useBackgroundAwarePolling } from '@/utils/appLifecycle';
import {
  advanceIntervals,
  mountComposable,
  setBackgrounded,
} from '../../test-helpers/pollingTestEnv.js';

const INTERVAL_MS = 1000;

function setup(t, options, active = true) {
  t.mock.timers.enable({ apis: ['setInterval'] });
  setAppBackgrounded(false);

  const counter = { calls: 0 };
  const activeRef = ref(active);
  const { result: poller, unmount } = mountComposable(() =>
    useBackgroundAwarePolling(() => counter.calls++, INTERVAL_MS, activeRef, options)
  );
  t.after(() => {
    unmount();
    setAppBackgrounded(false);
  });
  return { counter, poller, activeRef };
}

test('pauses while the app is backgrounded', async (t) => {
  const { counter, poller } = setup(t, { immediate: true });
  assert.equal(counter.calls, 1);

  await setBackgrounded(true);
  await advanceIntervals(t, INTERVAL_MS, 3);

  assert.equal(counter.calls, 1);
  assert.equal(poller.isRunning(), false);
});

test('resumes on the regular interval by default, without an immediate tick', async (t) => {
  const { counter, poller } = setup(t, { immediate: true });
  await setBackgrounded(true);

  await setBackgrounded(false);
  assert.equal(poller.isRunning(), true);
  assert.equal(counter.calls, 1);

  await advanceIntervals(t, INTERVAL_MS);
  assert.equal(counter.calls, 2);
});

test('immediateOnResume keeps the immediate tick on foreground', async (t) => {
  const { counter } = setup(t, { immediate: true, immediateOnResume: true });
  await setBackgrounded(true);

  await setBackgrounded(false);

  assert.equal(counter.calls, 2);
});

test('activating still honours immediate', async (t) => {
  const { counter, activeRef } = setup(t, { immediate: true }, false);
  assert.equal(counter.calls, 0);

  activeRef.value = true;
  await nextTick();

  assert.equal(counter.calls, 1);
});

test('foreground does not start an inactive poller', async (t) => {
  const { counter, poller } = setup(t, { immediate: true, immediateOnResume: true }, false);

  await setBackgrounded(true);
  await setBackgrounded(false);
  await advanceIntervals(t, INTERVAL_MS, 2);

  assert.equal(poller.isRunning(), false);
  assert.equal(counter.calls, 0);
});
