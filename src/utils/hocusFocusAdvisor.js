// Plain-language advice for Hocus Focus autofocus runs. Pure functions only, so the focus page,
// the setup assistant and the tests share one set of rules.
//
// The target comes from the Hocus Focus quick start: the sweep should bracket focus with roughly
// four points per side, and the stars at the outer points should be about three times as wide as
// in focus. The thresholds below are deliberately loose around that target; they are tuned on
// real runs (see docs/features/hocus-focus-simple-setup.md).

export const EDGE_RATIO_TOO_FLAT = 1.8;
export const EDGE_RATIO_TOO_STEEP = 5;
export const STEP_SIZE_GROW = 1.5;
export const STEP_SIZE_SHRINK = 0.7;
export const MIN_STARS = 15;
export const STAR_LOSS_RATIO = 0.3;
export const EXPOSURE_GROW = 2;
export const FINAL_HFR_WORSE_RATIO = 1.1;
export const DEFAULT_R2_THRESHOLD = 0.8;
export const EDGE_LOST_SHRINK = 0.5;

// Sweep plausibility. Points per side outside this band are almost always a typo; a half sweep
// over a tenth of the focuser's travel is far wider than any star field survives.
export const DEFAULT_OFFSET_STEPS = 4;
export const MIN_SANE_OFFSET_STEPS = 3;
export const MAX_SANE_OFFSET_STEPS = 7;
export const SWEEP_MAX_TRAVEL_FRACTION = 0.1;

// Step-size measurement. The probes go out until the stars reach the target size of the outermost
// AF point or fade below 30 % of the most stars seen; a rise under PROBE_MIN_SIGNAL_RATIO is
// seeing jitter. PROBE_HFR_RATIO only sizes the first probe from the hand-focus frames.
export const TARGET_EDGE_RATIO = 3;
export const PROBE_HFR_RATIO = 1.5;
export const PROBE_MIN_SIGNAL_RATIO = 1.15;
export const PROBE_STAR_LOSS_RATIO = 0.3;
export const PROBE_GROWTH = 2;
// One or two steps never show a rise; a focuser that loses the stars at 4 is bisected back down.
export const PROBE_FIRST_OFFSET = 4;
export const PROBE_BISECT_PRECISION = 0.15;
// The star-loss boundary is only bracketed to PROBE_BISECT_PRECISION and star counts jitter from
// frame to frame, so a capped sweep stays this far inside it. The boundary equals the run
// diagnosis' STAR_LOSS_RATIO, so the margin must keep the outer AF points clearly above it: on the
// Pi data 0.8 left about 36 % of the stars there, 0.7 still keeps about half.
export const SWEEP_STAR_MARGIN = 0.7;
export const PROBE_MAX_COUNT = 16;
export const PROBE_MIN_POINTS = 3;
export const PROBE_MAX_TRAVEL_FRACTION = 0.25;

// Upper bounds of the matching NINA profile inputs in FocusSettingsPanel.vue.
const MAX_OFFSET_STEPS = 10;
const MAX_EXPOSURE = 9999;
const MAX_STEP_SIZE = 100000;

// Image scale in arcsec per pixel.
export function imageScale(focalLength, pixelSize, binning = 1) {
  const f = Number(focalLength);
  const px = Number(pixelSize);
  const bin = Number(binning) > 0 ? Number(binning) : 1;
  if (!(f > 0) || !(px > 0)) return null;
  return (206.265 * px * bin) / f;
}

// Maps the image scale onto Hocus Focus' simple-mode "Pixel Scale" preset.
export function suggestPixelScalePreset(scale) {
  if (!(scale > 0)) return null;
  if (scale > 3) return 'WideField';
  if (scale < 1) return 'LongFocalLength';
  return 'Typical';
}

const SEVERITY_RANK = { error: 0, warn: 1, info: 2 };

function finding(id, severity, params = {}, fix = null) {
  return { id, severity, params, fix };
}

function round(value, max) {
  return Math.min(max, Math.max(1, Math.round(value)));
}

