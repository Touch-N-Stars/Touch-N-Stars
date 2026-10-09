// Pure helpers of the flight recorder (incidents) of the PINS native guider page: texts of causes and
// evidence, the replay timeline and playback timing, the tab badge and the list. No Vue, no stores,
// so they can be unit tested with node --test. Data shapes are the camelCase AdvancedIncident* DTOs
// of IAdvancedGuider as served by /api/internal-guider/incidents* and the 'incident' WebSocket event.
import { formatParameter, trimmed } from './nativeGuiderCoach';
import { toEpochSeconds } from './nativeGuider';

/** i18n base of all incident texts. */
export const INCIDENTS_TEXT_BASE = 'components.guider.native.incidents';

/** Trigger kinds (AdvancedIncidentTrigger.Kind), PascalCase as sent by the backend. */
export const INCIDENT_KINDS = [
  'StarLost',
  'Runaway',
  'MountNotResponding',
  'SettleTimeout',
  'CameraFailure',
  'MountPaused',
  'CalibrationFailed',
  'PulseLimited',
  'PulseOutputFailed',
  'DecFlipCorrected',
  'Spike',
  'Manual',
];

/** Likely causes of the diagnosis (AdvancedIncidentDiagnosis.Cause), in the diagnoser's rule order. */
export const INCIDENT_CAUSES = [
  'camera',
  'mountMoved',
  'calibrationMismatch',
  'mountNotMoving',
  'fieldJump',
  'clouds',
  'dew',
  'guideStarOnly',
  'driftTooFast',
  'periodicSpike',
  'unclear',
];

/** Evidence codes (AdvancedIncidentEvidence.Code) and the parameters their texts show. */
export const EVIDENCE_PARAMETERS = {
  cameraFailures: ['count'],
  frameGap: ['seconds'],
  mountSlewing: [],
  mountTrackingOff: [],
  mountParked: [],
  mountDisconnected: [],
  pierSideChanged: ['from', 'to'],
  errorGrew: ['frames', 'fromPx', 'toPx', 'axis'],
  runaway: ['axis'],
  decFlipCorrected: [],
  pulsesWithoutMotion: ['pulses', 'expectedPx', 'movedPx', 'axis'],
  fieldJump: ['jumpPx', 'jumpArcsec', 'stars'],
  starsFaded: ['stars', 'dropPercent', 'seconds'],
  recoveredAfter: ['seconds'],
  starsFadingSlowly: ['stars', 'dropPercent', 'minutes'],
  hfdGrew: ['percent'],
  primaryOnly: ['dropPercent', 'secondaries'],
  saturated: [],
  massJump: ['percent'],
  driftToEdge: ['percentOfRegion', 'frames', 'axis'],
  pulsesLimited: ['frames', 'axis'],
  spikeRepeats: ['count', 'periodSeconds'],
  spike: ['errorArcsec', 'rmsArcsec'],
  starLost: ['status'],
  trigger: ['kind'],
};

export const EVIDENCE_CODES = Object.keys(EVIDENCE_PARAMETERS);

/** End reasons of an incident; 'recording' while it is still open. */
export const END_REASONS = ['recording', 'recovered', 'stopped', 'cap', 'manual'];

/** Timeline marker types. */
export const MARKER_TYPES = ['trigger', 'recovered', 'note', 'gap', 'end'];

/** Marker colours (graph canvas, scrubber ticks and legend). */
export const INCIDENT_MARKER_COLORS = {
  trigger: '#f87171',
  recovered: '#34d399',
  note: '#a78bfa',
  gap: '#94a3b8',
  end: '#64748b',
};

// --- Texts ---------------------------------------------------------------------------

// Parameters that are counts (no unit, no decimals).
const COUNT_PARAMETERS = new Set(['count', 'pulses', 'secondaries', 'stars', 'frames']);

// String parameters whose values are translated from values.<group>.<value>.
const VALUE_GROUPS = { axis: 'axis', from: 'pierSide', to: 'pierSide', status: 'status' };

