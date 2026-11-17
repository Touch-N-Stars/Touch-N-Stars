<template>
  <div class="tns-card flex flex-col gap-3" data-testid="guide-camera-card">
    <div class="flex items-center justify-between gap-2">
      <h6 class="text-lg font-semibold text-content">{{ $t('components.guideCamera.title') }}</h6>
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

    <GuideCameraSettings />

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
import GuideCameraSettings from '@/components/guider/GuideCameraSettings.vue';

const store = apiStore();
const { t } = useI18n();

const info = computed(() => store.guideCameraInfo);
const settings = computed(() => store.profileInfo?.GuideCameraSettings ?? {});

const hasTemperature = computed(() => Number.isFinite(info.value.Temperature));
// The profile's gain, or the camera's current one while the profile keeps the default (-1).
const gain = computed(() => (settings.value.Gain >= 0 ? settings.value.Gain : info.value.Gain));

const exposure = ref(1);
const targetTemperature = ref(-10);
const isCapturing = ref(false);
const errorMessage = ref('');
const imageSrc = ref('');

// Seed from the profile whenever it arrives, but never overwrite what the user changed.
const targetTouched = ref(false);
watch(
  settings,
  (s) => {
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
