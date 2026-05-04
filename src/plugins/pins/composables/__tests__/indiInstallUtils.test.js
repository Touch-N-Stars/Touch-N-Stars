import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIndiInstallPayload,
  extractIndiInstallErrorDetail,
  parseIndiInstallJobId,
  validateIndiInstallForm,
} from '../indiInstallUtils.js';

test('validateIndiInstallForm validates type and label constraints', () => {
  const valid = validateIndiInstallForm({ type: 'focuser', label: '  My Focuser  ' });
  assert.equal(valid.isValid, true);
  assert.equal(valid.normalizedType, 'focuser');
  assert.equal(valid.normalizedLabel, 'My Focuser');

  const invalidType = validateIndiInstallForm({ type: 'camera', label: 'Good Label' });
  assert.equal(invalidType.isValid, false);
  assert.match(invalidType.typeError, /allowed values/i);

  const invalidEmptyLabel = validateIndiInstallForm({ type: 'weather', label: '   ' });
  assert.equal(invalidEmptyLabel.isValid, false);
  assert.match(invalidEmptyLabel.labelError, /required/i);

  const invalidTooLongLabel = validateIndiInstallForm({ type: 'rotator', label: 'x'.repeat(201) });
  assert.equal(invalidTooLongLabel.isValid, false);
  assert.match(invalidTooLongLabel.labelError, /200/);
});

test('buildIndiInstallPayload creates exact API payload shape', () => {
  const payload = buildIndiInstallPayload(
    { assetName: 'indi-astro-driver' },
    { type: 'telescope', label: '  Main Mount  ' }
  );

  assert.deepEqual(payload, {
    assetName: 'indi-astro-driver',
    type: 'telescope',
    label: 'Main Mount',
  });

  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'driverName'), false);
  assert.deepEqual(Object.keys(payload).sort(), ['assetName', 'label', 'type']);
});

test('parseIndiInstallJobId reports success response states', () => {
  assert.equal(parseIndiInstallJobId({ jobId: 'abc-123' }), 'abc-123');
  assert.equal(parseIndiInstallJobId(42), 42);
  assert.equal(parseIndiInstallJobId('job-7'), 'job-7');
  assert.equal(parseIndiInstallJobId({ message: 'queued' }), null);
});

test('extractIndiInstallErrorDetail reports API and fallback failure details', () => {
  assert.equal(
    extractIndiInstallErrorDetail({ response: { data: { detail: 'Package not found' } } }),
    'Package not found'
  );

  assert.equal(
    extractIndiInstallErrorDetail({ response: { data: { message: 'Install failed' } } }),
    'Install failed'
  );

  assert.equal(extractIndiInstallErrorDetail({ message: 'Network Error' }), 'Network Error');
});
