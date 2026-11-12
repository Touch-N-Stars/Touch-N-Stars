// Pure helpers of the guide log viewer: formatting on the log's wall clock, the RMS grades and
// their colours, chart data and overlays. No Vue, so they can be unit tested.
import { lowerBound } from './analyzeGuideLog';

export { gradeOfRatio as gradeOf } from './analyzeGuideLog';

/**
 * A Map that keeps only the `max` most recently used entries (get and set count as a use).
 */
export class LruCache extends Map {
  constructor(max) {
    super();
    this.max = max;
  }

  get(key) {
    if (!super.has(key)) return undefined;
    const value = super.get(key);
    super.delete(key);
    super.set(key, value);
    return value;
  }

  set(key, value) {
    super.delete(key);
    super.set(key, value);
    while (this.size > this.max) super.delete(this.keys().next().value);
    return this;
  }
}

/** Analysed logs of past nights by name|size|modified; a few, a night can be large on a phone. */
export const nightCache = new LruCache(5);

/** Grades of a stretch of guiding by its RMS against the night's typical RMS. */
export const GRADE_COLORS = {
  good: '#34d399',
  fair: '#a3e635',
  poor: '#fbbf24',
  bad: '#f87171',
  lost: '#e879f9',
};

export const SEVERITY_COLORS = { bad: '#f87171', warn: '#fbbf24', info: '#94a3b8' };

export const DITHER_COLOR = 'rgba(56, 189, 248, 0.55)';
export const DROP_COLOR = '#e879f9';
export const INCIDENT_COLOR = '#f472b6';
export const FREE_RA_COLOR = 'rgba(96, 165, 250, 0.55)';
export const FREE_DEC_COLOR = 'rgba(248, 113, 113, 0.55)';
export const CALIBRATION_COLOR = 'rgba(167, 139, 250, 0.35)';
export const HIGHLIGHT_COLOR = 'rgba(56, 189, 248, 0.12)';

const pad2 = (n) => String(n).padStart(2, '0');

/** HH:MM(:SS) of wall seconds (the log's clock, read as UTC). */
export function formatWall(t, withSeconds = true) {
  if (!Number.isFinite(t)) return '–';
  const d = new Date(t * 1000);
  const hm = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  return withSeconds ? `${hm}:${pad2(d.getUTCSeconds())}` : hm;
}