/**
 * Formats a numeric evidence parameter with its unit, like the Coach (units are part of the name:
 * jumpArcsec → "6.1″", dropPercent → "65 %", seconds → "12.5 s"), plus the incident-only names
 * (counts, percentOfRegion, minutes). Strings are returned as they are; missing values → null.
 */
export function formatIncidentParameter(name, value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (COUNT_PARAMETERS.has(name)) return String(Math.round(value));
    if (name === 'percentOfRegion') return `${Math.round(value)} %`;
    if (name === 'minutes') return `${trimmed(value, 1)} min`;
  }
  return formatParameter(name, value);
}

function unknownText({ t, te }) {
  const key = `${INCIDENTS_TEXT_BASE}.unknown`;
  return te(key) ? t(key) : '?';
}

/** Localized name of a trigger kind (the kind itself when unknown). */
export function kindText({ t, te }, kind) {
  const key = `${INCIDENTS_TEXT_BASE}.kinds.${kind}`;
  return kind && te(key) ? t(key) : String(kind || '');
}

/** Localized end reason (the reason itself when unknown). */
export function endReasonText({ t, te }, reason) {
  const key = `${INCIDENTS_TEXT_BASE}.endReasons.${String(reason || '').toLowerCase()}`;
  return reason && te(key) ? t(key) : String(reason || '');
}

/** Localized marker type (the type itself when unknown). */
export function markerTypeText({ t, te }, type) {
  const key = `${INCIDENTS_TEXT_BASE}.markers.${String(type || '').toLowerCase()}`;
  return type && te(key) ? t(key) : String(type || '');
}

/** A string parameter value in words: kinds by name, axes, pier sides and star status translated. */
export function valueText({ t, te }, name, value) {
  if (name === 'kind') return kindText({ t, te }, value);
  const group = VALUE_GROUPS[name];
  if (group) {
    const key = `${INCIDENTS_TEXT_BASE}.values.${group}.${value}`;
    if (te(key)) return t(key);
  }
  return String(value);
}

/** Interpolation values of an evidence/diagnosis text: numbers with units, strings translated. */
export function incidentTextParameters({ t, te }, parameters = {}) {
  const unknown = unknownText({ t, te });
  const out = {};
  for (const [name, raw] of Object.entries(parameters || {})) {
    if (typeof raw === 'string') out[name] = valueText({ t, te }, name, raw);
    else if (typeof raw === 'boolean') out[name] = String(raw);
    else out[name] = formatIncidentParameter(name, raw) ?? unknown;
  }
  return out;
}

/**
 * Localized likely cause: { cause, title, why, fix, known }. A cause this UI does not know yet shows
 * the engine's English message instead (a newer engine never shows an empty card).
 */
export function causeText({ t, te }, cause, fallbackMessage = '') {
  const code = String(cause || '');
  const base = `${INCIDENTS_TEXT_BASE}.causes.${code}`;
  if (!code || !te(`${base}.title`)) {
    return { cause: code, title: fallbackMessage || code, why: '', fix: '', known: false };
  }
  const field = (name) => (te(`${base}.${name}`) ? t(`${base}.${name}`) : '');
  return { cause: code, title: field('title'), why: field('why'), fix: field('fix'), known: true };
}

/**
 * Localized evidence sentence: { text, known }. Parameters the engine did not send read "?"; an
 * unknown code falls back to the engine's English message.
 */
export function evidenceText({ t, te }, evidence) {
  const code = String(evidence?.code || '');
  const key = `${INCIDENTS_TEXT_BASE}.evidence.${code}`;
  if (!code || !te(key)) return { text: evidence?.message || code, known: false };
  const params = incidentTextParameters({ t, te }, evidence?.parameters || {});
  const unknown = unknownText({ t, te });
  for (const name of EVIDENCE_PARAMETERS[code] || []) {
    if (params[name] === undefined) params[name] = unknown;
  }
  return { text: t(key, params), known: true };
}

// --- Timeline -----------------------------------------------------------------------------

/**
 * Index of frame number `frame` in the frames (oldest first, increasing numbers); the nearest frame
 * when that number was not kept. -1 without frames or a usable number.
 */
