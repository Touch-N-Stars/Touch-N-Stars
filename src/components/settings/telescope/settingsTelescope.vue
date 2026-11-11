<template>
  <div class="tns-card flex flex-col gap-2 sm:gap-3">
    <h3 class="tns-section-title">
      {{ $t('components.settings.telescope.titel') }}
    </h3>
    <div class="flex flex-row items-center justify-between w-full">
      <label for="telescope-name" class="text-sm text-content whitespace-nowrap">
        {{ $t('components.settings.telescope.name') }}
      </label>
      <input
        id="telescope-name"
        v-model="telescopeName"
        type="text"
        class="tns-input text-xs md:text-sm w-48"
        :class="nameStatusClass"
        @change="updateTelescopeName"
      />
    </div>
    <NumberInputPicker
      v-model="focalLength"
      :label="$t('components.camera.chip_settings.focal_length')"
      labelKey="components.camera.chip_settings.focal_length"
      :min="1"
      :max="5000"
      :step="1"
      :decimalPlaces="0"
      inputId="focal-length"
      @change="updateFocalLength"
    />
    <NumberInputPicker
      v-model="focalRatio"
      :label="$t('components.settings.telescope.focal_ratio')"
      labelKey="components.settings.telescope.focal_ratio"
      :min="1"
      :max="50"
      :step="0.1"
      :decimalPlaces="1"
      inputId="focal-ratio"
      @change="updateFocalRatio"
    />
  </div>
</template>

<script setup>
import { useProfileSetting } from '@/composables/useProfileSetting';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const {
  value: telescopeName,
  save: updateTelescopeName,
  glowClass: nameStatusClass,
} = useProfileSetting('TelescopeSettings-Name', { fallback: '' });
// An empty or zero profile value shows the old defaults, as before.
const { value: focalLength, save: updateFocalLength } = useProfileSetting(
  'TelescopeSettings-FocalLength',
  { fallback: 500, fromProfile: (v) => v || 500 }
);
const { value: focalRatio, save: updateFocalRatio } = useProfileSetting(
  'TelescopeSettings-FocalRatio',
  { fallback: 5.0, fromProfile: (v) => v || 5.0 }
);
</script>
