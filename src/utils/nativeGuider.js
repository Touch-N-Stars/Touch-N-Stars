// Pure helpers of the PINS native guider page (no Vue, no stores) so they can be unit tested
// with node --test. The data shapes are the camelCase DTOs of IAdvancedGuider as served by
// /api/internal-guider/* and /ws/internal-guider.

export const NATIVE_GUIDER_ID = 'InternalGuider';

// Guider settings shown outside the guider page, by the backend's setting name. A name the
// backend no longer has is simply not shown (NativeSettingsSheet skips unknown names).
/** Guider connect dialog: guide source, optics and pulse output. */
export const NATIVE_CONNECT_SETTINGS = [
  'GuideSource',
  'FocalLengthMm',
  'PixelSizeUm',
  'PulseOutput',
];
/** Setup wizard: what is needed before the first guiding run. */
export const NATIVE_WIZARD_SETTINGS = ['GuideSource', 'FocalLengthMm'];

/**
 * Whether the native guider is the guider in use: the connected device when there is one,
 * otherwise the device picked in the chooser (display name) or stored in the profile (Id).
 */
export function isNativeGuiderSelected({
  guiderInfo,
  profileGuiderName,
  selectedDisplayName,
} = {}) {
  if (guiderInfo?.Connected) {
    return guiderInfo.DeviceId === NATIVE_GUIDER_ID;
  }
  if (selectedDisplayName) {
    // PINS lists the device as "Internal Guider"; older builds called it "Native Guider".
    const name = String(selectedDisplayName);
    return name === NATIVE_GUIDER_ID || /\b(internal|native) guider\b/i.test(name);
  }
  return profileGuiderName === NATIVE_GUIDER_ID;
}

/**
 * isNativeGuiderSelected() for the main store: the connected guider, else the chooser's
 * display name, else the profile's guider.
 * @param {{ guiderInfo?: object, profileInfo?: object }} store apiStore (or the same shape)
 */
export function isNativeGuiderInUse(store, selectedDisplayName = '') {
  return isNativeGuiderSelected({
    guiderInfo: store?.guiderInfo,
    profileGuiderName: store?.profileInfo?.GuiderSettings?.GuiderName,
    selectedDisplayName,
  });
}

/**
 * Whether PINS' guide camera slot is in use. Only the native guider guides with it - PHD2
 * opens its camera itself, so a slot camera would fight PHD2 for the device - and only PINS'
 * profile has the slot (official NINA has no GuideCameraSettings).
 */
export function usesGuideCameraSlot(store, selectedDisplayName = '') {
  return (
    Boolean(store?.profileInfo?.GuideCameraSettings) &&
    isNativeGuiderInUse(store, selectedDisplayName)
  );
}

/**
 * The devices "connect all" takes care of. The guide camera slot only counts while the native
 * guider uses it: a camera left in the slot from an earlier native setup must neither be
 * connected for PHD2 nor keep "all connected" from ever becoming true.
 */
export function equipmentInUse(existingEquipmentList, { guideCameraSlot }) {
  const list = Array.isArray(existingEquipmentList) ? existingEquipmentList : [];
  return guideCameraSlot ? list : list.filter((device) => device?.apiName !== 'guidecamera');
}

/** Colour tone of a guider state: ok | info | warn | danger | idle. */
export function stateTone(state) {
  switch (state) {
    case 'Guiding':
      return 'ok';
    case 'Calibrating':
    case 'Looping':
    case 'Selected':
      return 'info';
    case 'Paused':
    case 'Reacquiring':
      return 'warn';
    case 'LostLock':
    case 'Failed':
      return 'danger';
    default:
      return 'idle';
  }
}

/** SNR colour tone: < 10 danger, < 20 warn, else ok; idle without a value. */
export function snrTone(snr) {
  if (snr === null || snr === undefined || !Number.isFinite(Number(snr))) return 'idle';
  const value = Number(snr);
  if (value < 10) return 'danger';
  if (value < 20) return 'warn';
  return 'ok';
}

/** Tailwind text colour per tone (theme tokens, so the red night filter keeps working). */
export const TONE_TEXT = {
  ok: 'text-status-ok',
  info: 'text-accent',
  warn: 'text-status-warn',
  danger: 'text-status-danger',
  idle: 'text-content-muted',
};