// Evaluates a response of GET hocusfocus/autofocus/last-run.
//
// `settings` carries the values a fix builds on:
//   stepSize, offsetSteps, exposureTime   NINA FocuserSettings
//   rSquaredThreshold                     Hocus Focus AF option
//   focusRange                            Hocus Focus Simple_FocusRange
//
// Returns null when there is nothing to judge (no run, run still going, too few points),
// otherwise { findings } sorted by severity; an empty list means the run looks good.
export function evaluateRun(run, settings = {}) {
  if (!run || run.Success === false) return null;

  if (run.IsActiveAutoFocuser === false) {
    return { findings: [finding('notActive', 'error')] };
  }
  if (run.InProgress) return null;

  const all = (Array.isArray(run.Points) ? run.Points : [])
    .filter((p) => Number.isFinite(p?.Position))
    .sort((a, b) => a.Position - b.Position);
  // A point without any measured HFR found no stars; HF also flags it as rejected.
  const isEmpty = (p) => !(p.HFR > 0);
  const points = all.filter((p) => !p.Rejected && !isEmpty(p));
  // The sweep went so far out that the outer frames were empty: the step size is far too large.
  // This is what an aborted run looks like, so it is judged even with fewer than three points.
  const edgesLost =
    points.length > 0 && all.length >= 3 && (isEmpty(all[0]) || isEmpty(all[all.length - 1]));
  if (!edgesLost && points.length < 3) return null;

  const findings = [];
  const { stepSize, offsetSteps, exposureTime, focusRange } = settings;
  const hasStep = Number(stepSize) > 0;

  // Star count first: with too few stars every other number is noise.
  const starMax = Number(run.AcceptedStarCountMax);
  const starMin = Number(run.AcceptedStarCountMin);
  if (Number.isFinite(starMax) && starMax < MIN_STARS) {
    const exposure = Number(exposureTime);
    findings.push(
      finding(
        'fewStars',
        'error',
        { stars: starMax, narrowband: isNarrowband(run.Filter) },
        exposure > 0
          ? {
              target: 'profile',
              key: 'FocuserSettings-AutoFocusExposureTime',
              value: Math.min(MAX_EXPOSURE, Math.round(exposure * EXPOSURE_GROW * 10) / 10),
            }
          : null
      )
    );
  }

  // Curve shape, star loss and fit all follow from the empty edges, so they are not judged.
  if (edgesLost) {
    findings.push(
      finding(
        'edgesLost',
        'error',
        {},
        hasStep
          ? {
              target: 'profile',
              key: 'FocuserSettings-AutoFocusStepSize',
              value: round(stepSize * EDGE_LOST_SHRINK, MAX_STEP_SIZE),
            }
          : null
      )
    );
    findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    return { findings };
  }

  let minIndex = 0;
  points.forEach((p, i) => {
    if (p.HFR < points[minIndex].HFR) minIndex = i;
  });
  const minHfr = points[minIndex].HFR;

  if (minIndex === 0 || minIndex === points.length - 1) {
    const steps = Number(offsetSteps);
    findings.push(
      finding(
        'notBracketed',
        'error',
        { side: minIndex === 0 ? 'inward' : 'outward' },
        steps > 0 && steps < MAX_OFFSET_STEPS
          ? {
              target: 'profile',
              key: 'FocuserSettings-AutoFocusInitialOffsetSteps',
              value: Math.min(MAX_OFFSET_STEPS, steps + 2),
            }
          : null
      )
    );
  } else if (minHfr > 0) {
    // Both ends have to rise, so the flatter end decides.
    const edgeRatio = Math.min(points[0].HFR, points[points.length - 1].HFR) / minHfr;
    const ratio = Math.round(edgeRatio * 10) / 10;
    if (edgeRatio < EDGE_RATIO_TOO_FLAT) {
      findings.push(
        finding(
          'tooFlat',
          'warn',
          { ratio },
          hasStep
            ? {
                target: 'profile',
                key: 'FocuserSettings-AutoFocusStepSize',
                value: round(stepSize * STEP_SIZE_GROW, MAX_STEP_SIZE),
              }
            : null
        )
      );
    } else if (edgeRatio > EDGE_RATIO_TOO_STEEP) {
      findings.push(
        finding(
          'tooSteep',
          'warn',
          { ratio },
          hasStep
            ? {
                target: 'profile',
                key: 'FocuserSettings-AutoFocusStepSize',
                value: round(stepSize * STEP_SIZE_SHRINK, MAX_STEP_SIZE),
              }
            : null
        )
      );
    }
  }

  // Many stars in focus but few at the defocused ends: the detector drops the donuts.
  if (
    Number.isFinite(starMax) &&
    starMax >= MIN_STARS &&
    Number.isFinite(starMin) &&
    starMin < starMax * STAR_LOSS_RATIO &&
    focusRange !== 'WideRange'
  ) {
    findings.push(
      finding(
        'starsLost',
        'warn',
        { min: starMin, max: starMax },
        { target: 'hf-sd', key: 'Simple_FocusRange', value: 'WideRange' }
      )
    );
  }

  const r2 = run.RSquares?.Hyperbolic;
  const r2Threshold = Number(settings.rSquaredThreshold) || DEFAULT_R2_THRESHOLD;
  if (typeof r2 === 'number' && r2 < r2Threshold) {
    findings.push(finding('poorFit', 'warn', { r2: Math.round(r2 * 100) / 100 }));
  }

  const initial = Number(run.InitialHFR);
  const final = Number(run.FinalHFR);
  if (initial > 0 && final > initial * FINAL_HFR_WORSE_RATIO) {
    findings.push(
      finding('worseAfter', 'info', {
        initial: Math.round(initial * 100) / 100,
        final: Math.round(final * 100) / 100,
      })
    );
  }

  findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return { findings };
}

