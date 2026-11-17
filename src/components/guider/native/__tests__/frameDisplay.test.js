import test from 'node:test';
import assert from 'node:assert/strict';
import { STRETCH_OPTIONS, frameWidthFor, stretchValue } from '../frameDisplay.js';

test('stretch levels map to their value, an unknown id to the default', () => {
  for (const option of STRETCH_OPTIONS) assert.equal(stretchValue(option.id), option.value);
  assert.equal(stretchValue('removed-level'), 0.2);
});

test('the frame width is the smallest fixed size that covers the need', () => {
  assert.equal(frameWidthFor(300), 512);
  assert.equal(frameWidthFor(1024), 1024);
  assert.equal(frameWidthFor(1025), 1536);
  assert.equal(frameWidthFor(5000), 2048);
});
