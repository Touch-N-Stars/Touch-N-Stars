// Horizon file (.hrz) parsing, export, and coordinate conversion.
// Inspired by christian-photo/HorizonCreator (MPL 2.0). No code copied.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// Parse NINA .hrz format: lines of "AZM  ALT" (degrees, whitespace-separated)
export function parseHrz(text) {
  const points = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const az = parseFloat(parts[0]);
    const alt = parseFloat(parts[1]);
    if (isFinite(az) && isFinite(alt)) points.push({ az, alt });
  }
  return points.sort((a, b) => a.az - b.az);
}

// Export to NINA .hrz format
export function exportHrz(points) {
  return [...points]
    .sort((a, b) => a.az - b.az)
    .map((p) => `${p.az.toFixed(2).padStart(6)}      ${p.alt.toFixed(2).padStart(5)}`)
    .join('\n');
}

// Linear interpolation of horizon altitude at a given azimuth (wraps 0/360)
function interpAlt(sorted, az) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0].alt;

  let lo = null;
  let hi = null;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].az <= az) lo = sorted[i];
    if (sorted[i].az >= az && hi === null) hi = sorted[i];
  }
  if (!lo) lo = sorted[sorted.length - 1];
  if (!hi) hi = sorted[0];
  if (lo.az === hi.az) return lo.alt;

  let span = hi.az - lo.az;
  let pos = az - lo.az;
  if (span < 0) span += 360;
  if (pos < 0) pos += 360;

  return lo.alt + (span > 0 ? pos / span : 0) * (hi.alt - lo.alt);
}

// Fill horizon at every `step` degrees of azimuth (0..359)
export function interpolateHorizon(points, step = 2) {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.az - b.az);
  const result = [];
  for (let az = 0; az < 360; az += step) {
    result.push({ az, alt: interpAlt(sorted, az) });
  }
  return result;
}

// Local Sidereal Time (radians) from MJD and observer longitude (radians)
export function mjdToLST(mjd, lonRad) {
  const JD = mjd + 2400000.5;
  const T = (JD - 2451545.0) / 36525;
  const GMST = 280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T * T;
  return (((GMST * D2R + lonRad) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

// Alt/Az (degrees, geographic N=0° E=90°) → { raDeg, decDeg } (ICRF J2000-ish)
// latRad: observer latitude in radians; lstRad: local sidereal time in radians
export function altAzToRaDec(altDeg, azDeg, latRad, lstRad) {
  const alt = altDeg * D2R;
  const az = azDeg * D2R;

  const sinDec = Math.sin(latRad) * Math.sin(alt) + Math.cos(latRad) * Math.cos(alt) * Math.cos(az);
  const decRad = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const H = Math.atan2(
    -Math.sin(az),
    Math.tan(alt) * Math.cos(latRad) - Math.cos(az) * Math.sin(latRad)
  );

  const ra = ((lstRad - H) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return { raDeg: ra * R2D, decDeg: decRad * R2D };
}

// Build a GeoJSON FeatureCollection (LineString) for the Stellarium overlay
export function buildHorizonGeoJSON(points, latRad, lonRad, mjd) {
  if (points.length < 2) return { type: 'FeatureCollection', features: [] };

  const lst = mjdToLST(mjd, lonRad);
  const interp = interpolateHorizon(points, 2);
  interp.push({ az: interp[0].az, alt: interp[0].alt }); // close the loop

  const coords = interp.map(({ az, alt }) => {
    const { raDeg, decDeg } = altAzToRaDec(alt, az, latRad, lst);
    return [raDeg, decDeg];
  });

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          stroke: '#ff6600',
          'stroke-opacity': 0.9,
          'stroke-width': 2,
        },
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  };
}
