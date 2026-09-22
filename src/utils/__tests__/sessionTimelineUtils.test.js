import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTime,
  mergeEvents,
  mergeGuideSteps,
  guideCursor,
  pairIntervals,
  buildTimelineRows,
  rollingRms,
  guideSeries,
  imageSeries,
  nearestIndex,
  symmetricLimit,
  paddedRange,
  parseRmsText,
  displayWindow,
  sessionStart,
  filterColors,
  LATEST_WINDOW_MS,
} from '../sessionTimelineUtils.js';

const T0 = Date.parse('2026-09-14T20:00:00.000+02:00');
const at = (seconds) => new Date(T0 + seconds * 1000).toISOString();
const ev = (Event, seconds, extra = {}) => ({ Event, Time: at(seconds), ...extra });
// Image-history entries with their absolute index, as the component passes them
const frames = (images, all = images) =>
  images.map((image) => ({ image, index: all.indexOf(image) }));

test('parseTime trims .NET seven-digit fractions and rejects garbage', () => {
  assert.equal(parseTime('2026-09-14T20:00:00.1234567+02:00'), T0 + 123);
  assert.equal(parseTime('2026-09-14T20:00:00+02:00'), T0);
  assert.equal(parseTime('not a date'), null);
  assert.equal(parseTime(null), null);
  assert.equal(parseTime(T0), T0);
});

test('mergeEvents deduplicates by name + time and sorts by time', () => {
  const first = mergeEvents([], [ev('GUIDER-START', 10), ev('GUIDER-STOP', 5)]);
  assert.deepEqual(
    first.map((e) => e.Event),
    ['GUIDER-STOP', 'GUIDER-START']
  );
  // A full re-fetch of the same history plus one new event adds exactly one.
  const second = mergeEvents(first, [
    ev('GUIDER-START', 10),
    ev('GUIDER-STOP', 5),
    ev('GUIDER-DITHER', 7),
  ]);
  assert.equal(second.length, 3);
  assert.deepEqual(
    second.map((e) => e.Event),
    ['GUIDER-STOP', 'GUIDER-DITHER', 'GUIDER-START']
  );
  // Events without a parsable time are dropped, not crashed on.
  assert.equal(mergeEvents([], [{ Event: 'X', Time: 'nope' }, { Event: 5 }]).length, 0);
});

test('mergeGuideSteps appends only newer steps and guideCursor returns the raw last Time', () => {
  const steps = mergeGuideSteps(
    [],
    [
      { Time: at(1), RADistanceRaw: 1 },
      { Time: at(2), RADistanceRaw: 2 },
    ]
  );
  assert.equal(steps.length, 2);
  const merged = mergeGuideSteps(steps, [
    { Time: at(2), RADistanceRaw: 2 }, // duplicate of the cursor
    { Time: at(1.5), RADistanceRaw: 9 }, // older than the cursor
    { Time: at(3), RADistanceRaw: 3 },
  ]);
  assert.deepEqual(
    merged.map((s) => s.RADistanceRaw),
    [1, 2, 3]
  );
  assert.equal(guideCursor(merged), at(3));
  assert.equal(guideCursor([]), null);
});

test('pairIntervals closes open bars at now and ignores ends without starts', () => {
  const events = mergeEvents(
    [],
    [
      ev('AUTOFOCUS-FINISHED', 1),
      ev('AUTOFOCUS-STARTING', 10),
      ev('AUTOFOCUS-FINISHED', 70),
      ev('AUTOFOCUS-STARTING', 100),
    ]
  );
  const now = T0 + 130 * 1000;
  const bars = pairIntervals(events, 'AUTOFOCUS-STARTING', 'AUTOFOCUS-FINISHED', now, 'success');
  assert.equal(bars.length, 2);
  assert.deepEqual([bars[0].start, bars[0].end, bars[0].open], [T0 + 10000, T0 + 70000, false]);
  assert.deepEqual([bars[1].start, bars[1].end, bars[1].open], [T0 + 100000, now, true]);
});