/** yyyy-MM-dd of wall seconds. */
export function formatWallDate(t) {
  if (!Number.isFinite(t)) return '–';
  const d = new Date(t * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Compact duration: "2h 05m", "4m 07s", "12s". */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '–';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${pad2(s % 60)}s`;
  return `${Math.floor(m / 60)}h ${pad2(m % 60)}m`;
}

/** File size: "812 KB", "2.9 MB". */
export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A distance given in arcsec, shown in the viewer's unit: "0.56″", or "0.18 px" with the arcsec
 * per px `scale` ('–' when the scale is unknown).
 */
export function formatDistance(arcsec, unit = 'arcsec', scale = NaN, digits = 2) {
  if (!Number.isFinite(arcsec)) return '–';
  if (unit !== 'px') return `${arcsec.toFixed(digits)}″`;
  return scale > 0 ? `${(arcsec / scale).toFixed(digits)} px` : '–';
}

/** A number with `digits` decimals, '–' when not finite. */
export function fmtNum(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '–';
}

/** Nice round number at or above v (1, 2, 2.5, 5 × 10^n). */
export function niceCeil(v) {
  if (!(v > 0)) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * base + 1e-12) return m * base;
  return 10 * base;
}

/** Nice tick step for a span and a wish of about `ticks` ticks. */
export function niceStep(span, ticks = 5) {
  const raw = span / Math.max(1, ticks);
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  for (const m of [1, 2, 5, 10]) if (raw <= m * base) return m * base;
  return 10 * base;
}

/** Time span of a parsed log: first section start to the last section end (wall seconds). */
export function nightSpan(log) {
  const sections = log?.sections ?? [];
  if (!sections.length) return null;
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const s of sections) {
    t0 = Math.min(t0, s.start);
    t1 = Math.max(t1, s.end ?? s.start);
  }
  if (!(t1 > t0)) t1 = t0 + 60;
  return { t0, t1 };
}

/** Clamps a view [t0, t1] into the night span with at least `minSpan` seconds. */
export function clampView(view, span, minSpan = 20) {
  if (!span) return view;
  let { t0, t1 } = view;
  if (t1 - t0 < minSpan) {
    const mid = (t0 + t1) / 2;
    t0 = mid - minSpan / 2;
    t1 = mid + minSpan / 2;
  }
  const width = Math.min(t1 - t0, span.t1 - span.t0);
  if (t0 < span.t0) {
    t0 = span.t0;
    t1 = t0 + width;
  }
  if (t1 > span.t1) {
    t1 = span.t1;
    t0 = t1 - width;
  }
  return { t0, t1 };
}

/** Zooms a view by `factor` (< 1 in) around `center` (default: its middle). */
export function zoomView(view, factor, center = (view.t0 + view.t1) / 2) {
  return {
    t0: center - (center - view.t0) * factor,
    t1: center + (view.t1 - center) * factor,
  };
}

/** The view around a finding: its span with room on both sides. */
export function viewAround(t0, t1, minSpan = 120) {
  const width = Math.max(minSpan, (t1 - t0) * 2);
  const mid = (t0 + t1) / 2;
  return { t0: mid - width / 2, t1: mid + width / 2 };
}

/**
 * uPlot data of the main chart: x, raMs, decMs, ra, dec, raFree, decFree, rms (the rolling total
 * RMS, when given), plus a null point between sections so the lines break where guiding stopped.
 * Arcsec or px.
 */
export function chartData(series, unit = 'arcsec', rolling = null) {
  const n = series.n;
  const gaps = Math.max(0, series.sectionRanges.length - 1);
  const len = n + gaps;
  const xs = new Array(len);
  const cols = Array.from({ length: 7 }, () => new Array(len));
  let k = 0;
  let prevSection = null;
  const val = (v) => (Number.isFinite(v) ? v : null);
  for (let i = 0; i < n; i++) {
    if (prevSection !== null && series.section[i] !== prevSection) {
      xs[k] = (series.t[i - 1] + series.t[i]) / 2;
      for (const c of cols) c[k] = null;
      k++;
    }
    prevSection = series.section[i];
    const f = unit === 'px' ? 1 : series.scale[i];
    xs[k] = series.t[i];
    cols[0][k] = series.raMs[i] || null;
    cols[1][k] = series.decMs[i] || null;
    cols[2][k] = series.drop[i] ? null : val(unit === 'px' ? series.ra[i] : series.raAs[i]);
    cols[3][k] = series.drop[i] ? null : val(unit === 'px' ? series.dec[i] : series.decAs[i]);
    cols[4][k] = series.drop[i] ? null : val(series.raFree[i] * f);
    cols[5][k] = series.drop[i] ? null : val(series.decFree[i] * f);
    // the rolling RMS is in arcsec
    cols[6][k] = rolling ? val(unit === 'px' ? rolling[i] / series.scale[i] : rolling[i]) : null;
    k++;
  }
  return [xs.slice(0, k), ...cols.map((c) => c.slice(0, k))];
}

/** uPlot data of the star plot: x, snr, mass normalised to the section's median. */
export function starData(series) {
  const n = series.n;
  const gaps = Math.max(0, series.sectionRanges.length - 1);
  const xs = new Array(n + gaps);
  const snr = new Array(n + gaps);
  const mass = new Array(n + gaps);
  const medMass = new Map();
  for (const r of series.sectionRanges) {
    const v = [];
    for (let i = r.from; i < r.to; i++)
      if (!series.drop[i] && series.mass[i] > 0) v.push(series.mass[i]);
    v.sort((a, b) => a - b);
    medMass.set(r.section, v.length ? v[v.length >> 1] : NaN);
  }
  let k = 0;
  let prev = null;
  for (let i = 0; i < n; i++) {
    if (prev !== null && series.section[i] !== prev) {
      xs[k] = (series.t[i - 1] + series.t[i]) / 2;
      snr[k] = null;
      mass[k] = null;
      k++;
    }
    prev = series.section[i];
    xs[k] = series.t[i];
    snr[k] = series.drop[i] || !Number.isFinite(series.snr[i]) ? null : series.snr[i];
    const m = medMass.get(series.section[i]);
    mass[k] =
      series.drop[i] || !(m > 0) || !Number.isFinite(series.mass[i]) ? null : series.mass[i] / m;
    k++;
  }
  return [xs.slice(0, k), snr.slice(0, k), mass.slice(0, k)];
}

/**
 * The findings drawn as markers (triangles) on the night overview and the guide graph: the
 * problems, and of the rest only the flips and calibrations.
 */
export function markerFindings(findings) {
  return (findings ?? []).filter(
    (f) => f.severity !== 'info' || f.kind === 'flip' || f.kind === 'calibration'
  );
}

/**
 * What lies under a time on a chart: the marked findings within `tolerance` seconds of their
 * span, the dithers within it, the light frame that was exposing. For the hover readout.
 */
export function markersAt(t, tolerance, { findings = [], dithers = [], exposures = [] } = {}) {
  return {
    findings: markerFindings(findings).filter(
      (f) => t >= f.t0 - tolerance && t <= f.t1 + tolerance
    ),
    dithers: dithers.filter((d) => Math.abs(d.t - t) <= tolerance),
    exposure: exposures.find((e) => t >= e.start && t <= e.end) ?? null,
  };
}

/** Time spans [t0, t1] of the settling frames. */
export function settleSpans(series) {
  const spans = [];
  let start = null;
  for (let i = 0; i < series.n; i++) {
    const on = series.settling[i] === 1;
    const sectionChange = i > 0 && series.section[i] !== series.section[i - 1];
    if (start !== null && (!on || sectionChange)) {
      spans.push([series.t[start], series.t[i - 1]]);
      start = null;
    }
    if (on && start === null) start = i;
  }
  if (start !== null) spans.push([series.t[start], series.t[series.n - 1]]);
  return spans;
}

/** Times of the dropped frames. */
export function dropTimes(series) {
  const out = [];
  for (let i = 0; i < series.n; i++) if (series.drop[i]) out.push(series.t[i]);
  return out;
}

/** Events of the guiding sections a chart marks: dithers and alerts, { t, type, ... }. */
export function chartEvents(log) {
  const out = [];
  for (const s of log?.sections ?? []) {
    if (s.kind !== 'guiding') continue;
    for (const e of s.events) if (e.type === 'dither' || e.type === 'alert') out.push(e);
  }
  return out;
}

/**
 * Y range of the error axis for the steps in a view: symmetric, the 99.5th percentile of the
 * absolute errors rounded up to a nice number, at least ±0.5.
 */
export function errorRange(data, t0, t1) {
  const xs = data[0];
  const from = lowerBound(xs, t0);
  const to = lowerBound(xs, t1);
  const values = [];
  for (let i = from; i < to; i++) {
    for (const c of [3, 4]) {
      const v = data[c][i];
      if (v !== null && v !== undefined) values.push(Math.abs(v));
    }
  }
  if (!values.length) return [-1, 1];
  values.sort((a, b) => a - b);
  const p = values[Math.min(values.length - 1, Math.floor(values.length * 0.995))];
  const r = niceCeil(Math.max(0.5, p * 1.1));
  return [-r, r];
}

/**
 * Range of the pulse axis for a view: the 98th percentile of the absolute pulses (at least
 * 100 ms), so a few long moves (dithers, recoveries) do not shrink the usual pulses to nothing.
 */
export function pulseRange(data, t0, t1) {
  const xs = data[0];
  const from = lowerBound(xs, t0);
  const to = lowerBound(xs, t1);
  const values = [];
  for (let i = from; i < to; i++) {
    for (const c of [1, 2]) {
      const v = data[c][i];
      if (v) values.push(Math.abs(v));
    }
  }
  if (!values.length) return [-100, 100];
  values.sort((a, b) => a - b);
  const p = values[Math.min(values.length - 1, Math.floor(values.length * 0.98))];
  const r = niceCeil(Math.max(100, p * 1.2));
  return [-r, r];
}

/** Points of the scatter plot: [ra, dec] arcsec (or px) of the usable steps in [from, to). */
export function scatterPoints(series, from, to, { unit = 'arcsec', excludeSettling = true } = {}) {
  const out = [];
  for (let i = from; i < to; i++) {
    if (series.drop[i] || (excludeSettling && series.settling[i])) continue;
    const ra = unit === 'px' ? series.ra[i] : series.raAs[i];
    const dec = unit === 'px' ? series.dec[i] : series.decAs[i];
    if (Number.isFinite(ra) && Number.isFinite(dec)) out.push([ra, dec]);
  }
  return out;
}

/**
 * Bins (t, y) into at most `max` buckets by time (mean per bucket), so the periodogram stays
 * quick on long ranges. Gaps stay gaps.
 */
export function binSeries(t, y, max = 4000) {
  const n = t.length;
  if (n <= max) return { t: Array.from(t), y: Array.from(y) };
  const t0 = t[0];
  const width = (t[n - 1] - t0) / max;
  const ot = [];
  const oy = [];
  let bucket = -1;
  let st = 0;
  let sy = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(y[i])) continue;
    const b = Math.floor((t[i] - t0) / width);
    if (b !== bucket && c) {
      ot.push(st / c);
      oy.push(sy / c);
      st = sy = c = 0;
    }
    bucket = b;
    st += t[i];
    sy += y[i];
    c++;
  }
  if (c) {
    ot.push(st / c);
    oy.push(sy / c);
  }
  return { t: ot, y: oy };
}
