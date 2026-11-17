import assert from 'node:assert/strict';
import test from 'node:test';
import { displayExposure, exposureSeconds, exposureSupported } from '../utils/exposureUnits.js';

test('solar submillisecond input stays in seconds on the camera API', () => {
  for (const [seconds, ms] of [
    [0.02, 20],
    [0.001, 1],
    [0.0002, 0.2],
    [0.00001, 0.01],
    [0.000001, 0.001],
  ]) {
    assert.equal(displayExposure(seconds, 'ms'), ms);
    assert.equal(exposureSeconds(String(ms), 'ms'), seconds);
    assert.equal(displayExposure(seconds, 's'), seconds);
    assert.equal(exposureSeconds(String(seconds), 's'), seconds);
  }
});

test('blank input is not converted to a zero-second exposure', () => {
  assert.equal(exposureSeconds('', 'ms'), null);
  assert.equal(displayExposure(null, 'ms'), '');
  assert.ok(Number.isNaN(exposureSeconds('bad', 'ms')));
});

test('short presets respect the reported camera limits instead of assuming 20 ms', () => {
  const fast = { min: 0.000032, max: 3600 };
  assert.equal(exposureSupported(0.0002, fast), true);
  assert.equal(exposureSupported(0.00001, fast), false);
  assert.equal(exposureSupported(0.0002, { min: 0.02, max: 1 }), false);
  assert.equal(exposureSupported(2, { min: 0, max: 1 }), false);
});
