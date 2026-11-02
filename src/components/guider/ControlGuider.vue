<template>
  <button
    class="tns-btn-primary"
    @click="guiderStartStop('start')"
    :disabled="
      isProcessingStart ||
      store.guiderInfo.State === 'Guiding' ||
      store.guiderInfo.State === 'Calibrating'
    "
  >
    <span class="flex items-center justify-center space-x-2">
      <span class="flex items-center">
        <template v-if="store.guiderInfo.State === 'Guiding'">
          <span>{{ $t('components.guider.status.guiding') }}</span>
        </template>
        <template v-else-if="isProcessingStart">
          <span>{{ $t('components.guider.running') }}</span>
        </template>
        <template v-else>
          <span>{{ $t('components.guider.start') }}</span>
        </template>
      </span>
      <svg
        v-if="store.guiderInfo.State === 'Guiding'"
        class="animate-spin h-5 w-5 text-green-400 ml-2"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </span>
  </button>
  <button
    class="tns-btn-secondary"
    @click="guiderStartWithCal()"
    :disabled="
      isProcessingStartWithCal ||
      store.guiderInfo.State === 'Guiding' ||
      store.guiderInfo.State === 'Calibrating'
    "
  >
    <span class="flex items-center justify-center space-x-2">
      <span class="flex items-center">
        <template v-if="store.guiderInfo.State === 'Calibrating'">
          <span>{{ $t('components.guider.status.calibrating') }}</span>
        </template>
        <template v-else-if="isProcessingStartWithCal">
          <span>{{ $t('components.guider.running') }}</span>
        </template>
        <template v-else>
          <span>{{ $t('components.guider.startWithCal') }}</span>
        </template>
      </span>
      <svg
        v-if="store.guiderInfo.State === 'Calibrating'"
        class="animate-spin h-5 w-5 text-blue-400 ml-2"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </span>
  </button>
  <button class="tns-btn-danger" @click="guiderStartStop('stop')">
    {{ $t('components.guider.stop') }}
  </button>
</template>
<script setup>
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';

import { ref } from 'vue';
import { reportBackendRefusal } from '@/utils/backendErrors';

const store = apiStore();
const isProcessingStart = ref(false);
const isProcessingStartWithCal = ref(false);

async function guiderStartStop(befehl) {
  isProcessingStart.value = true;
  try {
    const response = await apiService.guiderAction(befehl);
    console.log('Guider Command:', befehl);
    if (befehl === 'start') reportBackendRefusal(response, 'components.backendErrors.guidingStart');
  } catch (error) {
    console.error('Error:', error.response?.data || error);
  } finally {
    isProcessingStart.value = false;
  }
}

async function guiderStartWithCal() {
  isProcessingStartWithCal.value = true;
  try {
    const response = await apiService.guiderStart(true);
    console.log('Guider Command: Start with cal');
    reportBackendRefusal(response, 'components.backendErrors.guidingStart');
  } catch (error) {
    console.error('Error:', error.response?.data || error);
  } finally {
    isProcessingStartWithCal.value = false;
  }
}
</script>
