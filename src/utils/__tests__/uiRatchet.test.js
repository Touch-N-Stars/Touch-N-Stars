import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METRICS, compareToBaseline, countMetric } from '../../../scripts/lib/uiRatchet.mjs';

const { legacyColors, rawNumberInputs } = METRICS;

test('legacy colors are found with variants, opacity and important modifiers', () => {
  for (const className of [
    'bg-gray-800',
    'hover:text-cyan-400',
    'bg-slate-900/50',
    'border-t-gray-700',
    'md:hover:ring-red-500',
    '!bg-gray-800',
    'bg-gray-800!',
  ]) {
    assert.equal(countMetric(legacyColors, 'a.vue', `class="${className}"`), 1, className);
  }
});

test('design tokens and unrelated names are not legacy colors', () => {
  for (const className of [
    'bg-surface-1',
    'text-content-muted',
    'border-line-strong',
    'text-status-danger',
    'tns-btn-primary',
    'var(--color-cyan-700)',
    'my-bg-gray-800',
    'bg-gray-800-custom',
  ]) {
    assert.equal(countMetric(legacyColors, 'a.vue', `class="${className}"`), 0, className);
  }
});

test('legacy colors are counted in scripts too, and every occurrence adds up', () => {
  assert.equal(countMetric(legacyColors, 'a.js', "'bg-gray-800 text-gray-200'"), 2);
  assert.equal(countMetric(legacyColors, 'a.css', '.a { @apply bg-gray-800; }'), 0);
});

test('raw number inputs are found in templates only', () => {
  assert.equal(countMetric(rawNumberInputs, 'a.vue', '<input type="number" />'), 1);
  assert.equal(countMetric(rawNumberInputs, 'a.vue', "<input type='number' />"), 1);
  assert.equal(countMetric(rawNumberInputs, 'a.vue', '<input type="text" />'), 0);
  assert.equal(countMetric(rawNumberInputs, 'a.vue', "props: { type: 'number' }"), 0);
  assert.equal(countMetric(rawNumberInputs, 'a.js', '<input type="number" />'), 0);
});

test('the baseline comparison reports growth and shrinkage per metric', () => {
  const baseline = { legacyColors: 10, rawNumberInputs: 5 };

  assert.deepEqual(compareToBaseline({ legacyColors: 10, rawNumberInputs: 5 }, baseline), {
    increased: [],
    decreased: [],
  });
  assert.deepEqual(compareToBaseline({ legacyColors: 11, rawNumberInputs: 4 }, baseline), {
    increased: [{ name: 'legacyColors', count: 11, limit: 10 }],
    decreased: [{ name: 'rawNumberInputs', count: 4, limit: 5 }],
  });
});