test('buildTimelineRows derives every row from events and images', () => {
  const now = T0 + 600 * 1000;
  const events = mergeEvents(
    [],
    [
      ev('MOUNT-TRACKING-START', 0),
      ev('MOUNT-SLEW-START', 10),
      ev('MOUNT-SLEW-STOP', 20),
      ev('MOUNT-BEFORE-FLIP', 300),
      ev('MOUNT-AFTER-FLIP', 330),
      ev('GUIDER-STATE', 30, { State: 'Calibrating' }),
      ev('GUIDER-STATE', 60, { State: 'Guiding' }),
      ev('GUIDER-DITHER', 200),
      ev('GUIDER-STATE', 400, { State: 'LostLock' }),
      ev('GUIDER-STATE', 410, { State: 'Guiding' }),
      ev('PLATESOLVE-START', 21),
      ev('PLATESOLVE-SUCCESS', 25),
      ev('PLATESOLVE-START', 500),
      ev('PLATESOLVE-FAILED', 505),
      ev('AUTOFOCUS-STARTING', 100),
      ev('ERROR-AF', 120),
      ev('AUTOFOCUS-FINISHED', 130),
    ]
  );
  const images = [
    { Date: at(240), ExposureTime: 60, Filter: 'L' },
    { Date: at(300), ExposureTime: 60, Filter: 'Ha' },
    { Date: 'broken', ExposureTime: 60, Filter: 'L' },
  ];
  const rows = buildTimelineRows(events, frames(images), now);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.bars]));

  assert.deepEqual(Object.keys(byKey), ['mount', 'flip', 'guide', 'align', 'focus', 'capture']);

  const tracking = byKey.mount.find((b) => b.state === 'tracking');
  assert.equal(tracking.open, true);
  assert.equal(tracking.end, now);
  assert.equal(byKey.mount.filter((b) => b.state === 'slewing').length, 1);

  assert.equal(byKey.flip.length, 1);
  assert.equal(byKey.flip[0].end - byKey.flip[0].start, 30000);

  const guideStates = byKey.guide.filter((b) => !b.marker).map((b) => b.state);
  assert.deepEqual(guideStates, ['calibrating', 'guiding', 'lost', 'guiding']);
  assert.equal(byKey.guide.filter((b) => !b.marker).at(-1).open, true);
  assert.equal(byKey.guide.filter((b) => b.marker && b.state === 'dither').length, 1);

  assert.deepEqual(
    byKey.align.filter((b) => !b.marker).map((b) => b.state),
    ['success', 'failed']
  );

  assert.equal(byKey.focus.length, 1);
  assert.equal(byKey.focus[0].state, 'failed');

  assert.equal(byKey.capture.length, 2);
  assert.equal(byKey.capture[0].start, T0 + 180000);
  assert.equal(byKey.capture[0].imageIndex, 0);
  assert.equal(byKey.capture[1].imageIndex, 1);
  assert.notEqual(byKey.capture[0].color, byKey.capture[1].color);
});

test('guide row falls back to start/stop events without GUIDER-STATE', () => {
  const now = T0 + 100000;
  const events = mergeEvents([], [ev('GUIDER-START', 10), ev('GUIDER-STOP', 50)]);
  const guide = buildTimelineRows(events, [], now).find((r) => r.key === 'guide').bars;
  assert.equal(guide.length, 1);
  assert.deepEqual(
    [guide[0].state, guide[0].start, guide[0].end],
    ['guiding', T0 + 10000, T0 + 50000]
  );
});

test('rollingRms is a windowed total RMS', () => {
  assert.deepEqual(rollingRms([3, 0], [4, 0], 1), [5, 0]);
  const rms = rollingRms([1, 1, 1, 1], [0, 0, 0, 0], 2);
  assert.deepEqual(rms, [1, 1, 1, 1]);
  const mixed = rollingRms([2, 0], [0, 0], 2);
  assert.equal(mixed[0], 2);
  assert.ok(Math.abs(mixed[1] - Math.sqrt(2)) < 1e-12);
});

test('guideSeries scales pixels to arcseconds and drops SNR when the backend has none', () => {
  const steps = mergeGuideSteps(
    [],
    [
      { Time: at(1), RADistanceRaw: 1, DECDistanceRaw: -1, SNR: 20 },
      { Time: at(2), RADistanceRaw: 0.5, DECDistanceRaw: 0, SNR: null },
    ]
  );
  const series = guideSeries(steps, 2, 50);
  assert.deepEqual(
    series.ra.map((p) => p.y),
    [2, 1]
  );
  assert.deepEqual(
    series.dec.map((p) => p.y),
    [-2, 0]
  );
  assert.equal(series.unit, '"');
  assert.equal(series.snr.length, 1);
  assert.equal(series.rms.length, 2);
  assert.equal(guideSeries(steps, 0).unit, 'px');
});