export function frameIndexOf(frames, frame) {
  const list = Array.isArray(frames) ? frames : [];
  const target = Number(frame);
  if (!list.length || frame === null || frame === undefined || !Number.isFinite(target)) return -1;
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (Number(list[mid]?.frame) < target) lo = mid + 1;
    else hi = mid;
  }
  if (
    lo > 0 &&
    Math.abs(Number(list[lo - 1]?.frame) - target) <= Math.abs(Number(list[lo]?.frame) - target)
  ) {
    return lo - 1;
  }
  return lo;
}

/**
 * Seconds of every frame since the first one (from the timestamps; a frame without one gets the
 * previous position plus its exposure). Never decreasing.
 */
export function framePositions(frames) {
  const list = Array.isArray(frames) ? frames : [];
  const first = list.find((f) => Number.isFinite(toEpochSeconds(f?.timestamp)));
  const t0 = first ? toEpochSeconds(first.timestamp) : 0;
  const out = [];
  let previous = null;
  for (const f of list) {
    const t = toEpochSeconds(f?.timestamp);
    const step = Number(f?.exposureMs) > 0 ? Number(f.exposureMs) / 1000 : 1;
    let position = Number.isFinite(t) ? t - t0 : previous === null ? 0 : previous + step;
    if (previous !== null && position < previous) position = previous;
    out.push(position);
    previous = position;
  }
  return out;
}

/** Index of the last position at or before `seconds` (0 before the first, -1 without positions). */
export function indexAtPosition(positions, seconds) {
  const n = Array.isArray(positions) ? positions.length : 0;
  if (!n) return -1;
  if (!(seconds >= positions[0])) return 0;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (positions[mid] <= seconds) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * The markers of an incident mapped onto frame indices, oldest first: { type, index, frame, time,
 * text }. A marker without a frame number is placed by its time.
 */
export function timelineMarkers(incident) {
  const frames = Array.isArray(incident?.frames) ? incident.frames : [];
  if (!frames.length) return [];
  const times = frames.map((f) => toEpochSeconds(f?.timestamp));
  const result = [];
  for (const marker of Array.isArray(incident?.markers) ? incident.markers : []) {
    if (!marker) continue;
    let index = frameIndexOf(frames, marker.frame);
    if (index < 0) {
      const time = toEpochSeconds(marker.time);
      if (!Number.isFinite(time)) continue;
      index = 0;
      for (let i = 0; i < times.length; i++) {
        if (Number.isFinite(times[i]) && times[i] <= time) index = i;
      }
    }
    result.push({
      type: String(marker.type || '').toLowerCase(),
      index,
      frame: frames[index].frame,
      time: marker.time ?? null,
      text: marker.text || '',
    });
  }
  return result.sort((a, b) => a.index - b.index);
}

/**
 * The marker to jump to from `index`: the first one after it (direction > 0) or the last one before
 * it (direction < 0); null when there is none.
 */
export function adjacentMarker(markers, index, direction) {
  const list = Array.isArray(markers) ? markers : [];
  if (direction > 0) return list.find((m) => m.index > index) || null;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].index < index) return list[i];
  return null;
}

/** Which image the replay shows for a frame: 'key' (full resolution), 'context' (binned) or null. */
export function frameImageKind(frame) {
  if (frame?.hasKey) return 'key';
  if (frame?.hasContext) return 'context';
  return null;
}

/**
 * Runs of frames without any image as { from, to } (frame indices, inclusive), e.g. the gaps of an
 * ongoing incident. Empty when no frame has an image (nothing to contrast with).
 */
export function imageGapSpans(frames) {
  const list = Array.isArray(frames) ? frames : [];
  if (!list.some((f) => frameImageKind(f))) return [];
  const spans = [];
  let start = null;
  list.forEach((frame, i) => {
    const missing = !frameImageKind(frame);
    if (missing && start === null) start = i;
    if (!missing && start !== null) {
      spans.push({ from: start, to: i - 1 });
      start = null;
    }
  });
  if (start !== null) spans.push({ from: start, to: list.length - 1 });
  return spans;
}

/**
 * Guide-step-like records of the frames for the guide graph (graphData.buildGraphData), and for
 * each of them the index of its frame. Settling and dithering frames are shaded like in the live
 * graph; frames without a timestamp are left out.
 */
