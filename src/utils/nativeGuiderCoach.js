// Pure helpers of the Guiding Coach UI (no Vue, no stores) so they can be unit tested with
// node --test. Data shapes are the camelCase AdvancedCoach* DTOs of IAdvancedGuider as served by
// /api/internal-guider/coach* and the 'coach'/'hint' WebSocket events. The engine emits findings as
// stable codes with parameters; every text is rendered here from the locale files.

/** Selectable steps in session order (the report is always built). */
export const COACH_STEPS = ['CameraCheck', 'Drift', 'MountResponse', 'Trials'];

/** Finding codes (AdvancedCoachFinding.Code, hints included). Every code has title/why/fix texts. */
export const FINDING_CODES = [
  'camera.recommendation',
  'camera.good',
  'camera.noFeasible',
  'camera.snrLow',
  'camera.saturated',
  'camera.defocused',
  'camera.fewStars',
  'camera.noDarks',
  'drift.seeing',
  'drift.minMove',
  'drift.periodicError',
  'drift.exposureLimit',
  'drift.polarAlignment',
  'drift.wind',
  'drift.decGuideMode',
  'response.decBacklash',
  'response.minPulse',
  'response.asymmetry',
  'response.rateMismatch',
  'response.good',
  'trials.winner',
  'trials.noImprovement',
  'trials.conditionsChanged',
  'trials.nothingToTry',
  'report.seeingLimited',
  'report.mountLimited',
  'report.noImagingScale',
  'hint.raOscillation',
  'hint.raSluggish',
  'hint.pulseLimited',
  'hint.lowSnr',
  'hint.decDrift',
  'hint.seeingBound',
];

/**
 * Failure/step message codes (AdvancedCoachStatus.MessageCode, AdvancedCoachStepStatus.MessageCode
 * and the start result's). Each has title/why/fix texts like the findings.
 */
export const MESSAGE_CODES = [
  'coach.busy',
  'coach.notConnected',
  'coach.noStar',
  'coach.noCalibration',
  'coach.calibrationFailed',
  'coach.starLost',
  'coach.noPulseOutput',
  'coach.interrupted',
  'coach.cameraError',
  'coach.internal',
];

/** i18n base of the code texts: `${CODE_TEXT_BASE}.<code>.title|why|fix`. */
export const CODE_TEXT_BASE = 'components.guider.native.coach.codes';

/** i18n base of translated string parameter values: `${VALUE_TEXT_BASE}.<param>.<value>`. */
export const VALUE_TEXT_BASE = 'components.guider.native.coach.values';

const SEVERITY_RANK = { problem: 3, warning: 2, info: 1, good: 0 };

export function severityRank(severity) {
  return SEVERITY_RANK[String(severity || '').toLowerCase()] ?? 1;
}

