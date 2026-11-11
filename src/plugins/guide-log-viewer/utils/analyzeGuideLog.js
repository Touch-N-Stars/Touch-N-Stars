// Analysis of a parsed guide log (parseGuideLog.js) for the log viewer: one night-wide step
// series, statistics of any time range, the mount's motion without the corrections, findings
// (the moments worth a look) and a periodogram. Pure, no Vue, so it can be tested with
// node --test. Times are wall seconds (see parseGuideLog.js), distances px unless named *As
// (arcseconds).

const SIDEREAL_DAY_S = 86164.0905;

/** Frames of the rolling RMS used for the overview colouring and the bad-stretch finding. */
export const ROLLING_FRAMES = 30;

function median(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function percentile(values, p) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const idx = Math.min(v.length - 1, Math.max(0, Math.round((p / 100) * (v.length - 1))));
  return v[idx];
}

/** Pixel scale of a section, 1 when unknown (then arcsec equals px). */
export function sectionScale(section) {
  const ps = section?.header?.pixelScale;
  return Number.isFinite(ps) && ps > 0 ? ps : 1;
}

/**
 * Correction rates of a section in px/s at its declination: RA from the normalised rate
 * (cos dec), Dec as logged; else the calibration rates of the header. NaN when unknown.
 */
export function correctionRates(section) {
  const h = section?.header ?? {};
  const scale = sectionScale(section);
  let ra = NaN;
  let dec = NaN;
  if (Number.isFinite(h.normRaRate) && Number.isFinite(h.decDeg) && Number.isFinite(h.pixelScale)) {
    ra = (h.normRaRate * Math.cos((h.decDeg * Math.PI) / 180)) / scale;
  } else if (Number.isFinite(h.calibrationInfo?.xRate)) {
    ra = h.calibrationInfo.xRate;
  }
  if (Number.isFinite(h.normDecRate) && Number.isFinite(h.pixelScale)) dec = h.normDecRate / scale;
  else if (Number.isFinite(h.calibrationInfo?.yRate)) dec = h.calibrationInfo.yRate;
  return { ra, dec };
}

/**
 * Sign of a pulse's effect on the raw distance per direction letter, learned from the section:
 * a pulse corrects the error it was sent for, so it moves the distance against the sign of the
 * guide distance. { E, W, N, S } with +1 / -1 (0 when never seen).
 */
export function pulseSigns(section) {
  const votes = { E: 0, W: 0, N: 0, S: 0 };
  const s = section.steps;
  for (let i = 0; i < s.t.length; i++) {
    if (
      s.raMs[i] > 0 &&
      s.raDir[i] in votes &&
      Number.isFinite(s.raGuide[i]) &&
      s.raGuide[i] !== 0
    ) {
      votes[s.raDir[i]] += s.raGuide[i] > 0 ? -1 : 1;
    }
    if (
      s.decMs[i] > 0 &&
      s.decDir[i] in votes &&
      Number.isFinite(s.decGuide[i]) &&
      s.decGuide[i] !== 0
    ) {
      votes[s.decDir[i]] += s.decGuide[i] > 0 ? -1 : 1;
    }
  }
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const out = { E: sign(votes.E), W: sign(votes.W), N: sign(votes.N), S: sign(votes.S) };
  // A letter never seen mirrors its opposite
  if (!out.E && out.W) out.E = -out.W;
  if (!out.W && out.E) out.W = -out.E;
  if (!out.N && out.S) out.N = -out.S;
  if (!out.S && out.N) out.S = -out.N;
  return out;
}

/**
 * Night-wide step series of the guiding sections, as typed arrays of equal length n:
 * t, frame, ra/dec (px), raAs/decAs, raMs/decMs (signed by the effect's direction: positive
 * moves the distance up), snr, mass, drop, settling, section, seg (segment between lock
 * position changes), scale (the section's arcsec per px), raFree/decFree (px: where the star would be without the corrections,
 * restarting at each segment).
 */
