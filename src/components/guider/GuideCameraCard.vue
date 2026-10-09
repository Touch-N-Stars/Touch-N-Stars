<template>
  <div class="tns-card flex flex-col gap-3" data-testid="guide-camera-card">
    <div class="flex items-center justify-between gap-2">
      <h6 class="text-lg font-semibold text-white">{{ $t('components.guideCamera.title') }}</h6>
      <span class="text-sm text-content-muted truncate" :title="info.Name">{{ info.Name }}</span>
    </div>

    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      <span class="text-content-muted">{{ $t('components.guideCamera.sensor') }}</span>
      <span class="text-right">{{ info.XSize }} × {{ info.YSize }}, {{ info.BitDepth }} bit</span>
      <template v-if="hasTemperature">
        <span class="text-content-muted">{{ $t('components.guideCamera.temperature') }}</span>
        <span class="text-right">
          {{ info.Temperature.toFixed(1) }} °C
          <template v-if="info.CoolerOn"> · {{ Math.round(info.CoolerPower) }} %</template>
        </span>
      </template>
    </div>

    <!-- Gain: the camera's named gains as a list, otherwise a number like the camera page -->
    <div v-if="info.CanSetGain && info.Gains?.length" class="flex items-center gap-2">
      <label for="guide-camera-gain" class="text-xs md:text-sm text-gray-200 mr-3">
        {{ $t('components.guideCamera.gain') }}
      </label>
      <select
        id="guide-camera-gain"
        v-model.number="gain"
        class="tns-select ml-auto w-36 md:w-40"
        @change="saveGain"
      >
        <option v-for="(g, index) in info.Gains" :key="g" :value="index">{{ g }}</option>
      </select>
    </div>
    <NumberInputPicker
      v-else-if="info.CanSetGain"
      v-model="gain"
      :label="$t('components.guideCamera.gain')"
      labelKey="components.guideCamera.gain"
      :min="info.GainMin ?? 0"
      :max="info.GainMax ?? 1000"
      :step="1"
      :decimalPlaces="0"
      inputId="guide-camera-gain"
      @change="saveGain"
    />

    <NumberInputPicker
      v-if="info.CanSetOffset"
      v-model="offset"
      :label="$t('components.guideCamera.offset')"
      labelKey="components.guideCamera.offset"
      :min="info.OffsetMin ?? 0"
      :max="info.OffsetMax ?? 1000"
      :step="1"
      :decimalPlaces="0"
      inputId="guide-camera-offset"
      @change="saveOffset"
    />

    <div v-if="info.BinningModes?.length" class="flex items-center gap-2">
      <label for="guide-camera-binning" class="text-xs md:text-sm text-gray-200 mr-3">
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

    <template v-if="info.CanSetTemperature">
      <NumberInputPicker
        v-model="targetTemperature"
        :label="$t('components.guideCamera.targetTemperature')"
        labelKey="components.guideCamera.targetTemperature"
        :min="-50"
        :max="30"
        :step="1"
        :decimalPlaces="0"
        inputId="guide-camera-target-temp"
        @change="targetTouched = true"
      />
      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="tns-btn-secondary" @click="cool">
          {{ $t('components.guideCamera.cool') }}
        </button>
        <button type="button" class="tns-btn-secondary" @click="warm">
          {{ $t('components.guideCamera.warm') }}
        </button>
      </div>
    </template>

    <NumberInputPicker
      v-model="exposure"
      :label="$t('components.guideCamera.exposure')"
      labelKey="components.guideCamera.exposure"
      :min="0.001"
      :max="600"
      :step="0.001"
      :decimalPlaces="3"
      inputId="guide-camera-exposure"
    />
    <button
      type="button"
      class="tns-btn-primary"
      :disabled="isCapturing || info.IsExposing"
      data-testid="guide-camera-capture"
      @click="capture"
    >
      {{
        isCapturing ? $t('components.guideCamera.capturing') : $t('components.guideCamera.capture')
      }}
    </button>

    <p v-if="errorMessage" class="text-sm text-status-danger break-words">{{ errorMessage }}</p>
    <img
      v-if="imageSrc"
      :src="imageSrc"
      :alt="$t('components.guideCamera.title')"
      class="w-full rounded-control"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const store = apiStore();
const { t } = useI18n();

const info = computed(() => store.guideCameraInfo);
const settings = computed(() => store.profileInfo?.GuideCameraSettings ?? {});

const hasTemperature = computed(() => Number.isFinite(info.value.Temperature));
const binning = computed(() => `${info.value.BinX ?? 1}x${info.value.BinY ?? 1}`);

const exposure = ref(1);
const gain = ref(0);
const offset = ref(0);
const targetTemperature = ref(-10);
const isCapturing = ref(false);
const errorMessage = ref('');
const imageSrc = ref('');

// Seed from the profile whenever it arrives, but never overwrite what the user changed.
let gainTouched = false;
let offsetTouched = false;
const targetTouched = ref(false);
watch(
  [settings, info],
  ([s, i]) => {
    if (!gainTouched) gain.value = s.Gain >= 0 ? s.Gain : (i.Gain ?? 0);
    if (!offsetTouched) offset.value = s.Offset >= 0 ? s.Offset : (i.Offset ?? 0);
    if (!targetTouched.value && Number.isFinite(s.Temperature)) {
      targetTemperature.value = s.Temperature;
    }
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
  return succeeded(await apiService.profileChangeValue(key, value));
}

async function saveGain() {
  gainTouched = true;
  errorMessage.value = '';
  await saveProfile('GuideCameraSettings-Gain', gain.value);
}

async function saveOffset() {
  offsetTouched = true;
  errorMessage.value = '';
  await saveProfile('GuideCameraSettings-Offset', offset.value);
}

async function setBinning(mode) {
  errorMessage.value = '';
  // Only a binning the camera accepted is stored in the profile.
  if (!succeeded(await apiService.guideCameraSetBinning(mode))) return;
  const [binX, binY] = mode.split('x').map(Number);
  if (await saveProfile('GuideCameraSettings-BinningX', binX)) {
    await saveProfile('GuideCameraSettings-BinningY', binY);
  }
}

async function cool() {
  targetTouched.value = true;
  errorMessage.value = '';
  succeeded(
    await apiService.guideCameraCool(targetTemperature.value, settings.value.CoolingDuration ?? 0)
  );
}

async function warm() {
  errorMessage.value = '';
  succeeded(await apiService.guideCameraWarm(settings.value.WarmingDuration ?? 0));
}

// Takes one frame with the guide camera, e.g. to focus or frame it. Nothing is saved.
async function capture() {
  isCapturing.value = true;
  errorMessage.value = '';
  try {
    const response = await apiService.guideCameraCapture(
      exposure.value,
      info.value.CanSetGain ? gain.value : null
    );
    if (response?.Success && response.Response?.Image) {
      imageSrc.value = `data:image/jpeg;base64,${response.Response.Image}`;
    } else {
      errorMessage.value = response?.Error || t('components.guideCamera.failed');
    }
  } finally {
    isCapturing.value = false;
  }
}
</script>
