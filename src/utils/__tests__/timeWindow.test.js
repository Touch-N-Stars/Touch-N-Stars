import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_VIEW_SPAN_MS,
  brushMode,
  brushView,
  clampView,
  isFullView,
  panView,
  timeTicks,
  zoomView,
} from '../timeWindow.js';

const bounds = { start: 0, end: 3_600_000 };
const view = { start: 1_000_000, end: 2_000_000 };

test('clampView keeps the span inside the bounds and never below the minimum', () => {
  assert.deepEqual(clampView({ start: 3_000_000, end: 4_000_000 }, bounds), {
    start: 2_600_000,
    end: 3_600_000,
  });
  assert.deepEqual(clampView({ start: -500_000, end: 500_000 }, bounds), {
    start: 0,
    end: 1_000_000,
  });
  assert.deepEqual(clampView({ start: 1_000_000, end: 1_000_010 }, bounds), {
    start: 1_000_000,
    end: 1_000_000 + MIN_VIEW_SPAN_MS,
  });
  assert.deepEqual(clampView({ start: -1, end: 9_000_000 }, bounds), bounds);
});

test('zoomView scales around the anchor and panView shifts within the bounds', () => {
  assert.deepEqual(zoomView(view, 0.5, 0.5, bounds), { start: 1_250_000, end: 1_750_000 });
  assert.deepEqual(zoomView(view, 0.5, 0, bounds), { start: 1_000_000, end: 1_500_000 });
  assert.deepEqual(zoomView(view, 2, 1, bounds), { start: 0, end: 2_000_000 });
  assert.deepEqual(panView(view, 500_000, bounds), { start: 1_500_000, end: 2_500_000 });
  assert.deepEqual(panView(view, 5_000_000, bounds), { start: 2_600_000, end: 3_600_000 });
  assert.equal(isFullView(bounds, bounds), true);
  assert.equal(isFullView({ start: 500, end: 3_600_000 }, bounds), true);
  assert.equal(isFullView(view, bounds), false);
});

test('brushMode: handles at the edges, move inside, select elsewhere', () => {
  const wide = { x1: 100, x2: 300, grab: 14, full: false };
  assert.equal(brushMode({ ...wide, x: 95 }), 'start');
  assert.equal(brushMode({ ...wide, x: 110 }), 'start');
  assert.equal(brushMode({ ...wide, x: 200 }), 'move');
  assert.equal(brushMode({ ...wide, x: 292 }), 'end');
  assert.equal(brushMode({ ...wide, x: 310 }), 'end');
  assert.equal(brushMode({ ...wide, x: 400 }), 'select');
});

test('brushMode: a narrow highlight can still be moved, a full one is replaced', () => {
  // 7 px wide: the handles would swallow every press
  const narrow = { x1: 200, x2: 207, grab: 14, full: false };
  assert.equal(brushMode({ ...narrow, x: 203 }), 'move');
  assert.equal(brushMode({ ...narrow, x: 190 }), 'start');
  assert.equal(brushMode({ ...narrow, x: 215 }), 'end');
  // The highlight covers the whole strip: moving it would do nothing
  const full = { x1: 64, x2: 900, grab: 14, full: true };
  assert.equal(brushMode({ ...full, x: 400 }), 'select');
  assert.equal(brushMode({ ...full, x: 70 }), 'start');
});

test('brushView resizes, moves and selects inside the bounds', () => {
  assert.deepEqual(brushView('start', 0, 500_000, view, bounds), {
    start: 500_000,
    end: 2_000_000,
  });
  // A handle cannot cross the other one
  assert.deepEqual(brushView('start', 0, 2_500_000, view, bounds), {
    start: 2_000_000 - MIN_VIEW_SPAN_MS,
    end: 2_000_000,
  });
  assert.deepEqual(brushView('end', 0, 3_000_000, view, bounds), {
    start: 1_000_000,
    end: 3_000_000,
  });
  assert.deepEqual(brushView('move', 1_500_000, 1_700_000, view, bounds), {
    start: 1_200_000,
    end: 2_200_000,
  });
  assert.deepEqual(brushView('select', 800_000, 400_000, view, bounds), {
    start: 400_000,
    end: 800_000,
  });
});

test('timeTicks are round in local time and cover short views', () => {
  const hour = 3_600_000;
  const utc = timeTicks(10 * hour, 11 * hour, 6, 0);
  assert.deepEqual(
    utc.map((t) => (t - 10 * hour) / 60000),
    [0, 10, 20, 30, 40, 50, 60]
  );
  // India (+05:30): a six-hour step lands on local 00:00, 06:00, ... not on UTC hours
  const offset = 5.5 * hour;
  const local = timeTicks(0, 24 * hour, 4, offset);
  assert.ok(local.length >= 3 && local.every((t) => (t + offset) % (6 * hour) === 0));
  // The minimum view of 30 s still gets several ticks
  assert.deepEqual(timeTicks(0, 30_000, 6, 0), [0, 10_000, 20_000, 30_000]);
});
