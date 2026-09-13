import test from 'node:test';
import assert from 'node:assert/strict';
import {
  atlasSearchResultToTarget,
  atlasSelectionToFraming,
  ninaMountToAtlas,
  ninaObserverToAtlas,
  toNinaJ2000Coordinates,
  toAtlasCoordinates,
} from '../contracts.js';

test('normalizes RA at the wrap boundary without changing units', () => {
  assert.deepEqual(toAtlasCoordinates({ raDeg: 360, decDeg: 0, frame: 'ICRS' }), {
    raDeg: 0,
    decDeg: 0,
    frame: 'ICRS',
  });
  assert.equal(toAtlasCoordinates({ raDeg: -0.25, decDeg: 90, frame: 'J2000' }).raDeg, 359.75);
});

test('normalizes east-positive observer longitude', () => {
  assert.deepEqual(ninaObserverToAtlas({ Latitude: -33.9, Longitude: 181, Elevation: 12 }), {
    latitudeDeg: -33.9,
    longitudeDeg: -179,
    elevationM: 12,
  });
});

test('blocks an untagged mount coordinate from the viewer boundary', () => {
  assert.throws(
    () => ninaMountToAtlas({ Connected: true, RightAscension: 12, Declination: -20 }),
    /unknown/
  );
});

test('converts proven mount RA hours to atlas degrees', () => {
  const value = ninaMountToAtlas(
    { Connected: true, RightAscension: 23.5, Declination: -20, Coordinates: { Epoch: 'J2000' } },
    123
  );
  assert.equal(value.coordinates.raDeg, 352.5);
  assert.equal(value.timestampUtcMs, 123);
});

test('prefers Advanced API tagged degree coordinates', () => {
  const value = ninaMountToAtlas(
    {
      Connected: true,
      RightAscension: 1,
      Declination: 2,
      Coordinates: { RADegrees: 123.4, Dec: -55.6, Epoch: 'J2000' },
    },
    123
  );
  assert.equal(value.coordinates.raDeg, 123.4);
  assert.equal(value.coordinates.decDeg, -55.6);
});

test('precesses the Advanced API JNOW mount position to J2000', () => {
  const value = ninaMountToAtlas(
    {
      Connected: true,
      EquatorialSystem: 'JNOW',
      Coordinates: {
        RADegrees: 256.74138915,
        Dec: 89.79009914,
        Epoch: 'JNOW',
        DateTime: { UtcNow: '2026-07-18T20:34:58.297Z' },
      },
    },
    123
  );

  assert.equal(value.coordinates.frame, 'J2000');
  assert.equal(value.coordinates.epochJulianYear, 2000);
  assert.ok(Number.isFinite(value.coordinates.raDeg));
  assert.ok(Number.isFinite(value.coordinates.decDeg));
  assert.ok(value.coordinates.decDeg <= 90 && value.coordinates.decDeg >= -90);
  assert.equal(value.timestampUtcMs, 123);
});

test('passes J2000 coordinates through to the NINA command boundary', () => {
  assert.deepEqual(toNinaJ2000Coordinates({ raDeg: 359.75, decDeg: -20, frame: 'J2000' }), {
    raDeg: 359.75,
    decDeg: -20,
    frame: 'J2000',
    epochJulianYear: 2000,
  });
});

test('requires an explicit frame for a command-producing view center', () => {
  assert.throws(() => toNinaJ2000Coordinates({ raDeg: 10, decDeg: 20 }), /explicit/);
});

test('applies the IAU SOFA ICRS-to-FK5/J2000 orientation', () => {
  const coordinates = toNinaJ2000Coordinates({
    raDeg: 1.767794352 * (180 / Math.PI),
    decDeg: -0.2917512594 * (180 / Math.PI),
    frame: 'ICRS',
  });

  assert.equal(coordinates.frame, 'J2000');
  assert.equal(coordinates.epochJulianYear, 2000);
  assert.ok(Math.abs(coordinates.raDeg * (Math.PI / 180) - 1.7677944557000655) < 1e-14);
  assert.ok(Math.abs(coordinates.decDeg * (Math.PI / 180) + 0.2917513626469639) < 1e-14);
});

test('converts every tagged selection to the proven J2000 framing contract', () => {
  const target = atlasSelectionToFraming({
    name: 'M 31',
    coordinates: { raDeg: 10.6847, decDeg: 41.269, frame: 'ICRS' },
  });

  assert.equal(target.Name, 'M 31');
  assert.equal(target.coordinateFrame, 'J2000');
  assert.equal(target.epochJulianYear, 2000);
  assert.equal(target.sourceCoordinateFrame, 'ICRS');
  assert.ok(Math.abs(target.RA - 10.684711539261059) < 1e-12);
  assert.ok(Math.abs(target.Dec - 41.26900145907812) < 1e-12);

  assert.throws(
    () => atlasSelectionToFraming({ name: 'unsafe', coordinates: { raDeg: 1, decDeg: 2 } }),
    /explicit/
  );
});

test('preserves stellar identity and search-only marker metadata at the viewer boundary', () => {
  const result = atlasSearchResultToTarget({
    id: 'WR 99',
    uid: 'simbad-wr:2412127',
    name: 'WR 99',
    searchOnly: true,
    raDeg: 264.82612891646994,
    decDeg: -28.25234379719,
    frame: 'ICRS',
    crossIdSources: ['SIMBAD WR'],
  });
  assert.equal(result.uid, 'simbad-wr:2412127');
  assert.equal(result.searchOnly, true);
  assert.equal(result.magnitude, undefined);
  assert.deepEqual(result.crossIdSources, ['SIMBAD WR']);
});

test('builds viewer targets only from explicitly framed search results', () => {
  const result = atlasSearchResultToTarget({
    id: 'M 31',
    name: 'Andromeda Galaxy',
    displayName: 'M31 · Andromeda Galaxy',
    type: 'Galaxy',
    raDeg: 10.6847,
    decDeg: 41.269,
    frame: 'ICRS',
  });

  assert.equal(result.id, 'M 31');
  assert.equal(result.name, 'Andromeda Galaxy');
  assert.equal(result.displayName, 'M31 · Andromeda Galaxy');
  assert.deepEqual(result.coordinates, { raDeg: 10.6847, decDeg: 41.269, frame: 'ICRS' });
  assert.deepEqual(
    atlasSearchResultToTarget({
      id: 'Jupiter',
      coordinates: { raDeg: 123.4, decDeg: -5.6, frame: 'J2000', epochJulianYear: 2000 },
    }).coordinates,
    { raDeg: 123.4, decDeg: -5.6, frame: 'J2000', epochJulianYear: 2000 }
  );
  assert.throws(
    () => atlasSearchResultToTarget({ id: 'unsafe', raDeg: 10, decDeg: 20 }),
    /explicit/
  );
});