export function buildSeries(log) {
  const guiding = (log?.sections ?? []).filter((s) => s.kind === 'guiding');
  let n = 0;
  for (const s of guiding) n += s.steps.t.length;
  const series = {
    n,
    t: new Float64Array(n),
    frame: new Float64Array(n),
    ra: new Float64Array(n),
    dec: new Float64Array(n),
    raAs: new Float64Array(n),
    decAs: new Float64Array(n),
    raMs: new Float64Array(n),
    decMs: new Float64Array(n),
    snr: new Float64Array(n),
    mass: new Float64Array(n),
    drop: new Uint8Array(n),
    settling: new Uint8Array(n),
    section: new Int32Array(n),
    seg: new Int32Array(n),
    raFree: new Float64Array(n),
    decFree: new Float64Array(n),
    scale: new Float64Array(n),
    sectionRanges: [], // [{ section, from, to }] (to exclusive)
  };
  let k = 0;
  let seg = -1;
  for (const section of guiding) {
    const s = section.steps;
    const from = k;
    const scale = sectionScale(section);
    const signs = pulseSigns(section);
    const rates = correctionRates(section);
    // events by the step index they precede
    const settleMarks = new Map();
    const segMarks = new Set();
    for (const e of section.events) {
      if (e.type === 'settleStart') settleMarks.set(e.index, 1);
      else if (e.type === 'settleDone' || e.type === 'settleFailed') {
        if (settleMarks.get(e.index) !== 1) settleMarks.set(e.index, 0);
      }
      if (e.type === 'dither' || e.type === 'lockPos') segMarks.add(e.index);
    }
    let settling = 0;
    seg++;
    let raAcc = 0;
    let decAcc = 0;
    for (let i = 0; i < s.t.length; i++, k++) {
      if (settleMarks.has(i)) settling = settleMarks.get(i);
      if (segMarks.has(i) && i > 0) {
        seg++;
        raAcc = 0;
        decAcc = 0;
      }
      series.t[k] = s.t[i];
      series.frame[k] = s.frame[i];
      series.ra[k] = s.ra[i];
      series.dec[k] = s.dec[i];
      series.raAs[k] = s.ra[i] * scale;
      series.decAs[k] = s.dec[i] * scale;
      const raSign = signs[s.raDir[i]] || 0;
      const decSign = signs[s.decDir[i]] || 0;
      series.raMs[k] = s.raMs[i] * raSign;
      series.decMs[k] = s.decMs[i] * decSign;
      series.snr[k] = s.snr[i];
      series.mass[k] = s.mass[i];
      series.drop[k] = s.drop[i] ? 1 : 0;
      series.settling[k] = settling;
      series.section[k] = section.index;
      series.seg[k] = seg;
      series.scale[k] = scale;
      // star position without the corrections sent so far in this segment
      series.raFree[k] = Number.isFinite(rates.ra) ? s.ra[i] - raAcc : NaN;
      series.decFree[k] = Number.isFinite(rates.dec) ? s.dec[i] - decAcc : NaN;
      if (Number.isFinite(rates.ra)) raAcc += ((s.raMs[i] * raSign) / 1000) * rates.ra;
      if (Number.isFinite(rates.dec)) decAcc += ((s.decMs[i] * decSign) / 1000) * rates.dec;
    }
    series.sectionRanges.push({ section: section.index, from, to: k });
  }
  return series;
}

