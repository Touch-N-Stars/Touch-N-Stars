<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.slewRate.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.slewRate.description') }}
      </p>
    </div>

    <NumberInputPicker
      v-model="indiMaxSlewRateDps"
      :label="t('components.setupWizard.slewRate.maxSlewRate')"
      labelKey="components.setupWizard.slewRate.maxSlewRate"
      :min="0.1"
      :max="20"
      :step="0.1"
      :decimalPlaces="1"
      inputId="wizard-indi-max-slew-rate"
      @change="updateMaxSlewRate"
    />
    <p class="text-xs text-content-faint">
      {{ t('components.setupWizard.slewRate.maxSlewRateHint') }}
    </p>

    <SettingInput
      labelKey="components.mount.settings.telescope_settle_time"
      settingKey="TelescopeSettings-SettleTime"
      :modelValue="store.profileInfo?.TelescopeSettings?.SettleTime ?? 0"
      :max="600"
    />

    <p v-if="errorMessage" class="text-sm text-status-danger break-words">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import SettingInput from '@/components/helpers/settings/UpdateProfileNumber.vue';

const { t } = useI18n();
const store = apiStore();

const MAX_SLEW_RATE_FALLBACK = 3.0;

const indiMaxSlewRateDps = ref(MAX_SLEW_RATE_FALLBACK);
const errorMessage = ref('');
const touched = ref(false);

// settingsMount.vue seeds this in onMounted only, so it keeps showing 3.0 when the
// profile arrives with the 2s poll. Watch instead, but never fight a user edit.
watch(
  () => store.profileInfo?.TelescopeSettings?.IndiMaxSlewRateDps,
  (value) => {
    if (touched.value) return;
    indiMaxSlewRateDps.value = value ?? MAX_SLEW_RATE_FALLBACK;
  },
  { immediate: true }
);

async function updateMaxSlewRate() {
  touched.value = true;
  errorMessage.value = '';
  try {
    await apiService.profileChangeValue(
      'TelescopeSettings-IndiMaxSlewRateDps',
      indiMaxSlewRateDps.value
    );
  } catch (error) {
    console.error('[PinsWizard] Max slew rate failed:', error);
    errorMessage.value = t('components.setupWizard.slewRate.saveFailed', {
      message: error.message,
    });
  }
}
</script>
