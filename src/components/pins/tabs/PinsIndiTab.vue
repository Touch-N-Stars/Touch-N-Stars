<template>
  <div class="flex flex-col space-y-6">
    <PinsIndi3rdpartyCard
      :drivers="drivers"
      :loading="isDriversLoading"
      :installing="isDriverInstalling"
      :search-query="searchQuery"
      :selected-asset="selectedAsset"
      :disabled="isBusy"
      @refresh="loadDrivers"
      @search="loadDrivers"
      @install="openInstallModal"
      @edit-config="openRegistryModal"
      @update:search-query="searchQuery = $event"
      @update:selected-asset="selectedAsset = $event"
    />

    <PinsIndiInstallConfirmModal
      :show="showInstallModal"
      :selected-item="selectedDriver"
      :installing="isDriverInstalling"
      :error-message="installError"
      @close="closeInstallModal"
      @confirm="installDriver"
    />

    <PinsIndiRegistryEditModal
      :show="showRegistryModal"
      :disabled="isBusy"
      @close="showRegistryModal = false"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import PinsIndi3rdpartyCard from '../PinsIndi3rdpartyCard.vue';
import PinsIndiInstallConfirmModal from '../PinsIndiInstallConfirmModal.vue';
import PinsIndiRegistryEditModal from '../PinsIndiRegistryEditModal.vue';
import { usePinsJobRunner } from '../composables/usePinsJobRunner';
import { usePinsIndi3rdparty } from '../composables/usePinsIndi3rdparty';

const { t } = useI18n();
const runner = usePinsJobRunner({ t });
const { isBusy } = runner;

const {
  drivers,
  isLoading: isDriversLoading,
  isInstalling: isDriverInstalling,
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
} = usePinsIndi3rdparty({ t, runner });
</script>