/** First index with t >= value (binary search; n when none). */
export function lowerBound(t, value) {
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Index range [from, to) of the steps within [t0, t1]. */
export function indexRange(series, t0, t1) {
  return { from: lowerBound(series.t, t0), to: lowerBound(series.t, t1 + 1e-6) };
}

/** Least-squares slope of y over x within segments (each segment its own intercept). */
export function pooledSlope(x, y, groups) {
  const acc = new Map();
  for (let i = 0; i < x.length; i++) {
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
    let g = acc.get(groups[i]);
    // x relative to the group's first x: epoch seconds squared would lose all precision
    if (!g) acc.set(groups[i], (g = { x0: x[i], n: 0, sx: 0, sy: 0, sxx: 0, sxy: 0 }));
    const xi = x[i] - g.x0;
    g.n++;
    g.sx += xi;
    g.sy += y[i];
    g.sxx += xi * xi;
    g.sxy += xi * y[i];
  }
  let num = 0;
  let den = 0;
  for (const g of acc.values()) {
    if (g.n < 3) continue;
    num += g.sxy - (g.sx * g.sy) / g.n;
    den += g.sxx - (g.sx * g.sx) / g.n;
  }
  return den > 0 ? num / den : NaN;
}

/**
 * Statistics of steps [from, to) of the series. With excludeSettling the settling frames do
 * not count (as PHD2 and the live graph do). Distances in arcsec; drift in arcsec per minute.
 */
export function rangeStats(
  series,
  from,
  to,
  { excludeSettling = true, maxRaMs = null, maxDecMs = null, decDeg = null } = {}
) {
  const idx = [];
  let drops = 0;
  let settlingFrames = 0;
  for (let i = from; i < to; i++) {
    if (series.drop[i]) {
      drops++;
      continue;
    }
    if (series.settling[i]) {
      settlingFrames++;
      if (excludeSettling) continue;
    }
    if (!Number.isFinite(series.raAs[i]) || !Number.isFinite(series.decAs[i])) continue;
    idx.push(i);
  }
  const n = idx.length;
  const frames = to - from;
  const duration = frames > 0 ? series.t[to - 1] - series.t[from] : 0;
  const base = { frames, n, drops, settlingFrames, duration };
  if (!n) return { ...base, empty: true };

  let sRa = 0;
  let sDec = 0;
  let sRa2 = 0;
  let sDec2 = 0;
  let peakRa = 0;
  let peakDec = 0;
  let raPulses = 0;
  let decPulses = 0;
  let raLimited = 0;
  let decLimited = 0;
  let raFlips = 0;
  let decReversals = 0;
  let lastDecDir = 0;
  let prevRa = null;
  const snrs = [];
  for (const i of idx) {
    const ra = series.raAs[i];
    const dec = series.decAs[i];
    sRa += ra;
    sDec += dec;
    sRa2 += ra * ra;
    sDec2 += dec * dec;
    if (Math.abs(ra) > Math.abs(peakRa)) peakRa = ra;
    if (Math.abs(dec) > Math.abs(peakDec)) peakDec = dec;
    if (series.raMs[i]) raPulses++;
    if (series.decMs[i]) {
      decPulses++;
      const dir = Math.sign(series.decMs[i]);
      if (lastDecDir && dir !== lastDecDir) decReversals++;
      lastDecDir = dir;
    }
    if (maxRaMs && Math.abs(series.raMs[i]) >= maxRaMs) raLimited++;
    if (maxDecMs && Math.abs(series.decMs[i]) >= maxDecMs) decLimited++;
    if (prevRa !== null && Math.sign(ra) !== Math.sign(prevRa) && ra !== 0) raFlips++;
    prevRa = ra;
    snrs.push(series.snr[i]);
  }
  const meanRa = sRa / n;
  const meanDec = sDec / n;
  // PHD2 reports the RMS about the mean (standard deviation), the live graph too
  const rmsRa = Math.sqrt(Math.max(0, sRa2 / n - meanRa * meanRa));
  const rmsDec = Math.sqrt(Math.max(0, sDec2 / n - meanDec * meanDec));

  // Drift of the uncorrected motion, within segments between lock position changes
  const tt = idx.map((i) => series.t[i]);
  const groups = idx.map((i) => series.seg[i]);
  const pxScale = median(idx.map((i) => series.scale[i]));
  const raDrift =
    pooledSlope(
      tt,
      idx.map((i) => series.raFree[i]),
      groups
    ) *
    60 *
    pxScale;
  const decDrift =
    pooledSlope(
      tt,
      idx.map((i) => series.decFree[i]),
      groups
    ) *
    60 *
    pxScale;

  // PHD2's estimate of the polar alignment error from the Dec drift: 3.8197 × drift ("/min) / cos(dec), arcmin
  // only within one guiding session: sessions of other targets drift differently
  let polarError = NaN;
  if (
    series.section[idx[0]] === series.section[idx[n - 1]] &&
    Number.isFinite(decDrift) &&
    Number.isFinite(decDeg) &&
    Math.abs(decDeg) < 80 &&
    duration >= 300
  ) {
    polarError = (3.8197 * Math.abs(decDrift)) / Math.cos((decDeg * Math.PI) / 180);
  }

  return {
    ...base,
    rmsRa,
    rmsDec,
    rmsTotal: Math.hypot(rmsRa, rmsDec),
    meanRa,
    meanDec,
    peakRa,
    peakDec,
    raPulsePct: (100 * raPulses) / n,
    decPulsePct: (100 * decPulses) / n,
    raLimited,
    decLimited,
    // share of RA sign changes from frame to frame; around 0.5 is noise, near 1 overcorrection
    raOscillation: n > 1 ? raFlips / (n - 1) : NaN,
    decReversals,
    raDrift,
    decDrift,
    polarError,
    snrMedian: median(snrs),
  };
}

/**
 * Rolling total RMS (arcsec) over the last `frames` usable steps of the same section; NaN while
 * too few. With `axes` ({}), also fills axes.ra and axes.dec with the per-axis rolling RMS.
 */
export function rollingRms(series, frames = ROLLING_FRAMES, axes = null) {
  const out = new Float64Array(series.n).fill(NaN);
  if (axes) {
    axes.ra = new Float64Array(series.n).fill(NaN);
    axes.dec = new Float64Array(series.n).fill(NaN);
  }
  let q = [];
  let section = -1;
  let s1 = 0;
  let s2 = 0;
  let d1 = 0;
  let d2 = 0;
  for (let i = 0; i < series.n; i++) {
    if (series.section[i] !== section) {
      section = series.section[i];
      q = [];
      s1 = s2 = d1 = d2 = 0;
    }
    if (series.drop[i] || series.settling[i] || !Number.isFinite(series.raAs[i])) continue;
    const ra = series.raAs[i];
    const dec = series.decAs[i];
    q.push([ra, dec]);
    s1 += ra;
    s2 += ra * ra;
    d1 += dec;
    d2 += dec * dec;
    if (q.length > frames) {
      const [r0, e0] = q.shift();
      s1 -= r0;
      s2 -= r0 * r0;
      d1 -= e0;
      d2 -= e0 * e0;
    }
    if (q.length >= Math.min(frames, 10)) {
      const m = q.length;
      const vr = Math.max(0, s2 / m - (s1 / m) ** 2);
      const vd = Math.max(0, d2 / m - (d1 / m) ** 2);
      out[i] = Math.sqrt(vr + vd);
      if (axes) {
        axes.ra[i] = Math.sqrt(vr);
        axes.dec[i] = Math.sqrt(vd);
      }
    }
  }
  return out;
}

/** Worm period in seconds from the header's tooth count, null when unknown. */
export function wormPeriod(header) {
  const teeth = header?.wormTeeth;
  return Number.isFinite(teeth) && teeth > 0 ? SIDEREAL_DAY_S / teeth : null;
}

/**
 * Lomb-Scargle periodogram of y(t) (uneven sampling, gaps allowed), as amplitude of the best
 * fitting sine per period: { periods, amplitudes } with `count` log-spaced periods.
 */
export function periodogram(t, y, { minPeriod, maxPeriod, count = 300 } = {}) {
  const pts = [];
  for (let i = 0; i < t.length; i++)
    if (Number.isFinite(t[i]) && Number.isFinite(y[i])) pts.push([t[i], y[i]]);
  if (pts.length < 16) return { periods: [], amplitudes: [] };
  const mean = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const span = pts[pts.length - 1][0] - pts[0][0];
  const lo = Math.max(minPeriod ?? 2, 1e-3);
  const hi = Math.min(maxPeriod ?? span / 2, span / 1.5);
  if (!(hi > lo)) return { periods: [], amplitudes: [] };
  const periods = new Float64Array(count);
  const amplitudes = new Float64Array(count);
  const t0 = pts[0][0];
  const ts = pts.map((p) => p[0] - t0);
  const ys = pts.map((p) => p[1] - mean);
  for (let k = 0; k < count; k++) {
    const period = lo * Math.pow(hi / lo, k / (count - 1));
    const w = (2 * Math.PI) / period;
    let s2 = 0;
    let c2 = 0;
    for (const x of ts) {
      s2 += Math.sin(2 * w * x);
      c2 += Math.cos(2 * w * x);
    }
    const tau = Math.atan2(s2, c2) / (2 * w);
    let yc = 0;
    let ys2 = 0;
    let cc = 0;
    let ss = 0;
    for (let i = 0; i < ts.length; i++) {
      const c = Math.cos(w * (ts[i] - tau));
      const s = Math.sin(w * (ts[i] - tau));
      yc += ys[i] * c;
      ys2 += ys[i] * s;
      cc += c * c;
      ss += s * s;
    }
    const a = cc > 0 ? yc / cc : 0;
    const b = ss > 0 ? ys2 / ss : 0;
    periods[k] = period;
    amplitudes[k] = Math.hypot(a, b);
  }
  return { periods, amplitudes };
}

/** Removes a straight line per segment (drift and dither offsets) before the periodogram. */
export function detrendBySegment(t, y, groups) {
  const out = new Float64Array(y.length).fill(NaN);
  const bySeg = new Map();
  for (let i = 0; i < y.length; i++) {
    if (!Number.isFinite(y[i])) continue;
    if (!bySeg.has(groups[i])) bySeg.set(groups[i], []);
    bySeg.get(groups[i]).push(i);
  }
  for (const list of bySeg.values()) {
    if (list.length < 3) continue;
    const t0 = t[list[0]];
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const i of list) {
      const ti = t[i] - t0;
      sx += ti;
      sy += y[i];
      sxx += ti * ti;
      sxy += ti * y[i];
    }
    const m = list.length;
    const den = sxx - (sx * sx) / m;
    const slope = den > 0 ? (sxy - (sx * sy) / m) / den : 0;
    const icept = (sy - slope * sx) / m;
    for (const i of list) out[i] = y[i] - (icept + slope * (t[i] - t0));
  }
  return out;
}

