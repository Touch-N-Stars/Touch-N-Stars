import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGuideLog,
  parseInfo,
  parseWallTime,
  splitCsv,
  wallFromUtcMs,
  zoneOffsetMinutes,
} from '../utils/parseGuideLog.js';
import {
  buildSeries,
  correctionRates,
  detrendBySegment,
  exposureGuiding,
  findFindings,
  gradeOfRatio,
  indexRange,
  lightExposures,
  mergeNearby,
  periodogram,
  pooledSlope,
  pulseSigns,
  rangeStats,
  rollingRms,
  strongestPeriod,
  wormPeriod,
} from '../utils/analyzeGuideLog.js';
import { analyzeNight, settleDurations } from '../utils/nightModel.js';

const HEADER = `Equipment Profile = Rig
Dither = both axes, Dither scale = 1.000, Image noise reduction = none, Guide-frame time lapse = 0, Server disabled
Pixel scale = 2.00 arc-sec/px, Binning = 1, Focal length = 400 mm
Search region = 15 px, Star mass tolerance = 50.0%, Multi-star mode, list size = 9
 Camera = ZWO ASI120MM, gain = 75, full size = 1280 x 960, no dark, no defect map, pixel size = 3.8 um
Exposure = 1000 ms
Mount = EQMod Mount, connected, guiding enabled, xAngle = 58.7, xRate = 1.840, yAngle = 148.3, yRate = 2.531, parity = Even/Even
Norm rates RA = 8.0"/s @ dec 0, Dec = 6.0"/s; ortho.err. = unknown
X guide algorithm = Predictive, Correction pace = 0.50, Minimum move = none, Periodic error prediction = on, Worm teeth = 180
Y guide algorithm = Predictive, Correction pace = 0.50, Minimum move = none
Backlash comp = enabled, pulse = 200 ms
Max RA duration = 2500, Max DEC duration = 2500, DEC guide mode = Auto
RA Guide Speed = 7.5 a-s/s, Dec Guide Speed = 7.5 a-s/s, Cal Dec = 41.4, Last Cal Issue = None, Timestamp =
RA = 22.99 hr, Dec = 60.0 deg, Hour angle = Unknown hr, Pier side = West, Rotator pos = N/A, Alt = Unknown, Az = Unknown
Lock position = 234.127, 159.469, Star position = 0.000, 0.000, HFD = 2.10 px
Frame,Time,mount,dx,dy,RARawDistance,DECRawDistance,RAGuideDistance,DECGuideDistance,RADuration,RADirection,DECDuration,DECDirection,XStep,YStep,StarMass,SNR,ErrorCode`;

/** A step row: RA error ra, Dec error dec (px); pulses against the error (W for +RA, N for -Dec). */
function step(frame, time, ra, dec, { snr = 100 } = {}) {
  const raMs = Math.round(Math.abs(ra) * 100);
  const decMs = Math.round(Math.abs(dec) * 100);
  const raDir = raMs ? (ra > 0 ? 'W' : 'E') : '';
  const decDir = decMs ? (dec < 0 ? 'N' : 'S') : '';
  return `${frame},${time.toFixed(3)},"Mount",0.1,0.1,${ra.toFixed(3)},${dec.toFixed(3)},${(ra / 2).toFixed(3)},${(dec / 2).toFixed(3)},${raMs},${raDir},${decMs},${decDir},,,500000,${snr.toFixed(2)},0`;
}

function guidingSection(
  start,
  frames,
  { pier = 'West', from = 1, wobble = 0.2, extra = () => [] } = {}
) {
  const rows = [];
  for (let i = 0; i < frames; i++) {
    rows.push(...extra(i));
    const ra = wobble * Math.sin(i * 1.7);
    const dec = wobble * Math.cos(i * 1.3);
    rows.push(step(from + i, i * 2 + 1, ra, dec));
  }
  return `\nGuiding Begins at ${start}\n${HEADER.replace('Pier side = West', `Pier side = ${pier}`)}\n${rows.join('\n')}\n`;
}

