<template>
  <div class="tns-card flex flex-col gap-2 sm:gap-3">
    <h3 class="tns-section-title">
      {{ $t('components.settings.mount.titel') }}
    </h3>
    <NumberInputPicker
      v-model="indiMaxSlewRateDps"
      :label="$t('components.settings.mount.max_slew_rate')"
      labelKey="components.settings.mount.max_slew_rate"
      :min="0.1"
      :max="20"
      :step="0.1"
      :decimalPlaces="1"
      inputId="indi-max-slew-rate"
      @change="updateIndiMaxSlewRateDps"
    />
    <SettingInput
      labelKey="components.mount.settings.telescope_settle_time"
      settingKey="TelescopeSettings-SettleTime"
      :modelValue="store.profileInfo?.TelescopeSettings?.SettleTime ?? 0"
      :max="600"
    />
  </div>
</template>

<script setup>
import { apiStore } from '@/store/store';
import { useProfileSetting } from '@/composables/useProfileSetting';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import SettingInput from '@/components/helpers/settings/UpdatePorfileNumber.vue';

const store = apiStore();

const { value: indiMaxSlewRateDps, save: updateIndiMaxSlewRateDps } = useProfileSetting(
  'TelescopeSettings-IndiMaxSlewRateDps',
  { fallback: 3.0 }
);
</script>
