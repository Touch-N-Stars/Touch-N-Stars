import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { buildTppaStartMessage, tppaSlewsToStart, tppaStartCoordinates } =
  await import('@/utils/tppaStart');
const { equatorialToAltAz } = await import('@/utils/astronomy');

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

const date = new Date('2026-11-22T20:00:00Z');

test('the start position is the pole plus the offsets in the north', () => {
  const start = tppaStartCoordinates({
    latDeg: 48.137,
    lonDeg: 11.575,
    azimuthOffsetDeg: 1,
    altitudeOffsetDeg: 2,
    date,
  });
  assert.equal(start.azDeg, 1);
  assert.ok(Math.abs(start.altDeg - 50.137) < 1e-9);
  // Close to the celestial pole and well above the horizon at the real site.
  assert.ok(start.decDeg > 87 && start.decDeg < 89);
  const altAz = equatorialToAltAz(start.raDeg, start.decDeg, date, 48.137, 11.575);
  assert.ok(Math.abs(altAz.altDeg - 50.137) < 1e-6);
});

test('the start position faces south in the southern hemisphere', () => {
  const start = tppaStartCoordinates({
    latDeg: -33.9,
    lonDeg: 18.4,
    azimuthOffsetDeg: 1,
    altitudeOffsetDeg: 2,
    date,
  });
  assert.equal(start.azDeg, 181);
  assert.ok(Math.abs(start.altDeg - 35.9) < 1e-9);
  assert.ok(start.decDeg < -87 && start.decDeg > -89);
});

test('the stale latitude 0 is what sent TPPA below the horizon', () => {
  // TPPA kept the start computed at NINA's start on a fresh profile (latitude 0).
  const stale = tppaStartCoordinates({
    latDeg: 0,
    lonDeg: 11.575,
    azimuthOffsetDeg: 1,
    altitudeOffsetDeg: 2,
    date,
  });
  assert.equal(stale.azDeg, 181);
  assert.equal(stale.altDeg, 2);
  const atRealSite = equatorialToAltAz(stale.raDeg, stale.decDeg, date, 48.137, 11.575);
  assert.ok(atRealSite.altDeg < -40);
});

test('on PINS the app slews to the start only when TPPA would do it itself', () => {
  const pins = (overrides = {}) => api({ isPINS: true, ...overrides });
  assert.equal(tppaSlewsToStart(settings(), pins()), true);
  assert.equal(tppaSlewsToStart(settings({ StartFromCurrentPosition: true }), pins()), false);
  assert.equal(tppaSlewsToStart(settings({ ManualMode: true }), pins()), false);
  assert.equal(tppaSlewsToStart(settings(), pins({ mountInfo: { Connected: false } })), false);
});

test('on NINA TPPA keeps slewing to its start itself', () => {
  assert.equal(tppaSlewsToStart(settings(), api({ isPINS: false })), false);
});

test('a start after the app slewed asks TPPA to stay where it is', () => {
  const message = buildTppaStartMessage(
    settings({ StartFromCurrentPosition: true }),
    api({ isPINS: true })
  );
  assert.equal(message.StartFromCurrentPosition, true);
});
