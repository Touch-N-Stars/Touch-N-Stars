/**
 * Derivation for the session timeline of the sequence monitor: event history,
 * image history and guide steps in, timeline rows and chart series out. Pure
 * functions on plain data; all times are ms since epoch.
 *
 * `frames` are image-history entries with their absolute history index,
 * `{ image, index }`, so a filtered subset still opens the right image.
 */

// Bar state → colour
export const BAR_COLORS = {
  tracking: '#16a34a',
  slewing: '#eab308',
  parked: '#6b7280',
  flip: '#eab308',
  guiding: '#16a34a',
  calibrating: '#eab308',
  dither: '#facc15',
  lost: '#dc2626',
  paused: '#6b7280',
  success: '#16a34a',
  failed: '#dc2626',
  center: '#3b82f6',
  running: '#16a34a',
  capture: '#3b82f6',
};

// Capture bars are coloured per filter, in order of first appearance
const FILTER_PALETTE = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#a855f7',
  '#f97316',
  '#06b6d4',
  '#eab308',
  '#ec4899',
];

// `axis` groups series that share one zero-centred axis; the others get their own
export const STAT_SERIES = [
  { key: 'HFR', source: 'image', field: 'HFR', color: '#22d3ee' },
  { key: 'Stars', source: 'image', field: 'Stars', color: '#a78bfa' },
  { key: 'HFRStDev', source: 'image', field: 'HFRStDev', color: '#818cf8' },
  { key: 'FrameRMS', source: 'image', field: 'RmsText', color: '#fb7185' },
  { key: 'Median', source: 'image', field: 'Median', color: '#4ade80' },
  { key: 'Mean', source: 'image', field: 'Mean', color: '#fbbf24' },
  { key: 'StDev', source: 'image', field: 'StDev', color: '#c084fc' },
  { key: 'Min', source: 'image', field: 'Min', color: '#67e8f9' },
  { key: 'Max', source: 'image', field: 'Max', color: '#fdba74' },
  { key: 'Temperature', source: 'image', field: 'Temperature', color: '#ec4899' },
  { key: 'FocuserPosition', source: 'image', field: 'FocuserPosition', color: '#f97316' },
  { key: 'RA', source: 'guide', field: 'ra', color: '#22c55e', axis: 'guide' },
  { key: 'DEC', source: 'guide', field: 'dec', color: '#60a5fa', axis: 'guide' },
  { key: 'RMS', source: 'guide', field: 'rms', color: '#f87171', axis: 'guide' },
  { key: 'SNR', source: 'guide', field: 'snr', color: '#facc15' },
];

export const DEFAULT_SERIES = ['HFR', 'RA', 'DEC', 'RMS'];
export const LATEST_WINDOW_MS = 60 * 60 * 1000;
const RMS_WINDOW_STEPS = 50;

// --- parsing and merging ------------------------------------------------------------

/** Parses a backend timestamp to ms, or null. Safari rejects .NET's seven fractional digits. */
export function parseTime(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(ms) ? null : ms;
}

/** Total RMS in pixels from NINA's text form `Tot: 0.42 (0.85")`, or null. */
export function parseRmsText(value) {
  const match = typeof value === 'string' ? value.match(/(-?\d+\.?\d*)/) : null;
  return match ? parseFloat(match[1]) : null;
}

/**
 * Merges a fetched event history into the known one: sorted by time, with a
 * numeric `t`. The backend has no event ids and replays its log after a
 * restart, so events are deduplicated by name and time.
 */