/** Colour tone of a finding severity: good → ok, info → info, warning → warn, problem → danger. */
export function findingTone(severity) {
  switch (String(severity || '').toLowerCase()) {
    case 'good':
      return 'ok';
    case 'warning':
      return 'warn';
    case 'problem':
      return 'danger';
    default:
      return 'info';
  }
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function trimZeros(text) {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** Fixed digits without trailing zeros ("2", "1.5", "0.25"). */
export function trimmed(value, digits = 2) {
  if (!isNumber(value)) return '–';
  return trimZeros(value.toFixed(digits));
}

/**
 * Unit of a parameter from its name (AdvancedCoachFinding.Parameters carry the unit in the name,
 * e.g. rmsArcsec, hfdPx, periodSeconds). Plain unit names (arcmin, ms, seconds, percent, arcsec)
 * count too.
 * @returns {{ unit: string, digits: number, scale?: number }}
 */
export function parameterUnit(name) {
  const n = String(name || '');
  if (/ArcsecPerSec$/.test(n)) return { unit: '″/s', digits: 3 };
  if (/ArcsecPerMin$/.test(n)) return { unit: '″/min', digits: 2 };
  if (/(^a|A)rcsec$/.test(n)) return { unit: '″', digits: 2 };
  if (/(^a|A)rcmin$/.test(n)) return { unit: '′', digits: 1 };
  if (/(^p|P)x$/.test(n)) return { unit: ' px', digits: 2 };
  if (/(^m|M)s$/.test(n)) return { unit: ' ms', digits: 0 };
  if (/(^s|S)econds$/.test(n)) return { unit: ' s', digits: 1 };
  if (/(^p|P)ercent$/.test(n)) return { unit: ' %', digits: 0 };
  if (n === 'gain' || n === 'stars' || n === 'frames') return { unit: '', digits: 0 };
  if (n === 'snr') return { unit: '', digits: 0 };
  if (n === 'ratio') return { unit: '×', digits: 2 };
  return { unit: '', digits: 2 };
}

/**
 * Formats a numeric parameter with its unit ("0.84″", "7.3′", "250 ms", "12 %"); strings are
 * returned as they are. Null/undefined/NaN → null (the caller renders "unknown").
 */
export function formatParameter(name, value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (!isNumber(value)) return null;
  const { unit, digits, scale = 1 } = parameterUnit(name);
  const v = value * scale;
  // Signed percentages (improvement, change) keep their sign.
  const text = digits === 0 ? String(Math.round(v)) : trimZeros(v.toFixed(digits));
  return `${text}${unit}`;
}

/**
 * Text lookup of a code: `${base}.<field>_<severity>` first (severity-specific wording, e.g.
 * a good polar alignment needs no fix), then `${base}.<field>`.
 */
function lookup(t, te, base, field, severity, params) {
  const sev = String(severity || '').toLowerCase();
  if (sev && te(`${base}.${field}_${sev}`)) return t(`${base}.${field}_${sev}`, params);
  if (te(`${base}.${field}`)) return t(`${base}.${field}`, params);
  return '';
}

/**
 * Interpolation values for a finding's texts: every parameter formatted with its unit, string
 * enum values translated (values.<param>.<value>), missing numbers as "unknown".
 */
export function textParameters({ t, te }, parameters = {}) {
  const unknown = te('components.guider.native.coach.unknown')
    ? t('components.guider.native.coach.unknown')
    : '?';
  const out = {};
  for (const [name, raw] of Object.entries(parameters || {})) {
    if (typeof raw === 'string') {
      const key = `${VALUE_TEXT_BASE}.${name}.${raw}`;
      out[name] = te(key) ? t(key) : raw;
    } else if (typeof raw === 'boolean') {
      const key = `${VALUE_TEXT_BASE}.bool.${raw}`;
      out[name] = te(key) ? t(key) : String(raw);
    } else {
      out[name] = formatParameter(name, raw) ?? unknown;
    }
  }
  return out;
}

/**
 * Localized teaching texts of a finding (or hint): { title, why, fix, notes[], known }.
 * notes are extra sentences for boolean parameters that are true (codes.<code>.notes.<param>),
 * e.g. drift.polarAlignment with decAssumed. Unknown codes fall back to the engine's English
 * message so that a newer engine never shows an empty card.
 */
export function findingText({ t, te }, finding) {
  const code = String(finding?.code || '');
  const base = `${CODE_TEXT_BASE}.${code}`;
  const params = textParameters({ t, te }, finding?.parameters || {});
  const known = Boolean(code) && te(`${base}.title`);
  if (!known) {
    return {
      title: finding?.message || code || '?',
      why: '',
      fix: '',
      notes: [],
      known: false,
    };
  }
  const severity = finding?.severity;
  const notes = [];
  for (const [name, raw] of Object.entries(finding?.parameters || {})) {
    if (raw === true && te(`${base}.notes.${name}`)) notes.push(t(`${base}.notes.${name}`, params));
  }
  return {
    title: lookup(t, te, base, 'title', severity, params),
    why: lookup(t, te, base, 'why', severity, params),
    fix: lookup(t, te, base, 'fix', severity, params),
    notes,
    known: true,
  };
}

/**
 * Localized texts of a failure/step message code with its parameters (MessageParameters, e.g.
 * coach.interrupted { reason }): { title, why, fix, known }. A reason the engine did not send is
 * rendered as the generic "another command".
 */
export function messageText({ t, te }, messageCode, fallbackMessage = '', parameters = {}) {
  const code = String(messageCode || '');
  const base = `${CODE_TEXT_BASE}.${code}`;
  if (!code || !code.startsWith('coach.') || !te(`${base}.title`)) {
    return { title: fallbackMessage || code || '', why: '', fix: '', known: false };
  }
  const params = textParameters({ t, te }, parameters || {});
  if (params.reason === undefined) {
    params.reason = te(`${VALUE_TEXT_BASE}.reason.unknown`)
      ? t(`${VALUE_TEXT_BASE}.reason.unknown`)
      : '?';
  }
  return {
    title: lookup(t, te, base, 'title', null, params),
    why: lookup(t, te, base, 'why', null, params),
    fix: lookup(t, te, base, 'fix', null, params),
    known: true,
  };
}

// --- Options and estimates -----------------------------------------------------------

export const DEFAULT_EXPOSURES = [1, 2, 3];

function roundGain(value, span) {
  const step = span >= 200 ? 10 : span >= 50 ? 5 : 1;
  return Math.round(value / step) * step;
}

/**
 * Default camera check gains: the current gain plus two values spread over the camera's gain
 * range (at 1/3 and 2/3), as the engine does for an empty list. Without a range: the current
 * gain only (or nothing when unknown).
 */
export function defaultGains({ gainMin, gainMax, currentGain } = {}) {
  const gains = [];
  const hasCurrent = Number.isInteger(currentGain) && currentGain >= 0;
  if (hasCurrent) gains.push(currentGain);
  if (Number.isInteger(gainMin) && Number.isInteger(gainMax) && gainMax > gainMin) {
    const span = gainMax - gainMin;
    let added = 0;
    // 1/3 and 2/3 of the range; alternatives when one lands next to the current gain
    for (const fraction of [1 / 3, 2 / 3, 1 / 6, 5 / 6, 1 / 2]) {
      if (added === 2) break;
      const gain = Math.min(gainMax, Math.max(gainMin, roundGain(gainMin + span * fraction, span)));
      // skip values next to one already chosen (within 8 % of the range)
      if (gains.some((g) => Math.abs(g - gain) < span * 0.08)) continue;
      gains.push(gain);
      added++;
    }
  }
  return gains.sort((a, b) => a - b);
}

/** Overhead per camera check frame (download, processing), seconds. */
const FRAME_OVERHEAD_SECONDS = 0.7;
const TRIAL_SETTLE_SECONDS = 20;
const MOUNT_RESPONSE_SECONDS = 90;
const CALIBRATION_SECONDS = 120;

/**
 * Estimated duration per step in seconds for the options on the start screen.
 * options: { exposureSeconds[], gains[], framesPerCombination, driftSeconds, trialSeconds,
 * repeatBaseline }; empty exposures/gains = the defaults (exposures 1/2/3 s, 3 gains).
 */
export function estimateStepSeconds(step, options = {}) {
  const exposures = options.exposureSeconds?.length ? options.exposureSeconds : DEFAULT_EXPOSURES;
  const gainCount = options.gains?.length || 3;
  const frames = options.framesPerCombination || 5;
  switch (step) {
    case 'CameraCheck':
      return (
        gainCount * exposures.reduce((sum, e) => sum + frames * (e + FRAME_OVERHEAD_SECONDS) + 2, 0)
      );
    case 'Drift':
      return options.driftSeconds || 180;
    case 'MountResponse':
      return MOUNT_RESPONSE_SECONDS;
    case 'Trials':
      return (
        (options.repeatBaseline === false ? 3 : 4) *
        ((options.trialSeconds || 120) + TRIAL_SETTLE_SECONDS)
      );
    default:
      return 0;
  }
}

/** Total estimate of the selected steps; adds a calibration when one is needed and missing. */
export function estimateTotalSeconds(steps, options = {}, { calibrated = true } = {}) {
  let total = steps.reduce((sum, step) => sum + estimateStepSeconds(step, options), 0);
  const needsCalibration = steps.some((s) => s !== 'CameraCheck');
  if (!calibrated && needsCalibration && options.allowCalibration !== false) {
    total += CALIBRATION_SECONDS;
  }
  return total;
}

/** "45 s", "3 min", "1 h 05 min" (rounded to whole minutes from 90 s on). */
export function formatDuration(seconds) {
  if (!isNumber(seconds) || seconds < 0) return '–';
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/**
 * Parses one user-entered number (decimal comma accepted) within [min, max].
 * @returns {number|null}
 */
export function parseNumberInput(text, { integer = false, min = -Infinity, max = Infinity } = {}) {
  const raw = String(text ?? '')
    .trim()
    .replace(',', '.');
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) return null;
  if (value < min || value > max) return null;
  return value;
}

/** Adds a value to a sorted, distinct list. */
export function addSorted(list, value) {
  if (list.includes(value)) return list.slice();
  return [...list, value].sort((a, b) => a - b);
}

// --- Step views ------------------------------------------------------------------------

/**
 * Camera check grid: rows = exposures, columns = gains; cells carry the result, whether it is the
 * recommended one and the jitter range of the feasible cells for colouring.
 */
export function cameraGrid(camera) {
  const results = Array.isArray(camera?.results) ? camera.results : [];
  const exposures = [...new Set(results.map((r) => r.exposureSeconds))].sort((a, b) => a - b);
  const gains = [...new Set(results.map((r) => r.gain))].sort((a, b) => a - b);
  const recommended = camera?.recommended || null;
  const cells = new Map();
  let min = Infinity;
  let max = -Infinity;
  for (const r of results) {
    cells.set(`${r.exposureSeconds}|${r.gain}`, r);
    if (r.feasible && isNumber(r.jitterArcsec)) {
      min = Math.min(min, r.jitterArcsec);
      max = Math.max(max, r.jitterArcsec);
    }
  }
  const isRecommended = (r) =>
    Boolean(
      recommended &&
      r &&
      r.exposureSeconds === recommended.exposureSeconds &&
      r.gain === recommended.gain
    );
  return {
    exposures,
    gains,
    cell: (exposure, gain) => cells.get(`${exposure}|${gain}`) || null,
    isRecommended,
    jitterMin: Number.isFinite(min) ? min : null,
    jitterMax: Number.isFinite(max) ? max : null,
  };
}

/**
 * 0..1 position of a jitter value between the best and worst feasible cell (0 = best).
 * A single value or equal values give 0.
 */
export function jitterScale(value, min, max) {
  if (!isNumber(value) || !isNumber(min) || !isNumber(max)) return null;
  if (max - min < 1e-9) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Green (best) → amber → red (worst) background for a jitter scale value. */
export function jitterColor(scale, alpha = 0.35) {
  if (scale === null) return 'transparent';
  const hue = 140 - 140 * scale;
  return `hsla(${Math.round(hue)}, 70%, 45%, ${alpha})`;
}

/**
 * Overlay of the RA periodic error on the drift samples, drawn from the engine's fit
 * (AdvancedCoachDrift: Ra(T) = PeriodicErrorOffsetArcsec + RaDriftArcsecPerMin·T/60 +
 * PeriodicErrorAmplitudeArcsec·sin(2πT/PeriodicErrorPeriodSeconds + PeriodicErrorPhaseRad)).
 * @returns {number[]|null} one value per sample, null when there is no fit.
 */
export function periodicErrorOverlay(drift) {
  const samples = Array.isArray(drift?.samples) ? drift.samples : [];
  const period = drift?.periodicErrorPeriodSeconds;
  const amplitude = drift?.periodicErrorAmplitudeArcsec;
  const offset = drift?.periodicErrorOffsetArcsec;
  const phase = drift?.periodicErrorPhaseRad;
  if (!isNumber(period) || period <= 0 || !isNumber(amplitude) || !samples.length) return null;
  if (!isNumber(offset) || !isNumber(phase)) return null;
  const w = (2 * Math.PI) / period;
  const slope = isNumber(drift?.raDriftArcsecPerMin) ? drift.raDriftArcsecPerMin / 60 : 0;
  return samples.map((s) =>
    isNumber(s.t) ? offset + slope * s.t + amplitude * Math.sin(w * s.t + phase) : null
  );
}

// The Coach measures each pulse between the means of 3 frames before and after it and judges a duration only when
// its expected move is at least 3 σ of the mean measured move (engine MountResponseAnalyzer).
const PULSE_AVERAGE_FRAMES = 3;
const PULSE_CONCLUSIVE_SIGMAS = 3;

/**
 * Pulse response per direction: { direction, durations: [{ ms, n, ratio, expected, moved, conclusive }] } with
 * repeated pulses of the same duration averaged. Directions in the order W, E, N, S.
 * `seeing` ({ ra, dec }: per-frame position noise in arcsec, e.g. the Drift step's seeing) marks durations whose
 * expected move is within the noise (conclusive false: the ratio is noise); conclusive is null without it.
 */
export function pulseResponse(pulses, seeing = null) {
  const order = ['West', 'East', 'North', 'South'];
  const groups = new Map();
  for (const p of Array.isArray(pulses) ? pulses : []) {
    if (!p?.direction) continue;
    if (!groups.has(p.direction)) groups.set(p.direction, new Map());
    const byMs = groups.get(p.direction);
    const entry = byMs.get(p.durationMs) || {
      ms: p.durationMs,
      n: 0,
      ratio: 0,
      expected: 0,
      moved: 0,
    };
    entry.n += 1;
    entry.ratio += isNumber(p.ratio) ? p.ratio : 0;
    entry.expected += isNumber(p.expectedArcsec) ? p.expectedArcsec : 0;
    entry.moved += isNumber(p.movedArcsec) ? p.movedArcsec : 0;
    byMs.set(p.durationMs, entry);
  }
  return [...groups.entries()]
    .sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
    })
    .map(([direction, byMs]) => {
      const frameSigma = direction === 'West' || direction === 'East' ? seeing?.ra : seeing?.dec;
      return {
        direction,
        durations: [...byMs.values()]
          .sort((a, b) => a.ms - b.ms)
          .map((e) => {
            const expected = e.expected / e.n;
            const sigmaMean =
              isNumber(frameSigma) && frameSigma > 0
                ? (frameSigma * Math.sqrt(2 / PULSE_AVERAGE_FRAMES)) / Math.sqrt(e.n)
                : null;
            return {
              ms: e.ms,
              n: e.n,
              ratio: e.ratio / e.n,
              expected,
              moved: e.moved / e.n,
              conclusive:
                sigmaMean === null ? null : expected >= PULSE_CONCLUSIVE_SIGMAS * sigmaMean,
            };
          }),
      };
    });
}

/** Trials in display order A, B, C, A2 (unknown ids after them). */
export function orderedTrials(trials) {
  const order = ['A', 'B', 'C', 'A2'];
  return [...(Array.isArray(trials) ? trials : [])].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
  });
}

