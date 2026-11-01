<template>
  <div class="flex flex-col w-full border border-gray-500 p-1 md:p-2 rounded-lg">
    <!-- Dither Pixels -->
    <div class="flex flex-row items-center justify-between">
      <NumberInputPicker
        v-model="ditherPixels"
        :label="$t('components.guider.ditherPixels')"
        labelKey="components.guider.ditherPixels"
        :min="0"
        :max="1000"
        :step="0.5"
        :decimalPlaces="1"
        placeholder="3.0"
        inputId="ditherPixels"
        wrapperClass="w-24"
        @change="setDitherPixels"
      />
    </div>
    <p class="text-xs text-gray-400 text-right pr-1">
      {{ $t('components.guider.ditherMainCameraPixels', { pixels: ditherMainCameraPixels }) }}
    </p>

    <ProfileToggle
      labelKey="components.guider.ditherRAOnly"
      settingKey="GuiderSettings-DitherRAOnly"
      labelClass="text-xs md:text-sm text-gray-200"
      toggleClass="pr-5 pl-5 justify-center h-7 md:h-8"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import ProfileToggle from '@/components/helpers/settings/ProfileToggle.vue';
import { arcsecPerPixel } from '@/utils/imageScale';

const store = apiStore();

const ditherPixels = ref(3.0);

const statusClassDitherPixels = ref('');

// DitherPixels is in guide camera pixels; show what it amounts to on the imaging
// camera, like NINA's guider panel. The guider reports its scale once connected.
const ditherMainCameraPixels = computed(() => {
  const guideScale = Number(store.guiderInfo?.Connected ? store.guiderInfo.PixelScale : 0);
  const mainScale = arcsecPerPixel(
    store.profileInfo?.CameraSettings?.PixelSize,
    store.profileInfo?.TelescopeSettings?.FocalLength
  );
  const pixels = Number(ditherPixels.value);

  if (!(guideScale > 0) || !mainScale || !Number.isFinite(pixels)) return '—';
  return ((pixels * guideScale) / mainScale).toFixed(1);
});

const initializeSettings = () => {
  if (!store.profileInfo?.GuiderSettings) {
    console.warn('GuiderSettings not loaded');
    return;
  }

  ditherPixels.value = store.profileInfo.GuiderSettings.DitherPixels ?? 3.0;
};

async function setDitherPixels() {
  try {
    await apiService.profileChangeValue('GuiderSettings-DitherPixels', ditherPixels.value);
    statusClassDitherPixels.value = 'glow-green';
  } catch (error) {
    console.error('Error setting dither pixels:', error);
    statusClassDitherPixels.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassDitherPixels.value = '';
    }, 2000);
  }
}

onMounted(() => {
  initializeSettings();
});
</script>
