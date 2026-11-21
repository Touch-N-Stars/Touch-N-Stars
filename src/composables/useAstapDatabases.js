// The ASTAP star databases of a PINS rig: which are installed, which one suits the
// telescope and camera in the profile. Shared state, so the settings panel, the setup
// assistant and the simple mode home page agree once one of them has installed a database.
import { computed, ref } from 'vue';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import {
  fieldOfViewDeg,
  hasInstalledAstapDatabase,
  isRecommendationCovered,
  recommendAstapDatabase,
  withImageDatabase,
} from '@/utils/astapDatabases';

const packages = ref([]);
const loading = ref(false);
const loadError = ref(null);
const loaded = ref(false);
const checkedAt = ref('');

async function refresh() {
  if (loading.value) return;
  loading.value = true;
  try {
    const payload = (await apiPinsService.getAstapStarDatabases({ onlyNotInstalled: false })) || {};
    // The image's own database never shows up in the daemon's list, see withImageDatabase.
    packages.value = withImageDatabase(payload.packages);
    checkedAt.value = payload.checkedAt || '';
    loadError.value = null;
    loaded.value = true;
  } catch (error) {
    loadError.value = error;
    throw error;
  } finally {
    loading.value = false;
  }
}

export function useAstapDatabases() {
  const store = apiStore();

  const installed = computed(() => packages.value.filter((pkg) => pkg?.installed === true));
  const installable = computed(() => packages.value.filter((pkg) => pkg?.installed !== true));
  /** true / false, or null while unknown (not loaded, older daemon). */
  const hasInstalled = computed(() =>
    loaded.value ? hasInstalledAstapDatabase(packages.value) : null
  );

  const fovDeg = computed(() => {
    const profile = store.profileInfo;
    const camera = store.cameraInfo;
    const fromCamera = camera?.Connected && camera.XSize > 0 && camera.YSize > 0;
    return fieldOfViewDeg({
      focalLengthMm: profile?.TelescopeSettings?.FocalLength,
      pixelSizeUm: profile?.CameraSettings?.PixelSize,
      widthPx: fromCamera ? camera.XSize : profile?.FramingAssistantSettings?.CameraWidth,
      heightPx: fromCamera ? camera.YSize : profile?.FramingAssistantSettings?.CameraHeight,
    });
  });
  const recommendedId = computed(() => recommendAstapDatabase(fovDeg.value));
  /** The recommended database, or a denser one serving the same fields, is already there. */
  const recommendationCovered = computed(() =>
    isRecommendationCovered(
      recommendedId.value,
      installed.value.map((pkg) => pkg.databaseId)
    )
  );

  // The rig solves with ASTAP unless the profile says otherwise; only then does a missing
  // database block polar alignment and centering.
  const usesAstap = computed(() => {
    const type = store.profileInfo?.PlateSolveSettings?.PlateSolverType;
    return store.isPINS && (!type || String(type).toUpperCase() === 'ASTAP');
  });
  /** A missing database is known for sure, so warning about it is safe. */
  const missing = computed(() => usesAstap.value && hasInstalled.value === false);

  return {
    packages,
    installed,
    installable,
    hasInstalled,
    missing,
    usesAstap,
    loading,
    loadError,
    checkedAt,
    fovDeg,
    recommendedId,
    recommendationCovered,
    refresh,
  };
}