export const TONE_BG = {
  ok: 'bg-status-ok',
  info: 'bg-accent',
  warn: 'bg-status-warn',
  danger: 'bg-status-danger',
  idle: 'bg-content-faint',
};

const ACTIVE_GUIDING = ['Calibrating', 'Guiding', 'LostLock', 'Reacquiring', 'Paused'];

/**
 * Which controls are enabled in a state. connected=false disables everything; while the mount
 * slews to the calibration position (calibrationSlew) only stop is, and cancels the slew.
 * @returns {boolean}
 */
export function canPerform(
  action,
  state,
  { connected = true, isCalibrated = false, calibrationSlew = false } = {}
) {
  if (!connected) return false;
  if (calibrationSlew) return action === 'stop';
  const guiding = ACTIVE_GUIDING.includes(state);
  switch (action) {
    case 'loop':
      return !guiding && state !== 'Looping' && state !== 'Selected';
    case 'stop':
      return state !== 'Stopped' && state !== undefined && state !== null;
    case 'guide':
    case 'calibrate':
      return !guiding;
    case 'pause':
      return state === 'Guiding';
    case 'resume':
      return state === 'Paused';
    case 'dither':
      return state === 'Guiding';
    case 'clearCalibration':
      return isCalibrated && !guiding;
    case 'darks':
      return state === 'Stopped';
    default:
      return false;
  }
}

/** Seconds since the epoch of a step/marker timestamp (ISO string or Date). */
export function toEpochSeconds(timestamp) {
  if (timestamp === null || timestamp === undefined) return NaN;
  const ms = timestamp instanceof Date ? timestamp.getTime() : Date.parse(timestamp);
  return ms / 1000;
}

/**
 * Merges new guide steps into the ring (by frame number, oldest first) and trims it to max.
 * A frame number far below the newest one means a new guider session: the ring restarts.
 */
export function appendSteps(existing, incoming, max = 2000) {
  const list = Array.isArray(incoming) ? incoming : [incoming];
  let result = existing.slice();
  for (const step of list) {
    if (!step || step.frame === undefined || step.frame === null) continue;
    const last = result.length ? result[result.length - 1] : null;
    if (last && step.frame < last.frame - 10) {
      result = [];
    }
    const tail = result.length ? result[result.length - 1] : null;
    if (!tail || step.frame > tail.frame) {
      result.push(step);
    } else {
      const index = result.findIndex((s) => s.frame === step.frame);
      if (index >= 0) {
        result[index] = step;
      } else {
        result.push(step);
        result.sort((a, b) => a.frame - b.frame);
      }
    }
  }
  if (result.length > max) result = result.slice(result.length - max);
  return result;
}

/** Population RMS of finite values (null for none). */
export function rms(values) {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (Number.isFinite(v)) {
      sum += v * v;
      count++;
    }
  }
  return count ? Math.sqrt(sum / count) : null;
}

/** Population standard deviation (PHD2's RMS definition: around the mean). */
export function stdDev(values) {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return null;
  const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
  return Math.sqrt(finite.reduce((a, b) => a + (b - mean) * (b - mean), 0) / finite.length);
}

/**
 * RA/Dec error of a step in the requested unit ('arcsec' | 'px').
 * @returns {{ ra: number, dec: number }}
 */
export function stepError(step, unit = 'arcsec') {
  if (unit === 'px') return { ra: step.raDistanceRaw, dec: step.decDistanceRaw };
  return { ra: step.raArcsec, dec: step.decArcsec };
}

/** RMS of the given steps (settling steps excluded) in the unit. */
export function windowRms(steps, unit = 'arcsec') {
  // settling and dither recenter moves are excluded, as in PHD2's RMS
  const used = steps.filter((s) => !s.isSettling && !s.isRecenterMove);
  const ra = stdDev(used.map((s) => stepError(s, unit).ra));
  const dec = stdDev(used.map((s) => stepError(s, unit).dec));
  const total = ra === null || dec === null ? null : Math.sqrt(ra * ra + dec * dec);
  return { ra, dec, total, count: used.length };
}

/** Signed correction pulse in ms: East/North positive, West/South negative. */
export function signedPulse(duration, direction) {
  if (!duration) return 0;
  const d = String(direction || '').toLowerCase();
  if (d.startsWith('w') || d.startsWith('s')) return -Math.abs(duration);
  return Math.abs(duration);
}

