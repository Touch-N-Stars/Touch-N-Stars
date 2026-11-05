<template>
  <div class="flex flex-col gap-3">
    <PinsIndi3rdpartyCard
      :drivers="drivers"
      :loading="isLoadingDrivers"
      :installing="isInstalling"
      :search-query="searchQuery"
      :selected-asset="selectedAsset"
      @refresh="loadDrivers"
      @search="loadDrivers"
      @install="openInstallModal"
      @edit-config="showRegistryModal = true"
      @update:search-query="searchQuery = $event"
      @update:selected-asset="selectedAsset = $event"
    />

    <p v-if="installStatus" class="text-sm text-content-muted break-words">{{ installStatus }}</p>

    <!-- zIndex must clear the wizard overlay (z-overlay) but stay under the PINS
         upgrade overlay (z-dialog) - all of these teleport to body. -->
    <PinsIndiInstallConfirmModal
      :show="showInstallModal"
      :selected-item="selectedDriver"
      :installing="isInstalling"
      :error-message="installError"
      zIndex="z-overlay-modal"
      @close="closeInstallModal"
      @confirm="installDriver"
    />

    <PinsIndiRegistryEditModal
      :show="showRegistryModal"
      zIndex="z-overlay-modal"
      @close="showRegistryModal = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiPinsService from '@/services/apiPinsService';
import PinsIndi3rdpartyCard from '@/components/pins/PinsIndi3rdpartyCard.vue';
import PinsIndiInstallConfirmModal from '@/components/pins/PinsIndiInstallConfirmModal.vue';
import PinsIndiRegistryEditModal from '@/components/pins/PinsIndiRegistryEditModal.vue';
import {
  buildIndiInstallPayload,
  extractIndiInstallErrorDetail,
  parseIndiInstallJobId,
} from '@/components/pins/composables/indiInstallUtils';
import { pollJobUntilFinished } from '@/components/pins/composables/pinsJobPolling';

/**
 * Search, confirm and install a 3rd party INDI driver package.
 * Every device step of the wizard offers the same panel behind its
 * "device not listed?" toggle - only the search seed and the message
 * keys differ.
 */
const props = defineProps({
  // Biases the initial package list towards this device, e.g. 'mount'.
  // The user can clear the search field to widen it again.
  searchSeed: { type: String, default: '' },
  // i18n prefix holding installing/installSuccess/installFailed,
  // e.g. 'components.setupWizard.focuser'
  labelPrefix: { type: String, required: true },
});

const emit = defineEmits(['installed']);

const { t } = useI18n();

const drivers = ref([]);
const isLoadingDrivers = ref(false);
const searchQuery = ref('');
const selectedAsset = ref('');
const showInstallModal = ref(false);
const showRegistryModal = ref(false);
const isInstalling = ref(false);
const installError = ref('');
const installStatus = ref('');

const selectedDriver = computed(
  () => drivers.value.find((pkg) => pkg.assetName === selectedAsset.value) || null
);

async function loadDrivers() {
  if (isLoadingDrivers.value) return;
  isLoadingDrivers.value = true;
  try {
    const response = await apiPinsService.getPinsIndi3rdpartyPackages({
      onlyNotInstalled: true,
      q: searchQuery.value?.trim() || undefined,
    });
    const packages = response?.packages || [];
    drivers.value = packages;
    if (!packages.some((pkg) => pkg.assetName === selectedAsset.value)) {
      selectedAsset.value = packages[0]?.assetName || '';
    }
  } catch (error) {
    console.error('[PinsWizard] 3rd party driver list failed:', error);
    installStatus.value = t('components.setupWizard.driver.listFailed', {
      message: error.message,
    });
  } finally {
    isLoadingDrivers.value = false;
  }
}

function openInstallModal() {
  if (isInstalling.value || !selectedDriver.value) return;
  installError.value = '';
  showInstallModal.value = true;
}

function closeInstallModal() {
  if (isInstalling.value) return;
  showInstallModal.value = false;
  installError.value = '';
}

async function installDriver(formInput) {
  if (isInstalling.value || !selectedDriver.value) return;

  let payload;
  try {
    payload = buildIndiInstallPayload(selectedDriver.value, formInput || {});
  } catch (error) {
    installError.value = error.message;
    return;
  }

  isInstalling.value = true;
  installError.value = '';
  installStatus.value = t(`${props.labelPrefix}.installing`, { label: payload.label });

  try {
    const data = await apiPinsService.installPinsIndi3rdparty(payload);
    const jobId = parseIndiInstallJobId(data);

    if (jobId) {
      const pollResult = await pollJobUntilFinished(jobId);
      if (!pollResult.success) {
        throw new Error(pollResult.result?.status || 'unknown');
      }
    }

    showInstallModal.value = false;
    installStatus.value = t(`${props.labelPrefix}.installSuccess`, { label: payload.label });
    await loadDrivers();
    // The freshly installed driver only shows up after re-reading the INDI list.
    emit('installed');
  } catch (error) {
    console.error('[PinsWizard] 3rd party install failed:', error);
    const detail = extractIndiInstallErrorDetail(error);
    installError.value = detail;
    installStatus.value = t(`${props.labelPrefix}.installFailed`, { message: detail });
  } finally {
    isInstalling.value = false;
  }
}

// Only rendered inside the expanded "not listed?" panel, so mounting is the
// moment the user asks for the list.
onMounted(() => {
  if (props.searchSeed) searchQuery.value = props.searchSeed;
  loadDrivers();
});
</script>