/** The highest peak of a periodogram: { period, amplitude } or null. */
export function strongestPeriod(pg, { minPeriod = 0 } = {}) {
  let best = null;
  for (let k = 1; k < pg.periods.length - 1; k++) {
    if (pg.periods[k] < minPeriod) continue;
    const a = pg.amplitudes[k];
    if (a >= pg.amplitudes[k - 1] && a >= pg.amplitudes[k + 1] && (!best || a > best.amplitude)) {
      best = { period: pg.periods[k], amplitude: a };
    }
  }
  return best;
}

/** Overview of a guiding section for the session list. */
export function sectionSummary(series, range, section) {
  const h = section.header ?? {};
  const stats = rangeStats(series, range.from, range.to, {
    maxRaMs: h.maxRaMs,
    maxDecMs: h.maxDecMs,
    decDeg: h.decDeg,
  });
  const dithers = section.events.filter((e) => e.type === 'dither').length;
  return {
    section: section.index,
    start: section.start,
    end: section.end,
    pierSide: h.pierSide ?? null,
    raHours: h.raHours,
    decDeg: h.decDeg,
    exposureMs: h.exposureMs,
    dithers,
    stats,
  };
}

// --- Findings --------------------------------------------------------------------

/** Severity order for sorting and filtering. */
export const SEVERITIES = ['bad', 'warn', 'info'];

