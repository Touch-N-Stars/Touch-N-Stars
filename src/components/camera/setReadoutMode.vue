<template>
  <!-- The per-type routes set-readout/image and /snapshot arrived in ninaAPI 2.2.14.4 -->
  <div
    v-if="!store.checkVersionNewerOrEqual(store.currentApiVersion, '2.2.14.4')"
    class="flex items-center justify-between border border-line-strong p-1 md:p-2 rounded-control"
  >
    <label for="setReadoutMode" class="text-xs md:text-sm text-content font-medium">
      {{ $t('components.camera.readout_mode') }}
    </label>
    <select
      @change="setReadoutMode"
      id="setReadoutMode"
      v-model="cameraStore.readoutMode"
      class="tns-select w-20 md:w-28"
    >
      <option v-for="(mode, index) in store.cameraInfo.ReadoutModes" :key="index" :value="index">
        {{ mode }}
      </option>
    </select>
  </div>
  <div v-else class="flex flex-col gap-2 w-full">
    <div
      class="flex items-center justify-between flex-1 border border-line-strong p-1 md:p-2 rounded-control"
    >
      <label for="setReadoutModeImage" class="text-xs md:text-sm text-content font-medium">
        {{ $t('components.camera.readout_mode_image') }}
      </label>
      <select
        @change="setReadoutModeImage()"
        id="setReadoutModeImage"
        v-model="readoutModeImage"
        class="tns-select w-20 md:w-28"
      >
        <option v-for="(mode, index) in store.cameraInfo.ReadoutModes" :key="index" :value="index">
          {{ mode }}
        </option>
      </select>
    </div>

    <div
      class="flex items-center justify-between flex-1 border border-line-strong p-1 md:p-2 rounded-control"
    >
      <label for="setReadoutModeSnap" class="text-xs md:text-sm text-content font-medium">
        {{ $t('components.camera.readout_mode_snap') }}
      </label>
      <select
        @change="setReadoutModeSnap()"
        id="setReadoutModeSnap"
        v-model="readoutModeSnap"
        class="tns-select w-20 md:w-28"
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
import { useCameraStore } from '@/store/cameraStore';
import apiService from '@/services/apiService';
import { reportBackendRefusal } from '@/utils/backendErrors';

const store = apiStore();
const cameraStore = useCameraStore();
const readoutModeImage = ref('');
const readoutModeSnap = ref('');

onMounted(() => {
  initializeReadoutMode();
});

const initializeReadoutMode = () => {
  if (!store.cameraInfo) {
    console.warn('Camera info not loaded');
    return;
  }

  const readoutMode = store.cameraInfo.ReadoutMode ?? 0; // Falls undefined -> Standardwert 0
  cameraStore.readoutMode = readoutMode;

  readoutModeImage.value = store.cameraInfo.ReadoutModeForNormalImages;
  readoutModeSnap.value = store.cameraInfo.ReadoutModeForSnapImages;
};

async function setReadoutMode() {
  console.log('Set Readout to: ', cameraStore.readoutMode);
  try {
    const data = await apiService.setReadoutMode(cameraStore.readoutMode);
    console.log(data);
    // Refused while the camera is exposing: show the mode the camera still has.
    if (reportBackendRefusal(data, 'components.backendErrors.readout')) initializeReadoutMode();
  } catch (error) {
    console.log('Error while setting readoutMode');
  }
}

async function setReadoutModeImage() {
  try {
    const response = await apiService.setReadoutModeType('image', readoutModeImage.value);
    console.log('[setReadoutMode] ', response);
    if (reportBackendRefusal(response, 'components.backendErrors.readout')) {
      initializeReadoutMode();
      return;
    }
    await apiService.profileChangeValue(
      'CameraSettings-ReadoutModeForNormalImages',
      readoutModeImage.value
    );
  } catch (error) {
    console.log('Error while setting readoutMode');
  }
}

async function setReadoutModeSnap() {
  try {
    const response = await apiService.setReadoutModeType('snapshot', readoutModeSnap.value);
    console.log('[setReadoutMode] ', response);
    if (reportBackendRefusal(response, 'components.backendErrors.readout')) {
      initializeReadoutMode();
      return;
    }
    await apiService.profileChangeValue(
      'CameraSettings-ReadoutModeForSnapImages',
      readoutModeSnap.value
    );
  } catch (error) {
    console.log('Error while setting readoutMode');
  }
}
</script>
