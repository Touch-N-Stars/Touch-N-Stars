const VALID_FRAMES = new Set(['ICRS', 'J2000']);

// Transpose of the IAU SOFA 2023-10-11 iauFk5hip orientation matrix:
// Hipparcos/ICRS to FK5 equinox and epoch J2000.0.
// https://www.iausofa.org/current-software
const ICRS_TO_J2000 = [
  [0.9999999999999929, -0.00000011102233084587464, -0.00000004411805033656962],
  [0.00000011102233510229197, 0.9999999999999892, 0.00000009647792009175314],
  [0.00000004411803962536558, -0.00000009647792498984142, 0.9999999999999943],
];
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const ARCSEC_TO_RAD = DEG_TO_RAD / 3600;
const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12);
const JULIAN_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export function normalizeRaDeg(value) {
  if (value >= 0 && value < 360) return value;
  return ((value % 360) + 360) % 360;
}

export function toAtlasCoordinates({ raDeg, decDeg, frame, epochJulianYear }) {
  if (!Number.isFinite(raDeg) || !Number.isFinite(decDeg)) {
    throw new TypeError('Atlas coordinates require finite decimal degrees');
  }
  if (!VALID_FRAMES.has(frame)) {
    throw new TypeError('Atlas coordinates require an explicit ICRS or J2000 frame');
  }
  if (decDeg < -90 || decDeg > 90) throw new RangeError('Declination is outside [-90, 90]');
  if (frame === 'J2000' && epochJulianYear !== undefined && !Number.isFinite(epochJulianYear)) {
    throw new TypeError('J2000 epochJulianYear must be finite when supplied');
  }
  return {
    raDeg: normalizeRaDeg(raDeg),
    decDeg,
    frame,
    ...(epochJulianYear === undefined ? {} : { epochJulianYear }),
  };
}

export function ninaObserverToAtlas(astrometrySettings) {
  const latitudeDeg = astrometrySettings?.Latitude;
  const longitudeDeg = astrometrySettings?.Longitude;
  const elevationM = astrometrySettings?.Elevation ?? 0;
  if (![latitudeDeg, longitudeDeg, elevationM].every(Number.isFinite)) {
    throw new TypeError('NINA astrometry settings do not contain a finite observer');
  }
  if (latitudeDeg < -90 || latitudeDeg > 90) throw new RangeError('Observer latitude is invalid');
  return {
    latitudeDeg,
    longitudeDeg: ((((longitudeDeg + 180) % 360) + 360) % 360) - 180,
    elevationM,
  };
}

function precessEquatorialCoordinates(raDeg, decDeg, fromEpochJulianYear, toEpochJulianYear) {
  const centuriesFromJ2000 = (fromEpochJulianYear - 2000) / 100;
  const elapsedCenturies = (toEpochJulianYear - fromEpochJulianYear) / 100;
  const elapsedCenturiesSquared = elapsedCenturies * elapsedCenturies;
  const elapsedCenturiesCubed = elapsedCenturiesSquared * elapsedCenturies;
  const startCenturiesSquared = centuriesFromJ2000 * centuriesFromJ2000;

  // IAU 1976 precession angles (Meeus, Astronomical Algorithms, chapter 21).
  // NINA's JNOW coordinates are equinox-of-date; applying the inverse rotation
  // gives the J2000 coordinates required by the Atlas boundary.
  const zeta =
    ((2306.2181 + 1.39656 * centuriesFromJ2000 - 0.000139 * startCenturiesSquared) *
      elapsedCenturies +
      (0.30188 - 0.000344 * centuriesFromJ2000) * elapsedCenturiesSquared +
      0.017998 * elapsedCenturiesCubed) *
    ARCSEC_TO_RAD;
  const z =
    ((2306.2181 + 1.39656 * centuriesFromJ2000 - 0.000139 * startCenturiesSquared) *
      elapsedCenturies +
      (1.09468 + 0.000066 * centuriesFromJ2000) * elapsedCenturiesSquared +
      0.018203 * elapsedCenturiesCubed) *
    ARCSEC_TO_RAD;
  const theta =
    ((2004.3109 - 0.8533 * centuriesFromJ2000 - 0.000217 * startCenturiesSquared) *
      elapsedCenturies -
      (0.42665 + 0.000217 * centuriesFromJ2000) * elapsedCenturiesSquared -
      0.041833 * elapsedCenturiesCubed) *
    ARCSEC_TO_RAD;

  const ra = raDeg * DEG_TO_RAD;
  const dec = decDeg * DEG_TO_RAD;
  const a = Math.cos(dec) * Math.sin(ra + zeta);
  const b = Math.cos(theta) * Math.cos(dec) * Math.cos(ra + zeta) - Math.sin(theta) * Math.sin(dec);
  const c = Math.sin(theta) * Math.cos(dec) * Math.cos(ra + zeta) + Math.cos(theta) * Math.sin(dec);

  return {
    raDeg: normalizeRaDeg((Math.atan2(a, b) + z) * RAD_TO_DEG),
    decDeg: Math.asin(Math.max(-1, Math.min(1, c))) * RAD_TO_DEG,
  };
}