/** Kinds of findings, in the order the filter lists them. */
export const FINDING_KINDS = [
  'starLost',
  'badStretch',
  'jump',
  'clouds',
  'settle',
  'pulseLimit',
  'alert',
  'flip',
  'gap',
  'param',
  'calibration',
];

function runs(n, test, { mergeGap = 0 } = {}) {
  const out = [];
  let start = -1;
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (test(i)) {
      if (start >= 0 && i - last - 1 <= mergeGap) last = i;
      else {
        if (start >= 0) out.push([start, last]);
        start = last = i;
      }
    }
  }
  if (start >= 0) out.push([start, last]);
  return out;
}

/**
 * The moments of the night worth a look, oldest first: { kind, severity, t0, t1, params }.
 * Thresholds are relative to the night itself (its median rolling RMS and SNR), so a night of
 * poor seeing does not light up everywhere.
 */
export function findFindings(log, series, rolling = rollingRms(series)) {
  const out = [];
  const sections = log.sections ?? [];
  const n = series.n;
  const t = series.t;
  const sameSection = (a, b) => series.section[a] === series.section[b];

  // Star lost: runs of dropped frames (up to 10 good frames in between still count as one); a
  // single dropped frame is left to the statistics
  for (const [a, b] of runs(n, (i) => series.drop[i], { mergeGap: 10 })) {
    if (!sameSection(a, b)) continue;
    let frames = 0;
    for (let i = a; i <= b; i++) frames += series.drop[i];
    if (frames < 2) continue;
    const seconds = t[b] - t[a];
    out.push({
      kind: 'starLost',
      severity: frames >= 5 || seconds >= 15 ? 'bad' : 'warn',
      t0: t[a],
      t1: t[b],
      params: { frames, seconds: Math.round(seconds) },
    });
  }

  // Bad stretch: rolling RMS well above the night's typical one
  const typical = median(Array.from(rolling));
  if (Number.isFinite(typical) && typical > 0) {
    const limit = Math.max(typical * 2, typical + 0.5);
    for (const [a, b] of runs(n, (i) => rolling[i] > limit, { mergeGap: ROLLING_FRAMES })) {
      if (b - a < ROLLING_FRAMES / 2 || !sameSection(a, b)) continue;
      let peak = 0;
      for (let i = a; i <= b; i++) if (rolling[i] > peak) peak = rolling[i];
      // the rolling window looks back: start the stretch where its first window began
      const startIdx = Math.max(
        series.sectionRanges.find((r) => a >= r.from && a < r.to)?.from ?? 0,
        a - ROLLING_FRAMES + 1
      );
      out.push({
        kind: 'badStretch',
        severity: peak > typical * 3 ? 'bad' : 'warn',
        t0: t[startIdx],
        t1: t[b],
        params: { rms: peak, typical, ratio: peak / typical, minutes: (t[b] - t[startIdx]) / 60 },
      });
    }
  }

  // Jumps: single frames far off the section's spread (robust sigma from the MAD)
  for (const range of series.sectionRanges) {
    const totals = [];
    for (let i = range.from; i < range.to; i++) {
      if (!series.drop[i] && !series.settling[i])
        totals.push(Math.hypot(series.raAs[i], series.decAs[i]));
    }
    if (totals.length < 30) continue;
    const med = median(totals);
    const mad = median(totals.map((v) => Math.abs(v - med)));
    const limit = Math.max(med + 10 * 1.4826 * mad, med * 5, 3);
    let lastT = -Infinity;
    for (let i = range.from; i < range.to; i++) {
      if (series.drop[i] || series.settling[i]) continue;
      const total = Math.hypot(series.raAs[i], series.decAs[i]);
      if (!(total > limit) || t[i] - lastT < 120) continue;
      lastT = t[i];
      out.push({
        kind: 'jump',
        severity: total > limit * 2 ? 'bad' : 'warn',
        t0: t[i],
        t1: t[i],
        params: {
          arcsec: total,
          axis: Math.abs(series.raAs[i]) >= Math.abs(series.decAs[i]) ? 'RA' : 'Dec',
          typical: med,
        },
      });
    }
  }

  // Clouds: the star's SNR well below the section's median for a while
  for (const range of series.sectionRanges) {
    const snr = [];
    for (let i = range.from; i < range.to; i++) if (!series.drop[i]) snr.push(series.snr[i]);
    const med = median(snr);
    if (!(med > 0)) continue;
    const low = (i) => series.drop[i] || series.snr[i] < med * 0.5;
    for (const [a, b] of runs(range.to - range.from, (j) => low(range.from + j), { mergeGap: 3 })) {
      const ia = range.from + a;
      const ib = range.from + b;
      if (b - a < 8) continue;
      let minSnr = Infinity;
      for (let i = ia; i <= ib; i++)
        if (!series.drop[i] && series.snr[i] < minSnr) minSnr = series.snr[i];
      out.push({
        kind: 'clouds',
        severity: 'warn',
        t0: t[ia],
        t1: t[ib],
        params: {
          snr: Number.isFinite(minSnr) ? minSnr : 0,
          typical: med,
          minutes: (t[ib] - t[ia]) / 60,
        },
      });
    }
  }

  // Settling after dithers: failures and the slow ones
  const settles = [];
  for (const s of sections) {
    if (s.kind !== 'guiding') continue;
    let start = null;
    for (const e of s.events) {
      if (e.type === 'settleStart') start = e;
      else if ((e.type === 'settleDone' || e.type === 'settleFailed') && start) {
        settles.push({ t0: start.t, t1: e.t, failed: e.type === 'settleFailed' });
        start = null;
      }
    }
  }
  const settleTypical = median(settles.filter((s) => !s.failed).map((s) => s.t1 - s.t0));
  for (const s of settles) {
    const seconds = s.t1 - s.t0;
    const slow =
      Number.isFinite(settleTypical) && seconds > Math.max(settleTypical * 2, settleTypical + 20);
    if (!s.failed && !slow) continue;
    out.push({
      kind: 'settle',
      severity: s.failed ? 'bad' : 'warn',
      t0: s.t0,
      t1: s.t1,
      params: {
        seconds: Math.round(seconds),
        typical: Math.round(settleTypical || 0),
        failed: s.failed,
      },
    });
  }

  // Pulses at the limit
  for (const range of series.sectionRanges) {
    const h = sections[series.section[range.from]]?.header ?? {};
    if (!(h.maxRaMs > 0) && !(h.maxDecMs > 0)) continue;
    const limited = (j) => {
      const i = range.from + j;
      return (
        (h.maxRaMs > 0 && Math.abs(series.raMs[i]) >= h.maxRaMs) ||
        (h.maxDecMs > 0 && Math.abs(series.decMs[i]) >= h.maxDecMs)
      );
    };
    for (const [a, b] of runs(range.to - range.from, limited, { mergeGap: 3 })) {
      const ia = range.from + a;
      const ib = range.from + b;
      if (series.settling[ia] && series.settling[ib]) continue; // big moves while settling are expected
      out.push({
        kind: 'pulseLimit',
        severity: b - a >= 2 ? 'bad' : 'warn',
        t0: t[ia],
        t1: t[ib],
        params: { frames: b - a + 1 },
      });
    }
  }

  // Alerts the guider raised (the star losses and settle timeouts are findings of their own)
  const covered = new Set(['StarLost', 'SettleTimeout']);
  const lastAlert = new Map();
  for (const s of sections) {
    for (const e of s.events) {
      if (e.type !== 'alert' || covered.has(e.name)) continue;
      const prev = lastAlert.get(e.name);
      if (prev && e.t - prev.t1 < 120) {
        prev.t1 = e.t;
        prev.params.count++;
        continue;
      }
      const f = {
        kind: 'alert',
        severity: e.code >= 300 && e.code < 400 ? 'bad' : 'warn',
        t0: e.t,
        t1: e.t,
        params: { name: e.name, code: e.code, message: e.message, count: 1 },
      };
      lastAlert.set(e.name, f);
      out.push(f);
    }
  }

  // Meridian flips (pier side changes between sections), long breaks, settings changes, calibrations
  let prev = null;
  for (const s of sections) {
    if (s.kind === 'calibration') {
      out.push({
        kind: 'calibration',
        severity: s.endReason === 'failed' ? 'bad' : 'info',
        t0: s.start,
        t1: s.end ?? s.start,
        params: { failed: s.endReason === 'failed', steps: s.calibration?.steps.length ?? 0 },
      });
      continue;
    }
    if (prev) {
      const from = prev.header.pierSide;
      const to = s.header.pierSide;
      if (from && to && from !== to) {
        out.push({
          kind: 'flip',
          severity: 'info',
          t0: prev.end ?? s.start,
          t1: s.start,
          params: { from, to },
        });
      }
      const gap = s.start - (prev.end ?? s.start);
      if (gap >= 600) {
        out.push({
          kind: 'gap',
          severity: 'info',
          t0: prev.end,
          t1: s.start,
          params: { minutes: Math.round(gap / 60) },
        });
      }
    }
    for (const e of s.events) {
      if (e.type === 'param')
        out.push({
          kind: 'param',
          severity: 'info',
          t0: e.t,
          t1: e.t,
          params: { change: e.change },
        });
    }
    prev = s;
  }

  out.sort(
    (a, b) => a.t0 - b.t0 || SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)
  );
  return mergeNearby(out);
}