const CALIBRATION = `
Calibration Begins at 2026-11-10 18:41:00
Equipment Profile = Rig
Pixel scale = 2.00 arc-sec/px, Binning = 1, Focal length = 400 mm
Mount = EQMod Mount, Calibration Step = 750 ms, Calibration Distance = 25 px, Assume orthogonal axes = no
RA = 22.08 hr, Dec = -0.0 deg, Hour angle = Unknown hr, Pier side = West, Rotator pos = N/A, Alt = Unknown, Az = Unknown
Lock position = 460.429, 316.823, Star position = 0.000, 0.000, HFD = 0.00 px
Direction,Step,dx,dy,x,y,Dist
West,0,0.000,0.000,460.484,317.361,0.000
West,1,0.531,1.143,459.953,316.217,1.261
West,2,1.578,2.849,458.906,314.512,3.257
North,1,1.952,-1.062,458.579,324.444,2.222
North,2,4.017,-2.048,456.513,325.430,4.510
NudgeSouth,1,2.879,-1.791,457.652,325.173,3.391
West calibration complete. Angle = 59.5 deg, Rate = 1.954 px/sec, Parity = Even
Calibration complete, mount = Mount.
`;

function sampleLog() {
  const settle = (i) =>
    i === 20
      ? [
          'INFO: DITHER by 1.000, -1.000, new lock pos = 235.1, 158.4',
          'INFO: SETTLING STATE CHANGE, Settling started',
        ]
      : i === 26
        ? ['INFO: SETTLING STATE CHANGE, Settling complete']
        : i === 30
          ? ['INFO: Server received ALERT 305 MountTrackingOff: Tracking off — guiding paused']
          : [];
  return (
    'PHD2 version pins Native Guider 3.3 [Linux], Log version 2.5. Log enabled at 2026-11-10 18:40:00\n' +
    CALIBRATION +
    guidingSection('2026-11-10 18:42:53', 60, { extra: settle }) +
    '41,121.000,"DROP",,,,,,,,,,,,,1200,2.10,1,"Star lost - low SNR"\n' +
    '42,122.000,"DROP",,,,,,,,,,,,,1100,2.00,1,"Star lost - low SNR"\n' +
    'INFO: Guiding parameter change, Y guide algorithm = Predictive, Correction pace = 0.70\n' +
    'Guiding Ends at 2026-11-10 18:45:00\n' +
    guidingSection('2026-11-10 19:00:00', 40, { pier: 'East', from: 100 }) +
    'Guiding Ends at 2026-11-10 19:01:30\n\nLog Summary: calcnt:1 gcnt:2 gdur:200 gacnt:0\nLog closed at 2026-11-10 19:02:00\n'
  );
}

test('parseWallTime reads the log clock as UTC wall seconds', () => {
  assert.equal(parseWallTime('2026-11-10 18:42:53'), Date.UTC(2026, 10, 10, 18, 42, 53) / 1000);
  assert.equal(parseWallTime('nonsense'), null);
});

test('a clock set back between sessions keeps the time axis ascending', () => {
  // the second session starts at 02:10 after the clocks went back from 03:00 to 02:00
  const text =
    guidingSection('2026-10-25 02:00:00', 40) +
    'Guiding Ends at 2026-10-25 02:50:00\n' +
    guidingSection('2026-10-25 02:10:00', 40, { from: 100 }) +
    'Guiding Ends at 2026-10-25 02:20:00\n';
  const log = parseGuideLog(text);
  const [a, b] = log.sections;
  assert.equal(b.clockShift, 3600);
  assert.equal(b.start, parseWallTime('2026-10-25 03:10:00'));
  assert.ok(b.start > a.end);
  const s = buildSeries(log);
  for (let i = 1; i < s.n; i++) assert.ok(s.t[i] >= s.t[i - 1]);
});

test('splitCsv keeps quoted fields together', () => {
  assert.deepEqual(splitCsv('1,"a,b",,3'), ['1', 'a,b', '', '3']);
});

test('parseInfo recognises dithers, settling, alerts and parameter changes', () => {
  assert.deepEqual(parseInfo('DITHER by 1.500, -2.000, new lock pos = 10.000, 20.000'), {
    type: 'dither',
    dx: 1.5,
    dy: -2,
    lockX: 10,
    lockY: 20,
    text: 'DITHER by 1.500, -2.000, new lock pos = 10.000, 20.000',
  });
  assert.equal(parseInfo('SETTLING STATE CHANGE, Settling started').type, 'settleStart');
  assert.equal(parseInfo('SETTLING STATE CHANGE, Settling complete').type, 'settleDone');
  assert.equal(parseInfo('SETTLING STATE CHANGE, Settling failed').type, 'settleFailed');
  const alert = parseInfo('Server received ALERT 300 PulseLimitReached: Correction limited');
  assert.equal(alert.type, 'alert');
  assert.equal(alert.code, 300);
  assert.equal(alert.name, 'PulseLimitReached');
  assert.equal(parseInfo('Server received PAUSE').type, 'command');
  assert.equal(parseInfo('Guiding parameter change, Exposure = 2000').change, 'Exposure = 2000');
  assert.equal(
    parseInfo('Predictive Ra: meridian flip: periodic error phase follows').type,
    'flip'
  );
  assert.equal(parseInfo('Something else').type, 'info');
});