/**
 * Horizontal/vertical intensity cuts and a radial profile through (cx, cy) of a raw crop
 * { x0, y0, width, height, pixels } in frame coordinates.
 */
export function starProfiles(crop, cx, cy) {
  if (!crop || !crop.width || !crop.height || !Array.isArray(crop.pixels)) return null;
  const { x0, y0, width, height, pixels } = crop;
  const lx = cx - x0;
  const ly = cy - y0;
  const row = Math.min(height - 1, Math.max(0, Math.round(ly)));
  const col = Math.min(width - 1, Math.max(0, Math.round(lx)));

  const horizontal = [];
  for (let x = 0; x < width; x++) horizontal.push(pixels[row * width + x]);
  const vertical = [];
  for (let y = 0; y < height; y++) vertical.push(pixels[y * width + col]);

  // Radial profile: mean per 0.5 px ring.
  const bins = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = Math.hypot(x - lx, y - ly);
      const bin = Math.round(r * 2) / 2;
      const entry = bins.get(bin) || { sum: 0, count: 0 };
      entry.sum += pixels[y * width + x];
      entry.count++;
      bins.set(bin, entry);
    }
  }
  const radial = [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([r, e]) => ({ r, value: e.sum / e.count }));

  let min = Infinity;
  let max = -Infinity;
  for (const v of pixels) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { horizontal, vertical, radial, min, max, centerColumn: col, centerRow: row };
}

/** Pixel value from which a star counts as saturated: 97 % of the frame's full scale. */
export function saturationLevel(bitDepth) {
  return (Math.pow(2, Math.min(16, Math.max(8, bitDepth || 16))) - 1) * 0.97;
}

/**
 * RGBA pixels of a star crop { width, height, pixels } for a zoomed tile: black at the crop's
 * background (median), white at its peak, square-root stretched so the faint wings stay visible;
 * saturated pixels are red.
 */
export function starTileImage(crop, bitDepth) {
  if (!crop || !crop.width || !crop.height || !Array.isArray(crop.pixels)) return null;
  const { width, height, pixels } = crop;
  const sorted = [...pixels].sort((a, b) => a - b);
  const background = sorted[Math.floor(sorted.length / 2)];
  const range = Math.max(1, sorted[sorted.length - 1] - background);
  const saturation = saturationLevel(bitDepth);
  const rgba = new Uint8ClampedArray(width * height * 4);
  let saturated = 0;
  pixels.forEach((value, i) => {
    const o = i * 4;
    if (value >= saturation) {
      saturated++;
      rgba.set([248, 113, 113], o);
    } else {
      const level = Math.round(
        255 * Math.sqrt(Math.min(1, Math.max(0, (value - background) / range)))
      );
      rgba.set([level, level, level], o);
    }
    rgba[o + 3] = 255;
  });
  return { width, height, rgba, saturated };
}

/** Brightest grey of the star view (0..1): the star never outshines the points drawn on it. */
export const STAR_VIEW_PEAK_LEVEL = 0.55;

// Catmull-Rom spline through p0..p3, at t in [0, 1] between p1 and p2.
function catmullRom(p0, p1, p2, p3, t) {
  return (
    p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))
  );
}

/**
 * RGBA pixels (size × size) of the star view: the raw crop { x0, y0, width, height, pixels }
 * resampled bicubically over the square of ±radiusPx around the lock position (lockX, lockY,
 * frame px with pixel centres at integers), so the lock is the image centre. Stretched like
 * starTileImage (black at the crop's median, square root up to its peak), but only up to `peak`
 * grey and without red saturated pixels: `saturated` reports a peak at the saturation level
 * instead. Outside the crop is black.
 */
