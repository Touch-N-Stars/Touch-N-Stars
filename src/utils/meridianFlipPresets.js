// Beginner presets for NINA's meridian flip timing (Options > Imaging > Auto Meridian Flip).
// Each preset answers "how far can the mount track past the meridian?" with the three
// minute values NINA needs. Per the NINA docs, a pause before the meridian is only for
// equipment that cannot pass it, and min < max gives a flip window without downtime.

export const MERIDIAN_FLIP_PRESETS = [
  { id: 'barely', pause: 2, min: 0, max: 2 },
  { id: 'few', pause: 0, min: 5, max: 15 },
  { id: 'lots', pause: 0, min: 10, max: 30 },
];

export const CUSTOM_PRESET_ID = 'custom';

// Returns the id of the preset whose minute values equal the stored settings, or 'custom'.
export function matchPreset(settings) {
  if (!settings) return CUSTOM_PRESET_ID;
  const preset = MERIDIAN_FLIP_PRESETS.find(
    (p) =>
      Number(settings.PauseTimeBeforeMeridian) === p.pause &&
      Number(settings.MinutesAfterMeridian) === p.min &&
      Number(settings.MaxMinutesAfterMeridian) === p.max
  );
  return preset ? preset.id : CUSTOM_PRESET_ID;
}

// 'pierEast' / 'pierWest' are real answers; 'pierUnknown' or a missing field are not.
export function isPierSideKnown(sideOfPier) {
  return sideOfPier === 'pierEast' || sideOfPier === 'pierWest';
}

// Profile writes for a preset as [settingKey, value] pairs. UseSideOfPier is only touched
// while the mount is connected, because only then do we know whether it reports a side.
export function presetProfileChanges(presetId, mountInfo) {
  const preset = MERIDIAN_FLIP_PRESETS.find((p) => p.id === presetId);
  if (!preset) return [];

  const changes = [
    ['MeridianFlipSettings-PauseTimeBeforeMeridian', preset.pause],
    ['MeridianFlipSettings-MinutesAfterMeridian', preset.min],
    ['MeridianFlipSettings-MaxMinutesAfterMeridian', preset.max],
    ['MeridianFlipSettings-Recenter', true],
  ];
  if (mountInfo?.Connected) {
    changes.push(['MeridianFlipSettings-UseSideOfPier', isPierSideKnown(mountInfo.SideOfPier)]);
  }
  return changes;
}
