<template>
  <div class="flex flex-row w-full items-center min-w-28">
    <label for="Exposuretime" class="text-sm sm:text-xs mr-3 mb-1 text-content">
      {{ $t('components.guider.phd2.Exposuretime') }}
    </label>
    <select v-model="exposureTime" class="tns-select w-28 ml-auto" @change="setExposureTime">
      <option v-for="option in exposureOptions" :key="option" :value="option">
        {{ option }} s
      </option>
    </select>
  </div>
</template>

<script setup>
import apiService from '@/services/apiService';
import { onMounted, ref } from 'vue';

const exposureTime = ref();
const exposureOptions = [
  0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 15,
];

async function setExposureTime() {
  const msValue = exposureTime.value * 1000;
  await apiService.setPHD2Exposure(msValue);
}

onMounted(async () => {
  const response = await apiService.getPhd2Exposure();
  // On a failed request the global interceptor returns { Success: false,
  // Response: '' }, so guard against the missing Exposure value instead of
  // writing NaN into the select.
  const exposureMs = response?.Response?.Exposure;
  if (typeof exposureMs === 'number') {
    exposureTime.value = exposureMs / 1000;
  }
});
</script>
