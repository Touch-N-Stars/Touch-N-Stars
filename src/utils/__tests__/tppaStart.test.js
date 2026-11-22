import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { buildTppaStartMessage } = await import('@/utils/tppaStart');

const api = (overrides = {}) => ({
  isPINS: false,
  mountInfo: { Connected: true },
  currentApiVersion: '2.2.10.0',
  checkVersionNewerOrEqual: () => true,
  ...overrides,
});

const settings = (overrides = {}) => ({
  StartFromCurrentPosition: false,
  EastDirection: false,
  ManualMode: false,
  ExposureTime: null,
  Gain: null,
  Filter: null,
  Binning: null,
  ...overrides,
});

test('a chosen binning is sent to the TPPA plugin', () => {
  assert.equal(buildTppaStartMessage(settings({ Binning: 2 }), api()).Binning, 2);
});

test('the binning is sent in PINS mode too', () => {
  assert.equal(buildTppaStartMessage(settings({ Binning: 2 }), api({ isPINS: true })).Binning, 2);
});

test('without a chosen binning the field is left out, so the plugin keeps its own', () => {
  assert.equal('Binning' in buildTppaStartMessage(settings(), api()), false);
});
