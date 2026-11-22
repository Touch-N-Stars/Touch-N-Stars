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
// in-focus HFR (`focus` reports where the fit put focus, as an offset from the reference), but never further out than the furthest probe that still had enough stars, and
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
  let center = 0;
  if (slope) {
    // A focus offset outside the measured span is an artefact of a poor fit, not backlash.
    center = Math.min(furthest / 2, Math.max(-furthest, -fit.b / (2 * fit.a)));
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
  return {
    stepSize: round(Math.min(target, cap), MAX_STEP_SIZE),
    limited: cap < target,
    focus: center,
  };
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
  const list = (Array.isArray(samples) ? samples : []).filter(
    (s) => s?.hfr > 0 && Number.isFinite(s.position)
  );
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

// --- Focus scan ------------------------------------------------------------------------------
//
// The step-size measurement and the backlash measurement share one rule: every frame is reached
// moving the same way (`direction`), after a preload behind it that takes up the slack. Without
// it, backlash eats the first probes or the bisection moves back, and the result depends on which
// way the rough focus was last approached. The preload in turn moves the drawtube by up to the
// backlash away from where the hand left it, so the scan cannot take the start as focus: it walks
// out from the start until it has passed the sharpest frame, then runs nextProbe() from there.

// Preload as a share of the focuser's travel; it has to exceed the backlash. Without a known
// MaxStep a fixed number of steps.
export const SCAN_PRELOAD_TRAVEL_FRACTION = 0.02;
export const SCAN_PRELOAD_FALLBACK = 2000;
// Frame budget of the whole scan: finding focus plus the probes beyond it.
export const SCAN_MAX_COUNT = 24;
// A frame within this share of the arm's length from the fitted focus counts as taken at focus.
export const SCAN_FOCUS_TOLERANCE = 0.1;

// Steps behind a target each approach starts from, bounded by the travel behind `position`.
export function scanPreload(position, maxStep, direction) {
  const pos = Number(position) || 0;
  const max = Number(maxStep);
  const behind = direction > 0 ? pos : max > 0 ? max - pos : Infinity;
  const wanted = max > 0 ? Math.round(max * SCAN_PRELOAD_TRAVEL_FRACTION) : SCAN_PRELOAD_FALLBACK;
  return Math.max(0, Math.min(wanted, behind));
}

// Next frame of the focus scan.
//   frames  [{ offset, hfr, stars }] taken so far, offsets from the start in the scan direction
//   limits  { maxOffset, maxCount }
// Returns { action: 'probe', offset }, { action: 'done', best, probes } with the sharpest frame
// and the other usable frames (offsets from it), ready for suggestStepSize(), or { action: 'fail',
// reason } with the reasons of nextProbe().
export function nextScanProbe(frames, limits = {}, firstOffset = PROBE_FIRST_OFFSET) {
  const maxOffset = Number(limits.maxOffset) > 0 ? Math.floor(limits.maxOffset) : Infinity;
  const maxCount = limits.maxCount || SCAN_MAX_COUNT;
  if (!frames.length) return { action: 'probe', offset: 0 };
  const isLost = starLoss(frames);
  const good = frames.filter((f) => !isLost(f));
  const furthest = frames.reduce((m, f) => Math.max(m, f.offset), 0);
  const outwards = () => {
    const offset = furthest > 0 ? furthest * PROBE_GROWTH : Math.max(1, Math.round(firstOffset));
    if (offset > maxOffset || frames.length >= maxCount) {
      return { action: 'fail', reason: good.length ? 'noSignal' : 'noReference' };
    }
    return { action: 'probe', offset };
  };
  // No stars yet: focus may still lie ahead, up to the backlash beyond the start.
  if (!good.length) return outwards();

  const best = good.reduce((b, f) => (f.hfr < b.hfr ? f : b));
  const probes = frames
    .filter((f) => f.offset > best.offset)
    .map((f) => ({ ...f, offset: f.offset - best.offset }));
  // Still on the way to focus, or at it: keep going out.
  if (!probes.length) return outwards();

  // Fewer than PROBE_MIN_POINTS usable frames beyond focus: fill in halfway between focus and the
  // nearest of them. Needed when focus lay far ahead and the doubling jumped past it in one go,
  // or when the stars fade soon after focus and the bisection leaves too few frames before that.
  const goodBeyond = probes.filter((p) => !isLost(p));
  const fillIn = () => {
    if (!goodBeyond.length || goodBeyond.length >= PROBE_MIN_POINTS) return null;
    if (frames.length >= maxCount) return null;
    const nearest = goodBeyond.reduce((n, p) => (p.offset < n.offset ? p : n));
    const offset = best.offset + Math.round(nearest.offset / 2);
    if (offset <= best.offset || frames.some((f) => f.offset === offset)) return null;
    return { action: 'probe', offset };
  };
  // Stars that already rose clearly at the first frame beyond focus: fill in before going on.
  const nearestRise = goodBeyond.reduce((n, p) => (!n || p.offset < n.offset ? p : n), null);
  if (nearestRise && nearestRise.hfr >= best.hfr * PROBE_HFR_RATIO) {
    const early = fillIn();
    if (early) return early;
  }

  const next = nextProbe(
    best,
    probes,
    { maxOffset: maxOffset - best.offset, maxCount: probes.length + maxCount - frames.length },
    firstOffset
  );
  if (next.action === 'fail') return fillIn() || next;
  if (next.action === 'probe') return { action: 'probe', offset: best.offset + next.offset };
  if (next.action !== 'done') return next;

  // The frames before the sharpest one lie on the other arm and help the fit; lost ones there
  // would wrongly count as the star-loss edge of the sweep.
  const around = [
    ...good
      .filter((f) => f.offset < best.offset)
      .map((f) => ({ ...f, offset: f.offset - best.offset })),
    ...probes,
  ];
  // The step size scales with the sharpest frame's HFR, so one frame has to sit at focus: when
  // the scan's coarse steps straddled it, take one where the fit puts it.
  const focus = suggestStepSize(best, around, DEFAULT_OFFSET_STEPS)?.focus || 0;
  const arm = around.reduce((m, f) => Math.max(m, f.offset), 0) - focus;
  const target = Math.round(best.offset + focus);
  const nearest = frames.reduce((m, f) => Math.min(m, Math.abs(f.offset - target)), Infinity);
  if (nearest > SCAN_FOCUS_TOLERANCE * arm && frames.length < maxCount) {
    return { action: 'probe', offset: target };
  }
  return { action: 'done', best, probes: around };
}

// --- Backlash measurement --------------------------------------------------------------------
//
// After a change of direction the motor first takes up the slack, and the drawtube only follows
// once it is gone. The measurement walks through that dead band on the stars: a few calibration
// frames on one arm of the V turn HFR into a position, then the focuser walks towards focus in
// even steps. While the slack is being taken up the stars stay the same; the first frame that
// shows them shrinking tells how many steps were lost. A second walk back out measures the other
// reversal. Walking towards focus keeps the stars visible however large the backlash is, so the
// reach only depends on the number of steps, not on the AF sweep. Distances are in units of the
// AF half sweep (step size × points per side), so they scale with the focuser.
//
// NINA's compensation acts on every reversal (FocuserDecorator in N.I.N.A.), so the walks see what
// is left over it: with ABSOLUTE, the backlash minus BacklashIn/Out per reversal; with OVERSHOOT,
// how far the overshoot falls short of it. suggestBacklash() adds that remainder back onto the
// current values.

// Calibration points on the arm, approached moving away from focus. The outermost is the AF
// sweep's own edge, where the step-size measurement made sure the stars survive; the walk towards
// focus starts there.
export const BACKLASH_CALIBRATION = [0.5, 0.75, 1];
// Walk step. The first frame that moved has moved by less than a step plus the threshold, which
// has to stay inside the readable range below.
export const BACKLASH_WALK_STEP = 0.5;
// Steps per walk; with the step above this reads backlash up to ten half sweeps.
export const BACKLASH_WALK_MAX = 20;
// A frame counts as moved once its reading differs by this much from the frames before it: well
// above seeing jitter (about 0.1 px HFR), well below a step.
export const BACKLASH_MOVE_THRESHOLD = 0.15;
// The range a frame can be read in: below BACKLASH_ARM_START the V bends into its bottom, and
// beyond the outermost calibration point the straight line only holds for a while.
export const BACKLASH_ARM_START = 0.25;
export const BACKLASH_EXTRAPOLATION = 0.6;
// Under a tenth of an AF step, backlash cannot move the autofocus result.
export const BACKLASH_MIN_STEP_FRACTION = 0.1;
// An overshoot only has to be at least the backlash, and a larger one only costs time.
export const OVERSHOOT_MARGIN = 1.25;

// Positions for one backlash measurement around `position` (focus), or null when the sweep
// is not set or the travel has no room for it. Offsets count from `position` in `direction`.
//   calibration  offsets of the calibration frames, also the order they are taken in
//   preload      how far behind the first calibration point its approach starts; it has to take
//                up any slack the walks can measure
//   step         walk step in focuser steps
//   maxSteps     steps per walk, so the largest remainder it can read is maxSteps × step
//   low, high    the offsets a frame can be read at
//   threshold    the reading change that counts as moved
export function backlashPlan(position, maxStep, stepSize, offsetSteps, scanDirection) {
  const pos = Number(position);
  const half = Number(stepSize) * Number(offsetSteps);
  if (!Number.isFinite(pos) || !(half > 0)) return null;
  // The focus scan before it fixes the side; on its own the side with more room is used.
  const direction = scanDirection || probeLimits(pos, maxStep).direction;
  const max = Number(maxStep) > 0 ? Number(maxStep) : Infinity;
  const roomArm = direction > 0 ? max - pos : pos;
  const roomBehind = direction > 0 ? pos : max - pos;

  const calibration = BACKLASH_CALIBRATION.map((f) => Math.round(f * half));
  const first = calibration[0];
  const last = calibration[calibration.length - 1];
  const step = Math.max(1, Math.round(BACKLASH_WALK_STEP * half));
  // The walk in drives the nominal position behind the start by up to its full length, the walk
  // out brings it back past the last calibration point by as much.
  const maxSteps = Math.min(
    BACKLASH_WALK_MAX,
    Math.floor((roomBehind + last) / step) - 1,
    Math.floor((roomArm - last) / step)
  );
  if (!(maxSteps >= 2)) return null;
  const preload = Math.min((maxSteps + 1) * step, roomBehind + first);
  return {
    direction,
    half,
    calibration,
    preload,
    step,
    maxSteps,
    low: Math.round(BACKLASH_ARM_START * half),
    high: Math.round(last + BACKLASH_EXTRAPOLATION * half),
    threshold: BACKLASH_MOVE_THRESHOLD * half,
  };
}

// Least-squares line HFR = slope · offset + intercept through the calibration frames.
function lineFit(points) {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.offset, 0) / n;
  const my = points.reduce((s, p) => s + p.hfr, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.offset - mx) ** 2;
    sxy += (p.offset - mx) * (p.hfr - my);
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  return { slope, intercept: my - slope * mx };
}

