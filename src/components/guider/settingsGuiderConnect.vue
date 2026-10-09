<template>
  <div class="space-y-4">
    <div class="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
      <div class="space-y-3">
        <!-- PINS native guider: guide camera and optics live in its own settings -->
        <NativeSettingsSheet v-if="isNativeGuider" :names="NATIVE_CONNECT_SETTINGS" compact />

        <!-- PHD2 Connection Settings -->
        <settingsPhd2 v-else :selectedGuiderDevice="selectedGuiderDevice" />

        <!-- Dither Settings -->
        <settingsDither />

        <!-- Settle Settings -->
        <settingsSettle />

        <!-- Guiding Start Settings -->
        <settingsGuideStart />

        <!-- ROI Settings (PHD2 star search region) -->
        <settingsROI v-if="!isNativeGuider" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import settingsPhd2 from '@/components/guider/PHD2/settingsPhd2.vue';
import settingsDither from '@/components/guider/settingsDither.vue';
import settingsSettle from '@/components/guider/settingsSettle.vue';
import settingsGuideStart from '@/components/guider/settingsGuideStart.vue';
import settingsROI from '@/components/guider/settingsROI.vue';
import NativeSettingsSheet from '@/components/guider/native/NativeSettingsSheet.vue';
import { apiStore } from '@/store/store';
import { isNativeGuiderSelected } from '@/utils/nativeGuider';

const props = defineProps({
  selectedGuiderDevice: { type: String, default: '' },
});

const NATIVE_CONNECT_SETTINGS = ['GuideSource', 'FocalLengthMm', 'PixelSizeUm', 'PulseOutput'];

const store = apiStore();
const isNativeGuider = computed(() =>
  isNativeGuiderSelected({
    guiderInfo: store.guiderInfo,
    profileGuiderName: store.profileInfo?.GuiderSettings?.GuiderName,
    selectedDisplayName: props.selectedGuiderDevice,
  })
);
</script>
