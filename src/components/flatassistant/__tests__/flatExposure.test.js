import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFlatExposure, lastFlatExposure } from '../flatExposure.js';

test('formatFlatExposure keeps short flat exposures readable', () => {
  assert.equal(formatFlatExposure(0.00123), '0.00123');
  assert.equal(formatFlatExposure(0.05), '0.05');
  assert.equal(formatFlatExposure(2.345), '2.35');
  assert.equal(formatFlatExposure(12.34), '12.3');
  assert.equal(formatFlatExposure(NaN), null);
  assert.equal(formatFlatExposure(-1), null);
});

test('lastFlatExposure reads the newest flat from the image history', () => {
  const history = [
    { ImageType: 'LIGHT', ExposureTime: 120 },
    { ImageType: 'FLAT', ExposureTime: 0.0042 },
  ];
  assert.equal(lastFlatExposure(history), '0.0042');
});

test('lastFlatExposure ignores a newest frame of another type', () => {
  const history = [
    { ImageType: 'FLAT', ExposureTime: 0.5 },
    { ImageType: 'LIGHT', ExposureTime: 120 },
  ];
  assert.equal(lastFlatExposure(history), null);
});

test('lastFlatExposure accepts dark flats only in the dark phase', () => {
  const history = [{ ImageType: 'DARK', ExposureTime: 0.25 }];
  assert.equal(lastFlatExposure(history), null);
  assert.equal(lastFlatExposure(history, true), '0.25');
  assert.equal(lastFlatExposure([{ ImageType: 'DARKFLAT', ExposureTime: 1.5 }], true), '1.50');
});

test('lastFlatExposure handles a missing or empty history', () => {
  assert.equal(lastFlatExposure(null), null);
  assert.equal(lastFlatExposure([]), null);
  assert.equal(lastFlatExposure([{ ImageType: 'FLAT' }]), null);
});
