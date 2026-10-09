// Pure data shaping for the native guider graph, target plot and stats card. No Vue, no uPlot,
// so it can be unit tested with node --test.
import { signedPulse, stepError, toEpochSeconds } from '@/utils/nativeGuider';

/** Graph window sizes (steps) offered by the selector. */
export const GRAPH_WINDOWS = [50, 100, 200, 400];

/** Fixed y ranges (± value) offered next to 'auto'. */
export const Y_SCALES = [1, 2, 4, 8];

/** Guide steps in the rolling total RMS line. */
export const RMS_ROLLING_STEPS = 30;

// Fewer steps than this give no RMS value yet.
const RMS_MIN_STEPS = 5;

/** Marker kinds and their colours (canvas + legend). */
export const MARKER_COLORS = {
  dither: '#a78bfa',
  // Not the Dec red of the graph: a lost star must stand out from the Dec line.
  starlost: '#e879f9',
  settled: '#34d399',
  settleFailed: '#fbbf24',
  calibration: '#22d3ee',
};

const finiteOrNull = (v) => (Number.isFinite(v) ? v : null);

/** The last `window` steps with a usable timestamp. */
export function lastSteps(steps, window) {
  const list = Array.isArray(steps) ? steps : [];
  const tail = window > 0 && list.length > window ? list.slice(list.length - window) : list;
  return tail.filter((s) => s && Number.isFinite(toEpochSeconds(s.timestamp)));
}

/**
 * Rolling total RMS per step, aligned with `steps`: the RA and Dec standard deviations of the
 * last `size` steps that count (no settling, no recenter moves; as windowRms) up to that step,
 * combined. Null until RMS_MIN_STEPS steps count.
 */
export function rollingRms(steps, unit = 'arcsec', size = RMS_ROLLING_STEPS) {
  const out = [];
  const ra = [];
  const dec = [];
  const sd = (values) => {
    const mean = values.reduce((a, v) => a + v, 0) / values.length;
    return Math.sqrt(values.reduce((a, v) => a + (v - mean) * (v - mean), 0) / values.length);
  };
  for (const step of steps) {
    if (step && !step.isSettling && !step.isRecenterMove) {
      const error = stepError(step, unit);
      if (Number.isFinite(error.ra) && Number.isFinite(error.dec)) {
        ra.push(error.ra);
        dec.push(error.dec);
        if (ra.length > size) {
          ra.shift();
          dec.shift();
        }
      }
    }
    out.push(ra.length >= RMS_MIN_STEPS ? Math.hypot(sd(ra), sd(dec)) : null);
  }
  return out;
}

/**
 * Columns for uPlot: x (epoch seconds, strictly increasing), RA/Dec error in the unit, signed
 * correction pulses (null when no pulse, so no zero-height bars), settling flags, SNR, the
 * star mass normalised to its window maximum and the rolling total RMS (from the steps before
 * the window too, so it starts complete).
 */
export function buildGraphData(steps, { window = 100, unit = 'arcsec' } = {}) {
  const list = Array.isArray(steps) ? steps : [];
  const start = window > 0 && list.length > window ? list.length - window : 0;
  const rolling = rollingRms(list, unit);
  const xs = [];
  const ra = [];
  const dec = [];
  const raPulse = [];
  const decPulse = [];
  const settling = [];
  const snr = [];
  const mass = [];
  const rms = [];
  let lastX = -Infinity;

  for (let i = start; i < list.length; i++) {
    const step = list[i];
    if (!step || !Number.isFinite(toEpochSeconds(step.timestamp))) continue;
    let x = toEpochSeconds(step.timestamp);
    // uPlot needs strictly increasing x; nudge duplicates (same-millisecond timestamps).
    if (x <= lastX) x = lastX + 0.001;
    lastX = x;
    const error = stepError(step, unit);
    xs.push(x);
    ra.push(finiteOrNull(error.ra));
    dec.push(finiteOrNull(error.dec));
    const rp = signedPulse(step.raDuration, step.raDirection);
    const dp = signedPulse(step.decDuration, step.decDirection);
    raPulse.push(rp ? rp : null);
    decPulse.push(dp ? dp : null);
    settling.push(step.isSettling === true);
    snr.push(finiteOrNull(step.snr));
    mass.push(finiteOrNull(step.starMass));
    rms.push(rolling[i]);
  }

  let massMax = 0;
  for (const m of mass) if (m !== null && m > massMax) massMax = m;
  const massNorm = mass.map((m) => (m === null || massMax <= 0 ? null : m / massMax));

  return { xs, ra, dec, raPulse, decPulse, settling, snr, massNorm, rms, count: xs.length };
}

