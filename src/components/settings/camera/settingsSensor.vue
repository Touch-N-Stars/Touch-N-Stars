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
import { useProfileSetting } from '@/composables/useProfileSetting';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import ProfileToggle from '@/components/helpers/settings/ProfileToggle.vue';

// An empty or zero profile value shows the old placeholder defaults, as before.
const { value: pixelSize, save: updatePixelSize } = useProfileSetting('CameraSettings-PixelSize', {
  fallback: 5.0,
  fromProfile: (v) => v || 5.0,
});
const { value: chipHigh, save: updateChipHigh } = useProfileSetting(
  'FramingAssistantSettings-CameraHeight',
  { fallback: 1501, fromProfile: (v) => v || 1501 }
);
const { value: chipWidth, save: updateChipWidth } = useProfileSetting(
  'FramingAssistantSettings-CameraWidth',
  { fallback: 3001, fromProfile: (v) => v || 3001 }
);
const { value: bitDepth, save: updateBitDepth } = useProfileSetting('CameraSettings-BitDepth', {
  fallback: 16,
  fromProfile: (v) => v || 16,
});
</script>
