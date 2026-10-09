import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createI18n } from 'vue-i18n';
import en from '../../locales/en.json';
import {
  learningAxes,
  learningBadge,
  periodicErrorBadge,
  PERIODIC_ERROR_PHASE_TONE,
  appendMarker,
  appendSteps,
  canPerform,
  decDirection,
  groupSettings,
  alertText,
  isBasicSetting,
  isNativeGuiderSelected,
  markerFromMessage,
  saturationLevel,
  settingFormValue,
  settingApplies,
  settingDescription,
  settingLabel,
  settingOptionLabel,
  severityTone,
  signedPulse,
  snrTone,
  starProfiles,
  starTileImage,
  stateTone,
  validateSettingValue,
  windowRms,
  equipmentInUse,
  isNativeGuiderInUse,
  numericPickerSpec,
  alertRows,
  usesGuideCameraSlot,
} from '../nativeGuider.js';

test('native guider selection follows the connected device, then the chooser, then the profile', () => {
  assert.equal(
    isNativeGuiderSelected({ guiderInfo: { Connected: true, DeviceId: 'InternalGuider' } }),
    true
  );
  assert.equal(
    isNativeGuiderSelected({
      guiderInfo: { Connected: true, DeviceId: 'PHD2_Single' },
      profileGuiderName: 'InternalGuider',
    }),
    false
  );
  assert.equal(
    isNativeGuiderSelected({ guiderInfo: { Connected: false }, selectedDisplayName: 'PHD2' }),
    false
  );
  assert.equal(
    isNativeGuiderSelected({
      guiderInfo: { Connected: false },
      selectedDisplayName: 'PINS Native Guider',
    }),
    true
  );
  // The name PINS lists the device under
  assert.equal(
    isNativeGuiderSelected({
      guiderInfo: { Connected: false },
      selectedDisplayName: 'Internal Guider',
    }),
    true
  );
  assert.equal(
    isNativeGuiderSelected({
      guiderInfo: { Connected: false },
      selectedDisplayName: 'InternalGuider',
    }),
    true
  );
  assert.equal(
    isNativeGuiderSelected({ guiderInfo: {}, profileGuiderName: 'InternalGuider' }),
    true
  );
});

test('state and SNR tones', () => {
  assert.equal(stateTone('Guiding'), 'ok');
  assert.equal(stateTone('Calibrating'), 'info');
  assert.equal(stateTone('Paused'), 'warn');
  assert.equal(stateTone('LostLock'), 'danger');
  assert.equal(stateTone('Stopped'), 'idle');
  assert.equal(snrTone(5), 'danger');
  assert.equal(snrTone(15), 'warn');
  assert.equal(snrTone(20), 'ok');
  assert.equal(snrTone(null), 'idle');
  assert.equal(snrTone(NaN), 'idle');
  assert.equal(severityTone('Critical'), 'danger');
  assert.equal(severityTone('Warning'), 'warn');
  assert.equal(severityTone('Info'), 'info');
});

test('controls are enabled per state', () => {
  assert.equal(canPerform('loop', 'Stopped'), true);
  assert.equal(canPerform('loop', 'Guiding'), false);
  assert.equal(canPerform('guide', 'Looping'), true);
  assert.equal(canPerform('guide', 'Guiding'), false);
  assert.equal(canPerform('pause', 'Guiding'), true);
  assert.equal(canPerform('resume', 'Paused'), true);
  assert.equal(canPerform('resume', 'Guiding'), false);
  assert.equal(canPerform('dither', 'Looping'), false);
  assert.equal(canPerform('stop', 'Stopped'), false);
  assert.equal(canPerform('stop', 'LostLock'), true);
  assert.equal(canPerform('clearCalibration', 'Looping', { isCalibrated: true }), true);
  assert.equal(canPerform('clearCalibration', 'Looping', { isCalibrated: false }), false);
  assert.equal(canPerform('darks', 'Stopped'), true);
  assert.equal(canPerform('darks', 'Looping'), false);
  assert.equal(canPerform('loop', 'Stopped', { connected: false }), false);
});