// A frame is lost without an HFR or under PROBE_STAR_LOSS_RATIO of the most stars any frame showed.
function starLoss(frames) {
  const maxStars = frames.reduce((m, p) => Math.max(m, Number(p.stars) || 0), 0);
  return (p) =>
    !(p?.hfr > 0) || (maxStars > 0 && Number(p.stars) < maxStars * PROBE_STAR_LOSS_RATIO);
}

// Whether the calibration frames can carry the measurement: null when they can, otherwise
// 'notInFocus' (a frame further out was clearly sharper than the first, so the start position was
// not at focus and the calibration straddles it), 'lost' (a frame had too few stars, also
// absolutely: frames that are all far out of focus lose none relative to each other) or 'flat'
// (the stars did not grow across them).
export function backlashCalibrationFailure(calibration) {
  if (sharpestCalibrationFrame(calibration) !== calibration[0]) return 'notInFocus';
  const isLost = starLoss(calibration);
  if (calibration.length < 2 || calibration.some((p) => isLost(p) || !(p.stars >= MIN_STARS))) {
    return 'lost';
  }
  const first = calibration[0];
  const last = calibration[calibration.length - 1];
  const { slope } = lineFit(calibration);
  if (!(slope > 0) || !(last.hfr >= first.hfr * PROBE_MIN_SIGNAL_RATIO)) return 'flat';
  return null;
}

