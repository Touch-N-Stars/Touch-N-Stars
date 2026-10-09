// Pure helpers of the PINS native guider page (no Vue, no stores) so they can be unit tested
// with node --test. The data shapes are the camelCase DTOs of IAdvancedGuider as served by
// /api/internal-guider/* and /ws/internal-guider.

export const NATIVE_GUIDER_ID = 'InternalGuider';

/** Guider states reported by the native guider (IGuider.State / status.state). */
export const GUIDER_STATES = [
  'Stopped',
  'Looping',
  'Selected',
  'Calibrating',
  'Guiding',
  'LostLock',
  'Reacquiring',
  'Paused',
  'Failed',
];

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
 * Which controls are enabled in a state. connected=false disables everything.
 * @returns {boolean}
 */
export function canPerform(action, state, { connected = true, isCalibrated = false } = {}) {
  if (!connected) return false;
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

const SETTINGS_TEXT_BASE = 'components.guider.native.settings';
const ALERTS_TEXT_BASE = 'components.guider.native.alerts';

/** The translation of key, else the fallback (the backend's English text for keys it doesn't know). */
function textOr({ t, te }, key, fallback) {
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