test('appendSteps merges by frame, trims, and restarts on a new session', () => {
  let steps = appendSteps([], [{ frame: 1 }, { frame: 2 }, { frame: 3 }], 3);
  steps = appendSteps(steps, { frame: 4 }, 3);
  assert.deepEqual(
    steps.map((s) => s.frame),
    [2, 3, 4]
  );
  // Duplicate replaces, out-of-order inserts sorted.
  steps = appendSteps(steps, { frame: 3, snr: 9 }, 10);
  assert.equal(steps.find((s) => s.frame === 3).snr, 9);
  // A slightly older frame is inserted in order; a restart far below means a new session.
  steps = appendSteps(steps, { frame: 1 }, 10);
  assert.deepEqual(
    steps.map((s) => s.frame),
    [1, 2, 3, 4]
  );
  steps = appendSteps(steps, { frame: 100 }, 10);
  steps = appendSteps(steps, { frame: 1 }, 10);
  assert.deepEqual(
    steps.map((s) => s.frame),
    [1]
  );
  // Steps without frame are ignored.
  assert.equal(appendSteps([], { foo: 1 }).length, 0);
});

test('windowRms uses the standard deviation and skips settling steps', () => {
  const steps = [
    { raArcsec: 1, decArcsec: 0, raDistanceRaw: 0.5, decDistanceRaw: 0 },
    { raArcsec: -1, decArcsec: 0, raDistanceRaw: -0.5, decDistanceRaw: 0 },
    { raArcsec: 50, decArcsec: 50, isSettling: true },
  ];
  const arcsec = windowRms(steps, 'arcsec');
  assert.equal(arcsec.ra, 1);
  assert.equal(arcsec.dec, 0);
  assert.equal(arcsec.total, 1);
  assert.equal(arcsec.count, 2);
  assert.equal(windowRms(steps, 'px').ra, 0.5);
  assert.equal(windowRms([]).total, null);
});

test('signedPulse: East/North positive, West/South negative', () => {
  assert.equal(signedPulse(120, 'East'), 120);
  assert.equal(signedPulse(120, 'West'), -120);
  assert.equal(signedPulse(80, 'North'), 80);
  assert.equal(signedPulse(80, 'South'), -80);
  assert.equal(signedPulse(0, 'South'), 0);
});

test('starProfiles cuts through the star and bins the radial profile', () => {
  // 5x5 crop at (10, 20) with a peak in the middle.
  const pixels = [1, 1, 1, 1, 1, 1, 2, 3, 2, 1, 1, 3, 9, 3, 1, 1, 2, 3, 2, 1, 1, 1, 1, 1, 1];
  const p = starProfiles({ x0: 10, y0: 20, width: 5, height: 5, pixels }, 12, 22);
  assert.deepEqual(p.horizontal, [1, 3, 9, 3, 1]);
  assert.deepEqual(p.vertical, [1, 3, 9, 3, 1]);
  assert.equal(p.radial[0].r, 0);
  assert.equal(p.radial[0].value, 9);
  assert.equal(p.max, 9);
  assert.equal(p.min, 1);
  assert.equal(starProfiles(null, 0, 0), null);
});

test('starTileImage stretches from the background to the peak and marks saturated pixels', () => {
  const tile = starTileImage(
    { width: 3, height: 3, pixels: [100, 100, 100, 100, 1100, 350, 100, 100, 100] },
    16
  );
  const gray = (i) => tile.rgba[i * 4];
  assert.equal(gray(0), 0);
  assert.equal(gray(4), 255);
  assert.equal(gray(5), 128); // a quarter of the way up, square-root stretched
  assert.equal(tile.rgba[4 * 4 + 3], 255);
  assert.equal(tile.saturated, 0);

  const clipped = starTileImage({ width: 3, height: 1, pixels: [100, 65000, 100] }, 16);
  assert.deepEqual([...clipped.rgba.slice(4, 8)], [248, 113, 113, 255]);
  assert.equal(clipped.saturated, 1);
  assert.equal(starTileImage(null, 16), null);
});

test('saturationLevel is 97 % of the full scale of the bit depth', () => {
  assert.equal(saturationLevel(8), 255 * 0.97);
  assert.equal(saturationLevel(undefined), 65535 * 0.97);
});

test('settings: the Basic view follows the backend flag', () => {
  assert.equal(isBasicSetting({ name: 'ExposureSeconds', group: 'Camera', basic: false }), false);
  assert.equal(isBasicSetting({ name: 'SearchRegion', group: 'Stars', basic: true }), true);
  assert.equal(isBasicSetting({ name: 'ExposureSeconds' }), false, 'unflagged is advanced');
});