export function starViewImage(
  crop,
  { lockX, lockY, radiusPx, size = 256, bitDepth = 16, peak = STAR_VIEW_PEAK_LEVEL } = {}
) {
  if (!crop || !crop.width || !crop.height || !Array.isArray(crop.pixels)) return null;
  const { x0, y0, width, height, pixels } = crop;
  if (pixels.length < width * height || !(radiusPx > 0) || !(size > 0)) return null;
  if (!Number.isFinite(lockX) || !Number.isFinite(lockY)) return null;
  const sorted = Float64Array.from(pixels).sort();
  const background = sorted[Math.floor(sorted.length / 2)];
  const max = sorted[sorted.length - 1];
  const range = Math.max(1, max - background);
  const top = 255 * Math.min(1, Math.max(0, peak));
  const at = (col, row) =>
    pixels[Math.min(height - 1, Math.max(0, row)) * width + Math.min(width - 1, Math.max(0, col))];
  const sample = (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const tx = x - ix;
    const ty = y - iy;
    const row = (r) => catmullRom(at(ix - 1, r), at(ix, r), at(ix + 1, r), at(ix + 2, r), tx);
    return catmullRom(row(iy - 1), row(iy), row(iy + 1), row(iy + 2), ty);
  };

  const rgba = new Uint8ClampedArray(size * size * 4);
  const pitch = (2 * radiusPx) / size;
  for (let j = 0; j < size; j++) {
    // Crop coordinates of the output pixel's centre
    const y = lockY - radiusPx + (j + 0.5) * pitch - y0;
    for (let i = 0; i < size; i++) {
      const x = lockX - radiusPx + (i + 0.5) * pitch - x0;
      let level = 0;
      if (x >= -0.5 && x <= width - 0.5 && y >= -0.5 && y <= height - 0.5) {
        const norm = (sample(x, y) - background) / range;
        level = top * Math.sqrt(Math.min(1, Math.max(0, norm)));
      }
      const o = (j * size + i) * 4;
      rgba[o] = level;
      rgba[o + 1] = level;
      rgba[o + 2] = level;
      rgba[o + 3] = 255;
    }
  }
  return { size, rgba, saturated: max >= saturationLevel(bitDepth) };
}

/** Preferred display order of setting groups; unknown groups follow alphabetically. */
export const SETTING_GROUP_ORDER = [
  'Camera',
  'Stars',
  'Guiding',
  'Algorithms',
  'Calibration',
  'Dither',
  'Safety',
];

/** Whether a setting belongs to the Basic view (AdvancedGuiderSetting.Basic). */
export function isBasicSetting(setting) {
  return setting?.basic === true;
}

/**
 * Whether a setting applies with the current value of the one it depends on: with `dependsOn`
 * it applies only while that setting has one of the `appliesTo` values (e.g. RA aggression only
 * for the Hysteresis algorithm). Settings without the metadata, or whose dependency is not in
 * the list, always apply.
 */
export function settingApplies(setting, allSettings = []) {
  if (!setting?.dependsOn || !Array.isArray(setting.appliesTo)) return true;
  const dependency = (allSettings || []).find((s) => s.name === setting.dependsOn);
  if (!dependency) return true;
  const value = String(dependency.value ?? '').toLowerCase();
  return setting.appliesTo.some((v) => String(v).toLowerCase() === value);
}

/** Groups settings for the settings sheet, Basic only unless advanced is set; settings that don't apply are left out. */
export function groupSettings(settings, { advanced = false } = {}) {
  const list = (settings || []).filter(
    (s) => (advanced || isBasicSetting(s)) && settingApplies(s, settings)
  );
  const groups = new Map();
  for (const setting of list) {
    const group = setting.group || 'Other';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(setting);
  }
  const rank = (g) => {
    const i = SETTING_GROUP_ORDER.indexOf(g);
    return i >= 0 ? i : SETTING_GROUP_ORDER.length;
  };
  return [...groups.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([group, items]) => ({ group, settings: items }));
}

/**
 * Validates a user entry against the setting metadata.
 * @returns {{ ok: true, value: string|number|boolean } | { ok: false, error: string, params?: object }}
 *   error is an i18n key suffix under components.guider.native.settings.errors.
 */
export function validateSettingValue(setting, raw) {
  const type = String(setting?.type || 'string').toLowerCase();
  if (type === 'bool') {
    const value = raw === true || raw === 'true' || raw === 1 || raw === '1';
    return { ok: true, value };
  }
  if (type === 'int' || type === 'double') {
    const text = String(raw ?? '')
      .trim()
      .replace(',', '.');
    if (text === '') return { ok: false, error: 'required' };
    const value = Number(text);
    if (!Number.isFinite(value)) return { ok: false, error: 'number' };
    if (type === 'int' && !Number.isInteger(value)) return { ok: false, error: 'integer' };
    if (setting.min !== null && setting.min !== undefined && value < setting.min) {
      return { ok: false, error: 'min', params: { min: setting.min } };
    }
    if (setting.max !== null && setting.max !== undefined && value > setting.max) {
      return { ok: false, error: 'max', params: { max: setting.max } };
    }
    return { ok: true, value };
  }
  if (type === 'enum') {
    const value = String(raw ?? '');
    if (
      Array.isArray(setting.options) &&
      setting.options.length &&
      !setting.options.includes(value)
    ) {
      return { ok: false, error: 'option' };
    }
    return { ok: true, value };
  }
  return { ok: true, value: String(raw ?? '') };
}

