// What a PINS rig needs before the first night and does not have yet: a location in the profile
// and a star database for plate solving. Both are known for sure before anything is reported,
// so a profile that is still loading or an older daemon never shows a false warning.
import { computed, watch } from 'vue';
import { apiStore } from '@/store/store';
import { hasProfileLocation } from '@/utils/location';
import { useAstapDatabases } from '@/composables/useAstapDatabases';

export function useSimpleSetupChecks() {
  const store = apiStore();
  const astap = useAstapDatabases();

  const locationMissing = computed(() => !hasProfileLocation(store.profileInfo));
  const databaseMissing = astap.missing;

  // isPINS is only known after the first poll, which may come after the page mounted.
  watch(
    () => store.isPINS,
    (isPINS) => {
      if (isPINS) astap.refresh().catch(() => {});
    },
    { immediate: true }
  );

  return { locationMissing, databaseMissing };
}