test('parseGuideLog splits calibration and guiding sections with their headers', () => {
  const log = parseGuideLog(sampleLog());
  assert.equal(log.version, '2.5');
  assert.equal(log.sections.length, 3);
  const [cal, first, second] = log.sections;

  assert.equal(cal.kind, 'calibration');
  assert.equal(cal.endReason, 'complete');
  assert.deepEqual(
    cal.calibration.steps.map((s) => s.direction),
    ['West', 'West', 'West', 'North', 'North', 'NudgeSouth']
  );
  assert.equal(cal.calibration.results[0].angle, 59.5);
  assert.equal(cal.header.calibrationStepMs, 750);

  assert.equal(first.kind, 'guiding');
  assert.equal(first.endReason, 'stopped');
  assert.equal(first.steps.t.length, 62); // 60 steps + 2 drops
  assert.equal(first.steps.drop.filter(Boolean).length, 2);
  assert.equal(first.header.pixelScale, 2);
  assert.equal(first.header.exposureMs, 1000);
  assert.equal(first.header.pierSide, 'West');
  assert.equal(first.header.wormTeeth, 180);
  assert.equal(first.header.maxRaMs, 2500);
  assert.equal(first.header.calibrationInfo.xAngle, 58.7);
  assert.equal(first.steps.t[0], first.start + 1);
  assert.equal(first.end, parseWallTime('2026-11-10 18:45:00'));

  const types = first.events.map((e) => e.type);
  assert.deepEqual(types, ['dither', 'settleStart', 'settleDone', 'alert', 'param']);
  // events sit between the steps they came between
  assert.equal(first.events[0].index, 20);
  assert.equal(first.events[0].t, first.steps.t[19]);

  assert.equal(second.header.pierSide, 'East');
  assert.equal(second.steps.frame[0], 100);
});

test('parseGuideLog ends a section the log stops in the middle of', () => {
  const text = guidingSection('2026-11-10 20:00:00', 5);
  const log = parseGuideLog(text);
  assert.equal(log.sections[0].endReason, 'truncated');
  assert.equal(log.sections[0].end, log.sections[0].steps.t[4]);
});

test('parseGuideLog ignores text that is no guide log', () => {
  assert.deepEqual(parseGuideLog('hello\nworld').sections, []);
  assert.deepEqual(parseGuideLog('').sections, []);
});

test('zone offsets: IANA zones via Intl, else the fixed offset, else the browser zone', () => {
  const winter = Date.UTC(2026, 10, 10, 20, 0, 0);
  const summer = Date.UTC(2026, 6, 10, 20, 0, 0);
  assert.equal(zoneOffsetMinutes('Europe/Berlin', winter), 60);
  assert.equal(zoneOffsetMinutes('Europe/Berlin', summer), 120);
  assert.equal(zoneOffsetMinutes('No/Such_Zone', winter), null);
  assert.equal(wallFromUtcMs(winter, { timeZone: 'Europe/Berlin' }), winter / 1000 + 3600);
  assert.equal(
    wallFromUtcMs(winter, { timeZone: 'W. Europe Standard Time', utcOffsetMinutes: 60 }),
    winter / 1000 + 3600
  );
  assert.equal(wallFromUtcMs(NaN), null);
});

