import test from 'node:test';
import assert from 'node:assert/strict';
import { createI18n } from 'vue-i18n';
import en from '../../locales/en.json';
import {
  COACH_STEPS,
  DETAIL_CODES,
  FINDING_CODES,
  MESSAGE_CODES,
  activeHint,
  cameraGrid,
  compareReports,
  defaultGains,
  describeChange,
  errorBudget,
  estimateStepSeconds,
  estimateTotalSeconds,
  findingText,
  findingTone,
  formatDuration,
  formatParameter,
  hintKey,
  jitterScale,
  messageText,
  nightlyTrend,
  orderedTrials,
  otherFindingsByStep,
  parameterUnit,
  parseNumberInput,
  periodicErrorOverlay,
  pulseResponse,
  rankedActions,
  sparklinePoints,
  stepDetailText,
  upsertHint,
} from '../nativeGuiderCoach.js';

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
const { t, te } = i18n.global;

/** Parameters per catalogue code (AdvancedCoachFinding.Parameters). */
const SAMPLE_PARAMETERS = {
  'camera.recommendation': {
    exposureSeconds: 2,
    gain: 120,
    jitterArcsec: 0.184,
    snr: 42.4,
    stars: 7,
    currentJitterArcsec: 0.31,
  },
  'camera.good': { snr: 38, jitterArcsec: 0.2 },
  'camera.noFeasible': { reason: 'lowSnr' },
  'camera.snrLow': { snr: 11.2, noiseArcsec: 0.25 },
  'camera.saturated': { exposureSeconds: 3, gain: 300 },
  'camera.defocused': { hfdPx: 6.3, hfdArcsec: 4.1 },
  'camera.fewStars': { stars: 2 },
  'camera.noDarks': {},
  'drift.seeing': { rmsArcsec: 0.83, level: 'average' },
  'drift.minMove': { raPx: 0.21, decPx: 0.24 },
  'drift.periodicError': {
    amplitudeArcsec: 4.2,
    periodSeconds: 479,
    maxRateArcsecPerSec: 0.055,
  },
  'drift.exposureLimit': { seconds: 2.5, currentSeconds: 4 },
  'drift.polarAlignment': { arcmin: 7.34, decAssumed: true, driftArcsecPerMin: 1.8 },
  'drift.wind': { gustPercent: 12 },
  'drift.decGuideMode': { mode: 'North', driftArcsecPerMin: 1.2, backlashMs: 1400 },
  'response.decBacklash': { ms: 850, arcsec: 6.4 },
  'response.minPulse': { axis: 'Dec', ms: 120 },
  'response.asymmetry': { axis: 'Ra', ratio: 1.42 },
  'response.rateMismatch': { axis: 'Dec', ratio: 0.71 },
  'response.good': {},
  'trials.winner': {
    id: 'B',
    rmsArcsec: 0.62,
    baselineRmsArcsec: 0.81,
    improvementPercent: 23.4,
  },
  'trials.noImprovement': { rmsArcsec: 0.7 },
  'trials.conditionsChanged': { changePercent: 31 },
  'trials.nothingToTry': { rmsArcsec: 0.7, predictive: true },
  'report.seeingLimited': { seeingArcsec: 0.8, guidedArcsec: 0.9 },
  'report.mountLimited': { mountArcsec: 0.9, guidedArcsec: 1.2 },
  'report.noImagingScale': {},
  'hint.raOscillation': { index: 0.72 },
  'hint.raSluggish': { index: 0.1, rmsRaArcsec: 1.1 },
  'hint.pulseLimited': { axis: 'Ra', percent: 18 },
  'hint.lowSnr': { snr: 8 },
  'hint.decDrift': { driftArcsecPerMin: 1.5, arcmin: 6 },
  'hint.seeingBound': { rmsArcsec: 0.9 },
};

const SEVERITIES = ['good', 'info', 'warning', 'problem'];

function assertRendered(text, where) {
  assert.ok(text && text.trim(), `${where} is empty`);
  assert.doesNotMatch(text, /[{}]/, `${where} has an unresolved placeholder: ${text}`);
  assert.doesNotMatch(text, /components\.guider/, `${where} shows a key: ${text}`);
}

