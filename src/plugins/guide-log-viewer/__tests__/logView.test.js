import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGuideLog, parseWallTime } from '../utils/parseGuideLog.js';
import { buildSeries } from '../utils/analyzeGuideLog.js';
import {
  binSeries,
  chartData,
  markerFindings,
  markersAt,
  pulseRange,
  clampView,
  errorRange,
  formatDistance,
  formatDuration,
  formatSize,
  formatWall,
  nightSpan,
  niceCeil,
  scatterPoints,
  settleSpans,
  starData,
  viewAround,
  zoomView,
} from '../utils/logView.js';

const HEADER = `Pixel scale = 2.00 arc-sec/px, Binning = 1, Focal length = 400 mm
Frame,Time,mount,dx,dy,RARawDistance,DECRawDistance,RAGuideDistance,DECGuideDistance,RADuration,RADirection,DECDuration,DECDirection,XStep,YStep,StarMass,SNR,ErrorCode`;

function section(start, end, n, extra = () => [], tail = []) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(...extra(i));
    rows.push(
      `${i + 1},${i * 2 + 1},"Mount",0,0,0.500,-0.250,0.5,-0.25,50,W,25,N,,,1000,${10 + i},0`
    );
  }
  rows.push(...tail);
  return `Guiding Begins at ${start}\n${HEADER}\n${rows.join('\n')}\nGuiding Ends at ${end}\n`;
}

const settle = (i) =>
  i === 2
    ? ['INFO: SETTLING STATE CHANGE, Settling started']
    : i === 4
      ? ['INFO: SETTLING STATE CHANGE, Settling complete']
      : [];

const log = parseGuideLog(
  section('2026-11-10 20:00:00', '2026-11-10 20:00:20', 6, settle, [
    '7,13.000,"DROP",,,,,,,,,,,,,10,1.00,1,"x"',
  ]) + section('2026-11-10 21:00:00', '2026-11-10 23:59:00', 3)
);
const series = buildSeries(log);

test('formatting on the wall clock', () => {
  assert.equal(formatWall(parseWallTime('2026-11-10 21:05:09')), '21:05:09');
  assert.equal(formatWall(parseWallTime('2026-11-10 21:05:09'), false), '21:05');
  assert.equal(formatWall(NaN), '–');
  assert.equal(formatDuration(12.4), '12s');
  assert.equal(formatDuration(247), '4m 07s');
  assert.equal(formatDuration(7500), '2h 05m');
  assert.equal(formatSize(3 * 1024 * 1024), '3.0 MB');
  assert.equal(formatSize(200), '1 KB');
});

test('niceCeil rounds up to 1, 2, 2.5, 5 × 10^n', () => {
  assert.equal(niceCeil(0.7), 1);
  assert.equal(niceCeil(1.3), 2);
  assert.equal(niceCeil(2.2), 2.5);
  assert.equal(niceCeil(31), 50);
});

test('views: clamped into the night, zoomed around a point, framed around a finding', () => {
  const span = { t0: 0, t1: 1000 };
  assert.deepEqual(clampView({ t0: -100, t1: 100 }, span), { t0: 0, t1: 200 });
  assert.deepEqual(clampView({ t0: 900, t1: 1100 }, span), { t0: 800, t1: 1000 });
  assert.deepEqual(clampView({ t0: 500, t1: 505 }, span, 20), { t0: 492.5, t1: 512.5 });
  assert.deepEqual(clampView({ t0: -10, t1: 2000 }, span), { t0: 0, t1: 1000 });
  assert.deepEqual(zoomView({ t0: 0, t1: 100 }, 0.5, 20), { t0: 10, t1: 60 });
  assert.deepEqual(viewAround(100, 100), { t0: 40, t1: 160 });
  assert.deepEqual(viewAround(100, 400), { t0: -50, t1: 550 });
});

test('nightSpan covers all sections', () => {
  const span = nightSpan(log);
  assert.equal(span.t0, parseWallTime('2026-11-10 20:00:00'));
  assert.equal(span.t1, parseWallTime('2026-11-10 23:59:00'));
  assert.equal(nightSpan({ sections: [] }), null);
});