function isNarrowband(filter) {
  return /\b(ha|h-alpha|halpha|oiii|o3|sii|s2|nb|narrow)/i.test(String(filter || ''));
}

// Setup problems that are visible before any run.
//   profile             NINA profile (TelescopeSettings, CameraSettings, FocuserSettings)
//   starDetection       Hocus Focus star-detection options
//   focuser             NINA focuser info (MaxStep)
export function checkPrerequisites(profile, starDetection, focuser) {
  const issues = [];
  const focalLength = Number(profile?.TelescopeSettings?.FocalLength);
  const pixelSize = Number(profile?.CameraSettings?.PixelSize);
  if (!(focalLength > 0) || !(pixelSize > 0)) issues.push('missingOptics');

  const afBinning = Number(profile?.FocuserSettings?.AutoFocusBinning) || 1;
  if (starDetection && starDetection.DetectionBinning !== 'Bin1' && afBinning > 1) {
    issues.push('binningStacked');
  }

  const offsetSteps = Number(profile?.FocuserSettings?.AutoFocusInitialOffsetSteps);
  if (
    offsetSteps > 0 &&
    (offsetSteps < MIN_SANE_OFFSET_STEPS || offsetSteps > MAX_SANE_OFFSET_STEPS)
  ) {
    issues.push('offsetStepsUnusual');
  }

  const stepSize = Number(profile?.FocuserSettings?.AutoFocusStepSize);
  const maxStep = Number(focuser?.MaxStep);
  if (maxStep > 0 && stepSize * offsetSteps > maxStep * SWEEP_MAX_TRAVEL_FRACTION) {
    issues.push('sweepTooLarge');
  }
  return issues;
}

// The one-tap fixes for setup issues that have an obvious value.
export const ISSUE_FIXES = {
  offsetStepsUnusual: {
    target: 'profile',
    key: 'FocuserSettings-AutoFocusInitialOffsetSteps',
    value: DEFAULT_OFFSET_STEPS,
  },
};

// The positions an autofocus run will visit: NINA starts `offsetSteps` steps away from the
// current position and sweeps across it to the same distance on the other side.
export function sweepRange(position, stepSize, offsetSteps, maxStep) {
  const pos = Number(position);
  const half = Number(stepSize) * Number(offsetSteps);
  if (!Number.isFinite(pos) || !(half > 0)) return null;
  const from = pos - half;
  const to = pos + half;
  const max = Number(maxStep);
  return { from, to, half, outOfRange: from < 0 || (max > 0 && to > max) };
}