test('every catalogue code renders title, why and fix with all severities', () => {
  assert.equal(FINDING_CODES.length, Object.keys(SAMPLE_PARAMETERS).length);
  for (const code of FINDING_CODES) {
    const parameters = SAMPLE_PARAMETERS[code];
    assert.ok(parameters, `sample parameters for ${code}`);
    for (const severity of SEVERITIES) {
      const text = findingText({ t, te }, { code, severity, parameters });
      assert.equal(text.known, true, `${code} has texts`);
      assertRendered(text.title, `${code} title (${severity})`);
      assertRendered(text.why, `${code} why (${severity})`);
      assertRendered(text.fix, `${code} fix (${severity})`);
    }
  }
});

test('nothing to try explains why for the Predictive algorithm', () => {
  const finding = {
    code: 'trials.nothingToTry',
    severity: 'info',
    parameters: { rmsArcsec: 0.7, predictive: true },
  };
  assert.equal(findingText({ t, te }, finding).notes.length, 1);
  const classic = { ...finding, parameters: { rmsArcsec: 0.7, predictive: false } };
  assert.equal(findingText({ t, te }, classic).notes.length, 0);
});

test('every message code renders title, why and fix', () => {
  for (const code of MESSAGE_CODES) {
    const text = messageText({ t, te }, code, 'fallback');
    assert.equal(text.known, true, `${code} has texts`);
    assertRendered(text.title, `${code} title`);
    assertRendered(text.why, `${code} why`);
    assertRendered(text.fix, `${code} fix`);
  }
});

test('the locale has no text for a code outside the catalogue (keeps both in sync)', () => {
  const codes = en.components.guider.native.coach.codes;
  const known = new Set([...FINDING_CODES, ...MESSAGE_CODES]);
  for (const [group, entries] of Object.entries(codes)) {
    for (const name of Object.keys(entries)) {
      assert.ok(known.has(`${group}.${name}`), `${group}.${name} is not in the catalogue`);
    }
  }
});

test('finding texts interpolate formatted values with units and translated enums', () => {
  const pa = findingText(
    { t, te },
    {
      code: 'drift.polarAlignment',
      severity: 'warning',
      parameters: SAMPLE_PARAMETERS['drift.polarAlignment'],
    }
  );
  assert.equal(pa.title, 'Polar alignment error ≈ 7.3′');
  assert.match(pa.why, /1\.8″\/min/);
  assert.equal(pa.notes.length, 1, 'decAssumed adds its note');
  assert.match(pa.fix, /TPPA/);

  const good = findingText(
    { t, te },
    { code: 'drift.polarAlignment', severity: 'good', parameters: { arcmin: 1.2 } }
  );
  assert.equal(good.fix, 'Excellent, nothing to do.');
  assert.equal(good.notes.length, 0);

  const recommendation = findingText(
    { t, te },
    { code: 'camera.recommendation', parameters: SAMPLE_PARAMETERS['camera.recommendation'] }
  );
  assert.equal(recommendation.title, 'Best camera settings: 2 s at gain 120');
  assert.match(recommendation.why, /jitter 0\.18″ at SNR 42 with 7 usable stars/);

  const minPulse = findingText(
    { t, te },
    { code: 'response.minPulse', parameters: { axis: 'Ra', ms: 120.4 } }
  );
  assert.equal(minPulse.title, 'RA: pulses under 120 ms do not move the mount');

  const wind = findingText({ t, te }, { code: 'drift.wind', parameters: { gustPercent: 12.3 } });
  assert.match(wind.why, /^12 % of the frames/);

  const pe = findingText(
    { t, te },
    {
      code: 'drift.periodicError',
      parameters: { amplitudeArcsec: 3, periodSeconds: null, maxRateArcsecPerSec: 0.04 },
    }
  );
  assert.match(pe.why, /period unknown/);
});

test('unknown codes fall back to the engine message', () => {
  const text = findingText(
    { t, te },
    { code: 'future.thing', severity: 'info', message: 'Something new', parameters: {} }
  );
  assert.equal(text.known, false);
  assert.equal(text.title, 'Something new');
  assert.equal(messageText({ t, te }, 'coach.unheardOf', 'Engine text').title, 'Engine text');
});

test('message texts use the message parameters', () => {
  assert.match(
    messageText({ t, te }, 'coach.interrupted', 'Interrupted', { reason: 'slew' }).why,
    /because the mount slewed/
  );
  assert.match(
    messageText({ t, te }, 'coach.interrupted', 'Interrupted', {}).why,
    /because another command interrupted it/
  );
  // the old qualifier convention is gone: such a code is unknown and falls back
  assert.equal(messageText({ t, te }, 'coach.interrupted:slew', 'Engine text').known, false);
});