export function incidentGraphSteps(frames) {
  const steps = [];
  const frameIndexes = [];
  (Array.isArray(frames) ? frames : []).forEach((f, i) => {
    if (!f || !Number.isFinite(toEpochSeconds(f.timestamp))) return;
    steps.push({
      frame: f.frame,
      timestamp: f.timestamp,
      raArcsec: f.raArcsec,
      decArcsec: f.decArcsec,
      raDistanceRaw: f.raDistanceRaw,
      decDistanceRaw: f.decDistanceRaw,
      raDuration: f.raDuration,
      raDirection: f.raDirection,
      decDuration: f.decDuration,
      decDirection: f.decDirection,
      snr: f.snr,
      starMass: f.starMass,
      isSettling: f.settling === true || f.dithering === true,
    });
    frameIndexes.push(i);
  });
  return { steps, frameIndexes };
}

/** Graph point of a frame index: the last graph point at or before it (-1 when none). */
export function graphIndexOfFrame(frameIndexes, frameIndex) {
  const list = Array.isArray(frameIndexes) ? frameIndexes : [];
  let result = -1;
  let lo = 0;
  let hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] <= frameIndex) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

/**
 * Search-region box around the lock position in sensor pixels ({ x, y, size }, top-left corner;
 * side 2 × searchRegionPx + 1), null without a lock position or a region size.
 */
export function searchRegionRect(lockX, lockY, searchRegionPx) {
  const half = Number(searchRegionPx);
  if (!(half > 0) || !Number.isFinite(Number(lockX)) || !Number.isFinite(Number(lockY)))
    return null;
  if (lockX === null || lockY === null) return null;
  const size = 2 * half + 1;
  return { x: Number(lockX) - size / 2, y: Number(lockY) - size / 2, size };
}

// --- Playback ----------------------------------------------------------------------------------

/** Playback speeds (× real time, by the frame timestamps). */
export const PLAYBACK_SPEEDS = [1, 4, 16];

/** Shortest time between two shown frames: faster playback skips frames instead. */
export const MIN_TICK_MS = 250;

/** Longest wait for the next frame: longer pauses in the recording are shortened. */
export const MAX_TICK_MS = 2000;

/**
 * One step of playback from the playhead (seconds since the first frame, see framePositions): the
 * next playhead, the frame to show and the delay before showing it.
 *
 * Frames come as fast as the speed makes them, but never faster than one per minTickMs: then the
 * playhead moves on by minTickMs × speed and the frames in between are skipped, so a 16× playback
 * of 1 s frames shows every 4th frame and asks for at most 4 images a second. A wait longer than
 * maxTickMs (a gap in the recording) is cut short. null at the end.
 * @returns {{ playhead: number, index: number, delayMs: number } | null}
 */
export function playbackAdvance(
  positions,
  playhead,
  speed,
  { minTickMs = MIN_TICK_MS, maxTickMs = MAX_TICK_MS } = {}
) {
  const n = Array.isArray(positions) ? positions.length : 0;
  if (!n) return null;
  const s = Number(speed) > 0 ? Number(speed) : 1;
  const current = indexAtPosition(positions, playhead);
  if (current >= n - 1) return null;
  const start = Math.max(Number(playhead) || 0, positions[current]);
  const untilNext = ((positions[current + 1] - start) * 1000) / s;
  if (untilNext >= minTickMs) {
    if (untilNext > maxTickMs) {
      return { playhead: positions[current + 1], index: current + 1, delayMs: maxTickMs };
    }
    return { playhead: positions[current + 1], index: current + 1, delayMs: untilNext };
  }
  const next = start + (minTickMs * s) / 1000;
  const index = Math.min(n - 1, Math.max(current + 1, indexAtPosition(positions, next)));
  return { playhead: Math.max(next, positions[index]), index, delayMs: minTickMs };
}

/**
 * Frames to preload from `index`: the next `count` frames a playback at `speed` will show (frames it
 * skips are not loaded), only those that have an image.
 */