test('imageSeries skips missing fields and unparsable dates', () => {
  const images = [
    { Date: at(1), HFR: 2.5, FocuserPosition: 1000 },
    { Date: at(2), HFR: '3.5' },
    { Date: 'bad', HFR: 1 },
  ];
  assert.deepEqual(
    imageSeries(frames(images), 'HFR').map((p) => p.y),
    [2.5, 3.5]
  );
  assert.equal(imageSeries(frames(images), 'FocuserPosition').length, 1);
});

test('displayWindow: latest shows the last hour, otherwise the whole session', () => {
  const now = T0 + 5 * 3600 * 1000;
  assert.deepEqual(displayWindow({ latest: true, nowMs: now, startMs: T0 }), {
    start: now - LATEST_WINDOW_MS,
    end: now,
  });
  assert.deepEqual(displayWindow({ latest: false, nowMs: now, startMs: T0 }), {
    start: T0,
    end: now,
  });
  // No session start yet: a minimal window instead of a zero-width one.
  const empty = displayWindow({ latest: false, nowMs: now, startMs: null });
  assert.ok(empty.end - empty.start >= 60000);
});

test('sessionStart takes the earliest of events, exposures and guide steps', () => {
  const events = mergeEvents([], [ev('GUIDER-START', 100)]);
  const images = [{ Date: at(90), ExposureTime: 60 }];
  const steps = mergeGuideSteps([], [{ Time: at(50) }]);
  assert.equal(sessionStart(events, frames(images), steps), T0 + 30000);
  assert.equal(sessionStart([], [], []), null);
  // Never before the application start, which also stands in for missing data
  assert.equal(sessionStart(events, frames(images), steps, T0 + 40000), T0 + 40000);
  assert.equal(sessionStart([], [], [], T0), T0);
});

test('filterColors is stable in order of first appearance', () => {
  const colors = filterColors(frames([{ Filter: 'Ha' }, { Filter: 'L' }, { Filter: 'Ha' }, {}]));
  assert.deepEqual([...colors.keys()], ['Ha', 'L', '']);
  assert.equal(new Set(colors.values()).size, 3);
});

test("parseRmsText reads the pixel value out of NINA's RMS text", () => {
  assert.equal(parseRmsText('Tot: 0.42 (0.85")'), 0.42);
  assert.equal(parseRmsText('0.7'), 0.7);
  assert.equal(parseRmsText(''), null);
  assert.equal(parseRmsText(null), null);
});

test('imageSeries and the capture row keep absolute indices for a filtered subset', () => {
  const all = [
    { Date: at(10), ExposureTime: 5, HFR: 1, RmsText: 'Tot: 0.5 (1.0")', Filter: 'L' },
    { Date: at(20), ExposureTime: 5, HFR: 2, RmsText: 'Tot: 0.6 (1.2")', Filter: 'Ha' },
    { Date: at(30), ExposureTime: 5, HFR: 3, RmsText: 'Tot: 0.7 (1.4")', Filter: 'L' },
  ];
  const subset = frames(
    all.filter((img) => img.Filter === 'L'),
    all
  );
  assert.deepEqual(
    imageSeries(subset, 'HFR').map((p) => p.i),
    [0, 2]
  );
  assert.deepEqual(
    imageSeries(subset, 'RmsText').map((p) => p.y),
    [0.5, 0.7]
  );
  const capture = buildTimelineRows([], subset, T0 + 100000).find((r) => r.key === 'capture').bars;
  assert.deepEqual(
    capture.map((b) => b.imageIndex),
    [0, 2]
  );
});

