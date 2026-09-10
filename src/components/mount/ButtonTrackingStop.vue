<template>
  <button
    v-if="store.mountInfo.CanSetTrackingEnabled"
    @click="setTrackingMode(4)"
    :disabled="store.mountIsParked"
    class="tns-btn-danger"
    :class="{ 'border-accent': store.mountInfo.TrackingMode === 'Stopped' }"
  >
    <StopCircleIcon class="w-8 h-8" />
  </button>
</template>

<script setup>
import apiService from '@/services/apiService';
import { useI18n } from 'vue-i18n';
import { StopCircleIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';

const store = apiStore();
const { t } = useI18n();

async function setTrackingMode(mode) {
  //0=Siderial, 1=Lunar, 2=Solar, 3=King, 4=Stopped
  // The mount can be parked between render and click (e.g. by a running sequence).
  if (store.mountIsParked) return;
  try {
    const response = await apiService.setTrackingMode(mode);
    if (!response.Success) return;
    console.log(t('components.mount.control.trackingMode') + ' set');
  } catch (error) {
    console.log(t('components.mount.control.errors.tracking'));
  }
}
</script>

<style scoped>
.glow-green {
  box-shadow: 0 0 10px #00ff00;
}
</style>
