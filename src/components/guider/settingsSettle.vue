<template>
  <div class="flex flex-col w-full border border-line-strong p-1 md:p-2 rounded-lg">
    <!-- Settle Pixel Tolerance -->
    <div class="flex flex-row items-center justify-between">
      <NumberInputPicker
        v-model="settlePixels"
        :label="$t('components.guider.settlePixels')"
        labelKey="components.guider.settlePixels"
        :min="0"
        :max="100"
        :step="0.1"
        :decimalPlaces="1"
        placeholder="1.5"
        inputId="settlePixels"
        wrapperClass="w-24"
        @change="setSettlePixels"
      />
    </div>

    <!-- Minimum Settle Time -->
    <div class="flex flex-row items-center justify-between mt-2 md:mt-3">
      <NumberInputPicker
        v-model="settleTime"
        :label="$t('components.guider.settleTime')"
        labelKey="components.guider.settleTime"
        :min="0"
        :max="300"
        :step="1"
        :decimalPlaces="0"
        placeholder="10"
        inputId="settleTime"
        wrapperClass="w-24"
        @change="setSettleTime"
      />
    </div>

    <!-- Settle Timeout -->
    <div class="flex flex-row items-center justify-between mt-2 md:mt-3">
      <NumberInputPicker
        v-model="settleTimeout"
        :label="$t('components.guider.settleTimeout')"
        labelKey="components.guider.settleTimeout"
        :min="0"
        :max="300"
        :step="1"
        :decimalPlaces="0"
        placeholder="30"
        inputId="settleTimeout"
        wrapperClass="w-24"
        @change="setSettleTimeout"
      />
    </div>
  </div>
</template>

<script setup>
import { useProfileSetting } from '@/composables/useProfileSetting';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const { value: settlePixels, save: setSettlePixels } = useProfileSetting(
  'GuiderSettings-SettlePixels',
  { fallback: 1.5 }
);
const { value: settleTime, save: setSettleTime } = useProfileSetting('GuiderSettings-SettleTime', {
  fallback: 10,
});
const { value: settleTimeout, save: setSettleTimeout } = useProfileSetting(
  'GuiderSettings-SettleTimeout',
  { fallback: 30 }
);
</script>