// The calibration frame with the sharpest stars, counting only one that beats the first frame by
// more than seeing jitter; on a clean arm of the V that is the first frame itself.
export function sharpestCalibrationFrame(calibration) {
  const first = calibration[0];
  return calibration.reduce((best, p) => {
    const sharper = p.hfr > 0 && p.stars >= MIN_STARS && p.hfr * PROBE_MIN_SIGNAL_RATIO < best.hfr;
    return sharper ? p : best;
  }, first);
}

// Turns a frame into the offset it was taken at, read off the calibration line.
export function backlashReader(calibration) {
  const { slope, intercept } = lineFit(calibration);
  return (frame) => (frame.hfr - intercept) / slope;
}

// Where one walk stands.
//   start   reading the walk starts from (the last frame before it)
//   frames  [{ hfr, stars }] taken after 1, 2, … steps, each plan.step further in `sign`
//           (−1 towards focus, +1 away from it)
// Returns { action: 'step' } for one more step, { action: 'done', remainder, end } with the steps
// lost to the reversal and the reading the walk ended at, or { action: 'fail', reason } with
// 'tooLarge' (still no movement after plan.maxSteps), 'lost' (a frame lost its stars) or
// 'overcompensated' / 'unsteady' (the first / a later frame jumped out of the readable range).
export function backlashWalk(plan, calibration, start, frames, sign) {
  if (!frames.length) return { action: 'step' };
  const read = backlashReader(calibration);
  const isLost = starLoss([...calibration, ...frames]);
  const k = frames.length;
  const frame = frames[k - 1];
  if (isLost(frame)) return { action: 'fail', reason: 'lost' };
  const reading = read(frame);
  if (reading < plan.low || reading > plan.high) {
    return { action: 'fail', reason: k === 1 ? 'overcompensated' : 'unsteady' };
  }
  // Measured against the start alone: a frame before this one may already have moved a little,
  // below the threshold, and would pull an average towards the result.
  const moved = sign * (reading - start);
  if (moved > plan.threshold) {
    return { action: 'done', remainder: k * plan.step - moved, end: reading };
  }
  if (k >= plan.maxSteps) return { action: 'fail', reason: 'tooLarge' };
  return { action: 'step' };
}

