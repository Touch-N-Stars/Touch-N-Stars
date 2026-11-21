<template>
  <div class="flex flex-col gap-3">
    <!-- The calculation below is precise but technical; this is all a beginner needs. Only
         with a result: without one there is no "apply" button to point at. -->
    <p v-if="ditherGuidePixels" class="rounded-control bg-surface-2 p-3 text-sm text-content">
      {{
        t('components.setupWizard.guider.ditherPlainHint', {
          button: t('components.setupWizard.guider.ditherApply'),
        })
      }}
    </p>
    <!-- Desired dither, expressed the way the common recommendations are:
         in pixels of the imaging camera. -->
    <NumberInputPicker
      v-model="ditherMainPixels"
      :label="t('components.setupWizard.guider.ditherMainPixels')"
      labelKey="components.setupWizard.guider.ditherMainPixels"
      :min="1"
      :max="100"
      :step="1"
      :decimalPlaces="0"
      inputId="wizard-dither-main-pixels"
    />
    <p class="text-xs text-content-faint">
      {{ t('components.setupWizard.guider.ditherMainPixelsHint') }}
    </p>

    <!-- PHD2 only reports the guide camera's pixel size once its camera is
         connected. Until then it has to be entered by hand - there is no
         profile field for it, so this input stays local to the calculator. -->
    <template v-if="!reportedGuidePixelSize">
      <NumberInputPicker
        v-model="manualGuidePixelSize"
        :label="t('components.setupWizard.guider.guidePixelSize')"
        labelKey="components.setupWizard.guider.guidePixelSize"
        :min="0.01"
        :max="50"
        :step="0.01"
        :decimalPlaces="2"
        inputId="wizard-guide-pixel-size"
      />
      <p class="text-xs text-content-faint">
        {{
          native
            ? t('components.setupWizard.guider.guidePixelSizeHintNative')
            : t('components.setupWizard.guider.guidePixelSizeHint')
        }}
      </p>
    </template>

    <!-- The breakdown: both image scales, the resulting offset on sky, and the
         value NINA actually wants. -->
    <div v-if="ditherGuidePixels" class="flex flex-col gap-1 rounded-control bg-surface-2 p-3">
      <p class="text-xs text-content-muted">
        {{ t('components.setupWizard.guider.mainScale', { scale: mainScale.toFixed(2) }) }}
      </p>
      <p class="text-xs text-content-muted">
        {{
          t('components.setupWizard.guider.guideScale', {
            scale: guideScale.toFixed(2),
            binning: guideBinning,
          })
        }}
      </p>

      <!-- Cross-check against PHD2's own scale. A mismatch means PHD2 has a
           different focal length or pixel size than we just used, which also
           makes its own arcsec readouts wrong. -->
      <p v-if="scaleMismatch" class="flex items-start gap-2 text-xs text-status-warn">
        <span class="tns-dot bg-status-warn mt-1.5 shrink-0"></span>
        <span>
          {{
            t('components.setupWizard.guider.scaleMismatch', {
              scale: Number(guiderStore.phd2PixelScale).toFixed(2),
            })
          }}
        </span>
      </p>
      <p class="text-xs text-content-muted">
        {{ t('components.setupWizard.guider.ditherArcsec', { arcsec: ditherArcsec.toFixed(1) }) }}
      </p>
      <p class="text-sm text-content mt-1">
        {{ t('components.setupWizard.guider.ditherResult', { pixels: ditherGuidePixels }) }}
      </p>

      <p v-if="profileDitherPixels !== null" class="text-xs text-content-faint">
        {{
          t('components.setupWizard.guider.ditherCurrent', {
            pixels: profileDitherPixels,
            mainPixels: profileDitherAsMainPixels,
          })
        }}
      </p>

      <button
        class="tns-btn-secondary mt-2"
        :disabled="isApplying || alreadyApplied"
        @click="applyDitherPixels"
      >
        {{
          alreadyApplied
            ? t('components.setupWizard.guider.ditherApplied')
            : t('components.setupWizard.guider.ditherApply')
        }}
      </button>
    </div>

    <p v-else class="text-sm text-content-muted">
      {{
        native
          ? t('components.setupWizard.guider.ditherMissingDataNative')
          : t('components.setupWizard.guider.ditherMissingData')
      }}
    </p>

    <p v-if="errorMessage" class="text-sm text-status-danger break-words">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useGuiderStore } from '@/store/guiderStore';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { isNativeGuiderInUse } from '@/utils/nativeGuider';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { arcsecPerPixel } from '@/utils/imageScale';

/**
 * GuiderSettings-DitherPixels is expressed in *guide camera* pixels, while the
 * usual recommendations (10-15 px) are given in *imaging camera* pixels. The
 * ratio of the two image scales differs by a factor of 2-5 depending on the
 * guide scope, so the conversion is done here instead of being guessed.
 */
const { t } = useI18n();
const store = apiStore();
const guiderStore = useGuiderStore();
const nativeGuiderStore = useNativeGuiderStore();

