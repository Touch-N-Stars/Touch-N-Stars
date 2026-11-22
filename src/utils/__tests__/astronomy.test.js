import test from 'node:test';
import assert from 'node:assert/strict';

const {
  altAzToEquatorial,
  angularSeparationDeg,
  equatorialToAltAz,
  getMoonAltitudeDeg,
  getMoonDataForTarget,
  getMoonEquatorial,
  getMoonIllumination,
  getRiseTransitSet,
  getSunAltitudeDeg,
  getSunEquatorial,
  localSiderealTimeDeg,
} = await import('@/utils/astronomy');

// The series in astronomy.js is a deliberate low-accuracy approximation, so every
// reference check below allows degree-level slack. The anchors are events whose
// geometry is fixed by definition (solstices, equinoxes) or published to the
// minute (the two 2026 eclipses).
const SOLAR_ECLIPSE_2026 = new Date('2026-08-12T17:46:00Z'); // total, greatest eclipse -> new moon
const LUNAR_ECLIPSE_2026 = new Date('2026-03-03T11:34:00Z'); // total, greatest eclipse -> full moon

function assertClose(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} ± ${tolerance}, got ${actual}`
  );
}

test('sun declination matches the solstices and equinoxes', () => {
  const cases = [
    ['2026-03-20T14:46:00Z', 0, 0.1],
    ['2026-06-21T08:25:00Z', 23.44, 0.1],
    ['2026-09-23T00:05:00Z', 0, 0.1],
    ['2026-12-21T20:50:00Z', -23.44, 0.1],
  ];

  for (const [iso, expectedDec, tolerance] of cases) {
    const { decDeg } = getSunEquatorial(new Date(iso));
    assertClose(decDeg, expectedDec, tolerance, `sun declination at ${iso}`);
  }
});

test('sun stands almost overhead at the equator on the equinox', () => {
  // 12:00 UTC on the prime meridian is ~7 minutes off true solar noon (equation
  // of time), which costs roughly 2 degrees of altitude.
  const alt = getSunAltitudeDeg(new Date('2026-03-20T12:00:00Z'), 0, 0);
  assertClose(alt, 90, 3, 'sun altitude at the equator');
});

test('altitude and azimuth: a target on the meridian at the site latitude is in the zenith', () => {
  const date = new Date('2026-05-01T22:00:00Z');
  const latDeg = 48.1;
  const lonDeg = 11.6;
  // A body whose RA equals the local sidereal time is exactly on the meridian.
  const raDeg = localSiderealTimeDeg(date, lonDeg);

  const { altDeg } = equatorialToAltAz(raDeg, latDeg, date, latDeg, lonDeg);
  assertClose(altDeg, 90, 0.01, 'altitude in the zenith');

  const below = equatorialToAltAz(raDeg, latDeg - 90, date, latDeg, lonDeg);
  assertClose(below.altDeg, 0, 0.01, 'altitude 90 degrees away from the zenith');
});

test('moon is new and next to the sun during the total solar eclipse of 2026-08-12', () => {
  const { illumination, elongationDeg, sun, moon } = getMoonIllumination(SOLAR_ECLIPSE_2026);

  // The sun's own position is the independent anchor: mid-August puts it near
  // RA 9h30m / Dec +15 degrees.
  assertClose(sun.raDeg, 142.5, 1, 'sun right ascension');
  assertClose(sun.decDeg, 14.8, 1, 'sun declination');

  // An eclipse means the moon has to sit on top of it.
  assertClose(moon.raDeg, sun.raDeg, 1.5, 'moon right ascension');
  assertClose(moon.decDeg, sun.decDeg, 1.5, 'moon declination');

  assert.ok(elongationDeg < 2, `elongation should be near zero, got ${elongationDeg}`);
  assert.ok(illumination < 0.01, `illumination should be near zero, got ${illumination}`);
});

test('moon is full and opposite the sun during the total lunar eclipse of 2026-03-03', () => {
  const { illumination, elongationDeg } = getMoonIllumination(LUNAR_ECLIPSE_2026);

  assert.ok(elongationDeg > 178, `elongation should be near 180, got ${elongationDeg}`);
  assert.ok(illumination > 0.99, `illumination should be near one, got ${illumination}`);
});

test('illumination stays within zero and one across a full lunation', () => {
  const start = new Date('2026-01-01T00:00:00Z').getTime();
  const hour = 60 * 60 * 1000;
  let min = Infinity;
  let max = -Infinity;

  for (let h = 0; h <= 30 * 24; h += 6) {
    const { illumination } = getMoonIllumination(new Date(start + h * hour));
    assert.ok(illumination >= 0 && illumination <= 1, `illumination out of range: ${illumination}`);
    min = Math.min(min, illumination);
    max = Math.max(max, illumination);
  }

  // 30 days cover a whole synodic month, so both extremes have to show up.
  assert.ok(min < 0.02, `expected a new moon within 30 days, lowest was ${min}`);
  assert.ok(max > 0.98, `expected a full moon within 30 days, highest was ${max}`);
});

test('moon altitude tracks the sun during the solar eclipse', () => {
  // Northern Spain, inside the 2026 path of totality.
  const latDeg = 42.0;
  const lonDeg = -3.0;

  const moonAlt = getMoonAltitudeDeg(SOLAR_ECLIPSE_2026, latDeg, lonDeg);
  const sunAlt = getSunAltitudeDeg(SOLAR_ECLIPSE_2026, latDeg, lonDeg);

  assert.ok(moonAlt > 0 && sunAlt > 0, 'both bodies are above the horizon at the eclipse site');
  // Geocentric positions, so the ~1 degree lunar parallax is not corrected for.
  assertClose(moonAlt, sunAlt, 2, 'moon altitude versus sun altitude');
});

test('angular separation covers the trivial geometries', () => {
  assertClose(angularSeparationDeg(10, 20, 10, 20), 0, 1e-6, 'identical positions');
  assertClose(angularSeparationDeg(0, 90, 123, 0), 90, 1e-6, 'pole to equator');
  assertClose(angularSeparationDeg(0, 0, 180, 0), 180, 1e-6, 'opposite points');
  assertClose(angularSeparationDeg(0, 0, 30, 0), 30, 1e-6, 'along the equator');
});

test('angular separation returns null for unusable input', () => {
  assert.equal(angularSeparationDeg(null, 0, 10, 10), null);
  assert.equal(angularSeparationDeg(0, undefined, 10, 10), null);
  assert.equal(angularSeparationDeg(0, 0, NaN, 10), null);
});

test('moon data omits the separation when the target has no coordinates', () => {
  const date = new Date('2026-02-01T22:00:00Z');
  const moon = getMoonEquatorial(date);

  const withTarget = getMoonDataForTarget(moon.raDeg, moon.decDeg, date);
  assertClose(withTarget.separationDeg, 0, 1e-6, 'separation to the moon itself');
  assert.equal(withTarget.at, date.toISOString());

  const withoutTarget = getMoonDataForTarget(null, null, date);
  assert.equal(withoutTarget.separationDeg, null);
  assert.ok(Number.isFinite(withoutTarget.illumination));
});

test('rise, transit and set sit where the altitude curve crosses the horizon', () => {
  // Betelgeuse from Berlin, window starts at local noon.
  const ra = 88.7929;
  const dec = 7.407;
  const lat = 52.52;
  const lon = 13.405;
  const start = new Date('2026-01-15T11:00:00Z');

  const events = getRiseTransitSet(ra, dec, start, lat, lon);
  assert.equal(events.status, 'normal');
  for (const key of ['rise', 'transit', 'set']) {
    assert.ok(events[key] instanceof Date, `${key} is a date`);
    assert.ok(events[key] >= start && events[key] <= new Date(start.getTime() + 86400000));
  }
  assertClose(
    equatorialToAltAz(ra, dec, events.rise, lat, lon).altDeg,
    0,
    0.01,
    'altitude at rise'
  );
  assertClose(equatorialToAltAz(ra, dec, events.set, lat, lon).altDeg, 0, 0.01, 'altitude at set');
  assertClose(
    ((localSiderealTimeDeg(events.transit, lon) - ra + 540) % 360) - 180,
    0,
    0.01,
    'hour angle at transit'
  );
  assert.ok(events.transit > events.rise, 'transit follows the rise');
  assert.ok(events.set > events.transit, 'set follows the transit');
});

test('rise/transit/set reports circumpolar and never-rising objects explicitly', () => {
  const start = new Date('2026-06-01T10:00:00Z');
  const polaris = getRiseTransitSet(37.95, 89.26, start, 52.52, 13.405);
  assert.equal(polaris.status, 'circumpolar');
  assert.equal(polaris.rise, null);
  assert.equal(polaris.set, null);
  assert.ok(polaris.transit instanceof Date, 'circumpolar objects still culminate');

  const canopus = getRiseTransitSet(95.99, -52.7, start, 52.52, 13.405);
  assert.deepEqual(canopus, { status: 'neverRises', rise: null, transit: null, set: null });

  assert.equal(getRiseTransitSet(NaN, 0, start, 50, 10), null);
  assert.equal(getRiseTransitSet(10, 0, 'not a date', 50, 10), null);
});

test('altAzToEquatorial inverts equatorialToAltAz', () => {
  const date = new Date('2026-11-22T20:00:00Z');
  for (const [lat, lon] of [
    [48.137, 11.575],
    [-33.9, 18.4],
  ]) {
    for (const [alt, az] of [
      [50, 1],
      [30, 120],
      [10, 250],
      [70, 181],
    ]) {
      const { raDeg, decDeg } = altAzToEquatorial(alt, az, date, lat, lon);
      const back = equatorialToAltAz(raDeg, decDeg, date, lat, lon);
      assert.ok(Math.abs(back.altDeg - alt) < 1e-6, `alt ${alt}/${az} at ${lat}`);
      assert.ok(
        Math.abs(((back.azDeg - az + 540) % 360) - 180) < 1e-6,
        `az ${alt}/${az} at ${lat}`
      );
    }
  }
});

test('altAzToEquatorial puts the northern pole altitude at the celestial pole', () => {
  const { decDeg } = altAzToEquatorial(48, 0, new Date('2026-11-22T20:00:00Z'), 48, 11);
  assert.ok(Math.abs(decDeg - 90) < 1e-6);
});