// --- Step-size measurement -------------------------------------------------------------------
//
// The measurement moves the focuser away from rough focus in one direction and takes a frame per
// probe. Focusers differ by orders of magnitude (one step or several hundred per useful AF step),
// so there is no fixed probe distance: the offset doubles until the stars reach the target size,
// and once a probe loses the stars it bisects between the last good and the lost offset to find
// how far out the stars still survive. The AF sweep is never allowed beyond that.
//
// Backlash and NINA's backlash compensation shift where the probes really are: on the PINS test
// Pi the probes sat about 400 steps (its BacklashOut) beyond their nominal offset. Neither the
// stop rule nor the result may therefore assume that a nominal offset of 0 is in focus.
//
// reference  { hfr, stars } at the start position
// probes     [{ offset, hfr, stars }] in the order they were taken; offset is a step count > 0
// limits     { maxOffset } furthest allowed offset, maxCount the probe budget
//
// Returns { action: 'probe', offset }, { action: 'done' } or { action: 'fail', reason } with
// reason 'noSignal' (limit reached, stars never grew), 'lost' (stars gone even at the smallest
// offset) or 'noReference' (the start frame had no HFR).
export function nextProbe(reference, probes, limits = {}, firstOffset = PROBE_FIRST_OFFSET) {
  const maxOffset = Number(limits.maxOffset) > 0 ? Math.floor(limits.maxOffset) : Infinity;
  const maxCount = limits.maxCount || PROBE_MAX_COUNT;
  if (!(Number(reference?.hfr) > 0)) return { action: 'fail', reason: 'noReference' };

  const { good, lost, baseline } = classifyProbes(reference, probes);
  // The fit needs a few points on the rising arm, not just one lucky frame.
  const enough = good.length >= PROBE_MIN_POINTS;
  if (enough && good.some((p) => p.hfr >= baseline * TARGET_EDGE_RATIO)) {
    return { action: 'done' };
  }

  // Without a clear rise, a weaker one is still better than nothing.
  const fallback = () => {
    if (enough && good.some((p) => p.hfr >= baseline * PROBE_MIN_SIGNAL_RATIO)) {
      return { action: 'done' };
    }
    return { action: 'fail', reason: good.length || !lost.length ? 'noSignal' : 'lost' };
  };

  if (probes.length >= maxCount) return fallback();

  const lo = good.reduce((m, p) => Math.max(m, p.offset), 0);
  const hi = lost.reduce((m, p) => Math.min(m, p.offset), Infinity);
  // The star-loss boundary only caps the sweep, so it need not be found to the step.
  if (lo > 0 && hi - lo <= lo * PROBE_BISECT_PRECISION) return fallback();
  let offset;
  if (!probes.length) offset = Math.max(1, Math.round(firstOffset));
  else if (hi < Infinity) offset = Math.round((lo + hi) / 2);
  else offset = lo * PROBE_GROWTH;
  offset = Math.min(offset, maxOffset);

  if (offset <= lo || offset >= hi) return fallback();
  return { action: 'probe', offset };
}

// Splits the probes into usable and lost ones. The in-focus HFR (`baseline`) is the sharpest
// frame of all; a probe is lost once it has no HFR or under PROBE_STAR_LOSS_RATIO of the most
// stars any frame showed (defocused stars fade, so some loss is normal).
export function classifyProbes(reference, probes) {
  const frames = [reference, ...probes].filter((p) => p?.hfr > 0);
  const maxStars = frames.reduce((m, p) => Math.max(m, Number(p.stars) || 0), 0);
  const isLost = (p) =>
    !(p.hfr > 0) || (maxStars > 0 && Number(p.stars) < maxStars * PROBE_STAR_LOSS_RATIO);
  const good = probes.filter((p) => !isLost(p));
  const baseline = Math.min(...[reference, ...good].map((p) => p.hfr).filter((h) => h > 0));
  return { good, lost: probes.filter(isLost), baseline };
}

