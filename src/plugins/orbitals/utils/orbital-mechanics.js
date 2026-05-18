// Orbital mechanics for comets and asteroids.
// Algorithm: direct Kepler equation solver + ecliptic→equatorial rotation (Meeus, Astronomical Algorithms).

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const K = 0.01720209895; // Gaussian gravitational constant (AU^1.5/day)

export function dateToJD(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Gregorian year/month/fractional-day → Julian Date
export function ymdfToJD(year, month, day) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

// Earth's heliocentric ecliptic J2000 position (AU)
// T: Julian centuries from J2000
function earthPosition(T) {
  const Ld = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
  const Md = (((357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360) + 360) % 360;
  const Mr = Md * DEG;
  const e = 0.016708634 - 0.000042037 * T;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);
  const sunLong = ((Ld + C) % 360) * DEG;
  const sunAnom = ((Md + C) % 360) * DEG;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(sunAnom));
  return { x: -R * Math.cos(sunLong), y: -R * Math.sin(sunLong), z: 0 };
}

// Solve Kepler's equation for true anomaly ν and radius r.
// elements: { e, q, tp_jd } for comets  |  { e, a, epoch_jd, M0_deg } for asteroids
function solveOrbit(e, q_or_a, tp_or_epoch_jd, jd, isAsteroid = false) {
  let dt;
  let q;
  let a;

  if (isAsteroid) {
    a = q_or_a;
    const M0_deg = tp_or_epoch_jd._M0; // stashed by caller
    const epoch = tp_or_epoch_jd._epoch;
    const n = K / Math.pow(a, 1.5);
    const M0 = M0_deg * DEG;
    let M = (((M0 + n * (jd - epoch)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return solveElliptic(e, a, M);
  } else {
    dt = jd - tp_or_epoch_jd;
    q = q_or_a;
  }

  if (e < 0.98) {
    a = q / (1 - e);
    const n = K / Math.pow(a, 1.5);
    let M = (((n * dt) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return solveElliptic(e, a, M);
  } else if (e <= 1.0 + 1e-6) {
    return solveNearParabolic(e, q, dt);
  } else {
    return solveHyperbolic(e, q, dt);
  }
}

function solveElliptic(e, a, M) {
  // Halley's method — converges faster near e ≈ 1
  let E = M;
  for (let i = 0; i < 100; i++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const fpp = e * Math.sin(E);
    const dE = -f / (fp - (0.5 * f * fpp) / fp);
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  return { nu, r };
}

function solveNearParabolic(e, q, dt) {
  // Barker's equation — exact for e=1; good approximation for near-parabolic
  const W = (3 * K * dt) / (Math.sqrt(2) * q * Math.sqrt(q));
  const G = W / 2;
  const Y = Math.cbrt(G + Math.sqrt(G * G + 1));
  const s = Y - 1 / Y;
  const nu = 2 * Math.atan(s);
  const r = q * (1 + s * s);
  return { nu, r };
}

function solveHyperbolic(e, q, dt) {
  const a = q / (e - 1);
  const n = K / Math.pow(a, 1.5);
  const Mh = n * dt;
  // Initial guess from Mh and e
  let F = Math.sign(Mh) * Math.log((2 * Math.abs(Mh)) / e + 1.8);
  for (let i = 0; i < 100; i++) {
    const dF = (Mh - e * Math.sinh(F) + F) / (e * Math.cosh(F) - 1);
    F += dF;
    if (Math.abs(dF) < 1e-12) break;
  }
  const nu = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(F / 2));
  const r = a * (e * Math.cosh(F) - 1);
  return { nu, r };
}

// Calculate RA/Dec (J2000, degrees) for a comet or asteroid at `date`.
// element shapes:
//   comet:    { type:'comet',    e, q, i, w, node, tp_jd, ... }
//   asteroid: { type:'asteroid', e, a, i, w, node, epoch_jd, M0_deg, ... }
export function calcRaDec(el, date) {
  const jd = dateToJD(date);
  const T = (jd - 2451545.0) / 36525;

  const { e, i, w, node } = el;
  const ir = i * DEG,
    wr = w * DEG,
    nr = node * DEG;

  let solved;
  try {
    if (el.type === 'asteroid') {
      const sentinel = { _M0: el.M0_deg, _epoch: el.epoch_jd };
      solved = solveOrbit(e, el.a, sentinel, jd, true);
    } else {
      solved = solveOrbit(e, el.q, el.tp_jd, jd, false);
    }
  } catch {
    return null;
  }

  const { nu, r } = solved;
  if (!isFinite(r) || r <= 0 || !isFinite(nu)) return null;

  // Heliocentric ecliptic J2000
  const cos_i = Math.cos(ir),
    sin_i = Math.sin(ir);
  const cos_n = Math.cos(nr),
    sin_n = Math.sin(nr);
  const wv = wr + nu;
  const cos_wv = Math.cos(wv),
    sin_wv = Math.sin(wv);

  const xH = r * (cos_n * cos_wv - sin_n * sin_wv * cos_i);
  const yH = r * (sin_n * cos_wv + cos_n * sin_wv * cos_i);
  const zH = r * sin_wv * sin_i;

  // Add Earth's heliocentric position → geocentric ecliptic
  const earth = earthPosition(T);
  const xE = xH + earth.x;
  const yE = yH + earth.y;
  const zE = zH + earth.z;

  // Obliquity of ecliptic (J2000)
  const eps = (23.439291111 - 0.013004167 * T - 0.00000164 * T * T + 0.000000504 * T * T * T) * DEG;

  // Rotate ecliptic → equatorial
  const xQ = xE;
  const yQ = yE * Math.cos(eps) - zE * Math.sin(eps);
  const zQ = yE * Math.sin(eps) + zE * Math.cos(eps);

  const dist = Math.sqrt(xQ * xQ + yQ * yQ + zQ * zQ);
  if (dist === 0) return null;

  const ra = (Math.atan2(yQ, xQ) * RAD + 360) % 360;
  const dec = Math.asin(zQ / dist) * RAD;

  return { ra, dec, dist };
}

export function formatRA(deg) {
  const h = (((deg % 360) + 360) % 360) / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = Math.round(((h - hh) * 60 - mm) * 60);
  return `${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m ${String(ss < 60 ? ss : 59).padStart(2, '0')}s`;
}

export function formatDec(deg) {
  const sign = deg < 0 ? '−' : '+';
  const abs = Math.abs(deg);
  const dd = Math.floor(abs);
  const mm = Math.floor((abs - dd) * 60);
  const ss = Math.round(((abs - dd) * 60 - mm) * 60);
  return `${sign}${String(dd).padStart(2, '0')}° ${String(mm).padStart(2, '0')}' ${String(ss < 60 ? ss : 59).padStart(2, '0')}"`;
}

// Returns RA and Dec motion rates in arcsec/min, sampled 60 s apart.
export function calcShiftRates(el, date) {
  const p1 = calcRaDec(el, date);
  const p2 = calcRaDec(el, new Date(date.getTime() + 60_000));
  if (!p1 || !p2) return null;
  let dRA = p2.ra - p1.ra;
  if (dRA > 180) dRA -= 360;
  if (dRA < -180) dRA += 360;
  return {
    raRate:  (dRA * 3600) / 60,
    decRate: ((p2.dec - p1.dec) * 3600) / 60,
  };
}
