<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.slewRate.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.slewRate.whatFor') }}
      </p>
    </div>

    <!-- Read from the driver: nobody is expected to know this number. -->
    <div class="flex flex-col gap-2 rounded-control border border-line p-3">
      <div v-if="state === 'reading'" class="flex items-center gap-2 text-sm text-content-muted">
        <Spinner size="sm" />{{ t('components.setupWizard.slewRate.reading') }}
      </div>

      <div v-else-if="state === 'derived'" class="flex items-start gap-3">
        <span class="tns-dot bg-status-ok mt-1.5"></span>
        <p class="text-sm text-content">
          {{
            t('components.setupWizard.slewRate.derived', {
              label: derivedLabel,
              value: formatDps(indiMaxSlewRateDps),
            })
          }}
        </p>
      </div>

      <p v-else-if="state === 'notNeeded'" class="text-sm text-content">
        {{ t('components.setupWizard.slewRate.notNeeded') }}
      </p>

      <p v-else-if="state === 'unknown'" class="text-sm text-content">
        {{ t('components.setupWizard.slewRate.unknown', { value: formatDps(indiMaxSlewRateDps) }) }}
      </p>

      <template v-else-if="state === 'notConnected' || state === 'failed'">
        <p class="text-sm text-content">
          {{
            t(
              state === 'failed'
                ? 'components.setupWizard.slewRate.readFailed'
                : 'components.setupWizard.slewRate.notConnected',
              { value: formatDps(indiMaxSlewRateDps) }
            )
          }}
        </p>
        <button
          v-if="store.mountInfo?.Connected"
          type="button"
          class="tns-btn-secondary"
          @click="readFromDriver"
        >
          {{ t('components.setupWizard.slewRate.readAgain') }}
        </button>
      </template>
    </div>

    <button
      type="button"
      class="tns-btn-ghost justify-start! px-0! text-sm!"
      :aria-expanded="showManual"
      @click="showManual = !showManual"
    >
      <ChevronDownIcon class="w-4 h-4 transition-transform" :class="{ 'rotate-180': showManual }" />
      {{ t('components.setupWizard.slewRate.setManually') }}
    </button>
    <template v-if="showManual">
      <NumberInputPicker
        v-model="indiMaxSlewRateDps"
        :label="t('components.setupWizard.slewRate.maxSlewRate')"
        labelKey="components.setupWizard.slewRate.maxSlewRate"
        :min="0.1"
        :max="20"
        :step="0.1"
        :decimalPlaces="2"
        :useDefaultSentinel="false"
        inputId="wizard-indi-max-slew-rate"
        @change="onManualChange"
      />
      <p class="text-xs text-content-faint">
        {{ t('components.setupWizard.slewRate.manualHint') }}
      </p>
    </template>

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
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import Spinner from '@/components/helpers/Spinner.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import SettingInput from '@/components/helpers/settings/UpdateProfileNumber.vue';
import { deriveMaxSlewRate, slewRateDiffers } from '@/utils/mountSlewRate';

const { t, locale } = useI18n();
const store = apiStore();

// PINS' own default (TelescopeSettings.cs).
const MAX_SLEW_RATE_FALLBACK = 4.0;

const indiMaxSlewRateDps = ref(MAX_SLEW_RATE_FALLBACK);
const errorMessage = ref('');
// A value typed by the user is never overwritten, neither by the poll nor by the driver.
const touched = ref(false);
const showManual = ref(false);
// reading | derived | notNeeded | unknown | notConnected | failed
const state = ref('notConnected');
const derivedLabel = ref('');

// The profile arrives with the 2 s poll, so watch it instead of seeding once in onMounted.
watch(
  () => store.profileInfo?.TelescopeSettings?.IndiMaxSlewRateDps,
  (value) => {
    if (touched.value) return;
    indiMaxSlewRateDps.value = value ?? MAX_SLEW_RATE_FALLBACK;
  },
  { immediate: true }
);

function formatDps(value) {
  const number = Number(value) || 0;
  try {
    return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(number);
  } catch {
    // Some app locale codes (e.g. 'cz') are no valid BCP 47 tags in every engine.
    return String(Math.round(number * 100) / 100);
  }
}

async function saveMaxSlewRate(value) {
  errorMessage.value = '';
  try {
    const response = await apiService.profileChangeValue(
      'TelescopeSettings-IndiMaxSlewRateDps',
      value
    );
    if (response?.Success === false) throw new Error(response.Error || 'save failed');
    return true;
  } catch (error) {
    console.error('[PinsWizard] Max slew rate failed:', error);
    errorMessage.value = t('components.setupWizard.slewRate.saveFailed', {
      message: error.message,
    });
    return false;
  }
}

async function readFromDriver() {
  // The driver only names its speeds once it talks to the mount.
  if (!store.mountInfo?.Connected) {
    state.value = 'notConnected';
    return;
  }
  state.value = 'reading';
  try {
    const response = await apiService.getMountSlewRates();
    if (response?.Success === false || !response?.Response) {
      throw new Error(response?.Error || 'no slew rates');
    }
    const result = deriveMaxSlewRate(response.Response);
    if (result.status !== 'derived') {
      state.value = result.status;
      return;
    }
    derivedLabel.value = result.label;
    if (!touched.value) {
      if (
        slewRateDiffers(store.profileInfo?.TelescopeSettings?.IndiMaxSlewRateDps, result.dps) &&
        !(await saveMaxSlewRate(result.dps))
      ) {
        state.value = 'failed';
        return;
      }
      indiMaxSlewRateDps.value = result.dps;
    }
    state.value = 'derived';
  } catch (error) {
    console.warn('[PinsWizard] Reading slew rates failed:', error);
    state.value = 'failed';
  }
}

async function onManualChange() {
  touched.value = true;
  await saveMaxSlewRate(indiMaxSlewRateDps.value);
}

// The mount may get connected while this step is open (e.g. after going back one step).
watch(
  () => Boolean(store.mountInfo?.Connected),
  (connected, wasConnected) => {
    if (connected && !wasConnected) readFromDriver();
  }
);

onMounted(readFromDriver);
</script>