test('buildSeries joins the guiding sections with settling, segments and arcsec', () => {
  const log = parseGuideLog(sampleLog());
  const s = buildSeries(log);
  assert.equal(s.n, 102);
  assert.deepEqual(
    s.sectionRanges.map((r) => [r.section, r.from, r.to]),
    [
      [1, 0, 62],
      [2, 62, 102],
    ]
  );
  assert.equal(s.raAs[1], s.ra[1] * 2);
  assert.equal(s.scale[1], 2);
  // settling from the dither (step 20) until settle complete (step 26)
  assert.deepEqual(Array.from(s.settling.slice(18, 28)), [0, 0, 1, 1, 1, 1, 1, 1, 0, 0]);
  // a new segment after the dither, and one per section
  assert.equal(s.seg[19], s.seg[0]);
  assert.equal(s.seg[20], s.seg[0] + 1);
  assert.equal(s.seg[62], s.seg[20] + 1);
  assert.equal(s.drop[60], 1);
});

test('pulseSigns learns which direction moves the error which way', () => {
  const log = parseGuideLog(sampleLog());
  // W pulses were sent for positive RA errors, so they move the error down
  assert.deepEqual(pulseSigns(log.sections[1]), { E: 1, W: -1, N: 1, S: -1 });
});

test('correctionRates: RA from the normalised rate at the declination, Dec as logged', () => {
  const log = parseGuideLog(sampleLog());
  const rates = correctionRates(log.sections[1]);
  assert.ok(Math.abs(rates.ra - (8 * Math.cos(Math.PI / 3)) / 2) < 1e-9);
  assert.equal(rates.dec, 3);
});

test('uncorrected motion adds the pulses back: a constant drift fully corrected shows as drift', () => {
  // The star drifts 0.1 px per frame in Dec and every frame is pulled back completely
  // (pulse = 0.1 px at 3 px/s = 33.3 ms north), so the guided error stays at 0.1 px.
  const rows = [];
  for (let i = 0; i < 200; i++) {
    rows.push(
      `${i + 1},${(i * 2 + 1).toFixed(3)},"Mount",0,0,0.000,-0.100,0.000,-0.100,0,,33.333,N,,,500000,100.00,0`
    );
  }
  const text = `Guiding Begins at 2026-11-10 20:00:00\n${HEADER}\n${rows.join('\n')}\n`;
  const series = buildSeries(parseGuideLog(text));
  // free position goes down by 0.1 px per frame (200 frames: 6.6 min, enough for the estimate)
  assert.ok(Math.abs(series.decFree[10] - series.decFree[9] + 0.1) < 1e-6);
  const stats = rangeStats(series, 0, series.n, { decDeg: 60 });
  // 0.1 px per 2 s = 3 px/min = 6″/min
  assert.ok(Math.abs(stats.decDrift + 6) < 1e-3, String(stats.decDrift));
  assert.ok(Math.abs(stats.polarError - (3.8197 * 6) / 0.5) < 1e-2);
});

test('rangeStats: RMS about the mean, peaks, pulses and the settling switch', () => {
  const log = parseGuideLog(sampleLog());
  const s = buildSeries(log);
  const all = rangeStats(s, 0, 62, { excludeSettling: false, maxRaMs: 2500 });
  const calm = rangeStats(s, 0, 62);
  assert.equal(all.drops, 2);
  assert.equal(all.n, 60);
  assert.equal(calm.n, 54);
  assert.equal(calm.settlingFrames, 6);
  assert.ok(all.rmsTotal > 0 && all.rmsTotal < 0.6);
  assert.ok(Math.abs(all.rmsTotal - Math.hypot(all.rmsRa, all.rmsDec)) < 1e-12);
  assert.equal(all.raLimited, 0);
  assert.ok(all.raPulsePct > 80);
  assert.equal(rangeStats(s, 60, 62).empty, true);
});

test('rangeStats leaves the polar alignment unknown across sessions', () => {
  const log = parseGuideLog(sampleLog());
  const s = buildSeries(log);
  assert.ok(Number.isNaN(rangeStats(s, 0, s.n, { decDeg: 60 }).polarError));
});

test('pooledSlope fits one slope with an offset per group', () => {
  const x = [0, 1, 2, 10, 11, 12];
  const y = [0, 2, 4, 100, 102, 104];
  assert.equal(pooledSlope(x, y, [0, 0, 0, 1, 1, 1]), 2);
});

test('rollingRms restarts per section and fills the per-axis arrays', () => {
  const log = parseGuideLog(sampleLog());
  const s = buildSeries(log);
  const axes = {};
  const r = rollingRms(s, 30, axes);
  assert.ok(Number.isNaN(r[0]));
  assert.ok(Number.isFinite(r[40]));
  assert.ok(Number.isNaN(r[62])); // first frame of the second section
  assert.ok(Math.abs(r[40] - Math.hypot(axes.ra[40], axes.dec[40])) < 1e-12);
});