/** Normalizes the setting's invariant string value for form controls. */
export function settingFormValue(setting) {
  const type = String(setting?.type || 'string').toLowerCase();
  const value = setting?.value;
  if (type === 'bool') return String(value).toLowerCase() === 'true';
  return value ?? '';
}

/** Severity tone of an alert. */
export function severityTone(severity) {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
      return 'danger';
    case 'warning':
      return 'warn';
    default:
      return 'info';
  }
}

/** Graph marker for a feed message, or null. */
export function markerFromMessage(message) {
  const type = message?.type;
  const payload = message?.payload || {};
  const t = toEpochSeconds(message?.timestamp);
  if (!Number.isFinite(t)) return null;
  switch (type) {
    case 'dither':
      return { t, kind: 'dither' };
    case 'starlost':
      return { t, kind: 'starlost' };
    case 'settle': {
      const status = String(payload.status || '').toLowerCase();
      if (status === 'done') return { t, kind: 'settled' };
      if (status === 'failed') return { t, kind: 'settleFailed' };
      return null;
    }
    case 'calibration':
      return payload && payload.raAngleDeg !== undefined ? { t, kind: 'calibration' } : null;
    default:
      return null;
  }
}

/** Appends a marker, keeping at most max (oldest dropped). */
export function appendMarker(markers, marker, max = 300) {
  if (!marker) return markers;
  const next = [...markers, marker];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Formats a number with fixed digits, '–' for missing values. */
export function fmt(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '–';
  return Number(value).toFixed(digits);
}

/**
 * Warning for a frame's pixel levels (frame-info `levels`: { min, median, max, fullScale,
 * saturatedPercent, flat }): mostly saturated first, then a flat frame without signal, then a
 * noticeable saturated share. null when the frame looks normal or levels are unknown.
 * @returns {{ kind: 'saturated'|'flat'|'partlySaturated', percent: number, level: number,
 *   fullScale: number } | null}
 */
export function frameLevelWarning(levels) {
  if (!levels || typeof levels !== 'object') return null;
  const percent = Number(levels.saturatedPercent);
  const base = {
    percent: Number.isFinite(percent) ? percent : 0,
    level: Number.isFinite(Number(levels.median)) ? Math.round(Number(levels.median)) : 0,
    fullScale: Number.isFinite(Number(levels.fullScale)) ? Math.round(Number(levels.fullScale)) : 0,
  };
  if (base.percent >= 50) return { kind: 'saturated', ...base };
  if (levels.flat === true) return { kind: 'flat', ...base };
  if (base.percent >= 5) return { kind: 'partlySaturated', ...base };
  return null;
}

/** Tone of a learning algorithm's phase (AdvancedGuideAlgorithmState.phase). */
export const ALGORITHM_PHASE_TONE = { Learning: 'info', Adapted: 'ok' };

/**
 * The axes whose guide algorithm learns the sky and the mount (Predictive): `[{ axis, state }]`
 * with axis 'RA' or 'Dec' and the backend's AdvancedGuideAlgorithmState.
 */
export function learningAxes(status) {
  return [
    ['RA', status?.raAlgorithmState],
    ['Dec', status?.decAlgorithmState],
  ]
    .filter(([, state]) => state && typeof state === 'object')
    .map(([axis, state]) => ({ axis, state }));
}

/**
 * What the state strip says about learning algorithms: null when none learns or all have
 * learned, else `{ percent, axes }` of the axes still learning (percent of the least advanced).
 */
export function learningBadge(status) {
  const axes = learningAxes(status);
  const learning = axes.filter((a) => a.state.phase === 'Learning');
  if (learning.length) {
    const progress = Math.min(...learning.map((a) => Number(a.state.progress) || 0));
    return {
      percent: Math.floor(Math.min(1, Math.max(0, progress)) * 100),
      axes: learning.map((a) => a.axis),
    };
  }
  return null;
}

/** Tone of the RA periodic-error prediction's phase (AdvancedPeriodicErrorState.phase). */
export const PERIODIC_ERROR_PHASE_TONE = {
  Off: 'idle',
  Learning: 'info',
  Ready: 'idle',
  Predicting: 'ok',
  Negligible: 'idle',
};

/**
 * The state strip's periodic-error chip: `{ percent }` while the RA worm's periodic error is being
 * learned (and the algorithm itself has learned the sky and the mount), else null: also once the
 * curve is learned but too small to predict (Negligible).
 */
export function periodicErrorBadge(status) {
  if (learningBadge(status)) return null;
  const pe = status?.raAlgorithmState?.periodicError;
  if (!pe || pe.phase !== 'Learning') return null;
  const progress = Number(pe.progress) || 0;
  return { percent: Math.floor(Math.min(1, Math.max(0, progress)) * 100) };
}

/**
 * Dec guide mode Drift (AdvancedGuiderStatus.decDrift, null in the other Dec guide modes): null
 * without it, else `{ direction, driftArcsecPerMin, valveOpen, tone }` with direction 'Both' (until
 * the drift is known), 'North' or 'South', the drift's size (null before it is known) and whether
 * the safety valve lets both directions bring back a large error.
 */
export function decDirection(status) {
  const decDrift = status?.decDrift;
  const direction = decDrift?.direction;
  if (!['Both', 'North', 'South'].includes(direction)) return null;
  const raw = decDrift.driftArcsecPerMin;
  const drift = raw === null || raw === undefined ? NaN : Number(raw);
  const valveOpen = decDrift.safetyValveOpen === true;
  return {
    direction,
    driftArcsecPerMin: Number.isFinite(drift) ? Math.abs(drift) : null,
    valveOpen,
    tone: valveOpen ? 'warn' : direction === 'Both' ? 'info' : 'ok',
  };
}

/** Guider states in which the guide loop takes frames, so its timing is current. */
export const LOOP_STATES = [
  'Looping',
  'Selected',
  'Calibrating',
  'Guiding',
  'Paused',
  'LostLock',
  'Reacquiring',
];

/**
 * The guide loop's timing (AdvancedGuiderStatus.timing): null before the first cycle (or from a
 * backend without it), else `{ fps, cycles, median, last }`. median (over the last `cycles`
 * cycles) and last (the last cycle) are `{ cycleMs, exposureMs, cameraMs, processingMs,
 * frameToPulseMs, pulseMs, otherMs }`, null where unknown: frameToPulseMs and pulseMs without
 * pulses (the backend reports pulseMs 0 then). The backend has no last exposure; the exposure is
 * the one asked for, so the last cycle's is the exposure setting (status.exposureSeconds).
 */
export function guideTiming(status) {
  const timing = status?.timing;
  if (!timing || typeof timing !== 'object') return null;
  const num = (value) =>
    value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
  const cycles = num(timing.cycles);
  if (!(cycles > 0)) return null;
  const part = (cycle, exposure, camera, processing, frameToPulse, pulse, other) => {
    const toPulse = num(frameToPulse);
    return {
      cycleMs: num(cycle),
      exposureMs: num(exposure),
      cameraMs: num(camera),
      processingMs: num(processing),
      frameToPulseMs: toPulse,
      pulseMs: toPulse === null ? null : num(pulse),
      otherMs: num(other),
    };
  };
  const fps = num(timing.fps);
  const exposureSeconds = num(status.exposureSeconds);
  return {
    fps: fps > 0 ? fps : null,
    cycles,
    median: part(
      timing.cycleMs,
      timing.exposureMs,
      timing.cameraMs,
      timing.processingMs,
      timing.frameToPulseMs,
      timing.pulseMs,
      timing.otherMs
    ),
    last: part(
      timing.lastCycleMs,
      exposureSeconds > 0 ? exposureSeconds * 1000 : null,
      timing.lastCameraMs,
      timing.lastProcessingMs,
      timing.lastFrameToPulseMs,
      timing.lastPulseMs,
      timing.lastOtherMs
    ),
  };
}

/** A duration given in ms: '1.25 s' from a second on, '12 ms', '3.4 ms' below 10 ms; '–' when missing. */
export function formatMs(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '–';
  const value = Number(ms);
  if (value >= 1000) return `${fmt(value / 1000, 2)} s`;
  return `${fmt(value, value < 10 ? 1 : 0)} ms`;
}

/** Frames per second: two decimals below 10 fps, else one; '–' when missing. */
export function formatFps(fps) {
  if (fps === null || fps === undefined || !Number.isFinite(Number(fps))) return '–';
  return fmt(fps, Number(fps) < 10 ? 2 : 1);
}

const SETTINGS_TEXT_BASE = 'components.guider.native.settings';
const ALERTS_TEXT_BASE = 'components.guider.native.alerts';

/** The translation of key, else the fallback (the backend's English text for keys it doesn't know). */
/** t(key) when the locale has it, else `fallback` (e.g. the backend's own English text). */
export function textOr({ t, te }, key, fallback) {
  return te(key) ? t(key) : fallback;
}

/** Display label of an enum setting's option (settings.optionLabels.<setting>.<option>), else the option itself. */
export function settingOptionLabel(i18n, settingName, option) {
  return textOr(
    i18n,
    `${SETTINGS_TEXT_BASE}.optionLabels.${settingName}.${option}`,
    String(option)
  );
}

/** Label of a setting (settings.labels.<name>), else the backend's label, else the name. */
export function settingLabel(i18n, setting) {
  const name = String(setting?.name || '');
  const fallback = setting?.label || name;
  return name ? textOr(i18n, `${SETTINGS_TEXT_BASE}.labels.${name}`, fallback) : fallback;
}

/** Help text of a setting (settings.descriptions.<name>), else the backend's description. */
export function settingDescription(i18n, setting) {
  const name = String(setting?.name || '');
  const fallback = setting?.description || '';
  return name ? textOr(i18n, `${SETTINGS_TEXT_BASE}.descriptions.${name}`, fallback) : fallback;
}

/**
 * Title, explanation and fix of an alert, translated by its GuideErrorCode name
 * (alerts.<codeName>.title|explanation|fix); each falls back to the backend's English text.
 */
export function alertText(i18n, alert) {
  const codeName = String(alert?.codeName || '');
  const field = (name) => {
    const fallback = alert?.[name] || '';
    return codeName ? textOr(i18n, `${ALERTS_TEXT_BASE}.${codeName}.${name}`, fallback) : fallback;
  };
  return {
    title: field('title') || codeName,
    explanation: field('explanation'),
    fix: field('fix'),
  };
}

function decimalsOf(value) {
  const text = String(value ?? '');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return 0;
  return text.includes('.') ? text.split('.')[1].length : 0;
}

/**
 * Range, step and decimal places for a numeric setting in NumberInputPicker. The backend sends
 * only min/max (null = unbounded), so the precision is taken from the numbers it does send:
 * min, max, default and current value (ExposureSeconds min 0.01 -> 2 places). A double gets at
 * least one place, at most three; an int none.
 */
export function numericPickerSpec(setting) {
  const isInt = String(setting?.type || '').toLowerCase() === 'int';
  const finite = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));
  const decimals = isInt
    ? 0
    : Math.min(
        3,
        Math.max(
          1,
          ...[setting?.min, setting?.max, setting?.defaultValue, setting?.value].map(decimalsOf)
        )
      );
  return {
    min: finite(setting?.min) ? Number(setting.min) : -1000000,
    max: finite(setting?.max) ? Number(setting.max) : 1000000,
    step: isInt ? 1 : Number((10 ** -decimals).toFixed(decimals)),
    decimals,
  };
}

