// Sun and moon ephemerides plus the coordinate transforms around them.
//
// These are the low-accuracy series from Meeus' "Astronomical Algorithms":
// a deliberate approximation, good to roughly a degree for the moon and a few
// arc minutes for the sun. That is far more than enough for altitude curves,
// twilight shading and moon-distance warnings, and it keeps the whole thing
// dependency-free and synchronous.

export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function normalizeDeg360(deg) {
  return ((deg % 360) + 360) % 360;
}

export function clampValue(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function toJulianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function daysSinceJ2000(date) {
  return toJulianDate(date) - 2451545.0;
}

// Greenwich mean sidereal time in degrees.
export function gmstDeg(date) {
  const jd = toJulianDate(date);
  const t = (jd - 2451545.0) / 36525.0;
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38710000.0;
  return normalizeDeg360(gmst);
}

// Local sidereal time in degrees, longitude east-positive.
export function localSiderealTimeDeg(date, lonDeg) {
  return normalizeDeg360(gmstDeg(date) + lonDeg);
}

// RA/Dec (deg) at a given time and site -> altitude/azimuth (deg).
// Azimuth is measured from north towards east.
export function equatorialToAltAz(raDeg, decDeg, date, latDeg, lonDeg) {
  const ra = toRad(raDeg);
  const dec = toRad(decDeg);
  const lat = toRad(latDeg);
  const lst = toRad(localSiderealTimeDeg(date, lonDeg));
  const hourAngle = lst - ra;

  const sinAlt =
    Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(hourAngle);
  const alt = Math.asin(clampValue(sinAlt, -1, 1));

  const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat));
  let az = Math.acos(clampValue(cosAz, -1, 1));
  // Resolve the quadrant: a positive hour angle means the body is west of the meridian.
  if (Math.sin(hourAngle) > 0) az = 2 * Math.PI - az;

  return { altDeg: toDeg(alt), azDeg: toDeg(az) };
}

// Altitude/azimuth (deg, azimuth from north towards east) at a given time and site -> RA/Dec
// (deg) of date. The inverse of equatorialToAltAz, without refraction.
export function altAzToEquatorial(altDeg, azDeg, date, latDeg, lonDeg) {
  const alt = toRad(altDeg);
  const az = toRad(azDeg);
  const lat = toRad(latDeg);

  const sinDec = Math.sin(alt) * Math.sin(lat) + Math.cos(alt) * Math.cos(lat) * Math.cos(az);
  const dec = Math.asin(clampValue(sinDec, -1, 1));
  // Hour angle, positive west of the meridian.
  const hourAngle = Math.atan2(
    -Math.sin(az) * Math.cos(alt),
    Math.cos(lat) * Math.sin(alt) - Math.sin(lat) * Math.cos(alt) * Math.cos(az)
  );
  const raDeg = normalizeDeg360(localSiderealTimeDeg(date, lonDeg) - toDeg(hourAngle));

  return { raDeg, decDeg: toDeg(dec) };
}

export function eclipticToEquatorial(lambdaDeg, betaDeg, date) {
  const epsDeg = 23.439291 - 0.00000036 * daysSinceJ2000(date);

  const lambda = toRad(lambdaDeg);
  const beta = toRad(betaDeg);
  const eps = toRad(epsDeg);

  const sinDec = Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda);
  const dec = Math.asin(clampValue(sinDec, -1, 1));

  const y = Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps);
  const x = Math.cos(lambda);
  const ra = Math.atan2(y, x);

  return {
    raDeg: normalizeDeg360(toDeg(ra)),
    decDeg: toDeg(dec),
  };
}

export function getSunEquatorial(date) {
  const d = daysSinceJ2000(date);
  const meanAnomaly = normalizeDeg360(357.52911 + 0.98560028 * d);
  const meanLongitude = normalizeDeg360(280.46646 + 0.98564736 * d);

  // Equation of the center
  const c =
    1.914602 * Math.sin(toRad(meanAnomaly)) +
    0.019993 * Math.sin(toRad(2 * meanAnomaly)) +
    0.000289 * Math.sin(toRad(3 * meanAnomaly));

  const lambda = normalizeDeg360(meanLongitude + c);
  return eclipticToEquatorial(lambda, 0, date);
}