test('chartData breaks the lines between sections and skips dropped frames', () => {
  const data = chartData(series, 'arcsec');
  // 6 steps + 1 drop + gap + 3 steps
  assert.equal(data[0].length, 11);
  assert.equal(data[3][0], 1); // 0.5 px × 2″/px
  assert.equal(data[4][0], -0.5);
  assert.equal(data[3][6], null); // the dropped frame
  assert.equal(data[3][7], null); // the gap
  assert.ok(data[0][7] > data[0][6] && data[0][7] < data[0][8]);
  // W moved the RA error down and N moved Dec up: signed pulses
  assert.equal(data[1][0], -50);
  assert.equal(data[2][0], 25);
  assert.equal(chartData(series, 'px')[3][0], 0.5);
});

test('starData normalises the mass to the section median', () => {
  const [xs, snr, mass] = starData(series);
  assert.equal(xs.length, 11);
  assert.equal(snr[0], 10);
  assert.equal(mass[0], 1);
  assert.equal(snr[6], null);
});

test('settleSpans and errorRange', () => {
  const spans = settleSpans(series);
  assert.equal(spans.length, 1);
  assert.deepEqual(spans[0], [series.t[2], series.t[3]]);
  const data = chartData(series);
  // 1″ errors with 10 % room: ±2
  assert.deepEqual(errorRange(data, series.t[0], series.t[series.n - 1]), [-2, 2]);
  assert.deepEqual(errorRange(data, 0, 1), [-1, 1]);
});

test('scatterPoints leaves out drops and, unless asked, settling', () => {
  assert.equal(scatterPoints(series, 0, series.n).length, 7);
  assert.equal(scatterPoints(series, 0, series.n, { excludeSettling: false }).length, 9);
  assert.deepEqual(scatterPoints(series, 0, 1, { unit: 'px' }), [[0.5, -0.25]]);
});

test('binSeries averages into time buckets', () => {
  const t = Array.from({ length: 100 }, (_, i) => i);
  const y = t.map((v) => v * 2);
  const out = binSeries(t, y, 10);
  assert.ok(out.t.length <= 11 && out.t.length >= 9);
  for (let i = 0; i < out.t.length; i++) assert.ok(Math.abs(out.y[i] - out.t[i] * 2) < 1e-9);
  assert.deepEqual(binSeries([1, 2], [3, 4], 10), { t: [1, 2], y: [3, 4] });
});

test('pulseRange ignores the few longest pulses', () => {
  const xs = Array.from({ length: 100 }, (_, i) => i);
  const ra = xs.map((i) => (i === 50 ? 2500 : 80));
  const data = [xs, ra, xs.map(() => null)];
  assert.deepEqual(pulseRange(data, 0, 100), [-100, 100]);
  assert.deepEqual(pulseRange([[], [], []], 0, 1), [-100, 100]);
});

test('chartData carries the rolling RMS, converted to px with the section scale', () => {
  const rolling = new Float64Array(series.n).fill(0.8);
  assert.equal(chartData(series, 'arcsec', rolling)[7][0], 0.8);
  assert.equal(chartData(series, 'px', rolling)[7][0], 0.4);
  assert.equal(chartData(series)[7][0], null);
});

test('markerFindings: the problems plus flips and calibrations', () => {
  const kinds = markerFindings([
    { kind: 'jump', severity: 'warn' },
    { kind: 'gap', severity: 'info' },
    { kind: 'param', severity: 'info' },
    { kind: 'flip', severity: 'info' },
    { kind: 'calibration', severity: 'info' },
  ]).map((f) => f.kind);
  assert.deepEqual(kinds, ['jump', 'flip', 'calibration']);
});

test('markersAt names what lies under a time', () => {
  const findings = [
    { kind: 'badStretch', severity: 'bad', t0: 100, t1: 200 },
    { kind: 'gap', severity: 'info', t0: 150, t1: 150 },
    { kind: 'jump', severity: 'warn', t0: 300, t1: 300 },
  ];
  const dithers = [{ t: 152 }, { t: 400 }];
  const exposures = [{ start: 120, end: 180 }];
  const at = markersAt(150, 5, { findings, dithers, exposures });
  assert.deepEqual(
    at.findings.map((f) => f.kind),
    ['badStretch']
  );
  assert.equal(at.dithers.length, 1);
  assert.equal(at.exposure, exposures[0]);
  assert.deepEqual(
    markersAt(303, 5, { findings }).findings.map((f) => f.kind),
    ['jump']
  );
  assert.equal(markersAt(310, 5, { findings }).findings.length, 0);
});

test('formatDistance in arcsec or px', () => {
  assert.equal(formatDistance(0.564), '0.56″');
  assert.equal(formatDistance(1, 'px', 2), '0.50 px');
  assert.equal(formatDistance(1, 'px', NaN), '–');
  assert.equal(formatDistance(NaN), '–');
});
