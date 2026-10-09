import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGraphData,
  formatElapsed,
  formatRms,
  graphAriaLabel,
  lastSteps,
  markersInRange,
  niceCeil,
  pulseRange,
  RMS_ROLLING_STEPS,
  rollingRms,
  settlingSpans,
  symmetricRange,
  targetPoints,
  targetRadius,
} from '../graphData.js';

function step(frame, overrides = {}) {
  return {
    frame,
    timestamp: new Date(Date.UTC(2026, 8, 23, 21, 0, frame)).toISOString(),
    raArcsec: 0.1 * frame,
    decArcsec: -0.2 * frame,
    raDistanceRaw: 0.05 * frame,
    decDistanceRaw: -0.1 * frame,
    raDuration: 0,
    raDirection: '',
    decDuration: 0,
    decDirection: '',
    snr: 30,
    starMass: 1000 * frame,
    isSettling: false,
    ...overrides,
  };
}

test('lastSteps keeps the newest N steps with a timestamp', () => {
  const steps = [1, 2, 3, 4, 5].map((f) => step(f));
  steps[4].timestamp = null;
  assert.deepEqual(
    lastSteps(steps, 3).map((s) => s.frame),
    [3, 4]
  );
  assert.equal(lastSteps(steps, 0).length, 4);
  assert.equal(lastSteps(null, 10).length, 0);
});

test('buildGraphData picks the unit and signs the pulses', () => {
  const steps = [
    step(1, { raDuration: 120, raDirection: 'West', decDuration: 80, decDirection: 'North' }),
    step(2, { raDuration: 50, raDirection: 'East', decDuration: 0 }),
  ];
  const arcsec = buildGraphData(steps, { window: 10, unit: 'arcsec' });
  assert.equal(arcsec.count, 2);
  assert.deepEqual(arcsec.ra, [0.1, 0.2]);
  assert.deepEqual(arcsec.raPulse, [-120, 50]);
  assert.deepEqual(arcsec.decPulse, [80, null]);
  assert.deepEqual(arcsec.massNorm, [0.5, 1]);

  const px = buildGraphData(steps, { window: 10, unit: 'px' });
  assert.deepEqual(px.dec, [-0.1, -0.2]);
});

test('buildGraphData keeps x strictly increasing for duplicate timestamps', () => {
  const a = step(1);
  const b = step(2, { timestamp: a.timestamp });
  const { xs } = buildGraphData([a, b]);
  assert.ok(xs[1] > xs[0]);
});

test('buildGraphData maps non-finite values to null', () => {
  const { ra, snr } = buildGraphData([step(1, { raArcsec: NaN, snr: null })]);
  assert.deepEqual(ra, [null]);
  assert.deepEqual(snr, [null]);
});

test('rollingRms combines the RA and Dec spread of the last steps that count', () => {
  // RA alternates ±1″ (σ 1), Dec is constant (σ 0): total 1 once enough steps are in
  const steps = Array.from({ length: 40 }, (_, i) =>
    step(i, { raArcsec: i % 2 ? 1 : -1, decArcsec: 0.5 })
  );
  const rms = rollingRms(steps, 'arcsec', 10);
  assert.equal(rms.length, 40);
  assert.equal(rms[3], null, 'too few steps yet');
  assert.ok(Math.abs(rms[39] - 1) < 1e-9);

  // settling and recenter steps don't count: a huge settling error leaves the value alone
  const settling = [
    ...steps.slice(0, 20),
    step(20, { raArcsec: 50, isSettling: true }),
    step(21, { raArcsec: 50, isRecenterMove: true }),
  ];
  const withSettle = rollingRms(settling, 'arcsec', 10);
  assert.equal(withSettle[21], withSettle[19]);
});

test('buildGraphData carries the rolling RMS from the steps before the window', () => {
  const steps = Array.from({ length: 100 }, (_, i) =>
    step(i, { raArcsec: i % 2 ? 1 : -1, decArcsec: 0 })
  );
  const g = buildGraphData(steps, { window: 20 });
  assert.equal(g.rms.length, 20);
  assert.ok(
    g.rms.every((v) => v !== null && Math.abs(v - 1) < 1e-9),
    'complete from the first visible step'
  );
  assert.equal(RMS_ROLLING_STEPS, 30);
});

