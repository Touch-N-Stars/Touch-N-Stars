<template>
  <div class="block">
    <label class="block text-sm font-medium text-content mb-2">{{
      $t('components.settings.image.black_clipping')
    }}</label>
    <NumberInputPicker
      v-model="setValue"
      labelKey="components.settings.image.black_clipping"
      :min="-10"
      :max="0"
      :step="0.1"
      :decimalPlaces="1"
      placeholder="-2.8"
      inputId="black-clipping"
      wrapperClass="w-full"
      @change="updateSetting"
    />
  </div>
</template>
<script setup>
import { useProfileSetting } from '@/composables/useProfileSetting';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const { value: setValue, save: updateSetting } = useProfileSetting('ImageSettings-BlackClipping', {
  fallback: 0,
  toProfile: (v) => String(v).replace(',', '.'),
});
</script>