test('periodogram finds a sine period in unevenly sampled data', () => {
  const t = [];
  const y = [];
  for (let i = 0; i < 2000; i++) {
    const ti = i * 2 + (i % 7) * 0.3;
    if (i > 800 && i < 900) continue; // a gap
    t.push(ti);
    y.push(1.5 * Math.sin((2 * Math.PI * ti) / 480) + 0.3 * Math.sin(i * 12.9898));
  }
  const pg = periodogram(t, y, { minPeriod: 10, maxPeriod: 1500, count: 400 });
  const peak = strongestPeriod(pg);
  assert.ok(Math.abs(peak.period - 480) < 15, String(peak.period));
  assert.ok(Math.abs(peak.amplitude - 1.5) < 0.2, String(peak.amplitude));
});

test('detrendBySegment removes a line per segment', () => {
  const t = [0, 1, 2, 3, 4, 5];
  const out = detrendBySegment(t, [1, 2, 3, 10, 12, 14], [0, 0, 0, 1, 1, 1]);
  for (const v of out) assert.ok(Math.abs(v) < 1e-9);
});

test('wormPeriod from the tooth count', () => {
  assert.ok(Math.abs(wormPeriod({ wormTeeth: 180 }) - 478.69) < 0.01);
  assert.equal(wormPeriod({}), null);
});

test('findFindings: star loss, flip, alert, settings change and calibration', () => {
  const log = parseGuideLog(sampleLog());
  const s = buildSeries(log);
  const findings = findFindings(log, s);
  const kinds = findings.map((f) => f.kind);
  assert.ok(kinds.includes('starLost'));
  assert.ok(kinds.includes('flip'));
  assert.ok(kinds.includes('alert'));
  assert.ok(kinds.includes('param'));
  assert.ok(kinds.includes('calibration'));
  assert.ok(kinds.includes('gap'));
  const lost = findings.find((f) => f.kind === 'starLost');
  assert.equal(lost.params.frames, 2);
  const flip = findings.find((f) => f.kind === 'flip');
  assert.deepEqual(flip.params, { from: 'West', to: 'East' });
  // oldest first
  for (let i = 1; i < findings.length; i++) assert.ok(findings[i].t0 >= findings[i - 1].t0);
});

test('findFindings reports star losses on both sides of a session boundary', () => {
  const drop = (frame, time) =>
    `${frame},${time.toFixed(3)},"DROP",,,,,,,,,,,,,1200,2.10,1,"Star lost - low SNR"`;
  // the first session ends with three dropped frames, the next starts with three
  const text =
    guidingSection('2026-11-10 20:00:00', 40) +
    [drop(41, 81), drop(42, 82), drop(43, 83)].join('\n') +
    '\nGuiding Ends at 2026-11-10 20:01:30\n' +
    guidingSection('2026-11-10 20:02:00', 40, {
      from: 100,
      extra: (i) => (i < 3 ? [drop(97 + i, i * 2 + 0.5)] : []),
    }) +
    'Guiding Ends at 2026-11-10 20:03:30\n';
  const log = parseGuideLog(text);
  const s = buildSeries(log);
  assert.equal(s.sectionRanges.length, 2);
  // found per session, then merged as nearby losses of one stretch
  const lost = findFindings(log, s).filter((f) => f.kind === 'starLost');
  assert.equal(lost.length, 1);
  assert.equal(lost[0].count, 2);
  assert.equal(lost[0].params.frames, 6);
});

test('findFindings flags a rough stretch and a jump against the night itself', () => {
  const big = (i) => (i >= 200 && i < 260 ? 1.5 : 0.15);
  const rows = [];
  for (let i = 0; i < 400; i++) {
    const w = big(i);
    const ra = i === 330 ? 9 : w * Math.sin(i * 1.7);
    rows.push(step(i + 1, i * 2 + 1, ra, w * Math.cos(i * 1.3)));
  }
  const text = `Guiding Begins at 2026-11-10 20:00:00\n${HEADER}\n${rows.join('\n')}\n`;
  const log = parseGuideLog(text);
  const s = buildSeries(log);
  const findings = findFindings(log, s);
  const rough = findings.filter((f) => f.kind === 'badStretch');
  assert.equal(rough.length, 1);
  assert.ok(rough[0].t0 <= s.t[210] && rough[0].t1 >= s.t[250]);
  // the onset of the rough stretch and the single 9 px frame, merged into one finding
  const jump = findings.find((f) => f.kind === 'jump');
  assert.equal(jump.count, 2);
  assert.equal(jump.t1, s.t[330]);
  assert.equal(jump.params.axis, 'RA');
  assert.ok(Math.abs(jump.params.arcsec - 18) < 0.01);
});