// Settings whose default value is a sentinel rather than a number of its own: Gain and Offset use
// -1 for the value of the guide camera's settings, PixelSizeUm uses 0 for the camera driver's.
const SENTINEL_DEFAULT_SETTINGS = ['Gain', 'Offset', 'PixelSizeUm'];

/**
 * The sentinel value of a setting whose default means "take it from elsewhere" (its default
 * value), or null for an ordinary setting. The form shows it as "default" like the other
 * number fields of the app instead of the raw -1 or 0.
 */
export function defaultSentinel(setting) {
  if (!SENTINEL_DEFAULT_SETTINGS.includes(setting?.name)) return null;
  const value = Number(String(setting.defaultValue ?? '').replace(',', '.'));
  return setting.defaultValue !== null && setting.defaultValue !== '' && Number.isFinite(value)
    ? value
    : null;
}

/**
 * The value a sentinel setting stands for right now, or null when it is not known: Gain and
 * Offset take the guide camera's profile value, and while that is at its default (-1) the
 * connected camera's current one; PixelSizeUm takes the connected camera's pixel size.
 */
export function sentinelEffectiveValue(name, guideCameraProfile, guideCameraInfo) {
  const connected = Boolean(guideCameraInfo?.Connected);
  const known = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));
  if (name === 'Gain' || name === 'Offset') {
    const profileValue = guideCameraProfile?.[name];
    if (known(profileValue) && Number(profileValue) >= 0) return Number(profileValue);
    const cameraValue = guideCameraInfo?.[name];
    return connected && known(cameraValue) && Number(cameraValue) >= 0 ? Number(cameraValue) : null;
  }
  if (name === 'PixelSizeUm') {
    const pixelSize = guideCameraInfo?.PixelSize;
    return connected && known(pixelSize) && Number(pixelSize) > 0 ? Number(pixelSize) : null;
  }
  return null;
}

