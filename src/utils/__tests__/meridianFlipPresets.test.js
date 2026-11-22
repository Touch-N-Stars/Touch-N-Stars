import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MERIDIAN_FLIP_PRESETS,
  matchPreset,
  isPierSideKnown,
  presetProfileChanges,
  nearestTransitMs,
  plannedMeridianFlip,
} = await import('@/utils/meridianFlipPresets');
const { localSiderealTimeDeg } = await import('@/utils/astronomy');

test('matchPreset recognises every preset from its minute values', () => {
  for (const p of MERIDIAN_FLIP_PRESETS) {
    const settings = {
      PauseTimeBeforeMeridian: p.pause,
      MinutesAfterMeridian: p.min,
      MaxMinutesAfterMeridian: p.max,
    };
    assert.equal(matchPreset(settings), p.id);
  }
});

test('matchPreset falls back to custom for other values and missing settings', () => {
  assert.equal(
    matchPreset({
      PauseTimeBeforeMeridian: 0,
      MinutesAfterMeridian: 5,
      MaxMinutesAfterMeridian: 16,
    }),
    'custom'
  );
  assert.equal(matchPreset(null), 'custom');
});

test('isPierSideKnown accepts only real pier sides', () => {
  assert.equal(isPierSideKnown('pierEast'), true);
  assert.equal(isPierSideKnown('pierWest'), true);
  assert.equal(isPierSideKnown('pierUnknown'), false);
  assert.equal(isPierSideKnown(undefined), false);
});

test('presetProfileChanges writes the minutes and turns recenter on', () => {
  const changes = Object.fromEntries(presetProfileChanges('few', { Connected: false }));
  assert.deepEqual(changes, {
    'MeridianFlipSettings-PauseTimeBeforeMeridian': 0,
    'MeridianFlipSettings-MinutesAfterMeridian': 5,
    'MeridianFlipSettings-MaxMinutesAfterMeridian': 15,
    'MeridianFlipSettings-Recenter': true,
  });
});

test('presetProfileChanges sets side of pier only for a connected mount', () => {
  const reporting = Object.fromEntries(
    presetProfileChanges('few', { Connected: true, SideOfPier: 'pierWest' })
  );
  assert.equal(reporting['MeridianFlipSettings-UseSideOfPier'], true);

  const silent = Object.fromEntries(
    presetProfileChanges('few', { Connected: true, SideOfPier: 'pierUnknown' })
  );
  assert.equal(silent['MeridianFlipSettings-UseSideOfPier'], false);
});

test('presetProfileChanges ignores an unknown preset', () => {
  assert.deepEqual(presetProfileChanges('custom', { Connected: true }), []);
});

// --- plannedMeridianFlip -------------------------------------------------------------------------

const LON = 12.5;
const NOW = Date.UTC(2026, 10, 22, 20, 0, 0);
const MIN = 60000;
const SIDEREAL_HOUR_MS = 3600000 * 0.9972695663;
// A target that culminates `hours` sidereal hours after NOW
const raCulminatingIn = (hours) => (localSiderealTimeDeg(new Date(NOW), LON) + hours * 15) % 360;
const FEW = { PauseTimeBeforeMeridian: 0, MinutesAfterMeridian: 5, MaxMinutesAfterMeridian: 15 };

test('nearestTransitMs finds the culmination before or after the given time', () => {
  const east = nearestTransitMs(raCulminatingIn(2), LON, NOW);
  assert.ok(Math.abs(east - (NOW + 2 * SIDEREAL_HOUR_MS)) < 1000);
  const west = nearestTransitMs(raCulminatingIn(-3), LON, NOW);
  assert.ok(Math.abs(west - (NOW - 3 * SIDEREAL_HOUR_MS)) < 1000);
});

test('plannedMeridianFlip: a target imaged across its flip window flips', () => {
  const flip = plannedMeridianFlip(
    [{ raDeg: raCulminatingIn(1), startMs: NOW, endMs: NOW + 3 * 3600000 }],
    { lonDeg: LON, settings: FEW }
  );
  assert.equal(flip.index, 0);
  assert.ok(Math.abs(flip.meridianMs - (NOW + SIDEREAL_HOUR_MS)) < 1000);
  assert.equal(flip.earliestMs - flip.meridianMs, 5 * MIN);
  assert.equal(flip.latestMs - flip.meridianMs, 15 * MIN);
  assert.equal(flip.pauseMs, null);
});

test('plannedMeridianFlip: no flip when the plan leaves the target before it is due', () => {
  const settings = FEW;
  // Ends 2 min after the meridian, before the earliest flip at +5
  const endsEarly = [
    { raDeg: raCulminatingIn(1), startMs: NOW, endMs: NOW + SIDEREAL_HOUR_MS + 2 * MIN },
  ];
  assert.equal(plannedMeridianFlip(endsEarly, { lonDeg: LON, settings }), null);
  // Already west of the meridian when the plan gets there
  const west = [{ raDeg: raCulminatingIn(-1), startMs: NOW, endMs: NOW + 4 * 3600000 }];
  assert.equal(plannedMeridianFlip(west, { lonDeg: LON, settings }), null);
});

test('plannedMeridianFlip: a pause before the meridian makes the flip due earlier', () => {
  const barely = {
    PauseTimeBeforeMeridian: 2,
    MinutesAfterMeridian: 0,
    MaxMinutesAfterMeridian: 2,
  };
  // Imaging ends 1 min before the meridian: inside the pause, so the pause still hits it
  const targets = [
    { raDeg: raCulminatingIn(1), startMs: NOW, endMs: NOW + SIDEREAL_HOUR_MS - 1 * MIN },
  ];
  const flip = plannedMeridianFlip(targets, { lonDeg: LON, settings: barely });
  assert.equal(flip.meridianMs - flip.pauseMs, 2 * MIN);
  assert.equal(flip.earliestMs, flip.meridianMs);
});

test('plannedMeridianFlip: the first target that flips counts, unusable ones are skipped', () => {
  const targets = [
    { raDeg: null, startMs: NOW, endMs: NOW + 3600000 },
    { raDeg: raCulminatingIn(-2), startMs: NOW + 3600000, endMs: NOW + 2 * 3600000 },
    { raDeg: raCulminatingIn(3), startMs: NOW + 2 * 3600000, endMs: NOW + 5 * 3600000 },
  ];
  assert.equal(plannedMeridianFlip(targets, { lonDeg: LON, settings: FEW }).index, 2);
  // Without a site longitude there is no answer
  assert.equal(plannedMeridianFlip(targets, { lonDeg: null, settings: FEW }), null);
  // A latest time below the earliest counts as equal to it, like NINA does
  const flip = plannedMeridianFlip(targets, {
    lonDeg: LON,
    settings: { MinutesAfterMeridian: 10, MaxMinutesAfterMeridian: 3 },
  });
  assert.equal(flip.latestMs, flip.earliestMs);
});
