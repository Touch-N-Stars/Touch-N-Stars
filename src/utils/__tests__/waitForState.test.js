import test from 'node:test';
import assert from 'node:assert/strict';
import { ref, nextTick } from 'vue';

const { waitForState } = await import('@/utils/waitForState');

test('resolves at once when the state already holds', async () => {
  assert.equal(await waitForState(() => true, 10), true);
});

test('resolves true when the state changes before the timeout', async () => {
  const parked = ref(false);
  const result = waitForState(() => parked.value, 1000);
  parked.value = true;
  await nextTick();
  assert.equal(await result, true);
});

test('resolves false after the timeout', async () => {
  const parked = ref(false);
  assert.equal(await waitForState(() => parked.value, 20), false);
});
