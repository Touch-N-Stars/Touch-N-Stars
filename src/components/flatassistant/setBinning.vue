<template>
  <div class="flex flex-row w-full items-center min-w-28 border border-gray-500 p-1 rounded-lg">
    <label for="gain" class="text-sm mr-3 mb-1 text-gray-400">
      {{ $t('components.camera.binning_mode') }}
    </label>
    <select
      @change="setBinnig"
      id="binning"
      v-model="cameraStore.binningMode"
      class="tns-select ml-auto w-28"
    >
      <option v-for="mode in store.cameraInfo.BinningModes" :key="mode.Name" :value="mode.Name">
        {{ mode.Name }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { apiStore } from '@/store/store';
import { useCameraStore } from '@/store/cameraStore';
import apiService from '@/services/apiService';
import { reportBackendRefusal } from '@/utils/backendErrors';

const store = apiStore();
const cameraStore = useCameraStore();

onMounted(() => {
  initializeBinningMode();
});

// Setzt den initialen Binning Mode aus BinX und BinY
const initializeBinningMode = () => {
  if (!store.cameraInfo) {
    console.warn('Camera info not loaded');
    return;
  }

  const binX = store.cameraInfo.BinX ?? 1; // Falls undefined -> Standardwert 1
  const binY = store.cameraInfo.BinY ?? 1;
  cameraStore.binningMode = `${binX}x${binY}`;
};

async function setBinnig() {
  console.log('Set binning to: ', cameraStore.binningMode);
  try {
    const data = await apiService.setBinningMode(cameraStore.binningMode);
    console.log(data);
    // Refused while the camera is exposing: show the binning the camera still has.
    if (reportBackendRefusal(data, 'components.backendErrors.binning')) initializeBinningMode();
  } catch (error) {
    console.log('Error while setting binning');
  }
}
</script>
