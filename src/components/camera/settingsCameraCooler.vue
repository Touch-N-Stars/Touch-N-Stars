<template>
  <div class="flex flex-col items-center gap-2">
    <div v-if="store.cameraInfo.CanSetTemperature" class="w-full">
      <div
        class="flex flex-col min-w-36"
        :class="{ 'border border-slate-600/40 p-3 rounded-lg': !compact }"
      >
        <!-- Cooler status indicator, driven by the central cameraStore.coolingState.
             Compact mode leaves it out: the status bar panel shows the state next to it. -->
        <div
          v-if="!compact"
          class="flex items-center justify-center gap-2 px-3 py-2 mb-3 rounded-lg"
          :class="{
            'bg-slate-700/40': coolingState === 'off',
            'bg-blue-600/20 border border-blue-500/40': coolingState === 'cooling',
            'bg-green-600/20 border border-green-500/40': coolingState === 'holding',
            'bg-orange-600/20 border border-orange-500/40': coolingState === 'warming',
          }"
        >
          <span class="text-xs text-gray-300 font-medium">
            {{ $t('components.camera.cooler_status') }}:
          </span>
          <span
            class="text-xs font-semibold"
            :class="{
              'text-gray-400': coolingState === 'off',
              'text-blue-400': coolingState === 'cooling',
              'text-green-400': coolingState === 'holding',
              'text-orange-400': coolingState === 'warming',
            }"
          >
            {{ coolerStatusText }}
          </span>
        </div>

        <div v-if="!compact" class="border-t border-slate-600/40 mb-3"></div>

        <div class="flex flex-col justify-between sm:flex-row gap-2">
          <NumberInputPicker
            class="border border-line-strong p-1 md:p-2 rounded-control"
            v-model="store.profileInfo.CameraSettings.Temperature"
            :label="$t('components.camera.target_temperature')"
            labelKey="components.camera.target_temperature"
            :min="-50"
            :max="30"
            :step="1"
            :decimalPlaces="0"
            placeholder="-10"
            inputId="TemperatureSetPoint"
            wrapperClass="sm:flex-1 col-span-2"
            @change="setCoolingTemp"
          />

          <NumberInputPicker
            v-if="!compact"
            class="border border-line-strong p-1 md:p-2 rounded-control"
            v-model="store.profileInfo.CameraSettings.CoolingDuration"
            :label="$t('components.camera.cooling_time')"
            labelKey="components.camera.cooling_time"
            :min="0"
            :max="300"
            :step="1"
            :decimalPlaces="0"
            placeholder="1"
            inputId="CoolingDurationTime"
            wrapperClass="sm:flex-1 col-span-2"
            @change="setCoolingTime"
          />
        </div>

        <div v-if="!compact" class="flex flex-col justify-between sm:flex-row gap-2 mt-2">
          <NumberInputPicker
            class="border border-line-strong p-1 md:p-2 rounded-control"
            v-model="store.profileInfo.CameraSettings.WarmingDuration"
            :label="$t('components.camera.warm_up_time')"
            labelKey="components.camera.warm_up_time"
            :min="0"
            :max="300"
            :step="1"
            :decimalPlaces="0"
            inputId="WarmingDurationTime"
            wrapperClass="w-full sm:w-1/2"
            @change="setWarmingTime"
          />
        </div>

        <div v-if="!compact" class="border-t border-slate-600/40 my-4"></div>

        <!-- Action buttons like NINA: the running action turns into a cancel button -->
        <div class="grid grid-cols-2 gap-2" :class="{ 'mt-2': compact }">
          <button
            @click="onCoolDown"
            :disabled="coolBtnDisabled"
            class="flex items-center justify-center gap-2 rounded-control border px-3 py-1.5 h-7 md:h-8 text-xs md:text-sm font-medium text-content disabled:opacity-50 disabled:cursor-not-allowed"
            :class="
              isCoolingActive
                ? 'border-blue-500/60 bg-blue-600/20 text-blue-300'
                : 'border-line-strong bg-slate-700/40'
            "
          >
            <svg
              v-if="isCoolingActive"
              class="h-3.5 w-3.5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
            {{ isCoolingActive ? $t('general.cancel') : $t('components.camera.cool_down') }}
          </button>

          <button
            @click="onWarmUp"
            :disabled="warmBtnDisabled"
            class="flex items-center justify-center gap-2 rounded-control border px-3 py-1.5 h-7 md:h-8 text-xs md:text-sm font-medium text-content disabled:opacity-50 disabled:cursor-not-allowed"
            :class="
              isWarmingActive
                ? 'border-orange-500/60 bg-orange-600/20 text-orange-300'
                : 'border-line-strong bg-slate-700/40'
            "
          >
            <svg
              v-if="isWarmingActive"
              class="h-3.5 w-3.5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
            {{ isWarmingActive ? $t('general.cancel') : $t('components.camera.warm_up') }}
          </button>
        </div>
      </div>
    </div>
    <div v-if="store.cameraInfo.HasDewHeater && !compact" class="w-full">
      <div class="flex flex-col border border-slate-600/40 p-3 rounded-lg">
        <div
          class="flex items-center justify-between border border-line-strong p-1 md:p-2 rounded-control"
        >
          <label for="DewHeater" class="text-xs md:text-sm text-content font-medium">
            {{ $t('components.camera.dew_heater') }}
          </label>
          <toggleButton
            @click="toggleDewHeater"
            :status-value="store.cameraInfo.DewHeaterOn"
            class="h-7 md:h-8"
          />
        </div>
        <pinsSetDewHeaterStrength v-if="store.isPINS" class="mt-2" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useCameraStore } from '@/store/cameraStore';
