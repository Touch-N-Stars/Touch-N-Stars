<template>
  <div class="block">
    <label class="block text-sm font-medium text-gray-300 mb-2">{{
      $t('components.settings.image.quality')
    }}</label>
    <NumberInputPicker
      v-model="settingsStore.camera.imageQuality"
      labelKey="components.settings.image.quality"
      :min="1"
      :max="100"
      :step="1"
      :decimalPlaces="0"
      placeholder="90"
      inputId="image-quality"
      wrapperClass="w-full"
      @change="updateSetting"
    />
  </div>
</template>
<script setup>
import { useSettingsStore } from '@/store/settingsStore';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const settingsStore = useSettingsStore();

async function updateSetting() {
  // StatusClass feedback wird durch NumberInputPicker gehandhabt
}
</script>