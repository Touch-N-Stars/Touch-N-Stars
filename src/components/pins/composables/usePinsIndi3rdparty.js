import { computed, ref, watch } from 'vue';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import {
  buildIndiInstallPayload,
  extractIndiInstallErrorDetail,
  parseIndiInstallJobId,
} from './indiInstallUtils';

/** Search and install 3rd party INDI driver packages (Software tab). */
export function usePinsIndi3rdparty({ t, runner }) {
  const store = apiStore();
  const toastStore = useToastStore();
  const { status, isBusy, appendLog, getIp } = runner;

  const drivers = ref([]);
  const isLoading = ref(false);
  const isInstalling = ref(false);
  const searchQuery = ref('');
  const selectedAsset = ref('');
  const showInstallModal = ref(false);
  const showRegistryModal = ref(false);
  const installError = ref('');

  const selectedDriver = computed(
    () => drivers.value.find((pkg) => pkg.assetName === selectedAsset.value) || null
  );

  async function loadDrivers() {
    if (!getIp() || isLoading.value) return;

    isLoading.value = true;
    try {
      const response = await apiPinsService.getPinsIndi3rdpartyPackages({
        onlyNotInstalled: true,
        q: searchQuery.value?.trim() ? searchQuery.value.trim() : undefined,
      });

      const packages = response?.packages || [];
      drivers.value = packages;

      if (!packages.some((pkg) => pkg.assetName === selectedAsset.value)) {
        selectedAsset.value = packages[0]?.assetName || '';
      }
    } catch (error) {
      console.error(error);
      appendLog(t('plugins.pins.logs.indi3rdpartyLoadFailed', { message: error.message }));
    } finally {
      isLoading.value = false;
    }
  }

  function openInstallModal() {
    if (isBusy.value || isInstalling.value || !selectedDriver.value) return;

    installError.value = '';
    showInstallModal.value = true;
  }

  function closeInstallModal() {
    if (isInstalling.value) return;

    showInstallModal.value = false;
    installError.value = '';
  }

  function openRegistryModal() {
    if (isBusy.value) return;
    showRegistryModal.value = true;
  }

  async function installDriver(formInput) {
    if (isBusy.value || isInstalling.value || !selectedDriver.value) return;

    let payload;
    try {
      payload = buildIndiInstallPayload(selectedDriver.value, formInput || {});
    } catch (error) {
      installError.value = error.message;
      return;
    }

    const ip = runner.beginOperation('indi3rdparty');
    if (!ip) return;
    appendLog(t('plugins.pins.logs.indi3rdpartyInstallStart', { assetName: payload.assetName }));

    installError.value = '';
    isInstalling.value = true;
    try {
      const data = await apiPinsService.installPinsIndi3rdparty(payload);
      const returnedJobId = parseIndiInstallJobId(data);

      showInstallModal.value = false;
      toastStore.showToast({
        type: 'success',
        title: t('plugins.pins.indiInstallModalTitle'),
        message: returnedJobId
          ? t('plugins.pins.indiInstallModalSuccessStarted', { label: payload.label })
          : t('plugins.pins.indiInstallModalSuccessCompleted', { label: payload.label }),
        autoClose: true,
      });

      if (returnedJobId) {
        appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
        runner.followJobLog(ip, returnedJobId);
      } else {
        appendLog(
          t('plugins.pins.logs.indi3rdpartyInstallSuccess', {
            message: data?.message || JSON.stringify(data),
          })
        );
        status.value = 'Success';
      }

      await loadDrivers();
    } catch (error) {
      console.error(error);
      const errorDetail = extractIndiInstallErrorDetail(error);
      installError.value = errorDetail;
      status.value = 'Failed';
      appendLog(t('plugins.pins.logs.indi3rdpartyInstallFailed', { message: errorDetail }));
      runner.logServerError(error);
    } finally {
      isInstalling.value = false;
    }
  }

  watch(
    () => store.isPINS,
    (isPins) => {
      if (isPins) loadDrivers();
    },
    { immediate: true }
  );

  return {
    drivers,
    isLoading,
    isInstalling,
    searchQuery,
    selectedAsset,
    selectedDriver,
    showInstallModal,
    showRegistryModal,
    installError,
    loadDrivers,
    openInstallModal,
    closeInstallModal,
    openRegistryModal,
    installDriver,
  };
}
