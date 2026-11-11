<template>
  <div class="flex flex-col gap-2 sm:gap-4 pb-20">
    <!-- WandererCover Settings -->
    <div
      v-if="isWandererCover"
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-surface-2/50 rounded-lg border border-line/50"
    >
      <h3 class="font-bold text-base text-accent">
        {{ $t('components.flat.settings.title') }}
      </h3>
      <setFlatdeviceHeater />
      <setFlatdeviceOpenPosition />
      <setFlatdeviceClosedPosition />
    </div>
    <!-- Trained Flat Exposure Settings (profile-level, always shown) -->
    <div
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-surface-2/50 rounded-lg border border-line/50"
    >
      <TrainedFlatExposureSettings />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import setFlatdeviceHeater from './settings/setFlatdeviceHeater.vue';
import setFlatdeviceOpenPosition from './settings/setFlatdeviceOpenPosition.vue';
import setFlatdeviceClosedPosition from './settings/setFlatdeviceClosedPosition.vue';
import TrainedFlatExposureSettings from './settings/TrainedFlatExposureSettings.vue';
import { apiStore } from '@/store/store';

const store = apiStore();

const isWandererCover = computed(() => {
  return store.flatdeviceInfo.Name && store.flatdeviceInfo.Name.includes('Wanderer');
});
</script>