const SAMPLE_DETAIL_PARAMETERS = {
  'camera.combination': { exposureSeconds: 2, gain: 120, index: 3, total: 9 },
  calibrating: {},
  'drift.measuring': {},
  'response.backlash': {},
  'response.pulses': { direction: 'North', ms: 250 },
  'trial.settling': { id: 'B' },
  'trial.running': { id: 'C' },
};

test('every step detail code renders with its parameters', () => {
  assert.deepEqual(Object.keys(SAMPLE_DETAIL_PARAMETERS), DETAIL_CODES);
  for (const code of DETAIL_CODES) {
    const text = stepDetailText(
      { t, te },
      { detailCode: code, detailParameters: SAMPLE_DETAIL_PARAMETERS[code], detail: 'English' }
    );
    assertRendered(text, `detail ${code}`);
    assert.notEqual(text, 'English', `${code} has its own text`);
  }
  assert.equal(
    stepDetailText(
      { t, te },
      {
        detailCode: 'camera.combination',
        detailParameters: SAMPLE_DETAIL_PARAMETERS['camera.combination'],
      }
    ),
    'Exposure 2 s · gain 120 (3/9)'
  );
  assert.match(
    stepDetailText(
      { t, te },
      { detailCode: 'response.pulses', detailParameters: { direction: 'North', ms: 250 } }
    ),
    /North 250 ms$/
  );
});

test('step details fall back to the engine text', () => {
  assert.equal(
    stepDetailText({ t, te }, { detailCode: 'future.phase', detail: 'doing X' }),
    'doing X'
  );
  assert.equal(stepDetailText({ t, te }, { detail: 'doing Y' }), 'doing Y');
  assert.equal(stepDetailText({ t, te }, {}), '');
});

test('parameter units follow the name suffix', () => {
  assert.equal(parameterUnit('rmsArcsec').unit, '″');
  assert.equal(parameterUnit('arcsec').unit, '″');
  assert.equal(parameterUnit('arcmin').unit, '′');
  assert.equal(parameterUnit('hfdPx').unit, ' px');
  assert.equal(parameterUnit('backlashMs').unit, ' ms');
  assert.equal(parameterUnit('periodSeconds').unit, ' s');
  assert.equal(parameterUnit('improvementPercent').unit, ' %');
  assert.equal(parameterUnit('maxRateArcsecPerSec').unit, '″/s');
  assert.equal(parameterUnit('driftArcsecPerMin').unit, '″/min');
  assert.equal(formatParameter('rmsArcsec', 0.8349), '0.83″');
  assert.equal(formatParameter('periodSeconds', 480), '480 s');
  assert.equal(formatParameter('exposureSeconds', 1.5), '1.5 s');
  assert.equal(formatParameter('ms', 849.6), '850 ms');
  assert.equal(formatParameter('gain', 120), '120');
  assert.equal(formatParameter('ratio', 1.4), '1.4×');
  assert.equal(formatParameter('index', 0.724), '0.72');
  assert.equal(formatParameter('rmsArcsec', null), null);
  assert.equal(formatParameter('rmsArcsec', Number.NaN), null);
  assert.equal(formatParameter('mode', 'North'), 'North');
});

test('finding tones map the severities', () => {
  assert.equal(findingTone('good'), 'ok');
  assert.equal(findingTone('info'), 'info');
  assert.equal(findingTone('warning'), 'warn');
  assert.equal(findingTone('problem'), 'danger');
});

test('default gains: current plus two spread over the range, or the current one only', () => {
  assert.deepEqual(defaultGains({ gainMin: 0, gainMax: 300, currentGain: 250 }), [100, 200, 250]);
  // a spread value next to the current gain is replaced by another point of the range
  assert.deepEqual(defaultGains({ gainMin: 0, gainMax: 300, currentGain: 105 }), [50, 105, 200]);
  assert.deepEqual(defaultGains({ gainMin: 0, gainMax: 100 }), [35, 65]);
  assert.deepEqual(defaultGains({ currentGain: 50 }), [50]);
  assert.deepEqual(defaultGains({}), []);
});