test('an autofocus run without a finish event is closed by evidence and shown as failed', () => {
  const at = (minutes) => Date.parse('2026-09-19T00:00:00Z') + minutes * 60000;
  const ev = (Event, minutes) => ({
    Event,
    Time: new Date(at(minutes)).toISOString(),
    t: at(minutes),
  });
  const image = (endMinutes) => ({
    Date: new Date(at(endMinutes)).toISOString(),
    ExposureTime: 300,
  });
  const now = at(300);
  const focus = (events, images) =>
    buildTimelineRows(events, frames(images), now).find((row) => row.key === 'focus').bars;

  // 1: finished normally. 2: no finish, points until minute 64, exposure starts at 70.
  // 3: no finish, no points, next exposure starts at 125. 4: no finish, next run at 200.
  // 5: last run of the night, long ago, nothing after it.
  const bars = focus(
    [
      ev('AUTOFOCUS-STARTING', 10),
      ev('AUTOFOCUS-FINISHED', 14),
      ev('AUTOFOCUS-STARTING', 60),
      ev('AUTOFOCUS-POINT-ADDED', 62),
      ev('AUTOFOCUS-POINT-ADDED', 64),
      ev('AUTOFOCUS-STARTING', 120),
      ev('AUTOFOCUS-STARTING', 190),
      ev('AUTOFOCUS-STARTING', 200),
      ev('AUTOFOCUS-FINISHED', 204),
      ev('AUTOFOCUS-STARTING', 240),
    ],
    [image(75), image(130), image(210)]
  );
  assert.deepEqual(
    bars.map((bar) => [bar.start, bar.end, bar.state, bar.open]),
    [
      [at(10), at(14), 'success', false],
      [at(60), at(64), 'failed', false],
      [at(120), at(125), 'failed', false],
      [at(190), at(200), 'failed', false],
      [at(200), at(204), 'success', false],
      [at(240), at(240), 'failed', false],
    ]
  );

  // A recent run with nothing after it is still running, with or without focus points
  for (const events of [
    [ev('AUTOFOCUS-STARTING', 295)],
    [ev('AUTOFOCUS-STARTING', 290), ev('AUTOFOCUS-POINT-ADDED', 296)],
  ]) {
    const [bar] = focus(events, []);
    assert.deepEqual([bar.end, bar.state, bar.open], [now, 'running', true]);
  }
});

test('the guide row ends a bar on every state without a bar and on a disconnect', () => {
  const events = mergeEvents(
    [],
    [
      ev('GUIDER-STATE', 10, { State: 'Guiding' }),
      ev('GUIDER-STATE', 50, { State: 'Stopped' }),
      ev('GUIDER-STATE', 60, { State: 'Guiding' }),
      ev('GUIDER-DISCONNECTED', 90),
    ]
  );
  const guide = buildTimelineRows(events, [], T0 + 500000).find((r) => r.key === 'guide').bars;
  assert.deepEqual(
    guide.map((b) => [b.start - T0, b.end - T0, b.open]),
    [
      [10000, 50000, false],
      [60000, 90000, false],
    ]
  );
});

test('a blind-solve failover is one failed and one finished solve, without an echo', () => {
  // NINA logs the inner (blind) solve and then the result of the outer one again
  const events = mergeEvents(
    [],
    [
      ev('PLATESOLVE-START', 10),
      ev('PLATESOLVE-START', 20),
      ev('PLATESOLVE-SUCCESS', 30),
      ev('PLATESOLVE-SUCCESS', 31),
    ]
  );
  const align = buildTimelineRows(events, [], T0 + 100000).find((r) => r.key === 'align').bars;
  assert.deepEqual(
    align.map((b) => [b.start - T0, b.end - T0, b.state]),
    [
      [10000, 20000, 'failed'],
      [20000, 30000, 'success'],
    ]
  );
});

test('mergeGuideSteps keeps the newest maxSize steps and its reference when nothing is new', () => {
  const steps = mergeGuideSteps([], [{ Time: at(1) }, { Time: at(2) }, { Time: at(3) }], 2);
  assert.deepEqual(
    steps.map((step) => step.t),
    [T0 + 2000, T0 + 3000]
  );
  assert.equal(mergeGuideSteps(steps, [{ Time: at(3) }], 2), steps);
});

test('nearestIndex finds the closest point of a sorted series', () => {
  const points = [{ x: 10 }, { x: 20 }, { x: 40 }];
  assert.equal(nearestIndex(points, 0), 0);
  assert.equal(nearestIndex(points, 29), 1);
  assert.equal(nearestIndex(points, 31), 2);
  assert.equal(nearestIndex(points, 99), 2);
  assert.equal(nearestIndex([], 5), -1);
});

test('axis ranges follow the data inside the view and ignore single spikes', () => {
  const view = { start: 0, end: 1000 };
  const noise = Array.from({ length: 500 }, (_, i) => ({ x: i, y: i % 2 ? 0.3 : -0.3 }));
  noise[250] = { x: 250, y: 12 };
  assert.equal(symmetricLimit([noise], view), 0.5);
  assert.equal(symmetricLimit([noise], { start: 5000, end: 6000 }), 1);

  const range = paddedRange(
    [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 5000, y: 99 },
    ],
    view
  );
  assert.ok(range.min < 2 && range.min > 1 && range.max > 4 && range.max < 5);
  assert.equal(paddedRange([], view), null);
});
