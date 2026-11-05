import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPageProblems } from '../../../scripts/lib/browserChecks.mjs';

const healthyPage = {
  text: 'Equipment Control',
  scrollWidth: 390,
  viewportWidth: 390,
  exceptions: [],
};

test('a healthy page has no problems', () => {
  assert.deepEqual(findPageProblems(healthyPage), []);
});

test('uncaught exceptions are reported by their first line', () => {
  const problems = findPageProblems({
    ...healthyPage,
    exceptions: ['TypeError: boom\n    at index.js:1:1'],
  });

  assert.deepEqual(problems, ['exception: TypeError: boom']);
});

test('an empty page is a problem', () => {
  assert.deepEqual(findPageProblems({ ...healthyPage, text: ' \n ' }), ['page is empty']);
});

test('raw i18n keys are reported once each', () => {
  const problems = findPageProblems({
    ...healthyPage,
    text: 'components.foo.bar_baz and plugins.sequenceCreator.actions.title, components.foo.bar_baz',
  });

  assert.deepEqual(problems, [
    'untranslated keys: components.foo.bar_baz, plugins.sequenceCreator.actions.title',
  ]);
});

test('dotted text that is no i18n key passes', () => {
  for (const text of [
    'NINA.Plugin.Touch-N-Stars',
    'pins-503ce-1.local',
    'version 6.5.0.1',
    'https://app.example.com/plugins.json',
  ]) {
    assert.deepEqual(findPageProblems({ ...healthyPage, text }), [], text);
  }
});

test('horizontal overflow is a problem', () => {
  assert.deepEqual(findPageProblems({ ...healthyPage, scrollWidth: 391 }), [
    'horizontal overflow: 391px in a 390px viewport',
  ]);
});
