<template>
  <!-- px-2!/text-xs! override the base tns-btn px-4/text-sm so the labels fit on
       one line in the cramped 5-button row; ! is required because Tailwind
       sorts px-4/text-sm after px-2/text-xs so the base would otherwise win. -->
  <button
    v-if="store.mountInfo.CanSetTrackingEnabled"
    @click="setTrackingMode(0)"
    class="tns-btn-secondary px-2! text-xs!"
    :class="{ 'border-accent': store.mountInfo.TrackingMode === 'Sidereal' }"
  >
    {{ $t('components.mount.control.siderial') }}
  </button>
  <button
    @click="setTrackingMode(1)"
    class="tns-btn-secondary px-2! text-xs!"
    :class="{ 'border-accent': store.mountInfo.TrackingMode === 'Lunar' }"
  >
    Lunar
  </button>
  <button
    @click="setTrackingMode(2)"
    class="tns-btn-secondary px-2! text-xs!"
    :class="{ 'border-accent': store.mountInfo.TrackingMode === 'Solar' }"
  >
    Solar
  </button>
  <button
    @click="setTrackingMode(3)"
    class="tns-btn-secondary px-2! text-xs!"
    :class="{ 'border-accent': store.mountInfo.TrackingMode === 'King' }"
  >
    King
  </button>
</template>

<script setup>
import apiService from '@/services/apiService';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';

import { useHaptics } from '@/composables/useHaptics';

const { tapLight } = useHaptics();
const store = apiStore();
const { t } = useI18n();

async function setTrackingMode(mode) {
  tapLight();
  //0=Sidereal, 1=Lunar, 2=Solar, 3=King, 5=Stopped
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