import apiService from '@/services/apiService';
import toggleButton from '@/components/helpers/toggleButton.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import pinsSetDewHeaterStrength from './settingsPins/pinsSetDewHeaterStrength.vue';

// Compact (status bar panel): target temperature and the two buttons only.
const { compact } = defineProps({
  compact: { type: Boolean, default: false },
});

const store = apiStore();
const cameraStore = useCameraStore();
const { t } = useI18n();

const coolingState = computed(() => cameraStore.coolingState);
const isCoolingActive = computed(() => coolingState.value === 'cooling');
const isWarmingActive = computed(() => coolingState.value === 'warming');
const isPendingCancel = computed(() => cameraStore.coolingPending === 'cancel');

// The active button becomes a cancel button; the opposite one is disabled
// while a ramp runs or a cancel is still pending.
const coolBtnDisabled = computed(
  () => !store.cameraInfo.Connected || isWarmingActive.value || isPendingCancel.value
);
const warmBtnDisabled = computed(
  () => !store.cameraInfo.Connected || isCoolingActive.value || isPendingCancel.value
);

const coolerStatusText = computed(() => {
  const currentTemp = Math.round(store.cameraInfo.Temperature);
  // Cool-down target from the central store (profile setting first, see
  // cameraStore.targetTemp). Only valid for cooling: the true warm-up
  // destination is not exposed by NINA.
  const target = cameraStore.targetTemp;
  const targetText = target != null && !isNaN(target) ? ` ${Math.round(target)}°C` : '';

  switch (coolingState.value) {
    case 'cooling':
      return `${t('components.camera.cooler_status_cooling')}${targetText}`;
    case 'holding':
      return `${t('components.camera.cooler_status_holding')} (${currentTemp}°C)`;
    case 'warming':
      return t('components.camera.cooler_status_warming');
    default:
      return t('components.camera.cooler_status_off');
  }
});

async function setCoolingTime() {
  try {
    await apiService.profileChangeValue(
      'CameraSettings-CoolingDuration',
      store.profileInfo.CameraSettings.CoolingDuration
    );
  } catch (error) {
    console.log('[Camera] setCoolingTime error:', error);
  }
}

async function setWarmingTime() {
  try {
    await apiService.profileChangeValue(
      'CameraSettings-WarmingDuration',
      store.profileInfo.CameraSettings.WarmingDuration
    );
  } catch (error) {
    console.log('[Camera] setWarmingTime error:', error);
  }
}

async function setCoolingTemp() {
  try {
    await apiService.profileChangeValue(
      'CameraSettings-Temperature',
      store.profileInfo.CameraSettings.Temperature
    );
  } catch (error) {
    console.log('[Camera] setCoolingTemp error:', error);
  }
}

async function onCoolDown() {
  try {
    if (isCoolingActive.value) {
      await cameraStore.cancelTempChange();
      return;
    }
    await cameraStore.startCooling(
      store.profileInfo.CameraSettings.Temperature,
      store.profileInfo.CameraSettings.CoolingDuration
    );
  } catch (error) {
    console.log('[Camera] onCoolDown error:', error);
  }
}

async function onWarmUp() {
  try {
    if (isWarmingActive.value) {
      await cameraStore.cancelTempChange();
      return;
    }
    await cameraStore.startWarming(store.profileInfo.CameraSettings.WarmingDuration);
  } catch (error) {
    console.log('[Camera] onWarmUp error:', error);
  }
}

function toggleDewHeater() {
  const enable = !store.cameraInfo.DewHeaterOn;
  try {
    const data = apiService.startStoppDewheater(enable);
    console.log('[Camera] toggleDewHeater', data);
  } catch (error) {
    console.log('[Camera] toggleDewHeater error:', error);
  }
}
</script>
