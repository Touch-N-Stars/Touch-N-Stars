import { computed, ref, watch } from 'vue';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';

// Module-level so the Software tab (repository switch) and the Upgrade tab (the
// "updates available" hint) share one result.
const updatesCheckResult = ref(null);
const isCheckingUpdates = ref(false);

/** Pending system package updates on the PINS host. */
export function usePinsUpdates({ t, runner, loadOnPins = false }) {
  const store = apiStore();
  const { appendLog, getIp } = runner;

  const availableUpdatePackages = computed(() => {
    const packages = updatesCheckResult.value?.packages || [];
    return packages.filter((pkg) => pkg.updateAvailable);
  });

  async function checkUpdates() {
    if (!getIp() || isCheckingUpdates.value) return;

    isCheckingUpdates.value = true;
    try {
      updatesCheckResult.value = (await apiPinsService.getPinsUpdatesCheck()) || null;
    } catch (error) {
      console.error(error);
      appendLog(t('plugins.pins.logs.updateCheckFailed', { message: error.message }));
    } finally {
      isCheckingUpdates.value = false;
    }
  }

  if (loadOnPins) {
    watch(
      () => store.isPINS,
      (isPins) => {
        if (isPins) checkUpdates();
      },
      { immediate: true }
    );
  }

  return {
    updatesCheckResult,
    isCheckingUpdates,
    availableUpdatePackages,
    checkUpdates,
  };
}
