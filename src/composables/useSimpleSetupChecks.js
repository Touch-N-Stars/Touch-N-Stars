// What a PINS rig needs before the first night and does not have yet: a location in the profile,
// a star database for plate solving and a meridian flip timing that fits the mount. Each is
// known for sure before anything is reported, so a profile that is still loading or an older
// daemon never shows a false warning.
import { computed, watch } from 'vue';
import { apiStore } from '@/store/store';
import { hasProfileLocation } from '@/utils/location';
import { useAstapDatabases } from '@/composables/useAstapDatabases';
import { useSettingsStore } from '@/store/settingsStore';
import { CUSTOM_PRESET_ID, matchPreset } from '@/utils/meridianFlipPresets';

export function useSimpleSetupChecks() {
  const store = apiStore();
  const astap = useAstapDatabases();

  const locationMissing = computed(() => !hasProfileLocation(store.profileInfo));
  const databaseMissing = astap.missing;

  // The flip timing lives in the NINA profile; NINA's default fits no mount in particular. It
  // counts as chosen once picked (or kept) here for this profile, or when the profile holds one
  // of the presets (picked on the settings page). Done once, not every night.
  const settingsStore = useSettingsStore();
  const flipMissing = computed(() => {
    const profile = store.profileInfo;
    if (!profile?.Id || !profile.MeridianFlipSettings) return false;
    if (settingsStore.simpleMode?.flipSetupProfiles?.includes(profile.Id)) return false;
    return matchPreset(profile.MeridianFlipSettings) === CUSTOM_PRESET_ID;
  });
  function markFlipSetUp() {
    settingsStore.markMeridianFlipSetUp(store.profileInfo?.Id);
  }

  // isPINS is only known after the first poll, which may come after the page mounted.
  watch(
    () => store.isPINS,
    (isPINS) => {
      if (isPINS) astap.refresh().catch(() => {});
    },
    { immediate: true }
  );

  return { locationMissing, databaseMissing, flipMissing, markFlipSetUp };
}
