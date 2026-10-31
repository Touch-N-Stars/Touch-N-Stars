<template>
  <div
    class="flex flex-col w-full max-w-md space-y-2 mt-4 border border-gray-700 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg p-5"
  >
    <setCount />
    <setGain />
    <setOffset />
    <setMinExposureTime />
    <setMaxExposureTime />
    <setHistogramMeanTarget />
    <setHistogramTolerance />
    <selectFilter v-if="store.filterInfo.Connected" v-model="selectedFilterId" />
    <setBinning v-if="(store.cameraInfo?.BinningModes?.length || 0) > 1" />
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-300">{{ $t('components.flatassistant.keep_closed') }}</span>
      <toggleButton
        :statusValue="settingsStore.flats.keepClosed"
        @update:statusValue="settingsStore.flats.keepClosed = $event"
      />
    </div>
    <div v-show="flatsStore.status.State != 'Running'">
      <button @click="startAutoExposure" class="tns-btn-primary">
        {{ $t('components.flatassistant.start_sky_flat') }}
      </button>
    </div>
    <div v-show="flatsStore.status.State == 'Running'">
      <button @click="stopFlats" class="tns-btn-danger">
        {{ $t('components.flatassistant.stop') }}
      </button>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useFlatassistantStore } from '@/store/flatassistantStore';
import { useCameraStore } from '@/store/cameraStore';
import { useSettingsStore } from '@/store/settingsStore';
import setBinning from '@/components/flatassistant/setBinning.vue';
import setGain from '@/components/flatassistant/setGain.vue';
import setOffset from './setOffset.vue';
import setCount from '@/components/flatassistant/setCount.vue';
import setMinExposureTime from '@/components/flatassistant/setMinExposureTime.vue';
import setMaxExposureTime from '@/components/flatassistant/setMaxExposureTime.vue';
import setHistogramMeanTarget from '@/components/flatassistant/setHistogramMeanTarget.vue';
import setHistogramTolerance from '@/components/flatassistant/setHistogramTolerance.vue';
import selectFilter from '@/components/flatassistant/selectFilter.vue';
import toggleButton from '@/components/helpers/toggleButton.vue';

const store = apiStore();
const flatsStore = useFlatassistantStore();
const cameraStore = useCameraStore();
const settingsStore = useSettingsStore();

const selectedFilterId = ref(null);

onMounted(() => {
  flatsStore.binning = cameraStore.binningMode;
  flatsStore.gain = cameraStore.gain;
  flatsStore.offset = cameraStore.offset;
  selectedFilterId.value = store.filterInfo?.SelectedFilter?.Id ?? null;
});

async function startAutoExposure() {
  console.log('Flats startAutoExposure: ');
  if (await flatsStore.detectServerWorkflow()) {
    // Sky flats offer no dark count field, so none are taken (same as multi mode).
    await flatsStore.startServerRun({
      mode: 'SkyFlat',
      keepClosed: settingsStore.flats.keepClosed,
      darkCount: 0,
      filters: [
        {
          filterId: selectedFilterId.value,
          count: flatsStore.count,
          gain: flatsStore.gain,
          offset: flatsStore.offset,
          binning: flatsStore.binning,
          histogramMean: flatsStore.histogramMean * 100,
          meanTolerance: flatsStore.meanTolerance * 100,
          minExposure: flatsStore.minExposureTime,
          maxExposure: flatsStore.maxExposureTime,
        },
      ],
    });
    return;
  }
  try {
    await flatsStore.runFlatWorkflow({
      request: () =>
        apiService.flatSkyflat(
          flatsStore.count,
          flatsStore.minExposureTime,
          flatsStore.maxExposureTime,
          flatsStore.histogramMean,
          flatsStore.meanTolerance,
          flatsStore.binning,
          flatsStore.gain,
          flatsStore.offset,
          selectedFilterId.value,
          settingsStore.flats.keepClosed,
          flatsStore.darkCount
        ),
      darkCount: flatsStore.darkCount,
    });
  } catch (error) {
    console.log('Error startAutoExposure');
    flatsStore.notifyOperationIssue(error?.response?.data ?? error);
  }
}

async function stopFlats() {
  console.log('Flats stop: ');
  try {
    await flatsStore.stopWorkflow();
  } catch (error) {
    console.log('Error stopAutoExposure');
  }
}
</script>