/**
 * What the guider currently uses for a setting when that differs from the saved value, or null:
 * the Dec backlash pulse the adaptive compensation adjusted to while guiding.
 */
export function settingValueInUse(setting, status) {
  if (setting?.name !== 'BacklashPulseMs') return null;
  const inUse = status?.decBacklashPulseMs;
  if (inUse === null || inUse === undefined || !Number.isFinite(Number(inUse))) return null;
  return Number(inUse) === Number(setting.value) ? null : Number(inUse);
}

/** Identity of an alert (the guider sends no id): code, time and title. */
export function alertKey(alert) {
  return `${alert?.code ?? ''}|${alert?.timestamp ?? ''}|${alert?.title ?? ''}`;
}

/**
 * Alerts with a stable row key, oldest first. The key must not depend on the position in the
 * list: new alerts are added on top of the log, and an index-based key would close the row the
 * user just opened. Identical alerts (same code, time, title) are numbered in arrival order.
 */
export function alertRows(alerts) {
  const seen = new Map();
  return (Array.isArray(alerts) ? alerts : []).map((alert) => {
    const base = alertKey(alert);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return { alert, key: `${base}#${count}` };
  });
}

/**
 * A pier side in the UI language. NINA reports East/West/Unknown in some places and
 * pierEast/pierWest/pierUnknown in others; both spellings map to the same words.
 */
