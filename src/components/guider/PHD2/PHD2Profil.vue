<template>
  <div class="flex flex-row w-full items-center min-w-28">
    <label for="binning" class="text-sm sm:text-xs mr-3 mb-1 text-content">
      {{ $t('components.guider.phd2.profile') }}
    </label>
    <div class="relative ml-auto">
      <select
        v-model="selectedProfile"
        @change="onProfileChange"
        class="tns-select w-28"
        :class="statusClassConnect"
        :disabled="guiderStore.phd2IsConnected || isChangingProfile"
      >
        <option v-for="profile in profiles" :key="profile" :value="profile">
          {{ profile }}
        </option>
      </select>
      <div
        v-if="isChangingProfile"
        class="absolute inset-0 flex items-center justify-center bg-surface-1/50 rounded-control text-accent pointer-events-none"
      >
        <Spinner size="sm" />
      </div>
    </div>
    <div class="flex flex-row gap-1 ml-1">
      <button
        @click="connectEquipment"
        class="tns-btn-primary w-12"
        v-show="!guiderStore.phd2IsConnected"
      >
        <LinkIcon class="w-7 h-7 text-content" />
      </button>
      <button
        @click="disconnectEquipment"
        class="tns-btn-danger w-12"
        v-show="guiderStore.phd2IsConnected"
      >
        <LinkSlashIcon class="w-full h-7 text-content" />
      </button>
      <button
        v-if="store.isPINS"
        @click="showManagementModal = true"
        class="tns-btn-secondary w-12"
        :disabled="guiderStore.phd2IsConnected"
      >
        <Cog6ToothIcon class="w-7 h-7 text-content" />
      </button>
    </div>
  </div>

  <PHD2ProfileManagementModal :show="showManagementModal" @close="handleModalClose" />
</template>

<script setup>
import apiService from '@/services/apiService';
import { useGuiderStore } from '@/store/guiderStore';
import { onMounted, ref } from 'vue';
import { LinkSlashIcon, LinkIcon, Cog6ToothIcon } from '@heroicons/vue/24/outline';
import PHD2ProfileManagementModal from './PHD2ProfileManagementModal.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import { apiStore } from '@/store/store';

const guiderStore = useGuiderStore();
const store = apiStore();
const profiles = ref([]);
const selectedProfile = ref('');
const statusClassConnect = ref();
const statusClassDisconnect = ref();
const isChangingProfile = ref(false);
const showManagementModal = ref(false);

async function connectEquipment() {
  try {
    await apiService.connectPHD2Equipment(selectedProfile.value);
    statusClassConnect.value = 'glow-green';
  } catch (error) {
    statusClassConnect.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassConnect.value = '';
    }, 1000);
  }
}

async function disconnectEquipment() {
  try {
    await apiService.disconnectPHD2Equipment();
    statusClassDisconnect.value = 'glow-green';
  } catch (error) {
    statusClassDisconnect.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassDisconnect.value = '';
    }, 1000);
  }
}

async function onProfileChange() {
  const profileIndex = profiles.value.indexOf(selectedProfile.value);
  if (profileIndex !== -1) {
    isChangingProfile.value = true;
    try {
      // Backend erwartet eine ID die bei 1 beginnt, nicht bei 0
      const profileId = profileIndex + 1;
      console.log('Profile changed to:', selectedProfile.value, 'with ID', profileId);
      await guiderStore.setPHD2Profil(profileId);
      await guiderStore.fetchPHD2Cameras();
      await guiderStore.refreshPHD2SelectedMount();
      await guiderStore.fetchPHD2FocalLength();
      await guiderStore.fetchPHD2CalibrationStep();
      await guiderStore.fetchPHD2CalibrationDistance();
      await guiderStore.fetchPHD2ReverseDecAfterFlip();
      await guiderStore.fetchPHD2GuideAlgorithmRA();
      await guiderStore.fetchPHD2GuideAlgorithmDEC();
      await guiderStore.fetchPHD2CameraGain();
      await guiderStore.fetchPHD2CameraBinning();
      await guiderStore.fetchPHD2RestoreCalibration();
    } finally {
      isChangingProfile.value = false;
    }
  }
}

async function handleModalClose() {
  showManagementModal.value = false;
  // Profile-Liste neu laden
  const response = await apiService.getPhd2CurrentProfile();
  profiles.value = guiderStore.phd2EquipmentProfiles;
  selectedProfile.value = response.Response.Profile.name;
}

onMounted(async () => {
  const response = await apiService.getPhd2CurrentProfile();
  profiles.value = guiderStore.phd2EquipmentProfiles;
  selectedProfile.value = response.Response.Profile.name;
});
</script>