/** Symmetric y range: fixed ±scale, or auto with headroom and a minimum of ±minAbs. */
export function symmetricRange(values, { scale = 'auto', minAbs = 1 } = {}) {
  if (scale !== 'auto' && Number.isFinite(Number(scale)) && Number(scale) > 0) {
    const s = Number(scale);
    return [-s, s];
  }
  let maxAbs = 0;
  for (const series of values) {
    for (const v of series) {
      if (Number.isFinite(v) && Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    }
  }
  const limit = Math.max(minAbs, niceCeil(maxAbs * 1.1));
  return [-limit, limit];
}

/** Symmetric range for the pulse axis in ms (at least ±100 ms). */
export function pulseRange(raPulse, decPulse) {
  let maxAbs = 0;
  for (const series of [raPulse, decPulse]) {
    for (const v of series) {
      if (Number.isFinite(v) && Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    }
  }
  // Bars use at most ~60 % of the height so they stay behind the error lines.
  const limit = Math.max(100, niceCeil(maxAbs / 0.6));
  return [-limit, limit];
}

/** Rounds up to 1, 1.5, 2, 3, 4, 5, 6, 8 × 10^n. */
export function niceCeil(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  const fraction = value / base;
  const steps = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
  const nice = steps.find((s) => fraction <= s + 1e-9) ?? 10;
  return Number((nice * base).toPrecision(6));
}

/** Contiguous settling runs as [x0, x1] spans (for shading). */
export function settlingSpans(xs, settling) {
  const spans = [];
  let start = null;
  for (let i = 0; i < xs.length; i++) {
    if (settling[i] && start === null) start = xs[i];
    const endsHere = settling[i] && (i === xs.length - 1 || !settling[i + 1]);
    if (endsHere && start !== null) {
      spans.push([start, xs[i]]);
      start = null;
    }
  }
  return spans;
}

/** Markers whose time falls into [x0, x1]. */
export function markersInRange(markers, x0, x1) {
  if (!Array.isArray(markers) || !Number.isFinite(x0) || !Number.isFinite(x1)) return [];
  return markers.filter((m) => m && Number.isFinite(m.t) && m.t >= x0 && m.t <= x1);
}

/**
 * Points of the target plot (RA x, Dec y) with an opacity that grows towards the newest point.
 * `settling` marks the steps the RMS leaves out too: settling after a dither and dither recenter moves.
 */
export function targetPoints(steps, { window = 100, unit = 'arcsec' } = {}) {
  const selected = (Array.isArray(steps) ? steps : []).slice(-Math.max(1, window));
  const points = [];
  for (const step of selected) {
    const error = stepError(step, unit);
    if (!Number.isFinite(error.ra) || !Number.isFinite(error.dec)) continue;
    points.push({
      x: error.ra,
      y: error.dec,
      settling: step.isSettling === true || step.isRecenterMove === true,
    });
  }
  const n = points.length;
  return points.map((p, i) => ({ ...p, opacity: n <= 1 ? 1 : 0.15 + 0.85 * (i / (n - 1)) }));
}

/**
 * Outer radius of the target plot: nice value covering the guiding points and the RMS circle.
 * Settling points don't count: a dither would zoom out until the guiding points are one dot in the
 * middle, so they are drawn on the outer ring instead.
 */
export function targetRadius(points, rmsTotal, minRadius = 1) {
  let maxDistance = Number.isFinite(rmsTotal) ? rmsTotal : 0;
  for (const p of points) {
    if (!p.settling) maxDistance = Math.max(maxDistance, Math.hypot(p.x, p.y));
  }
  return Math.max(minRadius, niceCeil(maxDistance * 1.05));
}

/** Seconds as h:mm:ss ('–' when missing). */
export function formatElapsed(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return '–';
  const total = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** An RMS value with its unit ("0.62″", "0.41 px"), '–' when unknown. */
export function formatRms(value, unit = 'arcsec') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  return unit === 'px' ? `${value.toFixed(2)} px` : `${value.toFixed(2)}″`;
}

/**
 * Accessible name of a guide graph: its title and the RMS it shows, e.g.
 * "Guide graph: RMS 0.62″ (RA 0.41″, Dec 0.46″)"; only the title while there is no RMS.
 * labels: { title, rms, ra, dec } (translated); stats: windowRms() of the plotted steps.
 */
export function graphAriaLabel(labels, stats, unit = 'arcsec') {
  if (!stats || stats.total === null || stats.total === undefined) return labels.title;
  const f = (value) => formatRms(value, unit);
  return `${labels.title}: ${labels.rms} ${f(stats.total)} (${labels.ra} ${f(stats.ra)}, ${labels.dec} ${f(stats.dec)})`;
}