test('duration estimates cover every step and the calibration', () => {
  const options = { driftSeconds: 180, trialSeconds: 120, repeatBaseline: true };
  for (const step of COACH_STEPS) assert.ok(estimateStepSeconds(step, options) > 0, step);
  assert.equal(estimateStepSeconds('Trials', options), 4 * 140);
  assert.equal(estimateStepSeconds('Trials', { ...options, repeatBaseline: false }), 3 * 140);
  const all = estimateTotalSeconds(COACH_STEPS, options);
  // a default session is "about 15 minutes"
  assert.ok(all > 12 * 60 && all < 20 * 60, `total ${all}`);
  assert.equal(
    estimateTotalSeconds(['Drift'], options, { calibrated: false }) -
      estimateTotalSeconds(['Drift'], options),
    120
  );
  assert.equal(estimateTotalSeconds(['CameraCheck'], options, { calibrated: false }) > 0, true);
  assert.equal(formatDuration(45), '45 s');
  assert.equal(formatDuration(900), '15 min');
  assert.equal(formatDuration(3900), '1 h 05 min');
});

test('number input accepts a decimal comma and bounds', () => {
  assert.equal(parseNumberInput('1,5'), 1.5);
  assert.equal(parseNumberInput('120', { integer: true, min: 0, max: 300 }), 120);
  assert.equal(parseNumberInput('1.5', { integer: true }), null);
  assert.equal(parseNumberInput('400', { max: 300 }), null);
  assert.equal(parseNumberInput(''), null);
});

test('camera grid lays out exposures x gains and marks the recommended cell', () => {
  const results = [
    { exposureSeconds: 2, gain: 100, feasible: true, jitterArcsec: 0.3, snr: 30 },
    { exposureSeconds: 1, gain: 100, feasible: true, jitterArcsec: 0.5, snr: 18 },
    { exposureSeconds: 1, gain: 300, feasible: false, reason: 'saturated', jitterArcsec: 0.1 },
    { exposureSeconds: 2, gain: 300, feasible: true, jitterArcsec: 0.2, snr: 50 },
  ];
  const grid = cameraGrid({ results, recommended: results[3] });
  assert.deepEqual(grid.exposures, [1, 2]);
  assert.deepEqual(grid.gains, [100, 300]);
  assert.equal(grid.cell(1, 300).reason, 'saturated');
  assert.equal(grid.cell(3, 100), null);
  assert.equal(grid.isRecommended(grid.cell(2, 300)), true);
  assert.equal(grid.isRecommended(grid.cell(2, 100)), false);
  // infeasible cells do not stretch the colour range
  assert.equal(grid.jitterMin, 0.2);
  assert.equal(grid.jitterMax, 0.5);
  assert.equal(jitterScale(0.2, grid.jitterMin, grid.jitterMax), 0);
  assert.equal(jitterScale(0.5, grid.jitterMin, grid.jitterMax), 1);
});

test('the periodic error overlay uses the documented model of the engine', () => {
  const drift = {
    samples: [0, 60, 120].map((t) => ({ t, ra: 0, dec: 0 })),
    periodicErrorPeriodSeconds: 480,
    periodicErrorAmplitudeArcsec: 3,
    periodicErrorPhaseRad: 0.5,
    periodicErrorOffsetArcsec: -1,
    raDriftArcsecPerMin: 0.6,
  };
  const overlay = periodicErrorOverlay(drift);
  const expected = (t) => -1 + (0.6 * t) / 60 + 3 * Math.sin((2 * Math.PI * t) / 480 + 0.5);
  overlay.forEach((v, i) => assert.ok(Math.abs(v - expected(drift.samples[i].t)) < 1e-12));
});

test('the periodic error overlay needs the full fit', () => {
  const samples = [0, 60, 120].map((t) => ({ t, ra: 0, dec: 0 }));
  const fit = {
    samples,
    periodicErrorPeriodSeconds: 480,
    periodicErrorAmplitudeArcsec: 3,
    periodicErrorPhaseRad: 0.5,
    periodicErrorOffsetArcsec: -1,
  };
  assert.equal(periodicErrorOverlay({ ...fit, periodicErrorPeriodSeconds: null }), null);
  assert.equal(periodicErrorOverlay({ ...fit, periodicErrorOffsetArcsec: null }), null);
  assert.equal(periodicErrorOverlay({ ...fit, periodicErrorPhaseRad: undefined }), null);
  assert.equal(periodicErrorOverlay({ ...fit, samples: [] }), null);
  assert.equal(periodicErrorOverlay(fit).length, samples.length, 'no drift counts as none');
});