// Step size that puts the outermost of `offsetSteps` points at about TARGET_EDGE_RATIO × the
// in-focus HFR, but never further out than the furthest probe that still had enough stars, and
// SWEEP_STAR_MARGIN inside it once a probe lost them: the curve is not extrapolated into the
// region where the stars fade (`limited` reports that cap).
//
// The probes are fitted with the hyperbola HFR² = r² + k²·(d − d0)², which is a parabola in HFR²
// and leaves the focus offset d0 free, so backlash neither bends the slope k nor shrinks the
// reach measured from focus. r is the sharpest frame actually measured: the fit's own minimum is
// an extrapolation.
export function suggestStepSize(reference, probes, offsetSteps) {
  const n = Number(offsetSteps);
  const { good, lost, baseline } = classifyProbes(reference, probes);
  if (!(n > 0) || !(baseline > 0) || !good.length) return null;
  const furthest = good.reduce((m, p) => Math.max(m, p.offset), 0);

  const fit = parabolaFit(good.map((p) => [p.offset, p.hfr * p.hfr]));
  let slope = fit?.a > 0 ? Math.sqrt(fit.a) : null;
  let reach = furthest;
  if (slope) {
    // A focus offset outside the measured span is an artefact of a poor fit, not backlash.
    const center = Math.min(furthest / 2, Math.max(-furthest, -fit.b / (2 * fit.a)));
    reach = furthest - center;
  } else {
    // Too few or too noisy points for the fit: fall back to the furthest probe against focus.
    const far = good.find((p) => p.offset === furthest);
    if (!(far.hfr > baseline)) return null;
    slope = Math.sqrt(far.hfr * far.hfr - baseline * baseline) / far.offset;
  }
  const target = (Math.sqrt(TARGET_EDGE_RATIO ** 2 - 1) * baseline) / (slope * n);
  // Only a real star-loss boundary needs the margin; otherwise the furthest probe still had stars.
  const cap = (reach * (lost.length ? SWEEP_STAR_MARGIN : 1)) / n;
  return { stepSize: round(Math.min(target, cap), MAX_STEP_SIZE), limited: cap < target };
}

// Least-squares fit y = a·x² + b·x + c; returns { a, b } in the units of x, or null with fewer
// than three distinct x.
function parabolaFit(points) {
  if (new Set(points.map(([x]) => x)).size < 3) return null;
  // Centre and scale x so the normal equations stay well conditioned for offsets in the 1000s.
  const mean = points.reduce((s, [x]) => s + x, 0) / points.length;
  const scale = Math.max(...points.map(([x]) => Math.abs(x - mean))) || 1;
  const S = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const T = [0, 0, 0];
  for (const [x0, y] of points) {
    const x = (x0 - mean) / scale;
    const v = [x * x, x, 1];
    for (let i = 0; i < 3; i++) {
      T[i] += v[i] * y;
      for (let j = 0; j < 3; j++) S[i][j] += v[i] * v[j];
    }
  }
  const det = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(S);
  if (!d) return null;
  // Cramer's rule, then undo the centring and scaling: y = a'·u² + b'·u + c' with u = (x − m)/s.
  const a1 = det(S.map((row, i) => [T[i], row[1], row[2]])) / d;
  const b1 = det(S.map((row, i) => [row[0], T[i], row[2]])) / d;
  const a = a1 / (scale * scale);
  return { a, b: b1 / scale - 2 * a * mean };
}

// Points per side to pair with a measured step size: the current value unless it is implausible.
export function suggestOffsetSteps(current) {
  const n = Number(current);
  return n >= MIN_SANE_OFFSET_STEPS && n <= MAX_SANE_OFFSET_STEPS ? n : DEFAULT_OFFSET_STEPS;
}

