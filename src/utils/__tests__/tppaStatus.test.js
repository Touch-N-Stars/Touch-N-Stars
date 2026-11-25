import test from 'node:test';
import assert from 'node:assert/strict';
import { tppaStatusKey } from '../tppaStatus.js';

test('tppaStatusKey maps the fixed TPPA status lines', () => {
  assert.equal(tppaStatusKey('Capturing new image to solve...'), 'capturing');
  assert.equal(tppaStatusKey('Solving image...'), 'solving');
  assert.equal(tppaStatusKey(' Settling '), 'settling');
});

test('tppaStatusKey maps lines with a number after a fixed start', () => {
  assert.equal(tppaStatusKey('Slewing to initial position Alt 50° Az 1°'), 'slewInitial');
  assert.equal(tppaStatusKey('Plate solve attempt 2 of 3'), 'solveAttempt');
});

test('tppaStatusKey leaves unknown or empty lines alone', () => {
  assert.equal(tppaStatusKey('Something new'), null);
  assert.equal(tppaStatusKey(''), null);
  assert.equal(tppaStatusKey(undefined), null);
});
