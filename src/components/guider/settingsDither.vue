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
    <p v-if="isNativeGuider" class="text-xs text-gray-400 text-right pr-1">
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
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { arcsecPerPixel } from '@/utils/imageScale';
import { isNativeGuiderInUse } from '@/utils/nativeGuider';

const props = defineProps({
  selectedGuiderDevice: { type: String, default: '' },
});

const store = apiStore();
const nativeGuiderStore = useNativeGuiderStore();

const ditherPixels = ref(3.0);

const statusClassDitherPixels = ref('');

// DitherPixels is in guide camera pixels; show what it amounts to on the imaging
// camera, like NINA's guider panel. Internal guider only: its guide scale follows from
// its own settings and the guide camera, so the guider need not be connected.
const isNativeGuider = computed(() => isNativeGuiderInUse(store, props.selectedGuiderDevice));

// Loaded by the NativeSettingsSheet in the same dialog.
function nativeSetting(name) {
  const setting = nativeGuiderStore.settings.find((s) => s.name === name);
  return Number(String(setting?.value ?? '').replace(',', '.'));
}

// Same as the guider: PixelSizeUm 0 means the guide camera's own pixel size.
const guideScale = computed(() => {
  const pixelSizeSetting = nativeSetting('PixelSizeUm');
  const pixelSize =
    pixelSizeSetting > 0
      ? pixelSizeSetting
      : store.guideCameraInfo?.Connected
        ? store.guideCameraInfo.PixelSize
        : 0;

  return arcsecPerPixel(pixelSize, nativeSetting('FocalLengthMm'), nativeSetting('Binning') || 1);
});

const ditherMainCameraPixels = computed(() => {
  const mainScale = arcsecPerPixel(
    store.profileInfo?.CameraSettings?.PixelSize,
    store.profileInfo?.TelescopeSettings?.FocalLength
  );
  const pixels = Number(ditherPixels.value);

  if (!guideScale.value || !mainScale || !Number.isFinite(pixels)) return '—';
  return ((pixels * guideScale.value) / mainScale).toFixed(1);
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