test('settings that depend on another one are shown only for the values they apply to', () => {
  const settings = [
    { name: 'RaAlgorithm', group: 'Algorithms', basic: true, type: 'enum', value: 'Predictive' },
    {
      name: 'RaAggression',
      group: 'Algorithms',
      basic: true,
      dependsOn: 'RaAlgorithm',
      appliesTo: ['Hysteresis'],
    },
    {
      name: 'RaHysteresis',
      group: 'Algorithms',
      basic: false,
      dependsOn: 'RaAlgorithm',
      appliesTo: ['Hysteresis'],
    },
    { name: 'MaxRaDurationMs', group: 'Algorithms', basic: false, dependsOn: '', appliesTo: null },
  ];
  const names = (opts) =>
    groupSettings(settings, opts).flatMap((g) => g.settings.map((s) => s.name));
  assert.deepEqual(names(), ['RaAlgorithm']);
  assert.deepEqual(names({ advanced: true }), ['RaAlgorithm', 'MaxRaDurationMs']);

  settings[0] = { ...settings[0], value: 'hysteresis' };
  assert.deepEqual(names(), ['RaAlgorithm', 'RaAggression'], 'values compare case-insensitively');
  assert.deepEqual(names({ advanced: true }), [
    'RaAlgorithm',
    'RaAggression',
    'RaHysteresis',
    'MaxRaDurationMs',
  ]);

  // Old backends without the metadata, or a dependency that is not listed: always shown.
  assert.equal(settingApplies({ name: 'X' }, settings), true);
  assert.equal(
    settingApplies({ name: 'X', dependsOn: 'Missing', appliesTo: ['A'] }, settings),
    true
  );
});

test('periodicErrorBadge shows the RA worm learning once the sky and the mount are learned', () => {
  const adapted = { name: 'Predictive', phase: 'Adapted', progress: 1 };
  const pe = { phase: 'Learning', progress: 0.314 };
  assert.equal(periodicErrorBadge(null), null);
  assert.equal(periodicErrorBadge({ raAlgorithmState: adapted }), null);
  assert.deepEqual(periodicErrorBadge({ raAlgorithmState: { ...adapted, periodicError: pe } }), {
    percent: 31,
  });
  assert.equal(
    periodicErrorBadge({
      raAlgorithmState: { ...adapted, phase: 'Learning', progress: 0.5, periodicError: pe },
    }),
    null,
    'the sky & mount chip comes first'
  );
  for (const phase of ['Off', 'Ready', 'Predicting', 'Negligible']) {
    assert.equal(
      periodicErrorBadge({ raAlgorithmState: { ...adapted, periodicError: { ...pe, phase } } }),
      null
    );
  }
});

