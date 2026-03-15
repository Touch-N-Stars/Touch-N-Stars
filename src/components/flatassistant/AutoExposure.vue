<template>
  <div
    class="flex flex-col w-full max-w-md space-y-2 mt-4 border border-gray-700 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg p-5"
  >
    <setCount />
    <setGain />
    <setOffset />
    <setBrightness />
    <setMinExposureTime />
    <setMaxExposureTime />
    <setHistogramMeanTarget />
    <setHistogramTolerance />
    <changeFilter v-if="store.filterInfo.Connected" />
    <setBinning v-if="(store.cameraInfo?.BinningModes?.length || 0) > 1" />
    <div v-show="flatsStore.status.State != 'Running'">
      <button @click="startAutoExposure" class="default-button-cyan">
        {{ $t('components.flatassistant.start_auto_exposure') }}
      </button>
    </div>
    <div v-show="flatsStore.status.State == 'Running'">
      <button @click="stopFlats" class="default-button-red">
        {{ $t('components.flatassistant.stop') }}
      </button>
    </div>
  </div>
</template>
<script setup>
import { onMounted } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useFlatassistantStore } from '@/store/flatassistantStore';
import { useCameraStore } from '@/store/cameraStore';
import setBinning from '@/components/flatassistant/setBinning.vue';
import setGain from '@/components/flatassistant/setGain.vue';
import setOffset from './setOffset.vue';
import setCount from '@/components/flatassistant/setCount.vue';
import setMinExposureTime from '@/components/flatassistant/setMinExposureTime.vue';
import setMaxExposureTime from '@/components/flatassistant/setMaxExposureTime.vue';
import setHistogramMeanTarget from '@/components/flatassistant/setHistogramMeanTarget.vue';
import setHistogramTolerance from '@/components/flatassistant/setHistogramTolerance.vue';
import changeFilter from '@/components/filterwheel/changeFilter.vue';
import setBrightness from '@/components/flatassistant/setBrightness.vue';
import { useSettingsStore } from '@/store/settingsStore';

const store = apiStore();
const flatsStore = useFlatassistantStore();
const cameraStore = useCameraStore();
const settingsStore = useSettingsStore();

onMounted(() => {
  flatsStore.binning = cameraStore.binningMode;
  flatsStore.gain = cameraStore.gain;
  flatsStore.offset = cameraStore.offset;
});

async function startAutoExposure() {
  console.log('Flats startAutoExposure: ');
  try {
    const data = await apiService.flatAutoExposure(
      flatsStore.count,
      flatsStore.minExposureTime,
      flatsStore.maxExposureTime,
      flatsStore.histogramMean,
      flatsStore.meanTolerance,
      flatsStore.binning,
      flatsStore.gain,
      flatsStore.offset,
      store.filterNr,
      settingsStore.flats.brightness
    );
    console.log(data);
    console.log('Flats Filter: ', store.filterInfo?.SelectedFilter?.Id);
  } catch (error) {
    console.log('Error startAutoExposure');
  }
}

async function stopFlats() {
  console.log('Flats stop: ');
  try {
    const data = await apiService.flatassistantAction('stop');
    console.log(data);
  } catch (error) {
    console.log('Error stopAutoExposure');
  }
}
</script>