export function getMoonEquatorial(date) {
  const d = daysSinceJ2000(date);

  const meanLongitude = normalizeDeg360(218.316 + 13.176396 * d);
  const meanAnomalyMoon = normalizeDeg360(134.963 + 13.064993 * d);
  const meanAnomalySun = normalizeDeg360(357.529 + 0.98560028 * d);
  const meanElongation = normalizeDeg360(297.85 + 12.190749 * d);
  const argOfLatitude = normalizeDeg360(93.272 + 13.22935 * d);

  const lon =
    meanLongitude +
    6.289 * Math.sin(toRad(meanAnomalyMoon)) +
    1.274 * Math.sin(toRad(2 * meanElongation - meanAnomalyMoon)) +
    0.658 * Math.sin(toRad(2 * meanElongation)) +
    0.214 * Math.sin(toRad(2 * meanAnomalyMoon)) -
    0.186 * Math.sin(toRad(meanAnomalySun)) -
    0.059 * Math.sin(toRad(2 * meanElongation - 2 * meanAnomalyMoon)) -
    0.057 * Math.sin(toRad(2 * meanElongation - meanAnomalySun - meanAnomalyMoon)) +
    0.053 * Math.sin(toRad(2 * meanElongation + meanAnomalyMoon)) +
    0.046 * Math.sin(toRad(2 * meanElongation - meanAnomalySun)) +
    0.041 * Math.sin(toRad(meanAnomalySun - meanAnomalyMoon)) -
    0.035 * Math.sin(toRad(meanElongation)) -
    0.031 * Math.sin(toRad(meanAnomalySun + meanAnomalyMoon)) -
    0.015 * Math.sin(toRad(2 * argOfLatitude - 2 * meanElongation)) +
    0.011 * Math.sin(toRad(meanAnomalyMoon - 4 * meanElongation));

  const lat =
    5.128 * Math.sin(toRad(argOfLatitude)) +
    0.28 * Math.sin(toRad(meanAnomalyMoon + argOfLatitude)) +
    0.277 * Math.sin(toRad(meanAnomalyMoon - argOfLatitude)) +
    0.173 * Math.sin(toRad(2 * meanElongation - argOfLatitude)) +
    0.055 * Math.sin(toRad(2 * meanElongation + argOfLatitude - meanAnomalyMoon)) +
    0.046 * Math.sin(toRad(2 * meanElongation - argOfLatitude - meanAnomalyMoon)) +
    0.033 * Math.sin(toRad(2 * meanElongation + argOfLatitude)) +
    0.017 * Math.sin(toRad(2 * meanAnomalyMoon + argOfLatitude));

  return eclipticToEquatorial(normalizeDeg360(lon), lat, date);
}

export function getSunAltitudeDeg(date, latDeg, lonDeg) {
  const sun = getSunEquatorial(date);
  return equatorialToAltAz(sun.raDeg, sun.decDeg, date, latDeg, lonDeg).altDeg;
}

export function getMoonAltitudeDeg(date, latDeg, lonDeg) {
  const moon = getMoonEquatorial(date);
  return equatorialToAltAz(moon.raDeg, moon.decDeg, date, latDeg, lonDeg).altDeg;
}

export function angularSeparationDeg(ra1Deg, dec1Deg, ra2Deg, dec2Deg) {
  if (![ra1Deg, dec1Deg, ra2Deg, dec2Deg].every(Number.isFinite)) return null;

  const ra1 = toRad(ra1Deg);
  const dec1 = toRad(dec1Deg);
  const ra2 = toRad(ra2Deg);
  const dec2 = toRad(dec2Deg);

  const cosSep =
    Math.sin(dec1) * Math.sin(dec2) + Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2);

  return toDeg(Math.acos(clampValue(cosSep, -1, 1)));
}