export function mergeEvents(existing, incoming) {
  const seen = new Set();
  const out = [];
  for (const event of [...(existing || []), ...(incoming || [])]) {
    if (typeof event?.Event !== 'string') continue;
    const key = `${event.Event}|${event.Time}`;
    const t = parseTime(event.Time);
    if (t === null || seen.has(key)) continue;
    seen.add(key);
    out.push(event.t === t ? event : { ...event, t });
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * Appends the steps newer than the last known one and keeps the newest
 * `maxSize`. Returns `existing` itself when nothing was added, so watchers of
 * the array reference stay quiet.
 */
export function mergeGuideSteps(existing, incoming, maxSize = Infinity) {
  const known = existing || [];
  let lastT = known.length ? known[known.length - 1].t : -Infinity;
  const added = [];
  for (const step of incoming || []) {
    const t = parseTime(step?.Time);
    if (t === null || t <= lastT) continue;
    added.push({ ...step, t });
    lastT = t;
  }
  if (added.length === 0) return known;
  const merged = known.concat(added);
  return merged.length > maxSize ? merged.slice(merged.length - maxSize) : merged;
}

/** The `since` cursor for the next fetch: the raw Time of the newest step. */
export function guideCursor(steps) {
  return steps?.length ? (steps[steps.length - 1].Time ?? null) : null;
}

// --- timeline rows ------------------------------------------------------------------

const openBar = (event, state) => ({ start: event.t, state, open: false, startEvent: event });
const closed = (bar, end, extra) => ({ ...bar, end: Math.max(end, bar.start), ...extra });
const stillOpen = (bar, nowMs) => closed(bar, nowMs, { open: true });
const marker = (t, state, event) => ({ start: t, end: t, state, marker: true, startEvent: event });

const markers = (events, name, state) =>
  events.filter((event) => event.Event === name).map((event) => marker(event.t, state, event));

/**
 * Pairs start and end events into bars. A start while a bar is open replaces
 * it, an end without a start is ignored, a bar left open ends at `nowMs`.
 */
export function pairIntervals(events, startName, endName, nowMs, state) {
  const bars = [];
  let open = null;
  for (const event of events) {
    if (event.Event === startName) {
      open = openBar(event, state);
    } else if (event.Event === endName && open) {
      bars.push(closed(open, event.t, { endEvent: event }));
      open = null;
    }
  }
  if (open) bars.push(stillOpen(open, nowMs));
  return bars;
}

const slewTarget = (to) => (to?.RAString && to?.DecString ? `${to.RAString} ${to.DecString}` : '');

/**
 * Slewing bars only exist where an info poll caught the mount slewing, so a
 * short slew or any slew of a mount without a Slewing flag (OnStep) has none.
 * MOUNT-SLEWED marks the end of every goto through NINA, settle time included.
 */
function buildMountRow(events, nowMs) {
  const gotos = markers(events, 'MOUNT-SLEWED', 'slewing').map((bar) => ({
    ...bar,
    label: slewTarget(bar.startEvent.To),
  }));
  return [
    ...pairIntervals(events, 'MOUNT-TRACKING-START', 'MOUNT-TRACKING-STOP', nowMs, 'tracking'),
    ...pairIntervals(events, 'MOUNT-PARKED', 'MOUNT-UNPARKED', nowMs, 'parked'),
    ...pairIntervals(events, 'MOUNT-SLEW-START', 'MOUNT-SLEW-STOP', nowMs, 'slewing'),
    ...gotos,
  ];
}

// PHD2 app states that get a bar; every other state ends the current one
const GUIDER_STATES = {
  Guiding: 'guiding',
  Calibrating: 'calibrating',
  LostLock: 'lost',
  Paused: 'paused',
};

function buildGuideRow(events, nowMs) {
  const dithers = markers(events, 'GUIDER-DITHER', 'dither');
  if (!events.some((event) => event.Event === 'GUIDER-STATE')) {
    // Advanced API without state events
    return [...pairIntervals(events, 'GUIDER-START', 'GUIDER-STOP', nowMs, 'guiding'), ...dithers];
  }
  const bars = [];
  let open = null;
  for (const event of events) {
    if (event.Event !== 'GUIDER-STATE' && event.Event !== 'GUIDER-DISCONNECTED') continue;
    if (open) bars.push(closed(open, event.t));
    const state = GUIDER_STATES[event.State];
    open = state ? openBar(event, state) : null;
  }
  if (open) bars.push(stillOpen(open, nowMs));
  return [...bars, ...dithers];
}

function buildAlignRow(events, nowMs) {
  const bars = [];
  let open = null;
  // A blind-solve failover logs its result twice; the echo has no solve of its own.
  let resultSeen = false;
  for (const event of events) {
    if (event.Event === 'PLATESOLVE-START') {
      // No result arrived for the solve before: the failover took over
      if (open) bars.push(closed(open, event.t, { state: 'failed' }));
      open = openBar(event, 'running');
      resultSeen = false;
    } else if (event.Event === 'PLATESOLVE-SUCCESS' || event.Event === 'PLATESOLVE-FAILED') {
      const state = event.Event === 'PLATESOLVE-SUCCESS' ? 'success' : 'failed';
      if (open) bars.push(closed(open, event.t, { state, endEvent: event }));
      else if (!resultSeen) bars.push(marker(event.t, state, event));
      open = null;
      resultSeen = true;
    }
  }
  if (open) bars.push(stillOpen(open, nowMs));
  return [
    ...bars,
    ...markers(events, 'MOUNT-CENTER', 'center'),
    ...markers(events, 'ERROR-PLATESOLVE', 'failed'),
  ];
}

const AF_STALE_MS = 15 * 60 * 1000;

/**
 * NINA only announces the end of an autofocus run that produced a result. A
 * run without AUTOFOCUS-FINISHED is closed at its last focus point, else at
 * the next exposure or run (autofocus owns the camera), and shown as failed.
 * Only a recent run with nothing after it is still running.
 */
function buildFocusRow(events, captureStarts, nowMs) {
  const bars = [];
  let open = null;
  let lastPoint = null;

  const closeUnfinished = (boundary) => {
    const nextCapture = captureStarts.find((t) => t > open.start && t <= boundary);
    const bound = Math.min(boundary, nextCapture ?? Infinity);
    if (bound === Infinity && nowMs - (lastPoint ?? open.start) <= AF_STALE_MS) {
      bars.push(closed(open, nowMs, { open: true, state: 'running' }));
    } else {
      const end = lastPoint ?? (bound === Infinity ? open.start : bound);
      bars.push(closed(open, Math.min(end, bound), { state: 'failed' }));
    }
  };

  for (const event of events) {
    if (event.Event === 'AUTOFOCUS-STARTING') {
      if (open) closeUnfinished(event.t);
      open = openBar(event, 'success');
      lastPoint = null;
    } else if (event.Event === 'AUTOFOCUS-POINT-ADDED' && open) {
      lastPoint = event.t;
    } else if (event.Event === 'AUTOFOCUS-FINISHED' && open) {
      bars.push(closed(open, event.t, { endEvent: event }));
      open = null;
    }
  }
  if (open) closeUnfinished(Infinity);

  const errors = events.filter((event) => event.Event === 'ERROR-AF');
  const within = (bar, t) => t >= bar.start && t <= bar.end;
  for (const bar of bars) {
    if (!bar.open && errors.some((event) => within(bar, event.t))) bar.state = 'failed';
  }
  const outside = errors.filter((event) => !bars.some((bar) => within(bar, event.t)));
  return [...bars, ...outside.map((event) => marker(event.t, 'failed', event))];
}

export function filterColors(frames) {
  const colors = new Map();
  for (const { image } of frames || []) {
    const name = image?.Filter || '';
    if (!colors.has(name)) colors.set(name, FILTER_PALETTE[colors.size % FILTER_PALETTE.length]);
  }
  return colors;
}

const exposureStart = (image, end) => end - Math.max(0, Number(image.ExposureTime) || 0) * 1000;

function buildCaptureRow(frames) {
  const colors = filterColors(frames);
  const bars = [];
  for (const { image, index } of frames || []) {
    const end = parseTime(image?.Date);
    if (end === null) continue;
    bars.push({
      start: exposureStart(image, end),
      end,
      state: 'capture',
      color: colors.get(image.Filter || ''),
      label: image.Filter || '',
      imageIndex: index,
      open: false,
    });
  }
  return bars;
}

/**
 * All timeline rows in display order; `key` is also the i18n key suffix.
 * @param {Array} events merged events
 * @param {Array<{image: object, index: number}>} frames
 * @param {number} nowMs server time, ends the bars that are still open
 */
export function buildTimelineRows(events, frames, nowMs) {
  const sorted = events || [];
  const capture = buildCaptureRow(frames);
  const captureStarts = capture.map((bar) => bar.start).sort((a, b) => a - b);
  return [
    { key: 'mount', bars: buildMountRow(sorted, nowMs) },
    {
      key: 'flip',
      bars: pairIntervals(sorted, 'MOUNT-BEFORE-FLIP', 'MOUNT-AFTER-FLIP', nowMs, 'flip'),
    },
    { key: 'guide', bars: buildGuideRow(sorted, nowMs) },
    { key: 'align', bars: buildAlignRow(sorted, nowMs) },
    { key: 'focus', bars: buildFocusRow(sorted, captureStarts, nowMs) },
    { key: 'capture', bars: capture },
  ];
}

// --- chart series -------------------------------------------------------------------

/** Total RMS over the last `size` steps, in the unit of the inputs. */
export function rollingRms(ra, dec, size = RMS_WINDOW_STEPS) {
  const out = new Array(ra.length);
  let sum = 0;
  for (let i = 0; i < ra.length; i++) {
    sum += ra[i] * ra[i] + dec[i] * dec[i];
    if (i >= size) sum -= ra[i - size] * ra[i - size] + dec[i - size] * dec[i - size];
    out[i] = Math.sqrt(Math.max(0, sum) / Math.min(i + 1, size));
  }
  return out;
}

/** Guide steps as point lists, in arcseconds when the pixel scale is known. */
export function guideSeries(steps, pixelScale, rmsSize = RMS_WINDOW_STEPS) {
  const scale = pixelScale > 0 ? pixelScale : 1;
  const raValues = [];
  const decValues = [];
  const ra = [];
  const dec = [];
  const snr = [];
  for (const step of steps || []) {
    const r = (Number(step.RADistanceRaw) || 0) * scale;
    const d = (Number(step.DECDistanceRaw) || 0) * scale;
    raValues.push(r);
    decValues.push(d);
    ra.push({ x: step.t, y: r });
    dec.push({ x: step.t, y: d });
    if (step.SNR !== null && step.SNR !== undefined) snr.push({ x: step.t, y: Number(step.SNR) });
  }
  const rms = rollingRms(raValues, decValues, rmsSize).map((y, i) => ({ x: ra[i].x, y }));
  return { ra, dec, rms, snr, unit: pixelScale > 0 ? '"' : 'px' };
}

/** One point per frame that has the field; `i` is the absolute history index. */
export function imageSeries(frames, field) {
  const out = [];
  for (const { image, index } of frames || []) {
    const x = parseTime(image?.Date);
    const raw = image?.[field];
    const y = field === 'RmsText' ? parseRmsText(raw) : raw === null ? NaN : Number(raw);
    if (x !== null && Number.isFinite(y)) out.push({ x, y, i: index });
  }
  return out;
}

/** Index of the point nearest to `x` in points sorted by x, or -1. */
export function nearestIndex(points, x) {
  if (!points?.length) return -1;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x < x) lo = mid;
    else hi = mid;
  }
  return Math.abs(points[lo].x - x) <= Math.abs(points[hi].x - x) ? lo : hi;
}

