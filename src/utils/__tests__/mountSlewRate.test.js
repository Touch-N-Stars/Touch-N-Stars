import test from 'node:test';
import assert from 'node:assert/strict';
import { SLEW_RATE_KIND, deriveMaxSlewRate, slewRateDiffers } from '../mountSlewRate.js';

const option = (Index, Name, Label) => ({ Index, Name, Label, IsSelected: false });

// GET indi/mount/slew-rates from EQMod (simulation mode) on PINS, 2026-11-21.
const EQMOD = {
  Kind: SLEW_RATE_KIND.DISCRETE,
  PropertyName: 'TELESCOPE_SLEW_RATE',
  Options: [
    option(0, '1x', '1x'),
    option(1, '2x', '2x'),
    option(2, '3x', '4x'),
    option(3, '4x', '8x'),
    option(4, '5x', '32x'),
    option(5, '6x', '64x'),
    option(6, '7x', '128x'),
    option(7, '8x', '600x'),
    option(8, '9x', '700x'),
    option(9, 'SLEW_MAX', '800x'),
    option(10, 'SLEWCUSTOM', 'Custom'),
  ],
};

// Same endpoint, INDI Telescope Simulator: libindi's default switches. The names look like
// multiples but are plain indices; the labels carry no number.
const SIMULATOR = {
  Kind: SLEW_RATE_KIND.DISCRETE,
  PropertyName: 'TELESCOPE_SLEW_RATE',
  Options: [
    option(0, '1x', 'Guide'),
    option(1, '2x', 'Centering'),
    option(2, '3x', 'Find'),
    option(3, '4x', 'Max'),
  ],
};

test('EQMod: the top labelled multiple gives the speed', () => {
  // 800 x 1/240 °/s, the sidereal rate PINS itself uses.
  assert.deepEqual(deriveMaxSlewRate(EQMOD), { status: 'derived', dps: 3.33, label: '800x' });
});

test('libindi default switches: names are no multiples, the speed stays unknown', () => {
  assert.deepEqual(deriveMaxSlewRate(SIMULATOR), { status: 'unknown' });
});

test('"Max" and "Half" never count - PINS derives them from the configured value', () => {
  const capability = {
    Kind: SLEW_RATE_KIND.DISCRETE,
    Options: [option(0, 'a', '16x'), option(1, 'b', 'Max 1000x'), option(2, 'c', 'Half 500x')],
  };
  assert.deepEqual(deriveMaxSlewRate(capability), { status: 'derived', dps: 0.07, label: '16x' });
});

test('continuous or no rate control: PINS does not use the value', () => {
  assert.deepEqual(deriveMaxSlewRate({ Kind: SLEW_RATE_KIND.CONTINUOUS, Min: 0, Max: 5 }), {
    status: 'notNeeded',
  });
  assert.deepEqual(deriveMaxSlewRate({ Kind: SLEW_RATE_KIND.NONE }), { status: 'notNeeded' });
});

test('missing or broken payloads are unknown, not a crash', () => {
  assert.deepEqual(deriveMaxSlewRate(null), { status: 'unknown' });
  assert.deepEqual(deriveMaxSlewRate({ Kind: 1 }), { status: 'unknown' });
  assert.deepEqual(deriveMaxSlewRate({ Kind: 1, Options: [option(0, 'x', '0x')] }), {
    status: 'unknown',
  });
});

test('slewRateDiffers ignores rounding noise', () => {
  assert.equal(slewRateDiffers(3.33, 3.33), false);
  assert.equal(slewRateDiffers(3.334, 3.33), false);
  assert.equal(slewRateDiffers(4, 3.33), true);
  assert.equal(slewRateDiffers(undefined, 3.33), true);
});
