<template>
  <div
    class="flex flex-col w-full max-w-md space-y-2 mt-4 border border-gray-700 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg p-5"
  >
    <setCount />
    <setGain />
    <setOffset />
    <setExposureTime />
    <setMinBrightness />
    <setMaxBrightness />
    <setHistogramMeanTarget />
    <setHistogramTolerance />
    <changeFilter v-if="store.filterInfo.Connected" />
    <setBinning v-if="(store.cameraInfo?.BinningModes?.length || 0) > 1" />
    <div v-show="flatsStore.status.State != 'Running'">
      <button @click="startAutoExposure" class="default-button-cyan">
        {{ $t('components.flatassistant.start_auto_brightness') }}
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
import { useSettingsStore } from '@/store/settingsStore';
import setBinning from '@/components/flatassistant/setBinning.vue';
import setGain from '@/components/flatassistant/setGain.vue';
import setOffset from './setOffset.vue';
import setCount from '@/components/flatassistant/setCount.vue';
import setMinBrightness from '@/components/flatassistant/setMinBrightness.vue';
import setMaxBrightness from '@/components/flatassistant/setMaxBrightness.vue';
import setHistogramMeanTarget from '@/components/flatassistant/setHistogramMeanTarget.vue';
import setHistogramTolerance from '@/components/flatassistant/setHistogramTolerance.vue';
import changeFilter from '@/components/filterwheel/changeFilter.vue';
import setExposureTime from '@/components/flatassistant/setExposureTime.vue';

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
    const data = await apiService.flatAutoBrightness(
      flatsStore.count,
      settingsStore.flats.minBrightness,
      settingsStore.flats.maxBrightness,
      flatsStore.histogramMean,
      flatsStore.meanTolerance,
      flatsStore.binning,
      flatsStore.gain,
      flatsStore.offset,
      store.filterNr,
      settingsStore.flats.exposureTime
    );
    console.log(data);
  } catch (error) {
    console.log('Error flatAutoBrightness');
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
