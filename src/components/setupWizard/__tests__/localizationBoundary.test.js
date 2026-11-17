import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wizardSource = readFileSync(new URL('../SetupWizard.vue', import.meta.url), 'utf8');
const systemTabSource = readFileSync(
  new URL('../../pins/tabs/PinsSystemTab.vue', import.meta.url),
  'utf8'
);
const localizationSource = readFileSync(
  new URL('../../pins/system/PinsLocalizationSettings.vue', import.meta.url),
  'utf8'
);

test('PINS localization is ordered before Wi-Fi in the setup assistant', () => {
  assert.match(
    wizardSource,
    /store\.isPINS\s*\?\s*\[step\('localization'\), step\('wifi'\), step\('updates'\)\]/
  );
});

test('system localization settings remain inside the PINS capability boundary', () => {
  assert.match(systemTabSource, /<PinsLocalizationSettings v-if="store\.isPINS" \/>/);
});

test('large host option sets use searchable explicit selects instead of datalists', () => {
  assert.doesNotMatch(localizationSource, /<datalist/);
  assert.match(localizationSource, /v-model="form\.locale"/);
  assert.match(localizationSource, /v-model="form\.timezone"/);
  assert.match(localizationSource, /v-model="form\.keyboardLayout"/);
  assert.match(localizationSource, /type="search"/);
  assert.match(localizationSource, /`\$\{layout\.code\} \$\{layout\.name\}`/);
});
