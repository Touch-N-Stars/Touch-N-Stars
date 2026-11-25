<template>
  <div class="flex flex-col space-y-6">
    <TimeSyncSettings v-if="store.isPINS" />

    <!-- Raspberry Pi system locale, regulatory domain, timezone and keyboard -->
    <PinsLocalizationSettings v-if="store.isPINS" />
    <PinsSwapSettings v-if="store.isPINS && !simple" />

    <div v-if="simple" class="tns-card flex flex-col gap-3">
      <h3 class="tns-section-title">{{ $t('components.settings.system.title') }}</h3>
      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="tns-btn-secondary" @click="powerAction = 'restart'">
          {{ $t('components.settings.system.restart') }}
        </button>
        <button type="button" class="tns-btn-danger" @click="powerAction = 'shutdown'">
          {{ $t('components.settings.system.shutdown') }}
        </button>
      </div>
    </div>
    <SystemPowerModal v-if="powerAction" :initialAction="powerAction" @close="powerAction = null" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { apiStore } from '@/store/store';
import SystemPowerModal from '@/components/system/SystemPowerModal.vue';
import TimeSyncSettings from '../system/TimeSyncSettings.vue';
import PinsLocalizationSettings from '../system/PinsLocalizationSettings.vue';
import PinsSwapSettings from '../system/PinsSwapSettings.vue';

defineProps({
  // Simple mode: without the swap file, with restart and shutdown at hand
  simple: { type: Boolean, default: false },
});

const store = apiStore();
const powerAction = ref(null);
</script>