export function preloadIndices(positions, frames, index, speed, { count = 3, ...options } = {}) {
  const out = [];
  let playhead = Array.isArray(positions) && positions[index] !== undefined ? positions[index] : 0;
  for (let i = 0; i < count; i++) {
    const step = playbackAdvance(positions, playhead, speed, options);
    if (!step) break;
    playhead = step.playhead;
    if (frameImageKind(frames?.[step.index])) out.push(step.index);
  }
  return out;
}

// --- Badge (incidents saved since the tab was last opened) ------------------------------------

/** localStorage key of the last-seen time (per browser). */
export const LAST_SEEN_KEY = 'nativeGuider.incidents.lastSeen';

/** When an incident was (last) saved, in ms (its end, else its start); NaN when unknown. */
export function savedAt(summary) {
  const end = Date.parse(summary?.end);
  if (Number.isFinite(end)) return end;
  return Date.parse(summary?.start);
}

/**
 * Newest save time of the list (the guider's clock, so a phone with a different clock still counts
 * right); 0 for none.
 */
export function newestSavedAt(incidents) {
  let newest = 0;
  for (const incident of Array.isArray(incidents) ? incidents : []) {
    const at = savedAt(incident);
    if (Number.isFinite(at) && at > newest) newest = at;
  }
  return newest;
}

/** Incidents saved after the last-seen time (an ongoing incident saved again counts again). */
export function unseenIncidentCount(incidents, lastSeen) {
  const seen = Number(lastSeen) || 0;
  let count = 0;
  for (const incident of Array.isArray(incidents) ? incidents : []) {
    if (String(incident?.endReason || '').toLowerCase() === 'recording') continue;
    const at = savedAt(incident);
    if (Number.isFinite(at) && at > seen) count++;
  }
  return count;
}

/** Badge text: nothing for 0, "9+" above 9. */
export function badgeText(count) {
  const n = Number(count) || 0;
  if (n <= 0) return '';
  return n > 9 ? '9+' : String(n);
}