/** Kinds whose findings within MERGE_SECONDS of each other become one (with a count). */
const MERGED_KINDS = new Set(['starLost', 'badStretch', 'jump', 'clouds', 'pulseLimit']);
export const MERGE_SECONDS = 300;

// the parameter that says how bad a finding is, kept at its worst when findings merge
const WORST = { badStretch: 'rms', jump: 'arcsec', starLost: 'frames', pulseLimit: 'frames' };

/** Merges findings of a kind that follow each other within MERGE_SECONDS; `count` says how many. */
export function mergeNearby(findings, seconds = MERGE_SECONDS) {
  const out = [];
  const open = new Map();
  for (const f of findings) {
    f.count = f.count ?? 1;
    if (!MERGED_KINDS.has(f.kind)) {
      out.push(f);
      continue;
    }
    const prev = open.get(f.kind);
    if (prev && f.t0 - prev.t1 <= seconds) {
      prev.t1 = Math.max(prev.t1, f.t1);
      prev.count += f.count;
      if (SEVERITIES.indexOf(f.severity) < SEVERITIES.indexOf(prev.severity))
        prev.severity = f.severity;
      const key = WORST[f.kind];
      if (key === 'frames') prev.params.frames += f.params.frames;
      else if (key && f.params[key] > prev.params[key])
        prev.params = { ...prev.params, ...f.params };
      if (f.kind === 'clouds') prev.params.snr = Math.min(prev.params.snr, f.params.snr);
      if ('minutes' in prev.params) prev.params.minutes = (prev.t1 - prev.t0) / 60;
      if ('seconds' in prev.params && f.kind === 'starLost')
        prev.params.seconds = Math.round(prev.t1 - prev.t0);
      continue;
    }
    open.set(f.kind, f);
    out.push(f);
  }
  return out;
}

