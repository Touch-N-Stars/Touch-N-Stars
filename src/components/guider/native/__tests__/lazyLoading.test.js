import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the guider page loads the native UI only in native mode', async () => {
  const page = await source('../../../../views/GuidingPage.vue');
  assert.match(
    page,
    /defineAsyncComponent\(\{\s*loader: \(\) => import\('@\/components\/guider\/native\/NativeGuiderLayout\.vue'\)/
  );
  assert.doesNotMatch(page, /^import NativeGuiderLayout/m);
  assert.doesNotMatch(page, /uplot/i);
  // otherwise the catch-all vendor chunk, which every page loads, would carry uPlot
  const viteConfig = await source('../../../../../vite.config.js');
  assert.match(viteConfig, /name: 'uplot-vendor',\s*test: [^\n]*uplot/);
});

test('the native layout loads the Coach, the Incidents tab and the replay when shown', async () => {
  const layout = await source('../NativeGuiderLayout.vue');
  for (const file of [
    './coach/NativeCoachTab.vue',
    './incidents/NativeIncidentsTab.vue',
    './incidents/NativeIncidentReplay.vue',
  ]) {
    const escaped = file.replace(/[./]/g, (c) => `\\${c}`);
    assert.match(
      layout,
      new RegExp(`defineAsyncComponent\\(\\s*\\(\\) => import\\('${escaped}'\\)`)
    );
    assert.doesNotMatch(layout, new RegExp(`^import \\w+ from '${escaped}'`, 'm'));
  }
});

test('the PHD2 settings and the setup wizard load the native settings sheet only when needed', async () => {
  for (const path of [
    '../../settingsGuiderConnect.vue',
    '../../../setupWizard/steps/WizardGuiderStep.vue',
  ]) {
    const file = await source(path);
    assert.match(
      file,
      /defineAsyncComponent\(\s*\(\) => import\('@\/components\/guider\/native\/NativeSettingsSheet\.vue'\)/,
      path
    );
    assert.doesNotMatch(file, /^import NativeSettingsSheet/m, path);
  }
});
