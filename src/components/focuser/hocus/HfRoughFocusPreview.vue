<template>
  <!-- Image first, then everything used while turning the focuser right below it, so the HFR and
       the buttons stay in view together without scrolling. A smaller HFR means sharper stars. -->
  <div class="flex flex-col gap-3">
    <div class="h-64 sm:h-80 overflow-hidden rounded-control bg-ground">
      <ZoomableImage
        :imageData="imageStore.imageData"
        :loading="cameraStore.loading || cameraStore.isLoadingImage"
        :showDownload="false"
        :showFullscreen="false"
        height="100%"
        :altText="L('alt')"
        :placeholderText="L('placeholder')"
      />
    </div>

    <div v-if="samples.latest" class="flex flex-col gap-1 rounded-control bg-surface-2 p-3">
      <p class="text-sm text-content">
        {{
          L('current', {
            hfr: samples.latest.hfr.toFixed(2),
            position: samples.latest.position,
            stars: samples.latest.stars ?? '–',
          })
        }}
      </p>
      <p class="flex items-start gap-2 text-sm text-content">
        <span class="tns-dot bg-status-ok mt-1.5 shrink-0"></span>
        <span>
          {{ L('best', { hfr: samples.best.hfr.toFixed(2), position: samples.best.position }) }}
        </span>
      </p>
    </div>
    <p v-if="error" class="text-sm text-status-danger">{{ error }}</p>

    <div class="flex gap-2">
      <template v-if="!looping">
        <button class="tns-btn-secondary min-h-touch" :disabled="busy" @click="capture(false)">
          {{ L('single') }}
        </button>
        <button class="tns-btn-primary min-h-touch" :disabled="busy" @click="capture(true)">
          {{ L('loop') }}
        </button>
      </template>
      <button v-else class="tns-btn-danger min-h-touch" @click="stop">
        {{ L('stop') }}
      </button>
    </div>

    <!-- Focuser controls of the caller -->
    <slot />

    <NumberInputPicker
      v-model="exposure"
      :label="L('exposure')"
      labelKey="components.focuser.hfAssistant.preview.exposure"
      :min="0.1"
      :max="600"
      :step="0.5"
      :decimalPlaces="1"
      :useDefaultSentinel="false"
      inputId="hf-preview-exposure"
      labelPosition="top"
      wrapperClass="w-full"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useCameraStore } from '@/store/cameraStore';
import { useImagetStore } from '@/store/imageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useFocusFrame } from '@/composables/useFocusFrame';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import ZoomableImage from '@/components/helpers/ZoomableImage.vue';
import { focusSamples } from '@/utils/hocusFocusAdvisor';

// Camera preview for focusing by hand: single frames or a loop, with HFR and star count of the
// newest frame and the sharpest frame so far. Uses the camera page's capture path, so the image
// also shows up there.

const { t } = useI18n();
const L = (key, params) => t(`components.focuser.hfAssistant.preview.${key}`, params || {});
const store = apiStore();
const cameraStore = useCameraStore();
const imageStore = useImagetStore();
const settingsStore = useSettingsStore();
const focusFrame = useFocusFrame();

// Every measured frame of this step as { hfr, position, stars }, oldest first. The parent keeps
// them: the step-size measurement picks its first distance from them.
const frames = defineModel('samples', { type: Array, default: () => [] });

// The autofocus exposure is a good start: it was chosen to show enough stars.
const exposure = ref(Number(store.profileInfo?.FocuserSettings?.AutoFocusExposureTime) || 2);
const error = ref('');
const looping = ref(false);
const capturing = ref(false);
let stopped = false;

const busy = computed(
  () =>
    capturing.value ||
    !store.cameraInfo?.Connected ||
    !!store.cameraInfo?.IsExposing ||
    cameraStore.loading ||
    cameraStore.isLoadingImage
);

// Same gain choice as the snapshot on the camera page.
const gain = computed(() => {
  const profileGain = Number(store.profileInfo?.SnapShotControlSettings?.Gain);
  if (Number.isFinite(profileGain)) return profileGain;
  const settingsGain = Number(settingsStore.camera.gain);
  return Number.isFinite(settingsGain) ? settingsGain : -1;
});

// Newest and sharpest frame, each with the focuser position it was taken at. A frame during which
// the focuser moved has no position and is left out.
const samples = computed(() => focusSamples(frames.value));

function checkStopped() {
  if (stopped) throw new Error('aborted');
}

// Own loop instead of the camera store's: every frame has to be measured before the next starts.
async function capture(loop) {
  error.value = '';
  stopped = false;
  looping.value = loop;
  capturing.value = true;
  cameraStore.isLooping = false;
  try {
    do {
      const frame = await focusFrame.capture(Number(exposure.value) || 2, gain.value, checkStopped);
      frames.value = [...frames.value, frame];
    } while (looping.value && !stopped);
  } catch (err) {
    // The camera store has already reported a frame that brought no image.
    if (err.message !== 'aborted' && err.message !== 'noImage') {
      console.error('[HfRoughFocusPreview] Error capturing:', err);
      error.value = L('failed');
    }
  } finally {
    looping.value = false;
    capturing.value = false;
  }
}

async function stop() {
  stopped = true;
  looping.value = false;
  if (!store.cameraInfo?.IsExposing && !cameraStore.loading) return;
  try {
    await cameraStore.abortExposure(apiService);
  } catch (err) {
    console.error('[HfRoughFocusPreview] Error aborting exposure:', err);
  }
}

// Leaving the step must not leave the camera exposing: the next step starts its own frames.
onBeforeUnmount(() => {
  if (capturing.value) stop();
});
</script>
