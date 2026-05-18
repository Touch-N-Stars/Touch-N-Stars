// Planetary + Moon positions using Meeus low-accuracy orbital elements (Chap. 33).
// Accuracy: ~1° sufficient for slewing. No internet required.

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const K  = 0.01720209895; // Gaussian gravitational constant

import { dateToJD } from './orbital-mechanics.js';

// Planet mean elements: [L0, L1, a, e0, e1_per_cy, i0_deg, w0_deg, node0_deg]
// L = L0 + L1*T (mean longitude, degrees), T in Julian centuries from J2000
// Rates: all per century
const PLANET_ELEMENTS = {
  Mercury: [252.250906, 149474.0722491, 0.38709893, 0.20563069, 0.00002527, 7.00487, 77.45645, 48.33167],
  Venus:   [181.979801,  58519.2130302, 0.72333199, 0.00677323,-0.00004938, 3.39471,131.56370, 76.68069],
  Mars:    [355.433275,  19141.6964746, 1.52366231, 0.09341233, 0.00011902, 1.85061,336.04084, 49.57854],
  Jupiter: [ 34.351484,   3036.3027889, 5.20336301, 0.04839266,-0.00012880, 1.30530, 14.75385,100.55615],
  Saturn:  [ 50.077471,   1223.5110686, 9.53707032, 0.05415060,-0.00036762, 2.48446, 92.43194,113.71504],
  Uranus:  [314.055005,    429.8640561,19.19126393, 0.04716771,-0.00019150, 0.76986,170.96424, 74.22988],
  Neptune: [304.348665,    219.8833092,30.06896348, 0.00858587, 0.00002514, 1.76917, 44.97135,131.72169],
  Pluto:   [238.92881,     145.2078000,39.48168677, 0.24880766, 0.00006150,17.14175,224.06676,110.30347],
};

export const SOLAR_SYSTEM_BODIES = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
];

function mod360(x) { return ((x % 360) + 360) % 360; }

function earthElements(T) {
  // Earth: L, a, e (used as the reference in geocentric conversion)
  const L = mod360(100.464457 + 36000.7698278 * T);
  const a = 1.00000011;
  const e = 0.01671022 - 0.00003804 * T;
  const wLong = mod360(102.94719 + 1198.28 * T / 3600); // longitude of perihelion
  return { L, a, e, wLong };
}

