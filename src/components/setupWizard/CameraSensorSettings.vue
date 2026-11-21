<template>
  <div class="flex flex-col gap-3">
    <h3 class="text-sm font-semibold text-content">
      {{ t('components.setupWizard.camera.sensorTitle') }}
    </h3>

    <!-- Chip size: reported by the driver, or entered by hand (DSLR) -->
    <template v-if="chipSizeReadable">
      <div class="flex flex-col gap-2 rounded-control bg-surface-2 p-3">
        <p class="text-sm text-content">
          {{
            t('components.setupWizard.camera.chipSizeReported', {
              width: reportedWidth,
              height: reportedHeight,
            })
          }}
        </p>

        <template v-if="chipSizeMatchesProfile">
          <p class="flex items-center gap-2 text-xs text-status-ok">
            <span class="tns-dot bg-status-ok"></span>
            {{ t('components.setupWizard.camera.chipSizeMatches') }}
          </p>
        </template>
        <template v-else>
          <p class="text-xs text-content-muted">
            {{
              t('components.setupWizard.camera.chipSizeDiffers', {
                width: profileWidth ?? '—',
                height: profileHeight ?? '—',
              })
            }}
          </p>
          <button class="tns-btn-secondary" :disabled="isApplying" @click="applyReportedChipSize">
            {{ t('components.setupWizard.camera.chipSizeApply') }}
          </button>
        </template>
      </div>
    </template>

    <template v-else>
      <!-- Without a connected camera nothing is known yet; "does not report its sensor size -
           typical for DSLRs" read like a verdict on a camera nobody had picked. -->
      <p class="text-sm text-content-muted">
        {{
          store.cameraInfo?.Connected
            ? t('components.setupWizard.camera.chipSizeManualHint')
            : t('components.setupWizard.camera.chipSizeNotConnectedHint')
        }}
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <NumberInputPicker
          v-model="chipWidth"
          :label="t('components.setupWizard.camera.chipWidth')"
          labelKey="components.setupWizard.camera.chipWidth"
          :min="100"
          :max="10000"
          :step="1"
          :decimalPlaces="0"
          inputId="wizard-chip-width"
          @change="updateChipWidth"
        />
        <NumberInputPicker
          v-model="chipHeight"
          :label="t('components.setupWizard.camera.chipHeight')"
          labelKey="components.setupWizard.camera.chipHeight"
          :min="100"
          :max="10000"
          :step="1"
          :decimalPlaces="0"
          inputId="wizard-chip-height"
          @change="updateChipHeight"
        />
      </div>
    </template>

    <!-- Pixel size: never reported by NINA, always entered by hand -->
    <NumberInputPicker
      v-model="pixelSize"
      :label="t('components.setupWizard.camera.pixelSize')"
      labelKey="components.setupWizard.camera.pixelSize"
      :min="0.01"
      :max="50"
      :step="0.01"
      :decimalPlaces="2"
      inputId="wizard-pixel-size"
      @change="updatePixelSize"
    />
    <p class="text-xs text-content-faint">
      {{ t('components.setupWizard.camera.pixelSizeHint') }}
    </p>

    <p v-if="imageScale" class="text-xs text-content-muted">
      {{ t('components.setupWizard.camera.imageScale', { scale: imageScale }) }}
    </p>

    <p v-if="errorMessage" class="text-sm text-status-danger break-words">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { arcsecPerPixel } from '@/utils/imageScale';

/**
 * Sensor geometry for the wizard's camera step.
 *
 * Chip size in pixels lives in the profile under FramingAssistantSettings, not
 * CameraSettings - same keys as components/settings/camera/settingsSensor.vue.
 * Pixel size is never part of cameraInfo, so it is always a manual entry.
 */
const { t } = useI18n();
const store = apiStore();

const PIXEL_SIZE_FALLBACK = 5.0;

const pixelSize = ref(PIXEL_SIZE_FALLBACK);
const chipWidth = ref(0);
const chipHeight = ref(0);
const isApplying = ref(false);
const errorMessage = ref('');
// Once the user edits a field, a late profile poll must not overwrite their input.
const touchedFields = ref(new Set());

const reportedWidth = computed(() => Number(store.cameraInfo?.XSize) || 0);
const reportedHeight = computed(() => Number(store.cameraInfo?.YSize) || 0);

// DSLRs report no usable sensor size (NINA hands back -1/0), which is exactly the
// condition CenterHere.vue uses to fall back to the manually configured values.
const chipSizeReadable = computed(
  () => Boolean(store.cameraInfo?.Connected) && reportedWidth.value > 0 && reportedHeight.value > 0
);

const profileWidth = computed(() => store.profileInfo?.FramingAssistantSettings?.CameraWidth);
const profileHeight = computed(() => store.profileInfo?.FramingAssistantSettings?.CameraHeight);

const chipSizeMatchesProfile = computed(
  () => profileWidth.value === reportedWidth.value && profileHeight.value === reportedHeight.value
);

// Sanity readout so a mistyped pixel size is visible immediately.
const imageScale = computed(() => {
  const scale = arcsecPerPixel(pixelSize.value, store.profileInfo?.TelescopeSettings?.FocalLength);
  return scale === null ? '' : scale.toFixed(2);
});

// settingsSensor.vue seeds from the profile in onMounted only, so it keeps showing
// defaults when the 2s profile poll arrives later. Watch instead.
watch(
  () => store.profileInfo,
  (profile) => {
    if (!profile) return;
    if (!touchedFields.value.has('pixelSize')) {
      pixelSize.value = profile.CameraSettings?.PixelSize || PIXEL_SIZE_FALLBACK;
    }
    if (!touchedFields.value.has('chipWidth')) {
      chipWidth.value = profile.FramingAssistantSettings?.CameraWidth || 3001;
    }
    if (!touchedFields.value.has('chipHeight')) {
      chipHeight.value = profile.FramingAssistantSettings?.CameraHeight || 1501;
    }
  },
  { immediate: true, deep: true }
);

async function writeProfileValue(field, settingPath, value) {
  touchedFields.value.add(field);
  errorMessage.value = '';
  try {
    await apiService.profileChangeValue(settingPath, value);
  } catch (error) {
    console.error('[PinsWizard] Sensor setting failed:', error);
    errorMessage.value = t('components.setupWizard.camera.applyFailed', { message: error.message });
  }
}

function updatePixelSize() {
  return writeProfileValue('pixelSize', 'CameraSettings-PixelSize', pixelSize.value);
}

function updateChipWidth() {
  return writeProfileValue('chipWidth', 'FramingAssistantSettings-CameraWidth', chipWidth.value);
}

function updateChipHeight() {
  return writeProfileValue('chipHeight', 'FramingAssistantSettings-CameraHeight', chipHeight.value);
}

async function applyReportedChipSize() {
  if (isApplying.value) return;
  isApplying.value = true;
  errorMessage.value = '';
  try {
    await apiService.profileChangeValue(
      'FramingAssistantSettings-CameraWidth',
      reportedWidth.value
    );
    await apiService.profileChangeValue(
      'FramingAssistantSettings-CameraHeight',
      reportedHeight.value
    );
    await store.fetchProfilInfos();
  } catch (error) {
    console.error('[PinsWizard] Applying reported chip size failed:', error);
    errorMessage.value = t('components.setupWizard.camera.applyFailed', { message: error.message });
  } finally {
    isApplying.value = false;
  }
}
</script>
