/**
 * Math for a zoomable time axis: a `view` ({ start, end } in ms) that moves
 * inside `bounds`, the range brush that picks it, and its tick positions.
 */

export const MIN_VIEW_SPAN_MS = 30e3;

/** Fits a view into the bounds: the span is limited, the position shifted. */
export function clampView(view, bounds) {
  const boundsSpan = Math.max(1, bounds.end - bounds.start);
  const span = Math.min(Math.max(view.end - view.start, MIN_VIEW_SPAN_MS), boundsSpan);
  let start = view.start;
  if (start + span > bounds.end) start = bounds.end - span;
  if (start < bounds.start) start = bounds.start;
  return { start, end: start + span };
}

/** Scales the span by `factor` (< 1 zooms in) around `anchor`, a fraction of the view (0 = left). */
export function zoomView(view, factor, anchor, bounds) {
  const span = view.end - view.start;
  const newSpan = span * factor;
  const pivot = view.start + span * anchor;
  return clampView(
    { start: pivot - newSpan * anchor, end: pivot + newSpan * (1 - anchor) },
    bounds
  );
}

export function panView(view, deltaMs, bounds) {
  return clampView({ start: view.start + deltaMs, end: view.end + deltaMs }, bounds);
}

export function isFullView(view, bounds, toleranceMs = 1000) {
  return view.start <= bounds.start + toleranceMs && view.end >= bounds.end - toleranceMs;
}

/**
 * What a press at `x` on a range brush does. `x1`/`x2` are the pixel edges of
 * the highlighted view and `grab` the reach of a handle. Handles only reach
 * inside a highlight that is wide enough to leave room for moving it; a
 * highlight that covers everything cannot be moved, so a drag selects.
 * @returns {'start'|'end'|'move'|'select'}
 */
export function brushMode({ x, x1, x2, grab, full }) {
  const inside = x >= x1 && x <= x2;
  const reach = inside && x2 - x1 < grab * 3 ? 0 : grab;
  if (inside && reach === 0 && !full) return 'move';
  if (Math.abs(x - x1) <= reach && x - x1 <= x2 - x) return 'start';
  if (Math.abs(x - x2) <= reach) return 'end';
  return inside && !full ? 'move' : 'select';
}

/** The view a brush drag produces; `anchorT` is where it began, `t` where it is now. */
export function brushView(mode, anchorT, t, startView, bounds) {
  if (mode === 'move') return panView(startView, t - anchorT, bounds);
  let next;
  if (mode === 'start') {
    next = { start: Math.min(t, startView.end - MIN_VIEW_SPAN_MS), end: startView.end };
  } else if (mode === 'end') {
    next = { start: startView.start, end: Math.max(t, startView.start + MIN_VIEW_SPAN_MS) };
  } else {
    next = { start: Math.min(anchorT, t), end: Math.max(anchorT, t) };
  }
  return clampView(next, bounds);
}

const TICK_STEPS_MS = [
  10e3,
  30e3,
  60e3,
  2 * 60e3,
  5 * 60e3,
  10 * 60e3,
  15 * 60e3,
  30 * 60e3,
  3600e3,
  2 * 3600e3,
  3 * 3600e3,
  6 * 3600e3,
  12 * 3600e3,
  24 * 3600e3,
];

/** Ticks a plot of this width has room for; shared so stacked plots agree. */
export const tickCount = (widthPx) => Math.max(3, Math.floor(widthPx / 80));

/**
 * Round tick positions (ms), aligned to local wall-clock time so that they
 * fall on full hours in every time zone.
 */
export function timeTicks(start, end, target = 6, tzOffsetMs) {
  const offset = tzOffsetMs ?? -new Date(start).getTimezoneOffset() * 60e3;
  const span = Math.max(1, end - start);
  const step = TICK_STEPS_MS.find((s) => span / s <= target) ?? TICK_STEPS_MS.at(-1);
  const ticks = [];
  for (let t = Math.ceil((start + offset) / step) * step - offset; t <= end; t += step) {
    ticks.push(t);
  }
  return ticks;
}