test('symmetricRange honours fixed scales, headroom and the minimum', () => {
  assert.deepEqual(symmetricRange([[0.1, -0.2]], { scale: 4 }), [-4, 4]);
  assert.deepEqual(symmetricRange([[0.1, -0.2]], { scale: 'auto', minAbs: 1 }), [-1, 1]);
  assert.deepEqual(symmetricRange([[0.5], [-2.7]], { scale: 'auto', minAbs: 1 }), [-3, 3]);
  assert.deepEqual(symmetricRange([[]], { scale: 'auto', minAbs: 1 }), [-1, 1]);
});

test('pulseRange leaves room for the error lines', () => {
  assert.deepEqual(pulseRange([null], [null]), [-100, 100]);
  assert.deepEqual(pulseRange([300], [-600]), [-1000, 1000]);
});

test('niceCeil rounds up to nice values', () => {
  assert.equal(niceCeil(0.33), 0.4);
  assert.equal(niceCeil(1), 1);
  assert.equal(niceCeil(2.7), 3);
  assert.equal(niceCeil(7), 8);
  assert.equal(niceCeil(9), 10);
  assert.equal(niceCeil(0), 0);
});

test('settlingSpans groups contiguous settling steps', () => {
  const xs = [1, 2, 3, 4, 5, 6];
  const settling = [false, true, true, false, true, false];
  assert.deepEqual(settlingSpans(xs, settling), [
    [2, 3],
    [5, 5],
  ]);
  assert.deepEqual(settlingSpans([1, 2], [true, true]), [[1, 2]]);
});

test('markersInRange filters by time', () => {
  const markers = [
    { t: 1, kind: 'dither' },
    { t: 5, kind: 'settled' },
    { t: 9, kind: 'starlost' },
  ];
  assert.deepEqual(
    markersInRange(markers, 2, 9).map((m) => m.kind),
    ['settled', 'starlost']
  );
  assert.deepEqual(markersInRange(markers, NaN, 9), []);
});

test('targetPoints fades older points and skips missing values', () => {
  const points = targetPoints([step(1), step(2, { decArcsec: null }), step(3)], { window: 10 });
  assert.equal(points.length, 2);
  assert.equal(points[1].opacity, 1);
  assert.ok(points[0].opacity < points[1].opacity);
  assert.equal(targetPoints([step(1)], { window: 5 })[0].opacity, 1);
});

test('targetPoints marks settling steps and dither recenter moves', () => {
  const points = targetPoints(
    [step(1, { isSettling: true }), step(2, { isRecenterMove: true }), step(3)],
    { window: 10 }
  );
  assert.deepEqual(
    points.map((p) => p.settling),
    [true, true, false]
  );
});

test('targetRadius covers points and the RMS circle', () => {
  assert.equal(targetRadius([{ x: 0.2, y: -0.3 }], 0.25), 1);
  assert.equal(targetRadius([{ x: 2.4, y: 0 }], 0.5), 3);
  assert.equal(targetRadius([], 3.5), 4);
  // the distance counts, not the larger axis: (1.9, 1.9) is 2.7 from the centre
  assert.equal(targetRadius([{ x: 1.9, y: 1.9 }], 0.5), 3);
});

test('targetRadius leaves settling points out, a dither does not zoom out', () => {
  const points = [
    { x: 0.3, y: 0.2 },
    { x: 5, y: -4, settling: true },
  ];
  assert.equal(targetRadius(points, 0.2), 1);
});

test('formatElapsed renders h:mm:ss', () => {
  assert.equal(formatElapsed(0), '0:00:00');
  assert.equal(formatElapsed(3725.9), '1:02:05');
  assert.equal(formatElapsed(null), '–');
});

test('graphAriaLabel names the graph and the RMS it shows', () => {
  const labels = { title: 'Guide graph', rms: 'RMS', ra: 'RA', dec: 'Dec' };
  assert.equal(
    graphAriaLabel(labels, { total: 0.62, ra: 0.41, dec: 0.464 }),
    'Guide graph: RMS 0.62″ (RA 0.41″, Dec 0.46″)'
  );
  assert.equal(
    graphAriaLabel(labels, { total: 1.5, ra: 1, dec: 1.12 }, 'px'),
    'Guide graph: RMS 1.50 px (RA 1.00 px, Dec 1.12 px)'
  );
  assert.equal(graphAriaLabel(labels, { total: null, ra: null, dec: null }), 'Guide graph');
  assert.equal(formatRms(null), '–');
});