// Large series are sampled: the ranges below only need the shape of the data
function* sampleInView(data, view, maxSamples = 4000) {
  const stride = Math.max(1, Math.floor(data.length / maxSamples));
  for (let i = 0; i < data.length; i += stride) {
    if (data[i].x >= view.start && data[i].x <= view.end) yield data[i].y;
  }
}

/**
 * Half range of a zero-centred axis for the series in the view: their 99th
 * percentile with headroom, so that a dither spike leaves the plot instead of
 * flattening the rest.
 */
export function symmetricLimit(seriesData, view) {
  const values = seriesData.flatMap((data) => [...sampleInView(data, view)].map(Math.abs));
  if (values.length === 0) return 1;
  values.sort((a, b) => a - b);
  const p99 = values[Math.min(values.length - 1, Math.floor(values.length * 0.99))];
  return Math.max(0.5, Math.ceil(p99 * 1.25 * 2) / 2);
}

/** Value range of a series in the view with headroom, or null without data. */
export function paddedRange(data, view) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const y of sampleInView(data, view)) {
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  if (lo === Infinity) return null;
  const pad = (hi - lo) * 0.18 || Math.abs(hi) * 0.05 || 1;
  return { min: lo - pad, max: hi + pad };
}

// --- session window and formatting --------------------------------------------------

/** Earliest time of any data, not before `floorMs` (the application start), or null. */
export function sessionStart(events, frames, steps, floorMs = null) {
  // Events and steps are sorted by time
  let min = Math.min(events?.[0]?.t ?? Infinity, steps?.[0]?.t ?? Infinity);
  for (const { image } of frames || []) {
    const end = parseTime(image?.Date);
    if (end !== null) min = Math.min(min, exposureStart(image, end));
  }
  if (min === Infinity) return floorMs;
  return floorMs === null ? min : Math.max(min, floorMs);
}

/** The window to show: the last hour, or the whole session, never narrower than a minute. */
export function displayWindow({ latest, nowMs, startMs }) {
  if (latest) return { start: nowMs - LATEST_WINDOW_MS, end: nowMs };
  return { start: Math.min(startMs ?? nowMs, nowMs - 60000), end: nowMs };
}

export function formatClock(ms, { seconds = false } = {}) {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds && { second: '2-digit' }),
  });
}

export function formatElapsed(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
