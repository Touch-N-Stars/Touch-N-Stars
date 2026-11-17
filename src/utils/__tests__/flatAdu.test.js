import test from 'node:test';
import assert from 'node:assert/strict';
import { flatMaxADU } from '@/utils/flatAdu';

test('flatMaxADU() prefers the bit depth of the measured image over the camera info', () => {
  // A 14-bit NEF from a libgphoto2 camera whose profile still says 16 bit.
  assert.equal(flatMaxADU(14, 16), 16383);
  assert.equal(flatMaxADU(12, 16), 4095);
});

test('flatMaxADU() falls back to the camera bit depth, then to 16 bit', () => {
  assert.equal(flatMaxADU(null, 12), 4095);
  assert.equal(flatMaxADU(undefined, 16), 65535);
  assert.equal(flatMaxADU(null, undefined), 65535);
});

test('flatMaxADU() ignores bit depths outside 1-16', () => {
  assert.equal(flatMaxADU(0, 14), 16383);
  assert.equal(flatMaxADU(32, 0), 65535);
  assert.equal(flatMaxADU('x', 14.5), 65535);
});
