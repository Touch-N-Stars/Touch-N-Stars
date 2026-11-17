<template>
  <div class="w-full flex items-center gap-2">
    <LoadingOverlay :show="isLoading" :message="$t('common.loading')" />

    <label class="mr-2 shrink-0" for="profileDropdown">{{ $t('components.profile.label') }} </label>
    <select
      id="profileDropdown"
      class="tns-select w-full"
      v-model="selectedProfileId"
      @change="updateProfile"
      :disabled="isLoading || anyDeviceConnected"
    >
      <option v-for="profile in profiles" :key="profile.Id" :value="profile.Id">
        {{ profile.Name }}
      </option>
    </select>

    <!-- Manage button (PINS only) -->
    <button
      v-if="store.isPINS"
      @click="showManagementModal = true"
      class="tns-btn-secondary w-12 shrink-0"
      :title="$t('components.profile.manage')"
    >
      <AdjustmentsHorizontalIcon class="w-5 h-5" />
    </button>

    <ProfilManagementModal
      v-if="store.isPINS"
      :show="showManagementModal"
      @close="showManagementModal = false"
      @profile-changed="fetchProfiles"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useEquipmentStore } from '@/store/equipmentStore';
import { useToastStore } from '@/store/toastStore';
import { AdjustmentsHorizontalIcon } from '@heroicons/vue/24/outline';
import ProfilManagementModal from '@/components/profil/ProfilManagementModal.vue';
import LoadingOverlay from '@/components/helpers/LoadingOverlay.vue';

const store = apiStore();
const equipmentStore = useEquipmentStore();
const toastStore = useToastStore();
const { t } = useI18n();
const profiles = ref([]);
const selectedProfileId = ref(null);
const isLoading = ref(false);
const showManagementModal = ref(false);

const anyDeviceConnected = computed(
  () =>
    store.mountInfo.Connected ||
    store.cameraInfo.Connected ||
    store.filterInfo.Connected ||
    store.focuserInfo.Connected ||
    store.rotatorInfo.Connected ||
    store.guiderInfo.Connected ||
    store.weatherInfo.Connected ||
    store.safetyInfo.Connected ||
    store.flatdeviceInfo.Connected ||
    store.domeInfo.Connected ||
    store.switchInfo.Connected
);

async function fetchProfiles() {
  try {
    const response = await apiService.profileAction('show');
    if (response && response.Response) {
      profiles.value = response.Response;

      const activeProfile = profiles.value.find((profile) => profile.IsActive);
      if (activeProfile) {
        selectedProfileId.value = activeProfile.Id;
      }

      store.fetchProfilInfos();
    }
  } catch (error) {
    console.error('Error loading profiles:', error);
  }
}

function showSwitchError(message) {
  toastStore.showToast({ type: 'error', title: t('components.profile.switchFailed'), message });
}

async function updateProfile() {
  isLoading.value = true;
  try {
    const response = await apiService.profileSwitch(selectedProfileId.value);
    if (response && !response.Error) {
      console.log('Profile successfully updated');
      await fetchProfiles();
      equipmentStore.triggerReload();
    } else {
      showSwitchError(response?.Error || '');
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    showSwitchError(error.message);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchProfiles();
});
</script>

<style scoped></style>
