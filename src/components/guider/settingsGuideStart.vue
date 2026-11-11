<template>
  <div class="flex flex-col w-full border border-line-strong p-1 md:p-2 rounded-lg">
    <!-- Guiding Start Retry -->
    <ProfileToggle
      labelKey="components.guider.guidingStartRetry"
      settingKey="GuiderSettings-AutoRetryStartGuiding"
      labelClass="text-xs md:text-sm text-content"
      toggleClass="pr-5 pl-5 justify-center h-7 md:h-8"
    />

    <!-- Guiding Start Timeout -->
    <div class="flex flex-row items-center justify-between">
      <NumberInputPicker
        v-model="guidingStartTimeout"
        :label="$t('components.guider.guidingStartTimeout')"
        labelKey="components.guider.guidingStartTimeout"
        :min="0"
        :max="300"
        :step="1"
        :decimalPlaces="0"
        placeholder="60"
        inputId="guidingStartTimeout"
        wrapperClass="w-24"
        @change="setGuidingStartTimeout"
      />
    </div>
  </div>
</template>

<script setup>
import { useProfileSetting } from '@/composables/useProfileSetting';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import ProfileToggle from '@/components/helpers/settings/ProfileToggle.vue';

const { value: guidingStartTimeout, save: setGuidingStartTimeout } = useProfileSetting(
  'GuiderSettings-AutoRetryStartGuidingTimeoutSeconds',
  { fallback: 60 }
);
</script>
