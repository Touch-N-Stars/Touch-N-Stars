import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNinaPluginRequirement,
  isNinaPluginLoaded,
  parseLoadedNinaPlugins,
} from '../ninaPluginRequirement.js';
import nightSummaryMetadata from '../../plugins/nightsummary/plugin.json' with { type: 'json' };

// Live response of a PINS Pi, 2026-10-25.
const PI_RESPONSE = {
  Response: [
    'PolarAlignment',
    'LiveStack',
    'GroundStation',
    'NINA.Plugin.NightSummary',
    'joko.nina.plugins',
    'Phd2 Tools',
    'PINS.LuckyCapture',
    'Touch-N-Stars',
    'pins.plugin',
    'ninaAPI',
  ],
  Error: '',
  StatusCode: 200,
  Success: true,
  Type: 'API',
};

// Live response of a Windows NINA, 2026-11-05. NINA's installer names the folders after the
// plugin manifest, so they differ from the PINS package folders above.
const WINDOWS_RESPONSE = {
  Response: [
    'Advanced API',
    'Hocus Focus',
    'Livestack',
    'Night Summary',
    'NINA.Plugin.AAPA',
    'Phd2 Tools',
    "Touch 'N' Stars",
  ],
  Error: '',
  StatusCode: 200,
  Success: true,
  Type: 'API',
};

test('reads the requirement from plugin metadata', () => {
  assert.deepEqual(
    getNinaPluginRequirement({
      ninaPlugin: {
        name: 'NINA.Plugin.NightSummary',
        aliases: [' Night Summary ', '', 7],
        displayName: ' Night Summary ',
        pinsPackage: 'pins-plugin-nightsummary',
      },
    }),
    {
      name: 'NINA.Plugin.NightSummary',
      aliases: ['Night Summary'],
      displayName: 'Night Summary',
      pinsPackage: 'pins-plugin-nightsummary',
    }
  );
  assert.deepEqual(getNinaPluginRequirement({ ninaPlugin: { name: ' X ' } }), {
    name: 'X',
    aliases: [],
    displayName: 'X',
    pinsPackage: null,
  });
  assert.equal(getNinaPluginRequirement({}), null);
  assert.equal(getNinaPluginRequirement({ ninaPlugin: { name: '' } }), null);
  assert.equal(getNinaPluginRequirement(null), null);
});

test('matches the names NINA reports, ignoring case', () => {
  const loaded = parseLoadedNinaPlugins(PI_RESPONSE);
  for (const name of [
    'LiveStack',
    'PINS.LuckyCapture',
    'GroundStation',
    'NINA.Plugin.NightSummary',
  ]) {
    assert.equal(isNinaPluginLoaded(loaded, { name }), true, name);
  }
  assert.equal(isNinaPluginLoaded(loaded, { name: 'livestack' }), true);
  assert.equal(isNinaPluginLoaded(loaded, { name: 'Perihelion' }), false);
});

test('finds Night Summary under its folder name on both PINS and Windows', () => {
  const requirement = getNinaPluginRequirement(nightSummaryMetadata);
  assert.equal(isNinaPluginLoaded(parseLoadedNinaPlugins(PI_RESPONSE), requirement), true);
  assert.equal(isNinaPluginLoaded(parseLoadedNinaPlugins(WINDOWS_RESPONSE), requirement), true);
  assert.equal(isNinaPluginLoaded(['Hocus Focus'], requirement), false);
});

test('an unusable plugins response is reported as unknown, not as missing', () => {
  assert.equal(parseLoadedNinaPlugins({ Success: false, Response: [] }), null);
  assert.equal(parseLoadedNinaPlugins({ Success: true, Response: 'x' }), null);
  assert.equal(parseLoadedNinaPlugins(undefined), null);
  assert.equal(isNinaPluginLoaded(null, { name: 'LiveStack' }), false);
});
