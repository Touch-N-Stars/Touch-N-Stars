import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasDamagedLocaleText } from '../../../scripts/lib/localeTextIntegrity.mjs';

test('locale integrity rejects lossy placeholders and encoding corruption', () => {
  for (const text of ['??(JSON)', 'Pr?fe', 'caf\u00C3\u00A9', 'text\uFFFD']) {
    assert.equal(hasDamagedLocaleText(text), true, text);
  }
});

test('locale integrity accepts Unicode scripts and ordinary questions', () => {
  for (const text of [
    '인수 (JSON)',
    '参数',
    '引数',
    'Підключити',
    'Prüfen',
    '¿Continuar?',
    'Continue?',
    'Continuer ?',
    'coût',
  ]) {
    assert.equal(hasDamagedLocaleText(text), false, text);
  }
});
