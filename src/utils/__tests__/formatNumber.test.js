import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDecimal } from '../formatNumber.js';

test('formatDecimal writes the decimal separator of the locale', () => {
  assert.equal(formatDecimal(2.987, 2, 'de-DE'), '2,99');
  assert.equal(formatDecimal(2.987, 2, 'en-GB'), '2.99');
  assert.equal(formatDecimal(-10, 1, 'de-DE'), '-10,0');
});

test('formatDecimal keeps measurements ungrouped', () => {
  assert.equal(formatDecimal(25000.5, 1, 'de-DE'), '25000,5');
  assert.equal(formatDecimal(25000.5, 1, 'en-GB'), '25000.5');
});

test('formatDecimal returns an empty string for missing or invalid values', () => {
  for (const value of [null, undefined, '', 'abc', NaN, Infinity]) {
    assert.equal(formatDecimal(value, 2, 'de-DE'), '');
  }
  assert.equal(formatDecimal('1.5', 1, 'de-DE'), '1,5');
});
