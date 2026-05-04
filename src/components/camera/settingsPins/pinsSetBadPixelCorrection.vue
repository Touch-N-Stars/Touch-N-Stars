<template>
  <div v-if="hasFeature" class="w-full space-y-2">
    <div class="flex items-center justify-between border border-gray-500 p-1 md:p-2 rounded-lg">
      <label for="BadPixelCorrection" class="text-xs md:text-sm text-gray-200 font-medium">
        {{ $t('components.camera.BadPixelCorrection') }}
      </label>
      <toggleButton
        @click="toggleMode"
        :status-value="cameraStore.cameraSettings.BadPixelCorrection"
        class="h-7 md:h-8"
      />
    </div>
    <NumberInputPicker
      v-if="cameraStore.cameraSettings.BadPixelCorrection"
      class="border border-gray-500 p-1 md:p-2 rounded-lg"
      v-model="threshold"
      :label="$t('components.camera.BadPixelCorrectionThreshold')"
      labelKey="components.camera.BadPixelCorrectionThreshold"
      :min="cameraStore.cameraSettings.MinBadPixelCorrectionThreshold"
      :max="cameraStore.cameraSettings.MaxBadPixelCorrectionThreshold"
      :step="1"
      :decimalPlaces="0"
      inputId="badpixel-threshold"
      @change="setThreshold"
    />
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue';
import apiService from '@/services/apiService';
import { useCameraStore } from '@/store/cameraStore';
import toggleButton from '@/components/helpers/toggleButton.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const cameraStore = useCameraStore();

const hasFeature = computed(() => cameraStore.cameraSettings?.BadPixelCorrection !== undefined);

const threshold = ref(cameraStore.cameraSettings?.BadPixelCorrectionThreshold ?? 0);

watch(
  () => cameraStore.cameraSettings?.BadPixelCorrectionThreshold,
  (newVal) => {
    if (newVal !== undefined && newVal !== threshold.value) {
      threshold.value = newVal;
    }
  }
);

async function toggleMode() {
  const newValue = !cameraStore.cameraSettings.BadPixelCorrection;
  try {
    await apiService.cameraAction(
      `set-setting?settingName=BadPixelCorrection&newValue=${newValue}`
    );
  } catch (error) {
    console.log('Error:', error);
  }
  await cameraStore.readSettings();
}

async function setThreshold(value) {
  try {
    await apiService.cameraAction(
      `set-setting?settingName=BadPixelCorrectionThreshold&newValue=${value}`
    );
  } catch (error) {
    console.log('Error:', error);
  }
  await cameraStore.readSettings();
}
</script>