// First probe offset from the frames taken while focusing by hand: half the offset where those
// frames say the stars reach PROBE_HFR_RATIO, using the steepest estimate so the first probe
// stays well inside the star field. Without usable frames the probe starts at PROBE_FIRST_OFFSET.
export function initialProbeOffset(samples) {
  const list = (Array.isArray(samples) ? samples : []).filter((s) => s.hfr > 0);
  if (list.length < 2) return PROBE_FIRST_OFFSET;
  const best = list.reduce((b, s) => (s.hfr < b.hfr ? s : b));
  let steepest = 0;
  for (const s of list) {
    const d = Math.abs(s.position - best.position);
    if (d > 0 && s.hfr >= best.hfr * PROBE_MIN_SIGNAL_RATIO) {
      steepest = Math.max(steepest, Math.sqrt(s.hfr * s.hfr - best.hfr * best.hfr) / d);
    }
  }
  if (!(steepest > 0)) return PROBE_FIRST_OFFSET;
  const reach = (Math.sqrt(PROBE_HFR_RATIO ** 2 - 1) * best.hfr) / steepest;
  return Math.max(1, Math.floor(reach / 2));
}

// Probe direction and furthest offset: away from the nearer end of travel, at most
// PROBE_MAX_TRAVEL_FRACTION of the travel. Without a known MaxStep only position 0 bounds it.
export function probeLimits(position, maxStep) {
  const pos = Number(position) || 0;
  const max = Number(maxStep);
  if (!(max > 0)) return { direction: 1, maxOffset: Infinity };
  const direction = max - pos >= pos ? 1 : -1;
  const room = direction > 0 ? max - pos : pos;
  return { direction, maxOffset: Math.min(room, max * PROBE_MAX_TRAVEL_FRACTION) };
}

// The values evaluateRun() builds its fixes on, from the NINA profile and the two HF option sets.
export function advisorSettings(profile, autoFocus, starDetection) {
  const focuser = profile?.FocuserSettings || {};
  return {
    stepSize: focuser.AutoFocusStepSize,
    offsetSteps: focuser.AutoFocusInitialOffsetSteps,
    exposureTime: focuser.AutoFocusExposureTime,
    rSquaredThreshold: autoFocus?.RSquaredRejectionThreshold,
    focusRange: starDetection?.Simple_FocusRange,
  };
}

const FIX_LABELS = {
  'FocuserSettings-AutoFocusStepSize': 'stepSize',
  'FocuserSettings-AutoFocusInitialOffsetSteps': 'offsetSteps',
  'FocuserSettings-AutoFocusExposureTime': 'exposure',
  Simple_FocusRange: 'focusRange',
};

// i18n key suffix for the button that applies a fix.
export function fixLabelKey(fix) {
  return FIX_LABELS[fix?.key] || 'generic';
}

// Identifies an image-history entry; older backends may omit the Id.
export function historyEntryId(entry) {
  return entry?.Id || `${entry?.Date}|${entry?.Filename}`;
}

// The newest and the sharpest frame among the image-history entries not in `ignoreIds` (the
// frames that existed before focusing by hand started). Each entry carries the focuser position
// NINA recorded for that frame, so moving the focuser while the next frame downloads cannot mix
// up the pairing. History is oldest first.
export function focusSamples(history, ignoreIds = new Set()) {
  let latest = null;
  let best = null;
  for (const { hfr, position, stars } of historySamples(history, ignoreIds)) {
    latest = { hfr, position, stars };
    if (!best || hfr < best.hfr) best = latest;
  }
  return { latest, best };
}

// Every image-history entry not in `ignoreIds` that has an HFR and a focuser position, oldest
// first, as { id, hfr, position, stars }.
export function historySamples(history, ignoreIds = new Set()) {
  const samples = [];
  for (const entry of Array.isArray(history) ? history : []) {
    const hfr = Number(entry?.HFR);
    const position = entry?.FocuserPosition;
    // typeof, not Number(): Number(null) would turn a missing position into 0.
    if (!(hfr > 0) || typeof position !== 'number' || !Number.isFinite(position)) continue;
    const id = historyEntryId(entry);
    if (ignoreIds.has(id)) continue;
    samples.push({ id, hfr, position, stars: entry.Stars ?? null });
  }
  return samples;
}