test('every periodic-error phase has a label in every locale, Negligible its line too', () => {
  const dir = new URL('../../locales/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.equal(files.length, 14);
  assert.equal(PERIODIC_ERROR_PHASE_TONE.Negligible, 'idle');
  for (const file of files) {
    const periodic = JSON.parse(readFileSync(new URL(file, dir), 'utf8')).components.guider.native
      .stats.predictive.periodic;
    for (const phase of Object.keys(PERIODIC_ERROR_PHASE_TONE)) {
      assert.ok(periodic.phases[phase], `${file}: phases.${phase}`);
    }
    assert.ok(periodic.negligible, `${file}: negligible`);
  }
});

test('learningAxes and learningBadge report learning algorithms only', () => {
  assert.deepEqual(learningAxes(null), []);
  assert.deepEqual(learningAxes({ raAlgorithmState: null, decAlgorithmState: null }), []);
  assert.equal(learningBadge({ raAlgorithmState: null }), null);

  const ra = { name: 'Predictive', phase: 'Learning', progress: 0.456 };
  const dec = { name: 'Predictive', phase: 'Learning', progress: 0.62 };
  assert.deepEqual(
    learningAxes({ raAlgorithmState: ra, decAlgorithmState: dec }).map((a) => a.axis),
    ['RA', 'Dec']
  );
  assert.deepEqual(learningBadge({ raAlgorithmState: ra, decAlgorithmState: dec }), {
    percent: 45,
    axes: ['RA', 'Dec'],
  });
  assert.deepEqual(
    learningBadge({
      raAlgorithmState: { ...ra, phase: 'Adapted', progress: 1 },
      decAlgorithmState: dec,
    }),
    { percent: 62, axes: ['Dec'] }
  );
  assert.equal(
    learningBadge({ raAlgorithmState: { ...ra, phase: 'Adapted', progress: 1 } }),
    null,
    'nothing to say once adapted'
  );
});

test('groupSettings orders known groups first and filters basic', () => {
  const settings = [
    { name: 'A', group: 'Safety', basic: true },
    { name: 'B', group: 'Camera', basic: true },
    { name: 'C', group: 'Zeta', basic: false },
    { name: 'D', group: 'Algorithms', basic: false },
  ];
  assert.deepEqual(
    groupSettings(settings).map((g) => g.group),
    ['Camera', 'Safety']
  );
  assert.deepEqual(
    groupSettings(settings, { advanced: true }).map((g) => g.group),
    ['Camera', 'Algorithms', 'Safety', 'Zeta']
  );
});

test('validateSettingValue checks type and range', () => {
  const exposure = { type: 'double', min: 0.05, max: 30 };
  assert.deepEqual(validateSettingValue(exposure, '1,5'), { ok: true, value: 1.5 });
  assert.equal(validateSettingValue(exposure, '').error, 'required');
  assert.equal(validateSettingValue(exposure, 'abc').error, 'number');
  assert.deepEqual(validateSettingValue(exposure, '60'), {
    ok: false,
    error: 'max',
    params: { max: 30 },
  });
  assert.equal(validateSettingValue({ type: 'int', min: 1 }, '2.5').error, 'integer');
  assert.equal(validateSettingValue({ type: 'int', min: 1 }, '0').error, 'min');
  assert.deepEqual(validateSettingValue({ type: 'bool' }, 'true'), { ok: true, value: true });
  assert.equal(
    validateSettingValue({ type: 'enum', options: ['Auto', 'Off'] }, 'North').error,
    'option'
  );
  assert.deepEqual(validateSettingValue({ type: 'string' }, 'x'), { ok: true, value: 'x' });
  assert.equal(settingFormValue({ type: 'bool', value: 'True' }), true);
  assert.equal(settingFormValue({ type: 'double', value: '1.5' }), '1.5');
});

test('graph markers from feed messages', () => {
  const ts = '2026-09-23T21:00:00Z';
  assert.equal(markerFromMessage({ type: 'dither', timestamp: ts }).kind, 'dither');
  assert.equal(markerFromMessage({ type: 'starlost', timestamp: ts }).kind, 'starlost');
  assert.equal(
    markerFromMessage({ type: 'settle', timestamp: ts, payload: { status: 'done' } }).kind,
    'settled'
  );
  assert.equal(
    markerFromMessage({ type: 'settle', timestamp: ts, payload: { status: 'settling' } }),
    null
  );
  assert.equal(
    markerFromMessage({ type: 'calibration', timestamp: ts, payload: { raAngleDeg: 10 } }).kind,
    'calibration'
  );
  assert.equal(markerFromMessage({ type: 'calibration', timestamp: ts, payload: {} }), null);
  assert.equal(markerFromMessage({ type: 'step', timestamp: ts }), null);
  assert.equal(markerFromMessage({ type: 'dither' }), null);
  const markers = appendMarker([{ t: 1 }, { t: 2 }], { t: 3 }, 2);
  assert.deepEqual(
    markers.map((m) => m.t),
    [2, 3]
  );
});

test('frame level warnings: saturated before flat before a saturated share', async () => {
  const { frameLevelWarning } = await import('../nativeGuider.js');
  const saturated = frameLevelWarning({
    min: 65520,
    median: 65520,
    max: 65520,
    fullScale: 65535,
    saturatedPercent: 100,
    flat: true,
  });
  assert.equal(saturated.kind, 'saturated');
  assert.equal(saturated.percent, 100);

  const flat = frameLevelWarning({
    min: 212,
    median: 214.4,
    max: 215,
    fullScale: 65535,
    saturatedPercent: 0,
    flat: true,
  });
  assert.deepEqual(flat, { kind: 'flat', percent: 0, level: 214, fullScale: 65535 });

  assert.equal(frameLevelWarning({ saturatedPercent: 7.5, flat: false }).kind, 'partlySaturated');
  assert.equal(frameLevelWarning({ saturatedPercent: 0.2, flat: false }), null);
  assert.equal(frameLevelWarning(null), null);
});

test('decDirection reports the Dec direction of the Drift mode only', () => {
  assert.equal(decDirection(null), null);
  assert.equal(decDirection({ decDrift: null }), null, 'another Dec guide mode');
  assert.equal(decDirection({ decDrift: { direction: 'Sideways' } }), null, 'unknown direction');
  assert.deepEqual(
    decDirection({
      decDrift: { direction: 'Both', driftArcsecPerMin: null, safetyValveOpen: false },
    }),
    { direction: 'Both', driftArcsecPerMin: null, valveOpen: false, tone: 'info' }
  );
  assert.deepEqual(
    decDirection({
      decDrift: { direction: 'North', driftArcsecPerMin: -0.84, safetyValveOpen: false },
    }),
    { direction: 'North', driftArcsecPerMin: 0.84, valveOpen: false, tone: 'ok' }
  );
  assert.equal(
    decDirection({
      decDrift: { direction: 'South', driftArcsecPerMin: 0.5, safetyValveOpen: true },
    }).tone,
    'warn'
  );
});

test('settingOptionLabel translates known options and keeps the others', () => {
  const texts = {
    'components.guider.native.settings.optionLabels.DecGuideMode.Drift': 'Drift – follow',
  };
  const i18n = { t: (k) => texts[k], te: (k) => k in texts };
  assert.equal(settingOptionLabel(i18n, 'DecGuideMode', 'Drift'), 'Drift – follow');
  assert.equal(settingOptionLabel(i18n, 'DecGuideMode', 'Sideways'), 'Sideways');
  assert.equal(settingOptionLabel(i18n, 'NoiseReduction', 'None'), 'None');
});

const english = createI18n({ legacy: false, locale: 'en', messages: { en } }).global;

test('setting labels and descriptions are translated by name, else the backend text', () => {
  const exposure = { name: 'ExposureSeconds', label: 'Exposure (backend)', description: '' };
  assert.equal(settingLabel(english, exposure), 'Exposure');
  const gain = { name: 'Gain', label: 'Gain', description: 'backend text' };
  assert.match(settingDescription(english, gain), /^-1 keeps the driver's current gain/);
  const future = { name: 'FutureSetting', label: 'Future setting', description: 'Does X.' };
  assert.equal(settingLabel(english, future), 'Future setting');
  assert.equal(settingDescription(english, future), 'Does X.');
  assert.equal(settingLabel(english, { name: 'Unlabelled' }), 'Unlabelled');
  assert.equal(settingDescription(english, { name: 'Offset2' }), '');
});

test('alert texts are translated by code name, each field falling back to the backend', () => {
  const lost = { codeName: 'StarLost', title: 'x', explanation: 'x', fix: 'x' };
  assert.deepEqual(alertText(english, lost), {
    title: en.components.guider.native.alerts.StarLost.title,
    explanation: en.components.guider.native.alerts.StarLost.explanation,
    fix: en.components.guider.native.alerts.StarLost.fix,
  });
  const future = { codeName: 'FutureCode', title: 'New alert', explanation: 'Why', fix: '' };
  assert.deepEqual(alertText(english, future), { title: 'New alert', explanation: 'Why', fix: '' });
  assert.equal(alertText(english, { codeName: 'FutureCode' }).title, 'FutureCode');
  assert.equal(alertText(english, { title: 'Only a title' }).title, 'Only a title');
});

test('every locale translates the backend texts, and each one renders as it is', () => {
  const dir = new URL('../../locales/', import.meta.url);
  const native = en.components.guider.native;
  const groups = {
    'settings.labels': native.settings.labels,
    'settings.descriptions': native.settings.descriptions,
    alerts: native.alerts,
    'controls.actions': native.controls.actions,
  };
  const leaves = (object, prefix) =>
    Object.entries(object).flatMap(([key, value]) =>
      typeof value === 'object' ? leaves(value, `${prefix}.${key}`) : [`${prefix}.${key}`]
    );
  const keys = Object.entries(groups).flatMap(([path, object]) => leaves(object, path));
  assert.ok(keys.length > 200, `${keys.length} keys`);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const locale = file.replace('.json', '');
    const messages = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    const { t, te } = createI18n({
      legacy: false,
      locale,
      messages: { [locale]: messages },
    }).global;
    for (const key of keys) {
      const full = `components.guider.native.${key}`;
      assert.ok(te(full), `${file}: ${key}`);
      const raw = full.split('.').reduce((node, part) => node[part], messages);
      assert.equal(t(full), raw, `${file}: ${key} renders unchanged`);
    }
  }
});

test('the guide camera slot is used only by the native guider, and only where PINS has it', () => {
  const pinsProfile = (guider) => ({
    GuideCameraSettings: { Id: 'ZWO ASI120MM' },
    GuiderSettings: { GuiderName: guider },
  });
  const native = { profileInfo: pinsProfile('InternalGuider'), guiderInfo: { Connected: false } };
  const phd2 = { profileInfo: pinsProfile('PHD2_Single'), guiderInfo: { Connected: false } };
  const nina = {
    profileInfo: { GuiderSettings: { GuiderName: 'InternalGuider' } },
    guiderInfo: { Connected: false },
  };

  assert.equal(isNativeGuiderInUse(native), true);
  assert.equal(usesGuideCameraSlot(native), true);
  assert.equal(usesGuideCameraSlot(phd2), false);
  assert.equal(usesGuideCameraSlot(phd2, 'Internal Guider'), true, 'the chooser decides first');
  assert.equal(usesGuideCameraSlot(native, 'PHD2'), false);
  assert.equal(usesGuideCameraSlot(nina), false, 'official NINA has no slot');
  assert.equal(
    usesGuideCameraSlot({
      profileInfo: pinsProfile('PHD2_Single'),
      guiderInfo: { Connected: true, DeviceId: 'InternalGuider' },
    }),
    true,
    'the connected guider wins over the profile'
  );
});

test('"connect all" leaves the guide camera slot alone unless the native guider uses it', () => {
  const list = [
    { apiName: 'camera', id: 'cam' },
    { apiName: 'guidecamera', id: 'guide' },
    { apiName: 'guider', id: 'PHD2_Single' },
  ];
  assert.deepEqual(
    equipmentInUse(list, { guideCameraSlot: false }).map((d) => d.apiName),
    ['camera', 'guider']
  );
  assert.equal(equipmentInUse(list, { guideCameraSlot: true }).length, 3);
  assert.deepEqual(equipmentInUse(undefined, { guideCameraSlot: true }), []);
});

test('numeric settings get a picker range and precision from the numbers the backend sends', () => {
  assert.deepEqual(
    numericPickerSpec({ type: 'double', min: 0.01, max: 30, defaultValue: '2', value: '2.5' }),
    { min: 0.01, max: 30, step: 0.01, decimals: 2 }
  );
  assert.deepEqual(
    numericPickerSpec({ type: 'double', min: 0, max: 10000, defaultValue: '0', value: '240' }),
    { min: 0, max: 10000, step: 0.1, decimals: 1 },
    'a double keeps one decimal place even when all numbers are whole'
  );
  assert.deepEqual(numericPickerSpec({ type: 'int', min: 1, max: 50, value: '5' }), {
    min: 1,
    max: 50,
    step: 1,
    decimals: 0,
  });
  const unbounded = numericPickerSpec({ type: 'double', min: null, max: null, value: '0.12345' });
  assert.equal(unbounded.decimals, 3, 'at most three places');
  assert.ok(unbounded.min < -1000 && unbounded.max > 1000);
});

test('alert rows keep their key when newer alerts arrive', () => {
  const a = { code: 301, timestamp: '2026-10-09T20:00:00Z', title: 'Star lost' };
  const b = { code: 1, timestamp: '2026-10-09T20:01:00Z', title: 'Info' };
  const before = alertRows([a, b]);
  const after = alertRows([a, b, { ...a, timestamp: '2026-10-09T20:02:00Z' }]);
  assert.equal(after[0].key, before[0].key);
  assert.equal(after[1].key, before[1].key);

  const twins = alertRows([a, a]);
  assert.notEqual(twins[0].key, twins[1].key, 'identical alerts still get distinct keys');
});