export function ninaMountToAtlas(mountInfo, timestampUtcMs = Date.now()) {
  if (!mountInfo?.Connected) return null;
  const source = mountInfo.Coordinates ?? {};
  const rawEpoch = source.Epoch ?? mountInfo.EquatorialSystem;
  const epoch = String(rawEpoch ?? '').toUpperCase();
  if (epoch !== 'J2000' && epoch !== 'JNOW') {
    throw new TypeError(`Unsupported mount coordinate epoch: ${rawEpoch ?? 'unknown'}`);
  }
  let raDeg = source.RADegrees ?? (source.RA ?? mountInfo.RightAscension) * 15;
  let decDeg = source.Dec ?? mountInfo.Declination;
  if (epoch === 'JNOW') {
    const coordinateTime = Date.parse(source.DateTime?.UtcNow ?? '');
    const epochTimestampUtcMs = Number.isFinite(coordinateTime) ? coordinateTime : timestampUtcMs;
    const epochJulianYear = 2000 + (epochTimestampUtcMs - J2000_UTC_MS) / JULIAN_YEAR_MS;
    ({ raDeg, decDeg } = precessEquatorialCoordinates(raDeg, decDeg, epochJulianYear, 2000));
  }
  return {
    coordinates: toAtlasCoordinates({
      raDeg,
      decDeg,
      frame: 'J2000',
      epochJulianYear: 2000,
    }),
    connected: true,
    stale: Boolean(mountInfo.Stale),
    timestampUtcMs,
  };
}

export function toNinaJ2000Coordinates(value) {
  const coordinates = toAtlasCoordinates(value);
  if (coordinates.frame === 'J2000') {
    return {
      raDeg: coordinates.raDeg,
      decDeg: coordinates.decDeg,
      frame: 'J2000',
      epochJulianYear: 2000,
    };
  }

  const ra = coordinates.raDeg * DEG_TO_RAD;
  const dec = coordinates.decDeg * DEG_TO_RAD;
  const cosDec = Math.cos(dec);
  const vector = [cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec)];
  const [x, y, z] = ICRS_TO_J2000.map(
    (row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]
  );

  return {
    raDeg: normalizeRaDeg(Math.atan2(y, x) * RAD_TO_DEG),
    decDeg: Math.atan2(z, Math.hypot(x, y)) * RAD_TO_DEG,
    frame: 'J2000',
    epochJulianYear: 2000,
  };
}

export function atlasSearchResultToTarget(result) {
  if (!result || typeof result !== 'object') {
    throw new TypeError('Atlas search result is required');
  }
  const id = result.id ?? result.catalogId;
  const name = result.name || id;
  if (typeof id !== 'string' || !id.trim() || typeof name !== 'string' || !name.trim()) {
    throw new TypeError('Atlas search result requires an id and name');
  }
  const coordinates = toAtlasCoordinates(result.coordinates ?? result);
  return {
    id,
    uid: result.uid,
    searchOnly: result.searchOnly,
    crossIdSources: result.crossIdSources,
    name,
    displayName: result.displayName,
    aliases: result.aliases,
    objectType: result.type,
    parentBody: result.parentBody,
    magnitude: result.mag ?? result.magnitude,
    catalogueSource: result.catalogSource,
    coordinates,
  };
}

export function atlasSelectionToFraming(target) {
  if (!target?.name) throw new TypeError('Selected target requires a name');
  const sourceCoordinates = toAtlasCoordinates(target.coordinates ?? {});
  const coordinates = toNinaJ2000Coordinates(sourceCoordinates);
  return {
    Name: target.name,
    RA: coordinates.raDeg,
    Dec: coordinates.decDeg,
    coordinateFrame: 'J2000',
    epochJulianYear: 2000,
    sourceCoordinateFrame: sourceCoordinates.frame,
  };
}