// --- Report ----------------------------------------------------------------------------

/**
 * Error budget of a report (quadrature): seeing, centroid noise and mount/other, each with its
 * share of the guided variance. The mount part is derived when the report lacks it.
 * @returns {{ guided: number|null, parts: {key, arcsec, share}[] } | null}
 */
export function errorBudget(report) {
  if (!report) return null;
  const seeing = isNumber(report.seeingArcsec) ? report.seeingArcsec : null;
  const noise = isNumber(report.centroidNoiseArcsec) ? report.centroidNoiseArcsec : null;
  const guided = isNumber(report.guidedRmsArcsec) ? report.guidedRmsArcsec : null;
  let mount = isNumber(report.mountArcsec) ? report.mountArcsec : null;
  if (mount === null && guided !== null && (seeing !== null || noise !== null)) {
    mount = Math.sqrt(Math.max(0, guided ** 2 - (seeing ?? 0) ** 2 - (noise ?? 0) ** 2));
  }
  const parts = [
    { key: 'seeing', arcsec: seeing },
    { key: 'noise', arcsec: noise },
    { key: 'mount', arcsec: mount },
  ].filter((p) => p.arcsec !== null);
  if (!parts.length) return null;
  const variance = parts.reduce((sum, p) => sum + p.arcsec ** 2, 0);
  return {
    guided,
    parts: parts.map((p) => ({ ...p, share: variance > 0 ? p.arcsec ** 2 / variance : 0 })),
  };
}

