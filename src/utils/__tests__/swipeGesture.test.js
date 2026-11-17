import test from 'node:test';
import assert from 'node:assert/strict';
import { swipeStep, SWIPE_MIN_PX } from '../swipeGesture.js';

test('swipeStep: finger to the left goes forward, to the right goes back', () => {
  assert.equal(swipeStep(-80, 5), 1);
  assert.equal(swipeStep(80, -5), -1);
});

test('swipeStep ignores short and mostly vertical drags', () => {
  assert.equal(swipeStep(SWIPE_MIN_PX - 1, 0), 0);
  assert.equal(swipeStep(-80, 60), 0);
  assert.equal(swipeStep(0, 0), 0);
  assert.equal(swipeStep(SWIPE_MIN_PX, 0), -1);
});