// The guider built into PINS keeps focal length, pixel size and binning in its own settings;
// PHD2 reports them over its API. Everything else of the calculation is the same.
const native = computed(() => isNativeGuiderInUse(store));
function nativeSetting(name) {
  const value = Number(nativeGuiderStore.settings.find((s) => s.name === name)?.value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

const DEFAULT_DITHER_MAIN_PIXELS = 10;
const GUIDE_PIXEL_SIZE_FALLBACK = 3.75;

const ditherMainPixels = ref(DEFAULT_DITHER_MAIN_PIXELS);
const manualGuidePixelSize = ref(GUIDE_PIXEL_SIZE_FALLBACK);
const isApplying = ref(false);
const errorMessage = ref('');

// Imaging side - both values are set by the camera and telescope steps.
const mainScale = computed(
  () =>
    arcsecPerPixel(
      store.profileInfo?.CameraSettings?.PixelSize,
      store.profileInfo?.TelescopeSettings?.FocalLength
    ) ?? 0
);

// Guide side. Binning matters: PHD2 counts dither in binned pixels.
// Native guider: its own pixel size setting (0 = the camera's), else the guide camera slot's.
const reportedGuidePixelSize = computed(() =>
  native.value
    ? nativeSetting('PixelSizeUm') || Number(store.profileInfo?.GuideCameraSettings?.PixelSize) || 0
    : Number(guiderStore.phd2PixelSize) || 0
);
const guidePixelSize = computed(
  () => reportedGuidePixelSize.value || Number(manualGuidePixelSize.value) || 0
);
const guideBinning = computed(() =>
  native.value ? nativeSetting('Binning') || 1 : Number(guiderStore.phd2CameraBinning) || 1
);
const guideFocalLength = computed(() =>
  native.value ? nativeSetting('FocalLengthMm') : guiderStore.phd2FocalLength
);
const guideScale = computed(
  () => arcsecPerPixel(guidePixelSize.value, guideFocalLength.value, guideBinning.value) ?? 0
);

const ditherArcsec = computed(() => Number(ditherMainPixels.value) * mainScale.value);

// Rounded to one decimal - NINA stores a double, but nobody needs more.
const ditherGuidePixels = computed(() => {
  if (!mainScale.value || !guideScale.value || !ditherMainPixels.value) return 0;
  return Number((ditherArcsec.value / guideScale.value).toFixed(1));
});

const profileDitherPixels = computed(() => {
  const value = store.profileInfo?.GuiderSettings?.DitherPixels;
  return value === undefined || value === null ? null : Number(value);
});

// What the value currently in the profile amounts to on the imaging camera -
// usually the moment users realise their dither was far too small.
const profileDitherAsMainPixels = computed(() => {
  if (profileDitherPixels.value === null || !mainScale.value || !guideScale.value) return '—';
  return ((profileDitherPixels.value * guideScale.value) / mainScale.value).toFixed(1);
});

const alreadyApplied = computed(() => profileDitherPixels.value === ditherGuidePixels.value);

// PHD2 reports its own image scale. If it disagrees with what we just computed,
// PHD2 is working with a different focal length or pixel size - which also makes
// its guiding readouts in arcsec wrong, so it is worth surfacing.
const SCALE_MISMATCH_TOLERANCE = 0.05; // 5%
const scaleMismatch = computed(() => {
  if (native.value) return false;
  const phd2Scale = Number(guiderStore.phd2PixelScale);
  if (!(phd2Scale > 0) || !guideScale.value) return false;
  return Math.abs(guideScale.value - phd2Scale) / phd2Scale > SCALE_MISMATCH_TOLERANCE;
});

onMounted(async () => {
  if (native.value) {
    await nativeGuiderStore.loadSettings();
    return;
  }
  // All four are only reachable in PINS and no-op elsewhere. The focal length is
  // fetched here rather than relying on a sibling component having loaded it -
  // guideScale is useless without it, and the calculator has to stand on its own.
  await Promise.all([
    guiderStore.fetchPHD2PixelSize(),
    guiderStore.fetchPHD2CameraBinning(),
    guiderStore.fetchPHD2PixelScale(),
    guiderStore.fetchPHD2FocalLength(),
  ]);
  if (reportedGuidePixelSize.value) {
    manualGuidePixelSize.value = reportedGuidePixelSize.value;
  }
});

async function applyDitherPixels() {
  if (isApplying.value || !ditherGuidePixels.value) return;
  isApplying.value = true;
  errorMessage.value = '';
  try {
    await apiService.profileChangeValue('GuiderSettings-DitherPixels', ditherGuidePixels.value);
    await store.fetchProfilInfos();
  } catch (error) {
    console.error('[PinsWizard] Applying dither pixels failed:', error);
    errorMessage.value = t('components.setupWizard.guider.applyFailed', { message: error.message });
  } finally {
    isApplying.value = false;
  }
}
</script>
