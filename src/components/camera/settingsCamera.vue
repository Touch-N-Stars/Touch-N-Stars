<template>
  <div v-if="store.cameraInfo.Connected" class="flex flex-wrap items-center gap-2">
    <NumberInputPicker
      class="border border-gray-500 p-1 md:p-2 rounded-lg"
      v-model="settingsStore.camera.exposureTime"
      :label="$t('components.camera.exposure_time')"
      labelKey="components.camera.exposure_time"
      :min="0"
      :max="9999"
      :step="0.001"
      :decimalPlaces="3"
      placeholder="sek"
      inputId="exposure"
    />
    <div
      v-if="store.cameraInfo.Gains && store.cameraInfo.Gains.length > 0"
      class="flex items-center justify-between min-w-28 border border-gray-500 p-1 md:p-2 rounded-lg"
    >
      <label for="gain" class="text-xs md:text-sm text-gray-200 font-medium">
        {{ $t('components.camera.gain_iso') }}
      </label>
      <select
        id="gain"
        v-model.number="settingsStore.camera.gain"
        @change="setGain"
        class="default-select h-7 md:h-8 w-20 md:w-28"
      >
        <option v-for="(value, key) in store.cameraInfo.Gains" :key="key" :value="value">
          {{ value }}
        </option>
      </select>
    </div>
    <NumberInputPicker
      v-else
      class="border border-gray-500 p-1 md:p-2 rounded-lg"
      v-model="settingsStore.camera.gain"
      :label="$t('components.camera.gain_iso')"
      labelKey="components.camera.gain_iso"
      :min="0"
      :max="9999"
      :step="1"
      :decimalPlaces="0"
      placeholder="1"
      inputId="gain"
      @change="setGain"
    />
    <div v-if="store.cameraInfo.CanSetOffset" class="w-full">
      <div
        v-if="store.cameraInfo.Offset && store.cameraInfo.Offset.length > 0"
        class="flex items-center justify-between min-w-28 border border-gray-500 p-1 md:p-2 rounded-lg"
      >
        <label for="offset" class="text-xs md:text-sm text-gray-200 font-medium">
          {{ $t('components.camera.offset') }}
        </label>
        <select
          id="offset"
          v-model.number="settingsStore.camera.offset"
          @change="setOffset"
          class="default-select h-7 md:h-8 w-20 md:w-28"
        >
          <option v-for="(value, key) in store.cameraInfo.Offset" :key="key" :value="key">
            {{ value }}
          </option>
        </select>
      </div>
      <NumberInputPicker
        v-else
        class="border border-gray-500 p-1 md:p-2 rounded-lg"
        v-model="settingsStore.camera.offset"
        :label="$t('components.camera.offset')"
        labelKey="components.camera.offset"
        :min="store.cameraInfo.OffsetMin"
        :max="store.cameraInfo.OffsetMax"
        :step="1"
        :decimalPlaces="0"
        placeholder="0"
        inputId="offset"
        @change="setOffset"
      />
    </div>
    <setBinning v-if="store.cameraInfo.BinningModes.length > 1" />
    <pinsSetBinAverageEnabled
      v-if="store.isPINS && cameraStore.cameraSettings.SupportedActions?.includes('Bin Average')"
    />
    <div v-if="store.cameraInfo.ReadoutModes.length > 1" class="w-full">
      <setReadoutMode v-if="!store.isPINS" />
      <pinsSetReadoutMode v-else />
    </div>
    <pinsSetLowNoiseMode v-if="store.isPINS && cameraStore.cameraSettings.HasLowNoiseMode" />
    <pinsSetBadPixelCorrection
      v-if="store.isPINS && cameraStore.cameraSettings?.BadPixelCorrection !== undefined"
    />
    <pinsSetHighFullwellMode v-if="store.isPINS && cameraStore.cameraSettings.HasHighFullwell" />
    <pinsSetLEDLights v-if="store.isPINS && cameraStore.cameraSettings.CanSetLEDLights" />
    <div v-if="store.cameraInfo.CanSetUSBLimit" class="w-full">
      <setCameraUsbLimit v-if="!store.isPINS" />
      <pinsSetCameraUsbLimit v-else />
    </div>
    <pinsSetFanSpeed v-if="store.isPINS && cameraStore.cameraSettings.MaxFanSpeed > 0" />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import setBinning from '@/components/camera/setBinning.vue';
import setReadoutMode from '@/components/camera/setReadoutMode.vue';
import setCameraUsbLimit from './setCameraUsbLimit.vue';
import pinsSetCameraUsbLimit from './settingsPins/pinsSetCameraUsbLimit.vue';
import pinsSetLowNoiseMode from './settingsPins/pinsSetLowNoiseMode.vue';
import pinsSetBadPixelCorrection from './settingsPins/pinsSetBadPixelCorrection.vue';
import pinsSetHighFullwellMode from './settingsPins/pinsSetHighFullwellMode.vue';
import pinsSetBinAverageEnabled from './settingsPins/pinsSetBinAverageEnabled.vue';
import pinsSetLEDLights from './settingsPins/pinsSetLEDLights.vue';
import pinsSetFanSpeed from './settingsPins/pinsSetFanSpeed.vue';
import pinsSetReadoutMode from './settingsPins/pinsSetReadoutMode.vue';
import { useCameraStore } from '@/store/cameraStore';

const store = apiStore();
const settingsStore = useSettingsStore();
const cameraStore = useCameraStore();

// Setzt den initialen Offset
const initializeOffset = () => {
  if (!store.cameraInfo) {
    console.warn('Camera info not loaded');
    return;
  }

  const offset = store.cameraInfo.Offset ?? 0; // Falls undefined -> Standardwert 1
  settingsStore.camera.offset = offset;
};

const initializeGain = () => {
  if (!store.cameraInfo) {
    console.warn('Camera info not loaded');
    return;
  }

  settingsStore.camera.gain = store.profileInfo?.SnapShotControlSettings?.Gain || 0;
  if (settingsStore.camera.gain === -1) {
    settingsStore.camera.gain = store.profileInfo?.CameraSettings?.Gain;
    //console.log('[SettingsCamera] Gain from CameraSettings used:', settingsStore.camera.gain);
  }
};

async function setOffset() {
  console.log(settingsStore.camera.offset);
  if (store.cameraInfo.OffsetMin > settingsStore.camera.offset) {
    settingsStore.camera.offset = store.cameraInfo.OffsetMin;
    console.log('Offset too small, min:', store.cameraInfo.OffsetMin);
  }
  if (store.cameraInfo.OffsetMax < settingsStore.camera.offset) {
    settingsStore.camera.offset = store.cameraInfo.OffsetMax;
    console.log('Offset too large, max:', store.cameraInfo.OffsetMax);
  }
  try {
    await apiService.profileChangeValue('CameraSettings-Offset', settingsStore.camera.offset);
    settingsStore.saveCameraSettings();
  } catch (error) {
    console.log('Error while setting offset');
  }
}

async function setGain() {
  try {
    await apiService.profileChangeValue('SnapShotControlSettings-Gain', settingsStore.camera.gain);
    await apiService.profileChangeValue('CameraSettings-Gain', settingsStore.camera.gain);
    settingsStore.saveCameraSettings();
  } catch (error) {
    console.log('Error while setting gain');
  }
}

onMounted(() => {
  initializeOffset();
  initializeGain();
});
</script>