/** Last-seen time from the storage (localStorage by default); 0 when unset or unavailable. */
export function readLastSeen(storage) {
  try {
    const store = storage === undefined ? globalThis.localStorage : storage;
    const value = Number(store?.getItem(LAST_SEEN_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Stores the last-seen time; false when the storage is unavailable (private mode). */
export function writeLastSeen(value, storage) {
  try {
    const store = storage === undefined ? globalThis.localStorage : storage;
    if (!store) return false;
    store.setItem(LAST_SEEN_KEY, String(Math.round(Number(value) || 0)));
    return true;
  } catch {
    return false;
  }
}

// --- List ----------------------------------------------------------------------------------------

function startMs(summary) {
  const ms = Date.parse(summary?.start);
  return Number.isFinite(ms) ? ms : 0;
}

/** The current profile's incidents first, each group newest first. */
export function sortIncidents(incidents, profileId) {
  const own = (i) => (profileId && i?.tags?.profileId === profileId ? 0 : 1);
  return [...(Array.isArray(incidents) ? incidents : [])].sort(
    (a, b) =>
      own(a) - own(b) || startMs(b) - startMs(a) || String(b?.id).localeCompare(String(a?.id))
  );
}

/** 'profile' keeps the current profile's incidents (all when the profile is unknown); 'all' keeps all. */
export function filterIncidents(incidents, { filter = 'all', profileId = null } = {}) {
  const list = Array.isArray(incidents) ? incidents : [];
  if (filter === 'profile' && profileId)
    return list.filter((i) => i?.tags?.profileId === profileId);
  return list;
}

/** Filtered and sorted list of the tab. */
export function visibleIncidents(incidents, { filter = 'all', profileId = null } = {}) {
  return sortIncidents(filterIncidents(incidents, { filter, profileId }), profileId);
}

/**
 * What the alert's Replay button shows: 'saved' (the incident can be replayed), 'recording' (still
 * being recorded, not saved yet) or null (no incident, or it was deleted).
 */
export function alertIncidentState(alert, { incidents = [], recordingId = null } = {}) {
  const id = alert?.incidentId;
  if (!id) return null;
  if ((Array.isArray(incidents) ? incidents : []).some((i) => i?.id === id)) return 'saved';
  if (recordingId && recordingId === id) return 'recording';
  return null;
}

/**
 * Start (UTC) and kind from an incident id `yyyyMMdd-HHmmss-<kind>[-n]` (for the "recording…" row,
 * before the incident has a summary): { start: ISO string | null, kind: string | null }.
 */
export function parseIncidentId(id) {
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-([A-Za-z]+)/.exec(String(id || ''));
  if (!match) return { start: null, kind: null };
  const [, y, mo, d, h, mi, se, kind] = match;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
  return { start: Number.isFinite(ms) ? new Date(ms).toISOString() : null, kind };
}

/** Duration of an incident in seconds (null when unknown). */
export function incidentDurationSeconds(summary) {
  const start = Date.parse(summary?.start);
  const end = Date.parse(summary?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, (end - start) / 1000);
}

/** "45 s", "3:05 min", "1:02:05 h" ('–' when unknown). */
export function formatIncidentDuration(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return '–';
  const total = Math.max(0, Math.round(Number(seconds)));
  if (total < 60) return `${total} s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${s} h`;
  return `${m}:${s} min`;
}

/**
 * Size in 1024-based units like the guider's budget setting (IncidentBudgetMb): "850 B", "12 kB", "312 MB",
 * "1000 MB", "1.5 GB" ('–' when unknown).
 */
export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '–';
  const kb = 1024;
  const mb = kb * kb;
  const gb = mb * kb;
  if (value >= gb) return `${trimmed(value / gb, 1)} GB`;
  if (value >= mb)
    return `${value >= 10 * mb ? Math.round(value / mb) : trimmed(value / mb, 1)} MB`;
  if (value >= kb) return `${Math.round(value / kb)} kB`;
  return `${Math.round(value)} B`;
}

/**
 * The budget line: real incidents' storage and count, and the simulator's own budget when it has
 * incidents or a budget.
 */
export function budgetSummary(list) {
  const incidents = Array.isArray(list?.incidents) ? list.incidents : [];
  const simulatorCount = incidents.filter((i) => i?.tags?.simulator === true).length;
  return {
    used: Number(list?.usedBytes) || 0,
    budget: Number(list?.budgetBytes) || 0,
    count: incidents.length - simulatorCount,
    max: Number(list?.maxIncidents) || 0,
    simulatorUsed: Number(list?.simulatorUsedBytes) || 0,
    simulatorBudget: Number(list?.simulatorBudgetBytes) || 0,
    simulatorCount,
  };
}

/**
 * Star tiles of a replay frame from its crops (GET …/crops: { star, x0, y0, width, height, pixels },
 * star = index in the frame's star list, primary first) in the shape of NativeStarPeeper's props.
 */
export function cropTiles(frame, crops) {
  const stars = Array.isArray(frame?.stars) ? frame.stars : [];
  const list = (Array.isArray(crops) ? crops : []).filter(
    (c) => c && c.width > 0 && c.height > 0 && Array.isArray(c.pixels)
  );
  const centre = (crop) => ({
    x: crop.x0 + (crop.width - 1) / 2,
    y: crop.y0 + (crop.height - 1) / 2,
  });
  let primaryIndex = list.findIndex((c) => stars[c.star]?.isPrimary === true);
  if (primaryIndex < 0 && list.length && !stars.some((s) => s?.isPrimary)) primaryIndex = 0;
  const primaryCrop = primaryIndex >= 0 ? list[primaryIndex] : null;
  let primaryStar = null;
  if (primaryCrop) {
    const star = stars[primaryCrop.star];
    primaryStar = star?.isPrimary
      ? star
      : Number.isFinite(frame?.starX) && Number.isFinite(frame?.starY)
        ? { x: frame.starX, y: frame.starY, snr: frame.snr, hfd: frame.hfd, isPrimary: true }
        : { ...centre(primaryCrop), snr: null, hfd: null, isPrimary: true };
  }
  const secondaryCrops = list
    .filter((c, i) => i !== primaryIndex)
    .map((crop) => ({ crop, star: stars[crop.star] || { ...centre(crop), snr: null, hfd: null } }));
  return { primaryCrop, primaryStar, secondaryCrops };
}
