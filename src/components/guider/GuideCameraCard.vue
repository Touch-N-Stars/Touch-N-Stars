<template>
  <div class="tns-card flex flex-col gap-3" data-testid="guide-camera-card">
    <div class="flex items-center justify-between gap-2">
      <h6 class="text-lg font-semibold text-white">{{ $t('components.guideCamera.title') }}</h6>
      <span class="text-sm text-content-muted truncate">{{ info.Name }}</span>
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

    <div v-if="info.CanSetGain" class="flex items-center justify-between gap-2">
      <label for="guide-camera-gain" class="text-sm">{{ $t('components.guideCamera.gain') }}</label>
      <select
        v-if="info.Gains?.length"
        id="guide-camera-gain"
        v-model.number="gain"
        @change="saveGain"
        class="tns-select w-32"
      >
        <option v-for="(g, index) in info.Gains" :key="g" :value="index">{{ g }}</option>
      </select>
      <input
        v-else
        id="guide-camera-gain"
        v-model.number="gain"
        @change="saveGain"
        type="number"
        :min="info.GainMin"
        :max="info.GainMax"
        class="tns-input w-32"
      />
    </div>

    <div v-if="info.CanSetOffset" class="flex items-center justify-between gap-2">
      <label for="guide-camera-offset" class="text-sm">
        {{ $t('components.guideCamera.offset') }}
      </label>
      <input
        id="guide-camera-offset"
        v-model.number="offset"
        @change="saveOffset"
        type="number"
        :min="info.OffsetMin"
        :max="info.OffsetMax"
        class="tns-input w-32"
      />
    </div>

    <div v-if="info.BinningModes?.length" class="flex items-center justify-between gap-2">
      <label for="guide-camera-binning" class="text-sm">
        {{ $t('components.guideCamera.binning') }}
      </label>
      <select
        id="guide-camera-binning"
        :value="binning"
        @change="setBinning($event.target.value)"
        class="tns-select w-32"
      >
        <option v-for="mode in info.BinningModes" :key="mode.Name" :value="mode.Name">
          {{ mode.Name }}
        </option>
      </select>
    </div>

    <div v-if="info.CanSetTemperature" class="flex items-center gap-2">
      <label for="guide-camera-target-temp" class="text-sm grow">
        {{ $t('components.guideCamera.targetTemperature') }}
      </label>
      <input
        id="guide-camera-target-temp"
        v-model.number="targetTemperature"
        type="number"
        class="tns-input w-20"
      />
      <button class="tns-btn-secondary w-auto!" @click="cool">
        {{ $t('components.guideCamera.cool') }}
      </button>
      <button class="tns-btn-secondary w-auto!" @click="warm">
        {{ $t('components.guideCamera.warm') }}
      </button>
    </div>

    <div class="flex items-center gap-2">
      <label for="guide-camera-exposure" class="text-sm grow">
        {{ $t('components.guideCamera.exposure') }}
      </label>
      <input
        id="guide-camera-exposure"
        v-model.number="exposure"
        type="number"
        min="0.001"
        step="0.1"
        class="tns-input w-20"
      />
      <button
        class="tns-btn-primary w-auto!"
        :disabled="isCapturing || info.IsExposing"
        data-testid="guide-camera-capture"
        @click="capture"
      >
        {{
          isCapturing
            ? $t('components.guideCamera.capturing')
            : $t('components.guideCamera.capture')
        }}
      </button>
    </div>

    <p v-if="errorMessage" class="text-sm text-status-danger">{{ errorMessage }}</p>
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

const store = apiStore();
const { t } = useI18n();

const info = computed(() => store.guideCameraInfo);
const settings = computed(() => store.profileInfo?.GuideCameraSettings ?? {});

const hasTemperature = computed(() => Number.isFinite(info.value.Temperature));
const binning = computed(() => `${info.value.BinX ?? 1}x${info.value.BinY ?? 1}`);

const exposure = ref(1);
const gain = ref(null);
const offset = ref(null);
const targetTemperature = ref(-10);
const isCapturing = ref(false);
const errorMessage = ref('');
const imageSrc = ref('');

// Seed from the profile whenever it arrives, but never overwrite what the user typed.
let gainTouched = false;
let offsetTouched = false;
let targetTouched = false;
watch(
  [settings, info],
  ([s, i]) => {
    if (!gainTouched) gain.value = s.Gain >= 0 ? s.Gain : (i.Gain ?? null);
    if (!offsetTouched) offset.value = s.Offset >= 0 ? s.Offset : (i.Offset ?? null);
    if (!targetTouched && Number.isFinite(s.Temperature)) targetTemperature.value = s.Temperature;
  },
  { immediate: true }
);

function reportError(error) {
  errorMessage.value =
    error?.response?.data?.Error ||
    error?.Error ||
    error?.message ||
    t('components.guideCamera.failed');
}

async function saveGain() {
  gainTouched = true;
  try {
    await apiService.profileChangeValue('GuideCameraSettings-Gain', gain.value);
  } catch (error) {
    reportError(error);
  }
}

async function saveOffset() {
  offsetTouched = true;
  try {
    await apiService.profileChangeValue('GuideCameraSettings-Offset', offset.value);
  } catch (error) {
    reportError(error);
  }
}

async function setBinning(mode) {
  errorMessage.value = '';
  try {
    await apiService.guideCameraSetBinning(mode);
    const [binX, binY] = mode.split('x').map(Number);
    await apiService.profileChangeValue('GuideCameraSettings-BinningX', binX);
    await apiService.profileChangeValue('GuideCameraSettings-BinningY', binY);
  } catch (error) {
    reportError(error);
  }
}

async function cool() {
  targetTouched = true;
  errorMessage.value = '';
  try {
    await apiService.guideCameraCool(targetTemperature.value, settings.value.CoolingDuration ?? 0);
  } catch (error) {
    reportError(error);
  }
}

async function warm() {
  errorMessage.value = '';
  try {
    await apiService.guideCameraWarm(settings.value.WarmingDuration ?? 0);
  } catch (error) {
    reportError(error);
  }
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
      reportError(response);
    }
  } catch (error) {
    reportError(error);
  } finally {
    isCapturing.value = false;
  }
}
</script>