export const GRADES = ['excellent', 'good', 'fair', 'poor'];

/** Grade tone: excellent/good → ok, fair → warn, poor → danger, else idle. */
export function gradeTone(grade) {
  switch (String(grade || '').toLowerCase()) {
    case 'excellent':
    case 'good':
      return 'ok';
    case 'fair':
      return 'warn';
    case 'poor':
      return 'danger';
    default:
      return 'idle';
  }
}

/** Numeric grade for trends: excellent 4 … poor 1, null when unknown. */
export function gradeValue(grade) {
  const index = GRADES.indexOf(String(grade || '').toLowerCase());
  return index < 0 ? null : GRADES.length - index;
}

/**
 * Ranked actions of a report: the findings named in report.actions, in that order, followed by
 * warning/problem findings with setting changes that the list misses (defensive).
 */
export function rankedActions(report) {
  const findings = Array.isArray(report?.findings) ? report.findings : [];
  const byId = new Map(findings.map((f) => [f.id, f]));
  const ranked = (report?.actions || []).map((id) => byId.get(id)).filter(Boolean);
  const listed = new Set(ranked.map((f) => f.id));
  const extra = findings
    .filter(
      (f) =>
        !listed.has(f.id) &&
        ['warning', 'problem'].includes(String(f.severity).toLowerCase()) &&
        f.step !== 'Live'
    )
    .sort((a, b) => (b.impactArcsec ?? 0) - (a.impactArcsec ?? 0));
  return [...ranked, ...extra];
}

