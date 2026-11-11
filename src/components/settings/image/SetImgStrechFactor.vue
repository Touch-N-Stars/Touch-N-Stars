<template>
  <div class="block">
    <label class="block text-sm font-medium text-content mb-2">{{
      $t('components.settings.image.strech_factor')
    }}</label>
    <NumberInputPicker
      v-model="strechFactor"
      labelKey="components.settings.image.strech_factor"
      :min="0"
      :max="10"
      :step="0.1"
      :decimalPlaces="1"
      placeholder="0.1"
      inputId="strech-factor"
      wrapperClass="w-full"
      @change="updateSetting"
    />
  </div>
</template>
<script setup>
import { useProfileSetting } from '@/composables/useProfileSetting';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const { value: strechFactor, save: updateSetting } = useProfileSetting(
  'ImageSettings-AutoStretchFactor',
  { fallback: 0, toProfile: (v) => String(v).replace(',', '.') }
);
</script>
