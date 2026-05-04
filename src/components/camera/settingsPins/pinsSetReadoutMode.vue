<template>
  <div class="flex flex-col gap-2 w-full">
    <div
      class="flex items-center justify-between flex-1 border border-gray-500 p-1 md:p-2 rounded-lg"
    >
      <label for="setReadoutModeImage" class="text-xs md:text-sm text-gray-200 font-medium">
        {{ $t('components.camera.readout_mode_image') }}
      </label>
      <select
        @change="setReadoutModeImage()"
        id="setReadoutModeImage"
        v-model="readoutModeImage"
        class="default-select h-7 md:h-8 w-20 md:w-28"
      >
        <option v-for="(mode, index) in store.cameraInfo.ReadoutModes" :key="index" :value="index">
          {{ mode }}
        </option>
      </select>
    </div>

    <div
      class="flex items-center justify-between flex-1 border border-gray-500 p-1 md:p-2 rounded-lg"
    >
      <label for="setReadoutModeSnap" class="text-xs md:text-sm text-gray-200 font-medium">
        {{ $t('components.camera.readout_mode_snap') }}
      </label>
      <select
        @change="setReadoutModeSnap()"
        id="setReadoutModeSnap"
        v-model="readoutModeSnap"
        class="default-select h-7 md:h-8 w-20 md:w-28"
      >
        <option v-for="(mode, index) in store.cameraInfo.ReadoutModes" :key="index" :value="index">
          {{ mode }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';

const store = apiStore();
const readoutModeImage = ref('');
const readoutModeSnap = ref('');

onMounted(() => {
  initializeReadoutMode();
});

const initializeReadoutMode = async () => {
  if (!store.cameraInfo) {
    console.warn('Camera info not loaded');
    return;
  }
  try {
    const response = await apiService.cameraAction(`get-settings`);
    //console.log('[PINS Readout mode] ', response);
    readoutModeImage.value = response.Response.ReadoutModeForNormalImages;
    readoutModeSnap.value = response.Response.ReadoutModeForSnapImages;
  } catch (error) {
    console.log('Error while setting readoutMode');
  }
};

async function setReadoutModeImage() {
  try {
    const response = await apiService.cameraAction(
      `set-setting?settingName=ReadoutModeForNormalImages&newValue=${readoutModeImage.value}`
    );
    console.log('[pinsSetReadoutMode] ', response);
  } catch (error) {
    console.log('Error while setting readoutMode');
  }
}

async function setReadoutModeSnap() {
  try {
    const cameraResponse = await apiService.cameraAction(
      `set-setting?settingName=ReadoutModeForSnapImages&newValue=${readoutModeSnap.value}`
    );
    console.log('[pinsSetReadoutMode Camera] ', cameraResponse);
    const profileResponse = await apiService.profileChangeValue(
      'CameraSettings-ReadoutModeForSnapImages',
      readoutModeSnap.value
    );
    console.log('[pinsSetReadoutMode Profile] ', profileResponse);
  } catch (error) {
    console.log('[pinsSetReadoutMode] Error while setting readoutMode', error);
  }
}
</script>