test('pulse response marks durations whose expected move is within the seeing noise', () => {
  const pulses = [
    { direction: 'East', durationMs: 100, ratio: 2.7, expectedArcsec: 0.39, movedArcsec: 1.05 },
    { direction: 'East', durationMs: 100, ratio: 2.7, expectedArcsec: 0.39, movedArcsec: 1.05 },
    { direction: 'East', durationMs: 1000, ratio: 1.26, expectedArcsec: 3.89, movedArcsec: 4.9 },
    { direction: 'East', durationMs: 1000, ratio: 1.26, expectedArcsec: 3.89, movedArcsec: 4.9 },
    { direction: 'North', durationMs: 100, ratio: 1.26, expectedArcsec: 0.735, movedArcsec: 0.93 },
    { direction: 'North', durationMs: 100, ratio: 1.26, expectedArcsec: 0.735, movedArcsec: 0.93 },
  ];
  // 0.69″/0.53″ per frame: σ of the mean of 2 moves (3-frame means) ≈ 0.40″ RA, 0.31″ Dec
  const rows = pulseResponse(pulses, { ra: 0.69, dec: 0.53 });
  const east = rows.find((r) => r.direction === 'East').durations;
  assert.deepEqual(
    east.map((d) => [d.ms, d.conclusive]),
    [
      [100, false],
      [1000, true],
    ]
  );
  assert.equal(rows.find((r) => r.direction === 'North').durations[0].conclusive, false);
  // without the seeing no verdict
  assert.equal(pulseResponse(pulses)[0].durations[0].conclusive, null);
});

test('pulse response averages repeats per direction and duration', () => {
  const rows = pulseResponse([
    { direction: 'East', durationMs: 100, ratio: 0.4, expectedArcsec: 1, movedArcsec: 0.4 },
    { direction: 'West', durationMs: 250, ratio: 1, expectedArcsec: 2.5, movedArcsec: 2.5 },
    { direction: 'West', durationMs: 100, ratio: 0.8, expectedArcsec: 1, movedArcsec: 0.8 },
    { direction: 'West', durationMs: 100, ratio: 1.0, expectedArcsec: 1, movedArcsec: 1 },
  ]);
  assert.deepEqual(
    rows.map((r) => r.direction),
    ['West', 'East']
  );
  assert.deepEqual(
    rows[0].durations.map((d) => [d.ms, Number(d.ratio.toFixed(2))]),
    [
      [100, 0.9],
      [250, 1],
    ]
  );
});

test('error budget splits the guided variance in quadrature', () => {
  const budget = errorBudget({ guidedRmsArcsec: 1, seeingArcsec: 0.6, centroidNoiseArcsec: 0 });
  assert.equal(budget.parts.length, 3);
  const mount = budget.parts.find((p) => p.key === 'mount');
  assert.ok(Math.abs(mount.arcsec - 0.8) < 1e-9);
  assert.ok(Math.abs(budget.parts.find((p) => p.key === 'seeing').share - 0.36) < 1e-9);
  assert.ok(Math.abs(mount.share - 0.64) < 1e-9);
  assert.equal(errorBudget({}), null);
  assert.equal(errorBudget(null), null);
});

test('ranked actions follow the report order and other findings group by step', () => {
  const report = {
    actions: ['drift.polarAlignment', 'response.decBacklash'],
    findings: [
      { id: 'drift.seeing', step: 'Drift', severity: 'good' },
      { id: 'response.decBacklash', step: 'MountResponse', severity: 'warning' },
      { id: 'drift.polarAlignment', step: 'Drift', severity: 'problem' },
      { id: 'camera.snrLow', step: 'CameraCheck', severity: 'warning', impactArcsec: 0.1 },
      { id: 'camera.noDarks', step: 'CameraCheck', severity: 'info' },
    ],
  };
  const actions = rankedActions(report);
  assert.deepEqual(
    actions.map((f) => f.id),
    ['drift.polarAlignment', 'response.decBacklash', 'camera.snrLow']
  );
  const groups = otherFindingsByStep(
    report,
    actions.map((f) => f.id)
  );
  assert.deepEqual(
    groups.map((g) => [g.step, g.findings.map((f) => f.id)]),
    [
      ['CameraCheck', ['camera.noDarks']],
      ['Drift', ['drift.seeing']],
    ]
  );
});