export function getMoonIllumination(date) {
  const sun = getSunEquatorial(date);
  const moon = getMoonEquatorial(date);
  const elongationDeg = angularSeparationDeg(sun.raDeg, sun.decDeg, moon.raDeg, moon.decDeg);

  // Fraction illuminated: 0 = new moon, 1 = full moon
  const illumination = elongationDeg == null ? null : (1 - Math.cos(toRad(elongationDeg))) / 2;

  return {
    illumination,
    sun,
    moon,
    elongationDeg,
  };
}

// Moon data relative to one target. Without usable target coordinates the
// separation is null rather than NaN, so callers can simply omit it.
export function getMoonDataForTarget(targetRaDeg, targetDecDeg, date) {
  const { illumination, moon } = getMoonIllumination(date);
  const separationDeg =
    Number.isFinite(targetRaDeg) && Number.isFinite(targetDecDeg)
      ? angularSeparationDeg(targetRaDeg, targetDecDeg, moon.raDeg, moon.decDeg)
      : null;

  return {
    illumination,
    separationDeg,
    moonRaDeg: moon.raDeg,
    moonDecDeg: moon.decDeg,
    at: date instanceof Date ? date.toISOString() : null,
  };
}

const SIDEREAL_RATE_DEG_PER_MS = 360.98564736629 / 86400000;
const SIDEREAL_DAY_MS = 360 / SIDEREAL_RATE_DEG_PER_MS;

// Rise, transit and set of a fixed RA/Dec inside one window (default 24 h from
// windowStart). Geometric horizon (altitude 0°, no refraction) so the times sit
// exactly where the altitude curve crosses zero. `status` separates the two
// "no crossing" cases: 'circumpolar' still carries the transit (the culmination
// is what the observer wants to know), 'neverRises' carries nothing. Returns
// null for unusable input.
export function getRiseTransitSet(raDeg, decDeg, windowStart, latDeg, lonDeg, windowMs = 86400000) {
  if (![raDeg, decDeg, latDeg, lonDeg].every(Number.isFinite)) return null;
  if (!(windowStart instanceof Date) || !Number.isFinite(windowStart.getTime())) return null;

  const startMs = windowStart.getTime();
  const endMs = startMs + windowMs;

  // First transit (hour angle 0) after the window start; every other event is
  // an offset from it and gets shifted by whole sidereal days into the window.
  const hourAngleDeg = normalizeDeg360(localSiderealTimeDeg(windowStart, lonDeg) - raDeg);
  const firstTransitMs = startMs + ((360 - hourAngleDeg) % 360) / SIDEREAL_RATE_DEG_PER_MS;
  const inWindow = (ms) => {
    let time = ms;
    while (time < startMs) time += SIDEREAL_DAY_MS;
    while (time - SIDEREAL_DAY_MS >= startMs) time -= SIDEREAL_DAY_MS;
    return time <= endMs ? new Date(time) : null;
  };

  const lat = toRad(latDeg);
  const dec = toRad(decDeg);
  const cosH0 = -(Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
  const transit = inWindow(firstTransitMs);

  if (!Number.isFinite(cosH0)) {
    // Observer at a pole: the object either never sets or never rises.
    return Math.sin(lat) * Math.sin(dec) > 0
      ? { status: 'circumpolar', rise: null, transit, set: null }
      : { status: 'neverRises', rise: null, transit: null, set: null };
  }
  if (cosH0 < -1) return { status: 'circumpolar', rise: null, transit, set: null };
  if (cosH0 > 1) return { status: 'neverRises', rise: null, transit: null, set: null };

  const halfArcMs = toDeg(Math.acos(cosH0)) / SIDEREAL_RATE_DEG_PER_MS;
  return {
    status: 'normal',
    rise: inWindow(firstTransitMs - halfArcMs),
    transit,
    set: inWindow(firstTransitMs + halfArcMs),
  };
}