/** Findings that are not ranked actions, grouped by step in session order. */
export function otherFindingsByStep(report, actionIds = []) {
  const skip = new Set(actionIds);
  const order = [...COACH_STEPS, 'Report'];
  const groups = new Map();
  for (const f of Array.isArray(report?.findings) ? report.findings : []) {
    if (skip.has(f.id)) continue;
    const step = f.step || 'Report';
    if (!groups.has(step)) groups.set(step, []);
    groups.get(step).push(f);
  }
  return [...groups.entries()]
    .sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
    })
    .map(([step, items]) => ({
      step,
      findings: items.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    }));
}

/**
 * Per-night trend of the history (reports newest first): the latest report of every night,
 * oldest night first, with the values of the trend sparklines.
 */
export function nightlyTrend(reports) {
  const byNight = new Map();
  for (const r of Array.isArray(reports) ? reports : []) {
    const night = r.night || String(r.timestamp || '').slice(0, 10);
    if (!night) continue;
    const known = byNight.get(night);
    if (!known || Date.parse(r.timestamp) > Date.parse(known.timestamp)) byNight.set(night, r);
  }
  return [...byNight.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([night, r]) => ({
      night,
      rms: isNumber(r.guidedRmsArcsec) ? r.guidedRmsArcsec : null,
      grade: gradeValue(r.grade),
      polarAlignment: isNumber(r.polarAlignmentErrorArcmin) ? r.polarAlignmentErrorArcmin : null,
      backlash: isNumber(r.backlashArcsec) ? r.backlashArcsec : null,
    }));
}

