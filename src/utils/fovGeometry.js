// Camera FOV geometry helpers for the Stellarium FOV overlay.
// Pure functions — no Vue / Pinia / engine dependencies.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function computeCameraFovDeg({
  pixelSizeMicrons,
  focalLengthMm,
  sensorWidthPx,
  sensorHeightPx,
}) {
  if (!pixelSizeMicrons || !focalLengthMm || !sensorWidthPx || !sensorHeightPx) {
    return { fovX: 0, fovY: 0 };
  }
  const pixelSizeM = pixelSizeMicrons / 1_000_000;
  const focalLengthM = focalLengthMm / 1000;
  const sensorWidthM = sensorWidthPx * pixelSizeM;
  const sensorHeightM = sensorHeightPx * pixelSizeM;
  const fovX = 2 * Math.atan(sensorWidthM / 2 / focalLengthM) * R2D;
  const fovY = 2 * Math.atan(sensorHeightM / 2 / focalLengthM) * R2D;
  return { fovX, fovY };
}

function s2c(raDeg, decDeg) {
  const ra = raDeg * D2R;
  const dec = decDeg * D2R;
  const cd = Math.cos(dec);
  return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
}

function c2s(v) {
  const r = Math.hypot(v[0], v[1], v[2]);
  const dec = Math.asin(v[2] / r) * R2D;
  let ra = Math.atan2(v[1], v[0]) * R2D;
  if (ra < 0) ra += 360;
  return [ra, dec];
}

function normalize(v) {
  const r = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / r, v[1] / r, v[2] / r];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// Build a GeoJSON FeatureCollection containing a single closed-ring rectangular
// polygon representing the camera field of view on the sky.
//
// Coordinates are emitted in [lonDeg, latDeg] = [raDeg, decDeg] (J2000-ish ICRF).
// The four corners are constructed in the local tangent plane around (ra, dec)
// using cartesian east/north basis vectors, so the result stays well-behaved
// near the poles and for non-tiny FOVs.
//
// rotationDeg rotates the rectangle clockwise as seen on the sky (matches the
// convention used elsewhere in the app for rotator mechanical position).
export function buildFovPolygonGeoJSON({
  raDeg,
  decDeg,
  fovXDeg,
  fovYDeg,
  rotationDeg = 0,
  fillColor = '#00ff00',
  fillOpacity = 0.15,
  strokeColor = '#00ff00',
  strokeOpacity = 1,
  strokeWidth = 1,
  title = null,
}) {
  const c0 = s2c(raDeg, decDeg);
  const ra = raDeg * D2R;
  let east = [-Math.sin(ra), Math.cos(ra), 0];
  if (Math.hypot(east[0], east[1], east[2]) < 1e-9) {
    east = [1, 0, 0];
  } else {
    east = normalize(east);
  }
  const north = normalize(cross(c0, east));

  const halfX = fovXDeg / 2;
  const halfY = fovYDeg / 2;
  const cornersLocal = [
    [-halfX, -halfY],
    [halfX, -halfY],
    [halfX, halfY],
    [-halfX, halfY],
  ];

  // Position angle convention (matches NINA plate-solve PositionAngle):
  // 0° = top of frame toward celestial north, increasing toward east.
  const cosR = Math.cos(-rotationDeg * D2R);
  const sinR = Math.sin(-rotationDeg * D2R);

  const ring = cornersLocal.map(([dx, dy]) => {
    const dxr = dx * cosR - dy * sinR;
    const dyr = dx * sinR + dy * cosR;
    const ex = dxr * D2R;
    const ny = dyr * D2R;
    const p = normalize([
      c0[0] + ex * east[0] + ny * north[0],
      c0[1] + ex * east[1] + ny * north[1],
      c0[2] + ex * east[2] + ny * north[2],
    ]);
    return c2s(p);
  });
  ring.push([ring[0][0], ring[0][1]]);

  const properties = {
    fill: fillColor,
    'fill-opacity': fillOpacity,
    stroke: strokeColor,
    'stroke-opacity': strokeOpacity,
    'stroke-width': strokeWidth,
  };
  if (title) properties.title = title;

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties,
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
      },
    ],
  };
}

export const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};
