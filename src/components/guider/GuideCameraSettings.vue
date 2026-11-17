<template>
  <div class="flex flex-col gap-3" data-testid="guide-camera-settings">
    <!-- Gain: the camera's named gains as a list, otherwise a number; -1 keeps the driver default -->
    <div v-if="showExposure && gainList.length" class="flex items-center gap-2">
      <label for="guide-camera-gain" class="text-xs md:text-sm text-content mr-3">
        {{ $t('components.guideCamera.gain') }}
      </label>
      <select
        id="guide-camera-gain"
        v-model.number="gain"
        class="tns-select ml-auto w-36 md:w-40"
        @change="saveGain"
      >
        <option :value="-1">{{ $t('components.helpers.numberInput.default') }}</option>
        <!-- NINA stores the gain itself, not its position in the list -->
        <option v-for="g in gainList" :key="g" :value="g">{{ g }}</option>
      </select>
    </div>
    <NumberInputPicker
      v-else-if="showExposure && canSetGain"
      v-model="gain"
      :label="$t('components.guideCamera.gain')"
      labelKey="components.guideCamera.gain"
      :min="-1"
      :max="info.GainMax ?? 10000"
      :step="1"
      :decimalPlaces="0"
      :defaultValue="connected ? (info.Gain ?? null) : null"
      inputId="guide-camera-gain"
      @change="saveGain"
    />

    <NumberInputPicker
      v-if="showExposure && canSetOffset"
      v-model="offset"
      :label="$t('components.guideCamera.offset')"
      labelKey="components.guideCamera.offset"
      :min="-1"
      :max="info.OffsetMax ?? 10000"
      :step="1"
      :decimalPlaces="0"
      :defaultValue="connected ? (info.Offset ?? null) : null"
      inputId="guide-camera-offset"
      @change="saveOffset"
    />

    <template v-if="connected">
      <div v-if="showExposure && info.BinningModes?.length > 1" class="flex items-center gap-2">
        <label for="guide-camera-binning" class="text-xs md:text-sm text-content mr-3">
          {{ $t('components.guideCamera.binning') }}
        </label>
        <select
          id="guide-camera-binning"
          :value="binning"
          class="tns-select ml-auto w-36 md:w-40"
          @change="setBinning($event.target.value)"
        >
          <option v-for="mode in info.BinningModes" :key="mode.Name" :value="mode.Name">
            {{ mode.Name }}
          </option>
        </select>
      </div>

      <div v-if="info.ReadoutModes?.length > 1" class="flex items-center gap-2">
        <label for="guide-camera-readout" class="text-xs md:text-sm text-content mr-3">
          {{ $t('components.guideCamera.readoutMode') }}
        </label>
        <select
          id="guide-camera-readout"
          v-model.number="readoutMode"
          class="tns-select ml-auto w-36 md:w-40"
          @change="saveReadoutMode"
        >
          <option v-for="(mode, index) in info.ReadoutModes" :key="index" :value="index">
            {{ mode }}
          </option>
        </select>
      </div>

      <div v-if="info.CanSetUSBLimit" class="flex items-center gap-2">
        <label for="guide-camera-usb-limit" class="text-xs md:text-sm text-content mr-3">
          {{ $t('components.guideCamera.usbLimit') }}
        </label>
        <select
          id="guide-camera-usb-limit"
          v-model.number="usbLimit"
          class="tns-select ml-auto w-36 md:w-40"
          @change="saveUsbLimit"
        >
          <option v-for="n in usbLimits" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>

      <div v-if="deviceSettings?.MaxFanSpeed > 0" class="flex items-center gap-2">
        <label for="guide-camera-fan" class="text-xs md:text-sm text-content mr-3">
          {{ $t('components.camera.FanSpeed') }}
        </label>
        <select
          id="guide-camera-fan"
          v-model.number="fanSpeed"
          class="tns-select ml-auto w-36 md:w-40"
          @change="saveFanSpeed"
        >
          <option v-for="n in deviceSettings.MaxFanSpeed + 1" :key="n - 1" :value="n - 1">
            {{ n - 1 }}
          </option>
        </select>
      </div>

      <PinsSettingToggle
        v-if="deviceSettings?.SupportedActions?.includes('Bin Average')"
        device="guideCamera"
        settingName="BinAverageEnabled"
        labelKey="components.camera.BinAverageEnabled"
      />
      <PinsSettingToggle
        v-if="deviceSettings?.HasLowNoiseMode"
        device="guideCamera"
        settingName="LowNoiseMode"
        labelKey="components.camera.LowNoiseMode"
      />
      <PinsSettingToggle
        v-if="deviceSettings?.HasHighFullwell"
        device="guideCamera"
        settingName="HighFullwellMode"
        labelKey="components.camera.HighFullwellMode"
      />
      <PinsSettingToggle
        v-if="deviceSettings?.CanSetLEDLights"
        device="guideCamera"
        settingName="LEDLights"
        labelKey="components.camera.LEDLights"
      />
    </template>
    <p v-else class="text-xs text-content-muted">
      {{ $t('components.guideCamera.connectForMore') }}
    </p>

    <p v-if="errorMessage" class="text-sm text-status-danger break-words">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { computed, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useCameraStore } from '@/store/cameraStore';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import PinsSettingToggle from '@/components/helpers/settings/PinsSettingToggle.vue';

