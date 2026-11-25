<template>
  <div v-if="store.cameraInfo?.Connected && hasAnySetting" class="flex flex-col gap-2">
    <!-- Collapsed to one summary line, like the details of a plan exposure -->
    <button
      type="button"
      class="w-full min-h-touch flex items-center gap-2 text-left text-xs text-content-muted hover:text-content"
      :aria-expanded="open"
      data-haptic="none"
      @click="open = !open"
    >
      <ChevronRightIcon
        class="w-4 h-4 shrink-0 transition-transform duration-200"
        :class="{ 'rotate-90': open }"
      />
      <span class="shrink-0 font-semibold text-content">
        {{ t('components.simpleMode.camera.title') }}
      </span>
      <span class="min-w-0 flex-1 truncate">{{ summary }}</span>
    </button>

    <template v-if="open">
      <p class="text-xs text-content-faint">{{ t('components.simpleMode.camera.hint') }}</p>

      <GainInput
        v-if="store.cameraInfo.CanSetGain"
        :class="gain.glowClass.value"
        :modelValue="gainValue"
        labelKey="components.camera.gain_iso"
        :min="store.cameraInfo.GainMin ?? 0"
        :max="store.cameraInfo.GainMax ?? 1000"
        :useDefaultSentinel="false"
        inputId="simple-camera-gain"
        @change="gain.save($event)"
      />

      <NumberInputPicker
        v-if="store.cameraInfo.CanSetOffset"
        :class="offset.glowClass.value"
        :modelValue="offsetValue"
        :label="t('components.camera.offset')"
        labelKey="components.camera.offset"
        :min="store.cameraInfo.OffsetMin ?? 0"
        :max="store.cameraInfo.OffsetMax ?? 1000"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        inputId="simple-camera-offset"
        @change="offset.save($event)"
      />

      <div v-if="readoutModes.length > 1" class="flex items-center gap-3">
        <label for="simple-camera-readout" class="shrink-0 text-xs md:text-sm text-content">
          {{ t('components.camera.readout_mode') }}
        </label>
        <select
          id="simple-camera-readout"
          class="tns-select ml-auto w-auto! min-w-0 max-w-[60%]"
          :class="readoutGlow"
          :value="readoutValue"
          :disabled="readoutSaving || store.cameraInfo.IsExposing"
          @change="saveReadoutMode($event.target)"
        >
          <option v-for="(mode, index) in readoutModes" :key="index" :value="index">
            {{ mode }}
          </option>
        </select>
      </div>

      <p v-if="errorMessage" class="text-sm text-status-danger break-words">
        {{ errorMessage }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useProfileSetting } from '@/composables/useProfileSetting';
import GainInput from '@/components/helpers/GainInput.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { reportBackendRefusal } from '@/utils/backendErrors';

/**
 * The camera's default gain, offset and readout mode on the simple mode home page.
 *
 * Gain and offset are the profile defaults (CameraSettings-Gain/-Offset): N.I.N.A. uses them for
 * every exposure whose gain or offset is -1 ("camera default"), which is how the simple mode's
 * plan exposures are created; an exposure can still carry its own values. The readout mode only
 * takes effect when the connected camera is told as well, so it goes to the camera first and
 * then into the profile. Snapshots get the same mode - a beginner should not have to tell the
 * two apart; the camera page keeps them apart.
 */
const { t } = useI18n();
const store = apiStore();

const camera = computed(() => store.cameraInfo ?? {});
const settings = computed(() => store.profileInfo?.CameraSettings ?? {});

// A profile that never stored a value shows what the camera is set to right now
const gain = useProfileSetting('CameraSettings-Gain', {
  source: () => settings.value.Gain ?? camera.value.Gain,
});
const offset = useProfileSetting('CameraSettings-Offset', {
  source: () => settings.value.Offset ?? camera.value.Offset,
});
const readoutNormal = useProfileSetting('CameraSettings-ReadoutModeForNormalImages', {
  source: () =>
    settings.value.ReadoutModeForNormalImages ?? camera.value.ReadoutModeForNormalImages,
  fallback: 0,
});
const readoutSnap = useProfileSetting('CameraSettings-ReadoutModeForSnapImages', {
  source: () => settings.value.ReadoutModeForSnapImages ?? camera.value.ReadoutModeForSnapImages,
  fallback: 0,
});

const readoutModes = computed(() => camera.value.ReadoutModes ?? []);
const open = ref(false);

const hasAnySetting = computed(
  () => camera.value.CanSetGain || camera.value.CanSetOffset || readoutModes.value.length > 1
);

// NumberInputPicker needs a number to show; a camera that reports nothing starts at the minimum
const gainValue = computed(() => numberOr(gain.value.value, camera.value.GainMin ?? 0));
const offsetValue = computed(() => numberOr(offset.value.value, camera.value.OffsetMin ?? 0));
const readoutValue = computed(() => numberOr(readoutNormal.value.value, 0));

const summary = computed(() =>
  [
    camera.value.CanSetGain && `${t('components.sequence.simple.gainShort')} ${gainValue.value}`,
    camera.value.CanSetOffset &&
      `${t('components.sequence.simple.offsetShort')} ${offsetValue.value}`,
    readoutModes.value.length > 1 && readoutModes.value[readoutValue.value],
  ]
    .filter(Boolean)
    .join(' · ')
);

const readoutSaving = ref(false);
const readoutError = ref('');
const readoutGlow = computed(
  () => readoutNormal.glowClass.value || (readoutError.value ? 'glow-red' : '')
);

const errorMessage = computed(
  () => gain.error.value || offset.error.value || readoutError.value || ''
);

function numberOr(value, fallback) {
  const n = Number(value);
  return value === null || value === undefined || !Number.isFinite(n) ? fallback : n;
}

// Sets one readout mode on the connected camera. PINS takes it through its camera setting
// route, N.I.N.A. through the Advanced API (per image type since ninaAPI 2.2.14.4).
async function setCameraReadout(type, mode) {
  if (store.isPINS) {
    const settingName =
      type === 'image' ? 'ReadoutModeForNormalImages' : 'ReadoutModeForSnapImages';
    return apiService.cameraAction(`set-setting?settingName=${settingName}&newValue=${mode}`);
  }
  if (store.checkVersionNewerOrEqual(store.currentApiVersion, '2.2.14.4')) {
    return apiService.setReadoutModeType(type, mode);
  }
  // Older API: one mode for both image types
  return type === 'image' ? apiService.setReadoutMode(mode) : { Success: true };
}

async function saveReadoutMode(select) {
  const mode = Number(select.value);
  readoutSaving.value = true;
  readoutError.value = '';
  let applied = false;
  try {
    for (const type of ['image', 'snapshot']) {
      const response = await setCameraReadout(type, mode);
      // Refused (e.g. while the camera is exposing): toasted, the profile stays as it was
      reportBackendRefusal(response, 'components.backendErrors.readout');
      if (response?.Success === false) return;
    }
    applied = (await readoutNormal.save(mode)) && (await readoutSnap.save(mode));
  } catch (error) {
    console.error('[CameraDefaultSettings] Error setting readout mode:', error);
    readoutError.value = error?.message || String(error);
  } finally {
    readoutSaving.value = false;
    // The select keeps the picked option even when the bound value did not change
    if (!applied) select.value = String(readoutValue.value);
  }
}
</script>
