import test from 'node:test';
import assert from 'node:assert/strict';

const {
  COOLING_PRESETS,
  CUSTOM_COOLING_ID,
  FALLBACK_WARM_UP_MINUTES,
  matchCoolingPreset,
  hasOwnCoolingTiming,
  warmUpMinutes,
} = await import('@/utils/coolingPresets');

test('matchCoolingPreset recognises every preset from its minutes', () => {
  for (const p of COOLING_PRESETS) {
    assert.equal(matchCoolingPreset({ CoolingDuration: p.cool, WarmingDuration: p.warm }), p.id);
  }
});

test("NINA's default timing matches no preset, so a fresh profile is asked", () => {
  assert.equal(matchCoolingPreset({ CoolingDuration: 0, WarmingDuration: 0 }), CUSTOM_COOLING_ID);
  assert.equal(matchCoolingPreset(undefined), CUSTOM_COOLING_ID);
  assert.equal(
    matchCoolingPreset({ CoolingDuration: 'NaN', WarmingDuration: 5 }),
    CUSTOM_COOLING_ID
  );
});

test('hasOwnCoolingTiming offers only values someone set by hand', () => {
  assert.equal(hasOwnCoolingTiming({ CoolingDuration: 3, WarmingDuration: 8 }), true);
  assert.equal(hasOwnCoolingTiming({ CoolingDuration: 0, WarmingDuration: 0 }), false);
  assert.equal(hasOwnCoolingTiming({ CoolingDuration: 5, WarmingDuration: 10 }), false);
  assert.equal(hasOwnCoolingTiming({}), false);
});

test('warmUpMinutes keeps a gentle ramp when the profile has none', () => {
  assert.equal(warmUpMinutes({ WarmingDuration: 15 }), 15);
  assert.equal(warmUpMinutes({ WarmingDuration: 0 }), FALLBACK_WARM_UP_MINUTES);
  assert.equal(warmUpMinutes(undefined), FALLBACK_WARM_UP_MINUTES);
});
