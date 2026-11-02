<template>
  <div class="flex flex-col gap-4">
    <!-- Overview: assistant, setup problems and optics -->
    <div class="tns-card flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-semibold text-content">{{ L('title') }}</h3>
        <p class="text-sm text-content-muted">{{ L('description') }}</p>
      </div>

      <button class="tns-btn-primary min-h-touch" @click="emit('open-assistant')">
        {{ L('startAssistant') }}
      </button>

      <!-- Setup problems visible before any run -->
      <HfSetupIssues />

      <!-- Optics: read-only here, the assistant edits it -->
      <div class="flex flex-col gap-1 rounded-control bg-surface-2 p-3">
        <span class="text-xs font-semibold uppercase text-content-muted">{{ L('optics') }}</span>
        <p class="text-sm text-content">
          {{ L('opticsLine', { focalLength: focalLength || '–', pixelSize: pixelSize || '–' }) }}
        </p>
        <p v-if="scale" class="text-sm text-content-muted">
          {{ L('imageScale', { scale: scale.toFixed(2) }) }}
        </p>
      </div>
    </div>

    <!-- The sweep: NINA profile values -->
    <div class="tns-card flex flex-col gap-3">
      <h3 class="text-base font-semibold text-content">{{ L('sweep') }}</h3>
      <SettingInput
        labelKey="components.focuser.hfSimple.exposure"
        helpKey="components.focuser.hfSimple.help.exposure"
        settingKey="FocuserSettings-AutoFocusExposureTime"
        :modelValue="focuser.AutoFocusExposureTime ?? 0"
        :max="9999"
        :step="0.1"
      />
      <SettingInput
        labelKey="components.focuser.hfSimple.stepSize"
        helpKey="components.focuser.hfSimple.help.stepSize"
        settingKey="FocuserSettings-AutoFocusStepSize"
        :modelValue="focuser.AutoFocusStepSize ?? 0"
        :min="1"
        :max="100000"
      />
      <SettingInput
        labelKey="components.focuser.hfSimple.offsetSteps"
        helpKey="components.focuser.hfSimple.help.offsetSteps"
        settingKey="FocuserSettings-AutoFocusInitialOffsetSteps"
        :modelValue="focuser.AutoFocusInitialOffsetSteps ?? 0"
        :min="1"
        :max="10"
      />
      <HfSweepPreview />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useHocusFocusStore } from '@/store/hocusFocusStore';
import { imageScale } from '@/utils/hocusFocusAdvisor';
import SettingInput from '@/components/helpers/settings/UpdatePorfileNumber.vue';
import HfSetupIssues from './HfSetupIssues.vue';
import HfSweepPreview from './HfSweepPreview.vue';

const emit = defineEmits(['open-assistant']);

const { t } = useI18n();
const L = (key, params) => t(`components.focuser.hfSimple.${key}`, params || {});
const store = apiStore();

const focuser = computed(() => store.profileInfo?.FocuserSettings || {});
const focalLength = computed(() => store.profileInfo?.TelescopeSettings?.FocalLength);
const pixelSize = computed(() => store.profileInfo?.CameraSettings?.PixelSize);
const scale = computed(() =>
  imageScale(focalLength.value, pixelSize.value, focuser.value.AutoFocusBinning)
);

// The setup issues check the star detection options; their presets live under Crop & Stars
onMounted(async () => {
  try {
    await useHocusFocusStore().loadStarDetectionOptions();
  } catch (err) {
    console.error('[HfSimpleSettings] Error loading star detection options:', err);
  }
});
</script>