const props = defineProps({
  // Gain, offset and binning. The native guider has these as settings of its own, which win
  // over the camera's defaults, so its settings sheet shows only the camera's device options.
  showExposure: { type: Boolean, default: true },
});
const { showExposure } = toRefs(props);

const store = apiStore();
const cameraStore = useCameraStore();
const { t } = useI18n();

const info = computed(() => store.guideCameraInfo);
const settings = computed(() => store.profileInfo?.GuideCameraSettings ?? {});
const deviceSettings = computed(() => cameraStore.guideCameraSettings);
const connected = computed(() => Boolean(info.value.Connected));

// Without a connected camera nothing is known about it: gain and offset stay editable as plain
// profile values, everything else needs the camera.
const canSetGain = computed(() => !connected.value || info.value.CanSetGain);
const canSetOffset = computed(() => !connected.value || info.value.CanSetOffset);
const gainList = computed(() => (connected.value && info.value.Gains) || []);
const binning = computed(() => `${info.value.BinX ?? 1}x${info.value.BinY ?? 1}`);

const usbLimits = computed(() => {
  const min = Number.isFinite(info.value.USBLimitMin) ? info.value.USBLimitMin : 0;
  const max = Number.isFinite(info.value.USBLimitMax) ? info.value.USBLimitMax : 100;
  return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
});

const gain = ref(-1);
const offset = ref(-1);
const readoutMode = ref(0);
const usbLimit = ref(0);
const fanSpeed = ref(0);
const errorMessage = ref('');

// Seed from the profile and the camera whenever they arrive, but never overwrite what the user
// changed.
const touched = new Set();
function seed(key, target, value) {
  if (!touched.has(key) && value !== undefined && value !== null) target.value = value;
}
watch(
  [settings, info, deviceSettings],
  ([s, i, d]) => {
    seed('gain', gain, s.Gain);
    seed('offset', offset, s.Offset);
    seed('readout', readoutMode, s.ReadoutModeForNormalImages ?? i.ReadoutMode);
    seed('usb', usbLimit, i.USBLimit ?? s.USBLimit);
    seed('fan', fanSpeed, d?.FanSpeed);
  },
  { immediate: true }
);

// The device settings belong to the camera that is connected now.
watch(
  connected,
  (isConnected) => {
    if (isConnected) cameraStore.readGuideCameraSettings();
    else cameraStore.guideCameraSettings = undefined;
  },
  { immediate: true }
);

/**
 * These calls go through the global axios interceptor, which never rejects: a failure comes
 * back as { Success: false, Error }. Returns true when the call succeeded, else shows why.
 */
function succeeded(response) {
  if (response && response.Success === false) {
    errorMessage.value = response.Error || t('components.guideCamera.failed');
    return false;
  }
  return true;
}

async function saveProfile(key, value) {
  return succeeded(await apiService.profileChangeValue(`GuideCameraSettings-${key}`, value));
}

// Sets a value on the camera first; only a value the camera accepted is stored in the profile.
async function setOnCamera(settingName, value) {
  return succeeded(
    await apiService.guideCameraAction(`set-setting?settingName=${settingName}&newValue=${value}`)
  );
}

async function saveGain() {
  touched.add('gain');
  errorMessage.value = '';
  await saveProfile('Gain', gain.value);
}

async function saveOffset() {
  touched.add('offset');
  errorMessage.value = '';
  await saveProfile('Offset', offset.value);
}

async function setBinning(mode) {
  errorMessage.value = '';
  if (!succeeded(await apiService.guideCameraSetBinning(mode))) return;
  const [binX, binY] = mode.split('x').map(Number);
  if (await saveProfile('BinningX', binX)) {
    await saveProfile('BinningY', binY);
  }
}

// Guide frames are one kind of image, so both readout settings of the slot get the same mode.
async function saveReadoutMode() {
  touched.add('readout');
  errorMessage.value = '';
  for (const name of ['ReadoutModeForNormalImages', 'ReadoutModeForSnapImages']) {
    if (!(await setOnCamera(name, readoutMode.value))) return;
    if (!(await saveProfile(name, readoutMode.value))) return;
  }
}

async function saveUsbLimit() {
  touched.add('usb');
  errorMessage.value = '';
  if (await setOnCamera('USBLimit', usbLimit.value)) {
    await saveProfile('USBLimit', usbLimit.value);
  }
}

async function saveFanSpeed() {
  touched.add('fan');
  errorMessage.value = '';
  if (await setOnCamera('FanSpeed', fanSpeed.value)) {
    await saveProfile('FanSpeed', fanSpeed.value);
  }
  await cameraStore.readGuideCameraSettings();
}
</script>