function kepler(M, e) {
  // Newton-Raphson for E - e*sin(E) = M
  let E = M;
  for (let i = 0; i < 50; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

function helioEcliptic(L_deg, a, e, i_deg, wLong_deg, node_deg) {
  // Returns {x, y, z} in AU (heliocentric ecliptic J2000)
  const M = mod360(L_deg - wLong_deg) * DEG;
  const E = kepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r  = a * (1 - e * Math.cos(E));

  const w    = (wLong_deg - node_deg) * DEG; // argument of perihelion
  const node = node_deg * DEG;
  const inc  = i_deg * DEG;
  const wv   = w + nu;

  return {
    x: r * (Math.cos(node) * Math.cos(wv) - Math.sin(node) * Math.sin(wv) * Math.cos(inc)),
    y: r * (Math.sin(node) * Math.cos(wv) + Math.cos(node) * Math.sin(wv) * Math.cos(inc)),
    z: r * Math.sin(wv) * Math.sin(inc),
  };
}

function eclToEqu(x, y, z, T) {
  const eps = (23.439291111 - 0.013004167 * T) * DEG;
  return {
    xQ: x,
    yQ: y * Math.cos(eps) - z * Math.sin(eps),
    zQ: y * Math.sin(eps) + z * Math.cos(eps),
  };
}

function xyzToRaDec(xQ, yQ, zQ) {
  const dist = Math.sqrt(xQ * xQ + yQ * yQ + zQ * zQ);
  if (dist === 0) return null;
  const ra  = (Math.atan2(yQ, xQ) * RAD + 360) % 360;
  const dec = Math.asin(zQ / dist) * RAD;
  return { ra, dec, dist };
}

// ── Planet position ──────────────────────────────────────────────────────────

function planetRaDec(name, T) {
  const [L0, L1, a, e0, e1, i, w0, node0] = PLANET_ELEMENTS[name];
  const L    = mod360(L0 + L1 * T);
  const e    = e0 + e1 * T;
  const wLong = mod360(w0); // simplified: ignore small rate for perihelion long.
  const node  = mod360(node0);

  const earth = earthElements(T);

  const ph = helioEcliptic(L,           a,           e,    i, wLong, node);
  const eh = helioEcliptic(earth.L, earth.a, earth.e, 0.0, earth.wLong, 0);

  const gx = ph.x - eh.x;
  const gy = ph.y - eh.y;
  const gz = ph.z - eh.z;

  const { xQ, yQ, zQ } = eclToEqu(gx, gy, gz, T);
  return xyzToRaDec(xQ, yQ, zQ);
}

// ── Sun position (opposite to Earth's heliocentric) ─────────────────────────

function sunRaDec(T) {
  const earth = earthElements(T);
  const eh    = helioEcliptic(earth.L, earth.a, earth.e, 0, earth.wLong, 0);
  // Geocentric = -heliocentric Earth, then rotate ecliptic→equatorial
  const { xQ, yQ, zQ } = eclToEqu(-eh.x, -eh.y, -eh.z, T);
  return xyzToRaDec(xQ, yQ, zQ);
}

// ── Moon position (Meeus Chap. 47, simplified — ~10' accuracy) ──────────────

function moonRaDec(T) {
  // Fundamental arguments (degrees)
  const D  = mod360(297.85036 + 445267.111480 * T - 0.0019142 * T * T);
  const M  = mod360(357.52772 + 35999.050340 * T - 0.0001603 * T * T);
  const Mp = mod360(134.96298 + 477198.867398 * T + 0.0086972 * T * T);
  const F  = mod360(93.27191  + 483202.017538 * T - 0.0036825 * T * T);
  const Om = mod360(125.04452 - 1934.136261 * T  + 0.0020708 * T * T);

  const Dr  = D  * DEG, Mr = M * DEG, Mpr = Mp * DEG, Fr = F * DEG, Omr = Om * DEG;

  // Longitude correction (arcsec)
  const dL = 6288774 * Math.sin(Mpr)
            + 1274027 * Math.sin(2*Dr - Mpr)
            +  658314 * Math.sin(2*Dr)
            +  213618 * Math.sin(2*Mpr)
            -  185116 * Math.sin(Mr)
            -  114332 * Math.sin(2*Fr)
            +   58793 * Math.sin(2*Dr - 2*Mpr)
            +   57066 * Math.sin(2*Dr - Mr - Mpr)
            +   53322 * Math.sin(2*Dr + Mpr)
            +   45758 * Math.sin(2*Dr - Mr)
            -   40923 * Math.sin(Mr - Mpr)
            -   34720 * Math.sin(Dr)
            -   30383 * Math.sin(Mr + Mpr)
            +   15327 * Math.sin(2*Dr - 2*Fr)
            -   12528 * Math.sin(Mpr + 2*Fr)
            +   10980 * Math.sin(Mpr - 2*Fr)
            +   10675 * Math.sin(4*Dr - Mpr)
            +   10034 * Math.sin(3*Mpr)
            +    8548 * Math.sin(4*Dr - 2*Mpr)
            -    7888 * Math.sin(2*Dr + Mr - Mpr)
            -    6766 * Math.sin(2*Dr + Mr)
            -    5163 * Math.sin(Dr - Mpr)
            +    4987 * Math.sin(Dr + Mr)
            +    4036 * Math.sin(2*Dr - Mr + Mpr);

  // Latitude correction (arcsec)
  const dB =  5128122 * Math.sin(Fr)
            +  280602 * Math.sin(Mpr + Fr)
            +  277693 * Math.sin(Mpr - Fr)
            +  173237 * Math.sin(2*Dr - Fr)
            +   55413 * Math.sin(2*Dr - Mpr + Fr)
            +   46271 * Math.sin(2*Dr - Mpr - Fr)
            +   32573 * Math.sin(2*Dr + Fr)
            +   17198 * Math.sin(2*Mpr + Fr)
            +    9266 * Math.sin(2*Dr + Mpr - Fr)
            +    8822 * Math.sin(2*Mpr - Fr)
            +    8216 * Math.sin(2*Dr - Mr - Fr)
            +    4324 * Math.sin(2*Dr - 2*Mpr - Fr)
            +    4200 * Math.sin(2*Dr + Mpr + Fr)
            -    3359 * Math.sin(2*Dr + Mr - Fr)
            +    2463 * Math.sin(2*Dr - Mr - Mpr + Fr)
            +    2211 * Math.sin(2*Dr - Mr + Fr)
            +    2065 * Math.sin(2*Dr - Mr - Mpr - Fr);

  // Apparent longitude and latitude
  const L0moon = mod360(218.3164477 + 481267.88123421 * T);
  const lamb   = (L0moon + dL / 3600000) * DEG;
  const beta   = (dB / 3600000) * DEG;
  // Moon distance (km) — needed only for dist, skip
  const dist   = (385000.56 + 20905355 * Math.cos(Mpr) / 1000) / 149597870.7; // AU

  // Nutation in longitude (simplified)
  const dPsi = (-17.20 / 3600 * Math.sin(Omr)) * DEG;
  const appLamb = lamb + dPsi;

  // Ecliptic → equatorial
  const xE = dist * Math.cos(beta) * Math.cos(appLamb);
  const yE = dist * Math.cos(beta) * Math.sin(appLamb);
  const zE = dist * Math.sin(beta);

  const { xQ, yQ, zQ } = eclToEqu(xE, yE, zE, T);
  return xyzToRaDec(xQ, yQ, zQ);
}

// ── Public API ───────────────────────────────────────────────────────────────

export function calcSolarSystemRaDec(bodyName, date) {
  const jd = dateToJD(date);
  const T  = (jd - 2451545.0) / 36525;

  if (bodyName === 'Sun')  return sunRaDec(T);
  if (bodyName === 'Moon') return moonRaDec(T);
  if (PLANET_ELEMENTS[bodyName]) return planetRaDec(bodyName, T);
  return null;
}

// ── JWST via JPL Horizons ────────────────────────────────────────────────────
// Returns { ra, dec } in degrees (J2000) or throws.

export async function fetchJWSTPosition() {
  const now  = new Date();
  const stop = new Date(now.getTime() + 3600_000); // +1h

  const fmt = (d) => d.toISOString().slice(0, 16).replace('T', ' ');
  const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  url.searchParams.set('format', 'json');
  url.searchParams.set('COMMAND', "'James Webb Space Telescope'");
  url.searchParams.set('OBJ_DATA', "'NO'");
  url.searchParams.set('MAKE_EPHEM', "'YES'");
  url.searchParams.set('EPHEM_TYPE', "'OBSERVER'");
  url.searchParams.set('CENTER', "'500@399'");
  url.searchParams.set('START_TIME', `'${fmt(now)}'`);
  url.searchParams.set('STOP_TIME', `'${fmt(stop)}'`);
  url.searchParams.set('STEP_SIZE', "'1 h'");
  url.searchParams.set('QUANTITIES', "'1'");

  const resp = await fetch(url.toString(), { mode: 'cors', cache: 'no-cache' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const json = await resp.json();
  const text = json.result;
  if (!text) throw new Error('No result from Horizons');

  // Parse observer table — look for $$SOE…$$EOE block
  const soe = text.indexOf('$$SOE');
  const eoe = text.indexOf('$$EOE');
  if (soe < 0 || eoe < 0) throw new Error('Horizons: no ephemeris data in response');

  const block = text.slice(soe + 5, eoe).trim();
  const line  = block.split('\n')[0].trim(); // first epoch line
  // Format: "2026-May-16 20:00     12 34 56.78 +45 20 30.1 ..."
  // RA and Dec are after the date+time field (20 chars)
  const fields = line.replace(/\s+/g, ' ').split(' ');
  // fields: [date, time, raH, raM, raS, decSign+D, decM, decS, ...]
  const raH = parseFloat(fields[2]);
  const raM = parseFloat(fields[3]);
  const raS = parseFloat(fields[4]);
  const decRaw = fields[5]; // e.g. "+45" or "-05"
  const decSign = decRaw.startsWith('-') ? -1 : 1;
  const decD = Math.abs(parseFloat(decRaw));
  const decM = parseFloat(fields[6]);
  const decS = parseFloat(fields[7]);

  const ra  = (raH + raM / 60 + raS / 3600) * 15;
  const dec = decSign * (decD + decM / 60 + decS / 3600);

  if (!isFinite(ra) || !isFinite(dec)) throw new Error('Horizons: could not parse RA/Dec from response');

  return { ra, dec, dist: null, validUntil: stop.toISOString() };
}
