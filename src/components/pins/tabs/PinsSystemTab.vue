<template>
  <div class="flex flex-col space-y-6">
    <TimeSyncSettings v-if="store.isPINS" />

    <!-- Raspberry Pi system locale, regulatory domain, timezone and keyboard -->
    <PinsLocalizationSettings v-if="store.isPINS" />
    <PinsSwapSettings v-if="store.isPINS" />
  </div>
</template>

<script setup>
import { apiStore } from '@/store/store';
import TimeSyncSettings from '../system/TimeSyncSettings.vue';
import PinsLocalizationSettings from '../system/PinsLocalizationSettings.vue';
import PinsSwapSettings from '../system/PinsSwapSettings.vue';

const store = apiStore();
</script>