test('trials are ordered A, B, C, A2', () => {
  assert.deepEqual(
    orderedTrials([{ id: 'A2' }, { id: 'C' }, { id: 'A' }, { id: 'B' }]).map((t) => t.id),
    ['A', 'B', 'C', 'A2']
  );
});

test('history: the latest report per night, oldest night first, and the comparison', () => {
  const reports = [
    {
      night: '2026-09-22',
      timestamp: '2026-09-23T01:00:00Z',
      guidedRmsArcsec: 0.6,
      grade: 'good',
      polarAlignmentErrorArcmin: 2,
      backlashArcsec: 3,
    },
    {
      night: '2026-09-22',
      timestamp: '2026-09-22T22:00:00Z',
      guidedRmsArcsec: 0.9,
      grade: 'fair',
      polarAlignmentErrorArcmin: 8,
    },
    { night: '2026-09-20', timestamp: '2026-09-20T23:00:00Z', guidedRmsArcsec: 1.2, grade: 'poor' },
  ];
  const trend = nightlyTrend(reports);
  assert.deepEqual(
    trend.map((r) => [r.night, r.rms, r.grade]),
    [
      ['2026-09-20', 1.2, 1],
      ['2026-09-22', 0.6, 3],
    ]
  );
  const comparison = compareReports(reports[0], reports[1]);
  assert.deepEqual(
    comparison.map((c) => [c.key, c.trend]),
    [
      ['rms', 'better'],
      ['polarAlignment', 'better'],
    ]
  );
  assert.match(sparklinePoints([1, null, 3]), /^2\.0,22\.0 98\.0,2\.0$/);
});

test('the active hint: not dismissed, not expired, most severe then newest', () => {
  const now = Date.parse('2026-09-23T22:00:00Z');
  const hints = [
    { id: 'a', severity: 'info', timestamp: '2026-09-23T21:59:00Z' },
    { id: 'b', severity: 'warning', timestamp: '2026-09-23T21:50:00Z' },
    {
      id: 'c',
      severity: 'warning',
      timestamp: '2026-09-23T21:55:00Z',
      expiresAt: '2026-09-23T21:58:00Z',
    },
  ];
  assert.equal(activeHint(hints, { now }).id, 'b');
  assert.equal(activeHint(hints, { now, dismissed: [hintKey(hints[1])] }).id, 'a');
  // the same id emitted again later is a new hint
  const again = { ...hints[1], timestamp: '2026-09-23T21:59:30Z' };
  assert.equal(activeHint([again], { now, dismissed: [hintKey(hints[1])] }).id, 'b');
  assert.equal(activeHint([], { now }), null);
  assert.deepEqual(
    upsertHint(hints, { id: 'a', severity: 'good' }).map((h) => [h.id, h.severity]),
    [
      ['b', 'warning'],
      ['c', 'warning'],
      ['a', 'good'],
    ]
  );
});

test('setting changes use labels and units from the settings metadata', () => {
  const settings = [
    { name: 'RaAggression', label: 'RA aggression', type: 'double', value: '0.7' },
    { name: 'BacklashCompensation', label: 'Dec backlash compensation', type: 'bool' },
    { name: 'BacklashPulseMs', label: 'Dec backlash pulse', type: 'int', unit: 'ms' },
  ];
  assert.deepEqual(describeChange({ name: 'RaAggression', value: '0.6' }, settings), {
    name: 'RaAggression',
    label: 'RA aggression',
    from: '0.7',
    to: '0.6',
    unit: '',
  });
  const bool = describeChange(
    { name: 'BacklashCompensation', value: 'true', currentValue: 'false' },
    settings,
    { on: 'an', off: 'aus' }
  );
  assert.equal(`${bool.from} → ${bool.to}`, 'aus → an');
  assert.equal(
    describeChange({ name: 'BacklashPulseMs', value: '850.0', currentValue: '20' }, settings).to,
    '850'
  );
  assert.equal(describeChange({ name: 'Unknown', value: 'x' }, settings).label, 'Unknown');
  const label = (setting) => `«${setting.name}»`;
  assert.equal(
    describeChange({ name: 'RaAggression', value: '0.6' }, settings, { label }).label,
    '«RaAggression»',
    'a localized label'
  );
  assert.equal(
    describeChange({ name: 'Unknown', value: 'x' }, settings, { label }).label,
    '«Unknown»'
  );
});