test('mergeNearby joins findings of a kind that follow each other', () => {
  const merged = mergeNearby([
    { kind: 'jump', severity: 'warn', t0: 0, t1: 0, params: { arcsec: 3 } },
    { kind: 'jump', severity: 'bad', t0: 100, t1: 100, params: { arcsec: 9 } },
    { kind: 'alert', severity: 'warn', t0: 120, t1: 120, params: {} },
    { kind: 'jump', severity: 'warn', t0: 1000, t1: 1000, params: { arcsec: 4 } },
  ]);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].count, 2);
  assert.equal(merged[0].severity, 'bad');
  assert.equal(merged[0].params.arcsec, 9);
  assert.equal(merged[0].t1, 100);
});

test('light frames: on the wall clock, graded by the guiding during them', () => {
  const log = parseGuideLog(guidingSection('2026-11-10 20:00:00', 300));
  const s = buildSeries(log);
  // the wall clock is UTC+1: a frame ending at 19:02:00Z ended at 20:02:00 on the log's clock
  const toWall = (ms) => wallFromUtcMs(ms, { utcOffsetMinutes: 60 });
  const history = [
    {
      Date: '2026-11-10T19:02:00.0000000Z',
      ExposureTime: 60,
      ImageType: 'LIGHT',
      Filter: 'L',
      HFR: 2.1,
    },
    { Date: '2026-11-10T19:04:00Z', ExposureTime: 60, ImageType: 'LIGHT' },
    { Date: '2026-11-10T19:05:00Z', ExposureTime: 10, ImageType: 'FLAT' },
    { Date: '2026-11-10T23:00:00Z', ExposureTime: 60, ImageType: 'LIGHT' },
  ];
  const exposures = lightExposures(history, toWall);
  assert.equal(exposures.length, 3);
  assert.equal(exposures[0].end, parseWallTime('2026-11-10 20:02:00'));
  assert.equal(exposures[0].start, exposures[0].end - 60);
  assert.equal(exposures[0].filter, 'L');
  const { rows } = exposureGuiding(s, exposures);
  assert.equal(rows.length, 2); // the one at midnight has no guiding
  assert.ok(rows.every((r) => r.grade === 'good'));
  const { from, to } = indexRange(s, exposures[0].start, exposures[0].end);
  assert.equal(rows[0].from, from);
  assert.equal(rows[0].to, to);
});

test('gradeOfRatio', () => {
  assert.equal(gradeOfRatio(1), 'good');
  assert.equal(gradeOfRatio(1.5), 'fair');
  assert.equal(gradeOfRatio(2), 'poor');
  assert.equal(gradeOfRatio(3), 'bad');
  assert.equal(gradeOfRatio(NaN), 'good');
});

test('analyzeNight: the night at a glance from one log', () => {
  const m = analyzeNight(sampleLog(), { name: 'x.txt' });
  assert.equal(m.name, 'x.txt');
  assert.equal(m.series.n, 102);
  assert.equal(m.summaries.length, 2);
  assert.equal(m.dithers, 1);
  assert.deepEqual(settleDurations(m.log), [12]);
  assert.equal(m.settleMedian, 12);
  assert.equal(m.pixelScale, 2);
  // two guiding sessions: 18:42:53-18:45:00 and 19:00:00-19:01:30
  assert.equal(m.guidedSeconds, 127 + 90);
  assert.ok(m.typicalRms > 0 && m.typicalRa > 0 && m.typicalDec > 0);
  assert.equal(m.span.t0, parseWallTime('2026-11-10 18:41:00'));
  assert.ok(m.findings.some((f) => f.kind === 'flip'));
});

test('analyzeNight of a text that is no guide log has no sections', () => {
  const m = analyzeNight('hello');
  assert.equal(m.log.sections.length, 0);
  assert.equal(m.span, null);
  assert.ok(Number.isNaN(m.pixelScale));
});
