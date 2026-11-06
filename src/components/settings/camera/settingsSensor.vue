<template>
  <div class="tns-card flex flex-col gap-2 sm:gap-3">
    <h3 class="tns-section-title">
      {{ $t('components.camera.chip_settings.title') }}
    </h3>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <NumberInputPicker
        v-model="pixelSize"
        :label="$t('components.camera.chip_settings.pixel_size')"
        labelKey="components.camera.chip_settings.pixel_size"
        :min="0.01"
        :max="50"
        :step="0.01"
        :decimalPlaces="2"
        inputId="pixel-size"
        @change="updatePixelSize"
      />

      <NumberInputPicker
        v-model="chipHigh"
        :label="$t('components.camera.chip_settings.height')"
        labelKey="components.camera.chip_settings.height"
        :min="100"
        :max="10000"
        :step="1"
        :decimalPlaces="0"
        inputId="chip-high"
        @change="updateChipHigh"
      />

      <NumberInputPicker
        v-model="chipWidth"
        :label="$t('components.camera.chip_settings.width')"
        labelKey="components.camera.chip_settings.width"
        :min="100"
        :max="10000"
        :step="1"
        :decimalPlaces="0"
        inputId="chip-width"
        @change="updateChipWidth"
      />

      <NumberInputPicker
        v-model="bitDepth"
        :label="$t('components.camera.chip_settings.bit_depth')"
        labelKey="components.camera.chip_settings.bit_depth"
        :helpMessage="$t('components.camera.chip_settings.bit_depth_help')"
        :min="8"
        :max="16"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        inputId="camera-bit-depth"
        @change="updateBitDepth"
      />
    </div>

    <ProfileToggle
      settingKey="CameraSettings-BitScaling"
      labelKey="components.camera.chip_settings.bit_scaling"
      helpKey="components.camera.chip_settings.bit_scaling_help"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import ProfileToggle from '@/components/helpers/settings/ProfileToggle.vue';

const store = apiStore();

const pixelSize = ref(0);
const chipHigh = ref(0);
const chipWidth = ref(0);
const bitDepth = ref(16);
// Set once the user edits the field, so a late profile poll does not overwrite the input.
let bitDepthTouched = false;

async function updatePixelSize() {
  try {
    await apiService.profileChangeValue('CameraSettings-PixelSize', pixelSize.value);
  } catch (error) {
    console.error('Error updating PixelSize:', error);
  }
}

async function updateChipHigh() {
  try {
    await apiService.profileChangeValue('FramingAssistantSettings-CameraHeight', chipHigh.value);
  } catch (error) {
    console.error('Error updating ChipHigh:', error);
  }
}

async function updateChipWidth() {
  try {
    await apiService.profileChangeValue('FramingAssistantSettings-CameraWidth', chipWidth.value);
  } catch (error) {
    console.error('Error updating ChipWidth:', error);
  }
}

async function updateBitDepth() {
  bitDepthTouched = true;
  try {
    await apiService.profileChangeValue('CameraSettings-BitDepth', bitDepth.value);
  } catch (error) {
    console.error('Error updating BitDepth:', error);
  }
}

watch(
  () => store.profileInfo?.CameraSettings?.BitDepth,
  (value) => {
    if (!bitDepthTouched && value) bitDepth.value = value;
  },
  { immediate: true }
);

onMounted(() => {
  const profile = store.profileInfo;
  pixelSize.value = profile?.CameraSettings?.PixelSize || 5.0;
  chipHigh.value = profile?.FramingAssistantSettings?.CameraHeight || 1501;
  chipWidth.value = profile?.FramingAssistantSettings?.CameraWidth || 3001;
});
</script>