// Whether NINA's current compensation rules out the measurement. ABSOLUTE with different In and
// Out values moves NINA's own position scale by the difference on every back-and-forth (the
// offset in AbsoluteBacklashCompensationDecorator), so frames taken after a re-approach no longer
// line up with the ones before. Returns 'lopsidedAbsolute' or null; OVERSHOOT and equal values
// are fine, the measurement then reads what is left over them.
export function compensationBlocksMeasurement(focuserSettings) {
  const settings = focuserSettings || {};
  if (settings.BacklashCompensationModel !== 'ABSOLUTE') return null;
  const backlashIn = Number(settings.BacklashIn) || 0;
  const backlashOut = Number(settings.BacklashOut) || 0;
  return backlashIn !== backlashOut ? 'lopsidedAbsolute' : null;
}

// New BacklashIn/Out values from a measured remainder. `direction` is the plan's: the reversal
// towards focus is an inward move when the arm lies outwards. Returns
//   { model, backlash, changes: [{ key, value, current }] }
// where `backlash` is the estimated mechanical backlash in steps (null when the compensation
// covers it and the remainder therefore says nothing about its size) and `changes` is empty when
// the current compensation already fits.
export function suggestBacklash(focuserSettings, remainder, direction, stepSize) {
  const settings = focuserSettings || {};
  const model = settings.BacklashCompensationModel === 'ABSOLUTE' ? 'ABSOLUTE' : 'OVERSHOOT';
  const current = {
    In: Math.max(0, Number(settings.BacklashIn) || 0),
    Out: Math.max(0, Number(settings.BacklashOut) || 0),
  };
  const rest = {
    In: direction > 0 ? remainder.towards : remainder.away,
    Out: direction > 0 ? remainder.away : remainder.towards,
  };
  const relevant = Math.max(1, BACKLASH_MIN_STEP_FRACTION * Number(stepSize));
  const change = (side, value) => ({
    key: `FocuserSettings-Backlash${side}`,
    value,
    current: current[side],
  });

  if (model === 'ABSOLUTE') {
    // Each reversal is compensated on its own, so each side gets its own value.
    const total = {
      In: Math.max(0, Math.round(current.In + rest.In)),
      Out: Math.max(0, Math.round(current.Out + rest.Out)),
    };
    const changes = ['In', 'Out']
      .filter((side) => Math.abs(rest[side]) >= relevant && total[side] !== current[side])
      .map((side) => change(side, total[side]));
    const backlash = Math.round((total.In + total.Out) / 2);
    return { model, backlash: backlash >= relevant ? backlash : 0, changes };
  }

  // OVERSHOOT ends every move from one side, so both reversals show the same shortfall and their
  // mean is the better estimate. A value on the outward side keeps the default AF sweep (out
  // first, then stepping inwards) free of extra moves.
  const shortfall = (rest.In + rest.Out) / 2;
  const side = current.Out > 0 || current.In === 0 ? 'Out' : 'In';
  if (!(shortfall >= relevant)) {
    return { model, backlash: current[side] > 0 ? null : 0, changes: [] };
  }
  const backlash = Math.round(current[side] + shortfall);
  return { model, backlash, changes: [change(side, Math.ceil(backlash * OVERSHOOT_MARGIN))] };
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

// The newest and the sharpest of the hand-focus frames ({ hfr, position, stars }, oldest first).
// Frames without stars (HFR 0) or without a focuser position say nothing about the focus.
export function focusSamples(samples) {
  let latest = null;
  let best = null;
  for (const sample of Array.isArray(samples) ? samples : []) {
    if (!(sample?.hfr > 0) || !Number.isFinite(sample.position)) continue;
    latest = sample;
    if (!best || sample.hfr < best.hfr) best = sample;
  }
  return { latest, best };
}
