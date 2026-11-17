import test from 'node:test';
import assert from 'node:assert/strict';

const { MERIDIAN_FLIP_PRESETS, matchPreset, isPierSideKnown, presetProfileChanges } =
  await import('@/utils/meridianFlipPresets');

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