/**
 * Comparison of a report with the previous one: per metric the two values and whether the
 * change is an improvement (lower is better for all of them).
 */
export function compareReports(current, previous) {
  if (!current || !previous) return [];
  const metrics = [
    ['guidedRmsArcsec', 'rms'],
    ['seeingArcsec', 'seeing'],
    ['polarAlignmentErrorArcmin', 'polarAlignment'],
    ['backlashArcsec', 'backlash'],
    ['periodicErrorAmplitudeArcsec', 'periodicError'],
  ];
  return metrics
    .map(([field, key]) => {
      const now = current[field];
      const before = previous[field];
      if (!isNumber(now) || !isNumber(before)) return null;
      const delta = now - before;
      const relative = Math.abs(before) > 1e-9 ? delta / Math.abs(before) : 0;
      return {
        key,
        field,
        now,
        before,
        delta,
        trend: Math.abs(relative) < 0.05 ? 'same' : delta < 0 ? 'better' : 'worse',
      };
    })
    .filter(Boolean);
}

/** SVG polyline points of a sparkline; null values break nothing (they are skipped). */
export function sparklinePoints(values, width = 100, height = 24, pad = 2) {
  const finite = values.map((v, i) => [i, v]).filter(([, v]) => isNumber(v));
  if (!finite.length) return '';
  const min = Math.min(...finite.map(([, v]) => v));
  const max = Math.max(...finite.map(([, v]) => v));
  const span = max - min || 1;
  const step = values.length > 1 ? (width - 2 * pad) / (values.length - 1) : 0;
  return finite
    .map(([i, v]) => {
      const x = values.length > 1 ? pad + i * step : width / 2;
      const y = max === min ? height / 2 : pad + (1 - (v - min) / span) * (height - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// --- Hints -----------------------------------------------------------------------------

/**
 * Identity of one emitted hint: its id plus timestamp. A later hint with the same id (the
 * analyser re-emits a code after its rate limit, or in a new guiding session) is new again.
 */
export function hintKey(hint) {
  return `${hint?.id ?? ''}|${hint?.timestamp ?? ''}`;
}

/**
 * The one hint the state strip shows: active (not dismissed, not expired), highest severity,
 * then the newest. `dismissed` holds hintKey() values.
 */
export function activeHint(hints, { dismissed = [], now = Date.now() } = {}) {
  const list = (Array.isArray(hints) ? hints : []).filter((h) => {
    if (!h || !h.id || dismissed.includes(hintKey(h))) return false;
    const expires = h.expiresAt ? Date.parse(h.expiresAt) : NaN;
    return !Number.isFinite(expires) || expires > now;
  });
  list.sort(
    (a, b) =>
      severityRank(b.severity) - severityRank(a.severity) ||
      (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
  );
  return list[0] || null;
}

/** Adds or replaces a hint (by id). */
export function upsertHint(hints, hint) {
  if (!hint?.id) return hints;
  const list = (Array.isArray(hints) ? hints : []).filter((h) => h.id !== hint.id);
  list.push(hint);
  return list;
}

// --- Settings diff -------------------------------------------------------------------

/**
 * A setting change for display: label and unit from the settings metadata, values formatted
 * (bool → on/off keys, numbers trimmed). `label(setting)` localizes the label (settingLabel).
 * @returns {{ name, label, from, to, unit }}
 */
export function describeChange(change, settings = [], { on = 'on', off = 'off', label } = {}) {
  const setting = (settings || []).find((s) => s.name === change?.name) || null;
  const type = String(setting?.type || '').toLowerCase();
  const format = (value) => {
    if (value === null || value === undefined || value === '') return '–';
    const text = String(value);
    if (type === 'bool' || text === 'true' || text === 'false') {
      return text.toLowerCase() === 'true' ? on : off;
    }
    const number = Number(text);
    if (text.trim() !== '' && Number.isFinite(number)) return trimmed(number, 3);
    return text;
  };
  return {
    name: change?.name,
    label: label ? label(setting || { name: change?.name }) : setting?.label || change?.name || '',
    from: format(change?.currentValue ?? setting?.value),
    to: format(change?.value),
    unit: setting?.unit || '',
  };
}

// --- Step detail ---------------------------------------------------------------------

/** Sub-phase codes of AdvancedCoachStepStatus.DetailCode (texts under coach.details). */
export const DETAIL_CODES = [
  'camera.combination',
  'calibrating',
  'drift.measuring',
  'response.backlash',
  'response.pulses',
  'trial.settling',
  'trial.running',
];

/** i18n base of the step detail texts: `${DETAIL_TEXT_BASE}.<detailCode>`. */
export const DETAIL_TEXT_BASE = 'components.guider.native.coach.details';

/**
 * Localized sub-phase of a step from DetailCode + DetailParameters; the engine's English Detail
 * text as it is for a code without a text (a newer engine), '' when there is none.
 */
export function stepDetailText({ t, te }, step) {
  const code = String(step?.detailCode || '');
  const key = `${DETAIL_TEXT_BASE}.${code}`;
  if (code && te(key)) {
    return t(key, textParameters({ t, te }, step?.detailParameters || {}));
  }
  return String(step?.detail || '');
}
