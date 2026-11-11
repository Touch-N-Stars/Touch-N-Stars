<template>
  <div class="flex flex-col w-full border border-line-strong p-1 md:p-2 rounded-lg">
    <!-- ROI Percentage -->
    <div class="flex flex-row items-center justify-between">
      <NumberInputPicker
        v-model="roiPercentage"
        :label="$t('components.guider.roiPercentage')"
        labelKey="components.guider.roiPercentage"
        :min="0"
        :max="100"
        :step="1"
        :decimalPlaces="0"
        placeholder="25"
        inputId="roiPercentage"
        wrapperClass="w-24"
        @change="setRoiPercentage"
      />
    </div>
  </div>
</template>

<script setup>
import { useProfileSetting } from '@/composables/useProfileSetting';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const { value: roiPercentage, save: setRoiPercentage } = useProfileSetting(
  'GuiderSettings-PHD2ROIPct',
  { fallback: 25 }
);
</script>
