import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METRICS, compareToBaseline, countMetric } from '../../../scripts/lib/uiRatchet.mjs';

const {
  legacyColors,
  rawNumberInputs,
  pollingTimers,
  adHocSpinners,
  adHocOverlays,
  rawOverlayZIndex,
  webkitSelectionBlocks,
  draggableWithoutFallbackOnBody,
  forceFallback,
} = METRICS;

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

test('setInterval calls are counted, other timers are not', () => {
  assert.equal(countMetric(pollingTimers, 'a.js', 'const id = setInterval(poll, 2000);'), 1);
  assert.equal(countMetric(pollingTimers, 'a.vue', 'window.setInterval (tick, 1000)'), 1);
  assert.equal(countMetric(pollingTimers, 'a.js', 'clearInterval(id); setTimeout(f, 10);'), 0);
});

test('spinners and overlays are counted outside their helper only', () => {
  const spin = '<span class="h-4 w-4 animate-spin"></span>';
  assert.equal(countMetric(adHocSpinners, 'src/components/a.vue', spin), 1);
  assert.equal(countMetric(adHocSpinners, 'src\\components\\helpers\\Spinner.vue', spin), 0);
  assert.equal(countMetric(adHocSpinners, 'a.vue', 'class="animate-spin-slow"'), 0);

  const overlay = '<div class="fixed inset-0 bg-black/50"></div>';
  assert.equal(countMetric(adHocOverlays, 'src/components/a.vue', overlay), 1);
  assert.equal(countMetric(adHocOverlays, 'a.vue', 'class="inset-0 fixed"'), 1);
  assert.equal(countMetric(adHocOverlays, 'src/components/helpers/Modal.vue', overlay), 0);
  assert.equal(countMetric(adHocOverlays, 'a.vue', 'class="md:fixed inset-0"'), 0);
});

test('raw z-index values are counted from the overlay layers up', () => {
  for (const snippet of [
    'class="z-50"',
    'class="md:z-40"',
    'class="z-[9999]"',
    'z-index: 80;',
    "zIndex: '100'",
    'zIndex: 60',
  ]) {
    assert.equal(countMetric(rawOverlayZIndex, 'a.vue', snippet), 1, snippet);
  }
  for (const snippet of ['class="z-10"', 'class="z-30"', 'class="z-modal"', 'z-index: 1;']) {
    assert.equal(countMetric(rawOverlayZIndex, 'a.vue', snippet), 0, snippet);
  }
});

test('per-component webkit selection rules are counted in components', () => {
  const css = '.a { -webkit-user-select: none; -webkit-touch-callout: none; user-select: none; }';
  assert.equal(countMetric(webkitSelectionBlocks, 'a.vue', css), 2);
  assert.equal(countMetric(webkitSelectionBlocks, 'a.vue', 'class="select-text"'), 0);
});

test('draggables need fallbackOnBody, forceFallback is counted', () => {
  const tag = (attrs) => `<draggable v-model="list" ${attrs} @end="(e) => e.to > 0">`;
  assert.equal(countMetric(draggableWithoutFallbackOnBody, 'a.vue', tag('')), 1);
  assert.equal(
    countMetric(draggableWithoutFallbackOnBody, 'a.vue', tag(':fallbackOnBody="true"')),
    0
  );
  assert.equal(
    countMetric(draggableWithoutFallbackOnBody, 'a.vue', tag(':fallback-on-body="true"')),
    0
  );

  assert.equal(countMetric(forceFallback, 'a.vue', ':force-fallback="true"'), 1);
  assert.equal(countMetric(forceFallback, 'a.js', '{ forceFallback: true }'), 1);
  assert.equal(countMetric(forceFallback, 'a.vue', ':force-fallback="false"'), 0);
});

test('a metric missing from the baseline is held at zero', () => {
  assert.deepEqual(compareToBaseline({ legacyColors: 1 }, {}), {
    increased: [{ name: 'legacyColors', count: 1, limit: 0 }],
    decreased: [],
  });
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
