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
      <Spinner v-if="store.guiderInfo.State === 'Guiding'" size="sm" class="text-status-ok ml-2" />
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
      <Spinner v-if="store.guiderInfo.State === 'Calibrating'" size="sm" class="text-accent ml-2" />
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
import Spinner from '@/components/helpers/Spinner.vue';
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