// --- Exposures -------------------------------------------------------------------

/** Grade of an RMS against the typical one: 'good' | 'fair' | 'poor' | 'bad'. */
export function gradeOfRatio(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 1.25) return 'good';
  if (ratio <= 1.6) return 'fair';
  if (ratio <= 2.5) return 'poor';
  return 'bad';
}

/**
 * Guiding during each light frame: { ...exposure, stats, grade } for the exposures that
 * overlap the series; grade (gradeOfRatio) relative to the median of these exposures, 'lost'
 * when the star was lost during it.
 */
export function exposureGuiding(series, exposures) {
  const rows = [];
  for (const exp of exposures ?? []) {
    if (!(exp.end > exp.start)) continue;
    const { from, to } = indexRange(series, exp.start, exp.end);
    if (to - from < 2) continue;
    const stats = rangeStats(series, from, to, { excludeSettling: false });
    if (stats.empty) continue;
    rows.push({ ...exp, from, to, stats });
  }
  const typical = median(rows.map((r) => r.stats.rmsTotal));
  for (const r of rows) {
    const ratio = typical > 0 ? r.stats.rmsTotal / typical : 1;
    r.ratio = ratio;
    r.grade = r.stats.drops > 0 ? 'lost' : gradeOfRatio(ratio);
  }
  return { rows, typical };
}

/** Exposures of an image history (ninaAPI image-history entries) on the log's wall clock. */
export function lightExposures(history, toWall) {
  const out = [];
  for (const [index, image] of (history ?? []).entries()) {
    const type = String(image?.ImageType ?? '').toUpperCase();
    if (type && type !== 'LIGHT') continue;
    const endMs =
      typeof image?.Date === 'string' ? Date.parse(image.Date.replace(/(\.\d{3})\d+/, '$1')) : NaN;
    const seconds = Number(image?.ExposureTime);
    if (!Number.isFinite(endMs) || !(seconds > 0)) continue;
    const end = toWall(endMs);
    if (!Number.isFinite(end)) continue;
    out.push({
      index,
      start: end - seconds,
      end,
      seconds,
      filter: image.Filter ?? null,
      hfr: Number.isFinite(Number(image.HFR)) ? Number(image.HFR) : null,
      stars: Number.isFinite(Number(image.Stars)) ? Number(image.Stars) : null,
    });
  }
  return out;
}

export { median, percentile };