export function pierSideText(i18n, side, fallback = '–') {
  if (!side) return fallback;
  return textOr(i18n, `components.guider.native.calibration.pierSides.${side}`, String(side));
}

// The guider takes a guide star chosen in the frame only while looping without guiding.
const STAR_SELECTION_STATES = ['Looping', 'Selected'];
const GUIDING_STATES = ['Guiding', 'Calibrating', 'Paused', 'LostLock', 'Reacquiring'];

/**
 * Whether a guide star can be chosen in the frame now: { allowed: true, reason: null }, else
 * { allowed: false, reason } with reason 'coach', 'guiding' or 'notLooping'.
 */
export function starSelectionAvailability(state, coachRunning) {
  if (coachRunning) return { allowed: false, reason: 'coach' };
  if (STAR_SELECTION_STATES.includes(state)) return { allowed: true, reason: null };
  if (GUIDING_STATES.includes(state)) return { allowed: false, reason: 'guiding' };
  return { allowed: false, reason: 'notLooping' };
}

/**
 * Frame pixel { x, y } under a tap, or null outside the frame. `rect` is the on-screen rectangle
 * of the stage (Panzoom transform included); the frame is letterboxed ("contain") inside it.
 */
export function framePointFromTap(rect, frameWidth, frameHeight, clientX, clientY) {
  if (!rect?.width || !rect?.height || !frameWidth || !frameHeight) return null;
  const scale = Math.min(rect.width / frameWidth, rect.height / frameHeight);
  const left = rect.left + (rect.width - frameWidth * scale) / 2;
  const top = rect.top + (rect.height - frameHeight * scale) / 2;
  const x = (clientX - left) / scale;
  const y = (clientY - top) / scale;
  if (x < 0 || y < 0 || x >= frameWidth || y >= frameHeight) return null;
  return { x, y, scale };
}

/** Text of a rejected guide star selection: the reason's translation, else the backend's message. */
export function starSelectionErrorText(i18n, error) {
  const code = String(error?.messageCode || '');
  const fallback = error?.message || String(error || '');
  return code
    ? textOr(i18n, `components.guider.native.frame.select.errors.${code}`, fallback)
    : fallback;
}
