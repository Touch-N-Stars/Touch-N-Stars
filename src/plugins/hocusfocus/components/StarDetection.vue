<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="store.isLoadingDetectionOptions" class="flex items-center justify-center py-12">
      <div class="spinner"></div>
      <p class="ml-4 text-gray-400">{{ L('loading') }}</p>
    </div>

    <!-- Error -->
    <div
      v-if="store.detectionOptionsError"
      class="rounded-lg border border-red-700/50 bg-red-900/40 p-4"
    >
      <p class="text-red-200">
        <span class="font-semibold">{{ L('error') }}</span> {{ store.detectionOptionsError }}
      </p>
      <button class="tns-btn-secondary mt-3 w-auto px-4" @click="loadStarDetectionOptions()">
        {{ L('retry') }}
      </button>
    </div>

    <div v-if="o && !store.isLoadingDetectionOptions" class="space-y-6">
      <!-- Per-filter notice: while per-filter star detection owns the options object these
           edits go into one filter's snapshot instead of the global settings. -->
      <div
        v-if="o.PersistToProfile === false"
        class="rounded-lg border border-amber-600/50 bg-amber-900/25 p-3 text-sm text-amber-200"
      >
        {{ L('perFilterActive') }}
      </div>

      <!-- The optimizer tunes these settings against a saved or live auto-focus run -->
      <div :class="cardClass">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <h3 :class="headingClass">{{ L('optimizer') }}</h3>
            <p class="text-sm text-gray-400">
              {{ optimizerRunning ? L('optimizerRunning') : L('optimizerDescription') }}
            </p>
          </div>
          <button class="tns-btn-secondary w-auto px-4" @click="showOptimizer = true">
            {{ optimizerRunning ? L('optimizerResume') : L('optimizerOpen') }}
          </button>
        </div>
      </div>

      <!-- General -->
      <div :class="cardClass">
        <h3 :class="headingClass">{{ L('generalSettings') }}</h3>
        <div class="flex flex-col gap-3">
          <HfSelectField
            :model-value="o.DetectionBinning"
            :label="L('detectionBinning')"
            :help="H('detectionBinning')"
            :options="detectionBinningOptions"
            :status="statusOf('DetectionBinning')"
            :error="errorOf('DetectionBinning')"
            @change="save('DetectionBinning', $event)"
          />
          <p
            v-if="o.DetectionBinningRecommendationVisible && o.DetectionBinningHint"
            class="text-sm italic text-cyan-300"
            :title="o.DetectionBinningHintDetail"
          >
            {{ o.DetectionBinningHint }}
          </p>
          <HfSelectField
            :model-value="o.MeasurementAverage"
            :label="L('measurementAverage')"
            :help="H('measurementAverage')"
            :options="measurementAverageOptions"
            :status="statusOf('MeasurementAverage')"
            :error="errorOf('MeasurementAverage')"
            @change="save('MeasurementAverage', $event)"
          />
          <HfToggleRow
            v-for="tg in generalToggles"
            :key="tg.key"
            :model-value="o[tg.key]"
            :label="L(tg.label)"
            :help="H(tg.label)"
            :status="statusOf(tg.key)"
            :error="errorOf(tg.key)"
            @change="save(tg.key, $event)"
          />
        </div>
      </div>

      <!-- Simple mode -->
      <div v-if="!o.UseAdvanced" :class="cardClass">
        <h3 :class="headingClass">{{ L('simpleModeSettings') }}</h3>
        <HfToggleRow
          v-if="o.HasOptimizedSettings"
          :model-value="o.UseOptimizedSettings"
          :label="L('useOptimizedSettings')"
          :help="H('useOptimizedSettings')"
          :status="statusOf('UseOptimizedSettings')"
          :error="errorOf('UseOptimizedSettings')"
          @change="save('UseOptimizedSettings', $event)"
        />
        <div v-if="!o.UseOptimizedSettings" class="flex flex-col gap-3">
          <HfSelectField
            :model-value="o.Simple_NoiseLevel"
            :label="L('noiseLevel')"
            :help="H('noiseLevel')"
            :options="noiseLevelOptions"
            :status="statusOf('Simple_NoiseLevel')"
            :error="errorOf('Simple_NoiseLevel')"
            @change="save('Simple_NoiseLevel', $event)"
          />
          <HfSelectField
            :model-value="o.Simple_PixelScale"
            :label="L('pixelScale')"
            :help="H('pixelScale')"
            :options="pixelScaleOptions"
            :status="statusOf('Simple_PixelScale')"
            :error="errorOf('Simple_PixelScale')"
            @change="save('Simple_PixelScale', $event)"
          />
          <HfSelectField
            :model-value="o.Simple_FocusRange"
            :label="L('focusRange')"
            :help="H('focusRange')"
            :options="focusRangeOptions"
            :status="statusOf('Simple_FocusRange')"
            :error="errorOf('Simple_FocusRange')"
            @change="save('Simple_FocusRange', $event)"
          />
        </div>
      </div>

      <!-- Advanced sections -->
      <template v-if="o.UseAdvanced">
        <div v-for="section in advancedSections" :key="section.title" :class="cardClass">
          <h3 :class="headingClass">{{ L(section.title) }}</h3>
          <div class="flex flex-col gap-3">
            <template v-for="f in visibleFields(section)" :key="f.key">
              <HfToggleRow
                v-if="f.type === 'bool'"
                :model-value="o[f.key]"
                :label="L(f.label)"
                :help="H(f.label)"
                :status="statusOf(f.key)"
                :error="errorOf(f.key)"
                @change="save(f.key, $event)"
              />
              <HfSelectField
                v-else-if="f.type === 'enum'"
                :model-value="o[f.key]"
                :label="L(f.label)"
                :help="H(f.label)"
                :options="f.options"
                :status="statusOf(f.key)"
                :error="errorOf(f.key)"
                @change="save(f.key, $event)"
              />
              <HfNumberField
                v-else
                :model-value="Number(o[f.key])"
                :label="L(f.label)"
                :help="H(f.label)"
                :hint="rangeHint(f)"
                :min="f.min"
                :max="f.max"
                :step="f.step"
                :decimals="f.decimals"
                :inputId="'hf-sd-' + f.key"
                :status="statusOf(f.key)"
                :error="errorOf(f.key)"
                @change="save(f.key, $event)"
              />
            </template>
          </div>
        </div>
      </template>

      <!-- Intermediate files (always available, like the plugin's own options page) -->
      <div :class="cardClass">
        <h3 :class="headingClass">{{ L('intermediateFiles') }}</h3>
        <HfToggleRow
          :model-value="o.SaveIntermediateImages"
          :label="L('saveIntermediateImages')"
          :help="H('saveIntermediateImages')"
          :status="statusOf('SaveIntermediateImages')"
          :error="errorOf('SaveIntermediateImages')"
          @change="save('SaveIntermediateImages', $event)"
        />
        <HfTextField
          v-if="o.SaveIntermediateImages"
          :model-value="o.IntermediateSavePath"
          :label="L('intermediateSavePath')"
          :help="H('intermediateSavePath')"
          :status="statusOf('IntermediateSavePath')"
          :error="errorOf('IntermediateSavePath')"
          @change="save('IntermediateSavePath', $event)"
        />
      </div>

      <!-- Reset -->
      <div class="flex justify-start">
        <button
          class="tns-btn-secondary w-auto px-6"
          :disabled="store.isLoadingDetectionOptions"
          @click="showResetConfirm = true"
        >
          {{ L('resetToDefaults') }}
        </button>
      </div>
    </div>

    <StarDetectionOptimizer
      :show="showOptimizer"
      @close="onOptimizerClosed"
      @accepted="loadStarDetectionOptions()"
    />

    <!-- Reset confirmation -->
    <Modal :show="showResetConfirm" maxWidth="max-w-sm" @close="showResetConfirm = false">
      <template #header>
        <h2 class="text-xl font-bold text-white">{{ L('resetTitle') }}</h2>
      </template>
      <template #body>
        <div class="flex w-full flex-col gap-6">
          <p class="text-sm text-gray-300">{{ L('resetPrompt') }}</p>
          <div class="flex justify-end gap-3">
            <button class="tns-btn-secondary w-auto px-4" @click="showResetConfirm = false">
              {{ L('cancel') }}
            </button>
            <button
              class="tns-btn-danger w-auto px-4"
              :disabled="isResetting"
              @click="executeReset()"
            >
              {{ isResetting ? L('resetting') : L('reset') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHocusFocusStore } from '../store/hocusfocusStore';
import apiService from '@/services/apiService';
import Modal from '@/components/helpers/Modal.vue';
import HfToggleRow from './fields/HfToggleRow.vue';
import HfNumberField from './fields/HfNumberField.vue';
import HfSelectField from './fields/HfSelectField.vue';
import HfTextField from './fields/HfTextField.vue';
import StarDetectionOptimizer from './optimizer/StarDetectionOptimizer.vue';

const props = defineProps({
  isTabActive: { type: Boolean, default: false },
});

const { t } = useI18n();
const store = useHocusFocusStore();

const L = (key) => t(`plugins.hocusfocus.starDetection.${key}`);
const H = (key) => t(`plugins.hocusfocus.starDetection.help.${key}`);

const o = computed(() => store.starDetectionOptions);

// --- Optimizer ------------------------------------------------------------------------------
const showOptimizer = ref(false);
// A run keeps going when its window is closed, so the card offers to reopen it.
const optimizerRunning = ref(false);

async function refreshOptimizerStatus() {
  try {
    const state = await apiService.hocusfocus.optimizer.getState();
    optimizerRunning.value = !!state?.Active;
  } catch {
    optimizerRunning.value = false;
  }
}

function onOptimizerClosed() {
  showOptimizer.value = false;
  refreshOptimizerStatus();
}

const cardClass =
  'p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50';
const headingClass = 'font-bold text-base text-cyan-400';

// --- Enum choices. Values are the backend enum names; labels mirror the plugin's own wording. ---
const detectionBinningOptions = [
  { value: 'Bin1', label: '1x1 (Off)' },
  { value: 'Bin2', label: '2x2' },
  { value: 'Bin3', label: '3x3' },
  { value: 'Bin4', label: '4x4' },
];
const measurementAverageOptions = [
  { value: 'Median', label: 'Median' },
  { value: 'MeanOutliers', label: 'Mean + Outlier Detection' },
];
const noiseLevelOptions = ['Typical', 'None', 'High', 'Low'].map((v) => ({ value: v, label: v }));
const pixelScaleOptions = [
  { value: 'Typical', label: 'Typical' },
  { value: 'WideField', label: 'Wide Field' },
  { value: 'LongFocalLength', label: 'Long Focal Length' },
];
const focusRangeOptions = [
  { value: 'Typical', label: 'Typical' },
  { value: 'WideRange', label: 'Wide Range' },
];
const psfFitTypeOptions = [
  { value: 'Moffat_40', label: 'Moffat 4.0' },
  { value: 'Gaussian', label: 'Gaussian' },
  { value: 'Moffat_25', label: 'Moffat 2.5' },
  { value: 'Moffat_15', label: 'Moffat 1.5' },
  { value: 'MoffatFittable', label: 'Moffat (β fittable)' },
];

// Toggles the plugin shows regardless of Advanced Mode.
const generalToggles = [
  { key: 'UseAdvanced', label: 'advancedMode' },
  { key: 'HotpixelThresholdingEnabled', label: 'useHotpixelThresholding' },
  { key: 'UseAutoFocusCrop', label: 'useAutoFocusCrop' },
  { key: 'ModelPSF', label: 'fitPSF' },
  { key: 'DebugMode', label: 'debugMode' },
];

// Advanced fields, grouped for the touch layout. Ranges and steps follow the validation rules in
// the plugin's own options page (Resources/OptionsDataTemplates.xaml) so TNS cannot offer a value
// HocusFocus would reject. `when` mirrors that page's row visibility.
const advancedSections = [
  {
    title: 'noiseAndStructure',
    fields: [
      { key: 'HotpixelFiltering', label: 'hotpixelFiltering', type: 'bool' },
      {
        key: 'StarMeasurementNoiseReductionEnabled',
        label: 'noiseReducedStarMeasurement',
        type: 'bool',
      },
      {
        key: 'NoiseReductionRadius',
        label: 'noiseReductionRadius',
        min: 0,
        max: 20,
        step: 1,
        decimals: 0,
      },
      {
        key: 'NoiseClippingMultiplier',
        label: 'noiseClippingMultiplier',
        min: 0.1,
        max: 20,
        step: 0.1,
        decimals: 2,
      },
      {
        key: 'StarClippingMultiplier',
        label: 'starClippingMultiplier',
        min: 0.1,
        max: 20,
        step: 0.1,
        decimals: 2,
      },
      { key: 'StructureLayers', label: 'structureLayers', min: 1, max: 10, step: 1, decimals: 0 },
      {
        key: 'BrightnessSensitivity',
        label: 'brightnessSensitivity',
        min: 0,
        max: 100,
        step: 0.1,
        decimals: 2,
      },
      { key: 'LocallyAdaptiveBinarization', label: 'locallyAdaptiveBinarization', type: 'bool' },
      {
        key: 'AdaptiveNoiseBlockSize',
        label: 'adaptiveNoiseBlockSize',
        min: 64,
        max: 256,
        step: 16,
        decimals: 0,
        when: (v) => v.LocallyAdaptiveBinarization,
      },
    ],
  },
  {
    title: 'starGates',
    fields: [
      {
        key: 'StarPeakResponse',
        label: 'starPeakResponse',
        min: 0,
        max: 1,
        step: 0.01,
        decimals: 2,
      },
      { key: 'MaxDistortion', label: 'maxDistortion', min: 0, max: 1, step: 0.01, decimals: 2 },
      {
        key: 'StarCenterTolerance',
        label: 'starCenterTolerance',
        min: 0,
        max: 1,
        step: 0.01,
        decimals: 2,
      },
      {
        key: 'StarBackgroundBoxExpansion',
        label: 'starBackgroundBoxExpansion',
        min: 1,
        max: 20,
        step: 1,
        decimals: 0,
      },
      {
        key: 'MinStarBoundingBoxSize',
        label: 'minStarBoundingBoxSize',
        min: 1,
        max: 50,
        step: 1,
        decimals: 0,
      },
      { key: 'MinHFR', label: 'minHFR', min: 0.1, max: 10, step: 0.1, decimals: 2 },
      {
        key: 'StructureDilationSize',
        label: 'structureDilationSize',
        min: 3,
        max: 30,
        step: 1,
        decimals: 0,
      },
      {
        key: 'StructureDilationCount',
        label: 'structureDilationCount',
        min: 0,
        max: 10,
        step: 1,
        decimals: 0,
      },
      {
        key: 'PixelSampleSize',
        label: 'pixelSampleSize',
        min: 0.01,
        max: 1,
        step: 0.01,
        decimals: 2,
      },
    ],
  },
  {
    title: 'defocusAware',
    fields: [
      { key: 'DefocusAwareGates', label: 'defocusAwareGates', type: 'bool' },
      {
        key: 'DefocusDistortionSizeReference',
        label: 'defocusDistortionSizeReference',
        min: 1,
        max: 1000,
        step: 1,
        decimals: 1,
        when: (v) => v.DefocusAwareGates,
      },
      {
        key: 'DefocusDistortionMinFactor',
        label: 'defocusDistortionMinFactor',
        min: 0.01,
        max: 1,
        step: 0.01,
        decimals: 2,
        when: (v) => v.DefocusAwareGates,
      },
      {
        key: 'DefocusCenteringToleranceFactor',
        label: 'defocusCenteringToleranceFactor',
        min: 1,
        max: 10,
        step: 0.1,
        decimals: 2,
        when: (v) => v.DefocusAwareGates,
      },
      { key: 'DefocusAwareStructure', label: 'defocusAwareStructure', type: 'bool' },
      {
        key: 'StructureLayerBoost',
        label: 'structureLayerBoost',
        min: 0,
        max: 6,
        step: 1,
        decimals: 0,
      },
      { key: 'DefocusAwareDonutDetection', label: 'defocusAwareDonutDetection', type: 'bool' },
      {
        key: 'DonutMorphCloseSize',
        label: 'donutMorphCloseSize',
        min: 1,
        max: 25,
        step: 1,
        decimals: 0,
        when: (v) => v.DefocusAwareDonutDetection,
      },
      {
        key: 'DonutMinAnnularityHoleFraction',
        label: 'donutMinAnnularityHoleFraction',
        min: 0.02,
        max: 0.6,
        step: 0.01,
        decimals: 2,
        when: (v) => v.DefocusAwareDonutDetection,
      },
      {
        key: 'DonutMaxStreakEccentricity',
        label: 'donutMaxStreakEccentricity',
        min: 0.8,
        max: 1,
        step: 0.01,
        decimals: 2,
        when: (v) => v.DefocusAwareDonutDetection,
      },
      {
        key: 'DonutSaturationBloomRadius',
        label: 'donutSaturationBloomRadius',
        min: 0,
        max: 100,
        step: 1,
        decimals: 1,
        when: (v) => v.DefocusAwareDonutDetection,
      },
    ],
  },
  {
    title: 'psfFitting',
    fields: [
      { key: 'PSFFitType', label: 'psfFitType', type: 'enum', options: psfFitTypeOptions },
      { key: 'PSFResolution', label: 'psfResolution', min: 1, max: 30, step: 1, decimals: 0 },
      {
        key: 'PSFParallelPartitionSize',
        label: 'psfParallelPartitionSize',
        min: 0,
        max: 2000,
        step: 10,
        decimals: 0,
      },
      { key: 'PSFFitThreshold', label: 'psfFitThreshold', min: 0, max: 1, step: 0.01, decimals: 2 },
      { key: 'PSFPixelIntegration', label: 'psfPixelIntegration', type: 'bool' },
      { key: 'UsePSFAbsoluteDeviation', label: 'usePSFAbsoluteDeviation', type: 'bool' },
    ],
  },
  {
    title: 'saturationAndContamination',
    fields: [
      {
        key: 'HotpixelThreshold',
        label: 'hotpixelThreshold',
        min: 0,
        max: 1,
        step: 0.001,
        decimals: 3,
        when: (v) => v.HotpixelThresholdingEnabled,
      },
      {
        key: 'SaturationThreshold',
        label: 'saturationThreshold',
        min: 0,
        max: 1,
        step: 0.001,
        decimals: 3,
      },
      { key: 'ExcludeSaturatedStarsFromHFR', label: 'excludeSaturatedStarsFromHFR', type: 'bool' },
      {
        key: 'ContaminationSensitivity',
        label: 'contaminationSensitivity',
        min: 0,
        max: 20,
        step: 0.1,
        decimals: 2,
      },
      { key: 'RejectContaminatedStars', label: 'rejectContaminatedStars', type: 'bool' },
    ],
  },
];

function visibleFields(section) {
  const values = o.value || {};
  return section.fields.filter((f) => (f.when ? f.when(values) : true));
}

function rangeHint(field) {
  if (field.type) return '';
  return `${field.min} – ${field.max}`;
}

// --- Saving -------------------------------------------------------------------------------
const optionStatus = ref({});
const optionErrors = ref({});
const saveTimers = new Map();

const statusOf = (key) => optionStatus.value[key] || '';
const errorOf = (key) => optionErrors.value[key] || '';

// The number fields commit on every keystroke, so coalesce before hitting the plugin.
function save(key, value) {
  if (value === undefined || value === null) return;
  if (!store.starDetectionOptions) return;
  store.starDetectionOptions[key] = value;

  clearTimeout(saveTimers.get(key));
  saveTimers.set(
    key,
    setTimeout(() => {
      saveTimers.delete(key);
      pushOption(key, value);
    }, 300)
  );
}

async function pushOption(key, value) {
  optionStatus.value = { ...optionStatus.value, [key]: 'saving' };
  optionErrors.value = { ...optionErrors.value, [key]: '' };
  try {
    const response = await apiService.hocusfocus.setStarDetectionOption(key, value);
    if (response && response.success === false) {
      throw new Error(response.error || L('saveFailed'));
    }
    optionStatus.value = { ...optionStatus.value, [key]: 'saved' };
    setTimeout(() => {
      optionStatus.value = { ...optionStatus.value, [key]: '' };
    }, 1000);
    // Simple-mode presets and the binning recommendation are derived server-side, so a change
    // to one option can move several others.
    if (derivedRefreshKeys.has(key)) {
      await refreshOptions();
    }
  } catch (err) {
    console.error(`[StarDetection] Error saving ${key}:`, err);
    // A rejected value comes back as HTTP 400 with the plugin's own validation message.
    const detail = err.response?.data?.error || err.message;
    optionStatus.value = { ...optionStatus.value, [key]: 'error' };
    optionErrors.value = { ...optionErrors.value, [key]: detail || L('saveFailed') };
    // The plugin kept its previous value, so put the shown value back in sync.
    await refreshOptions();
  }
}

// Re-reads the options WITHOUT the store's loading flag, which would unmount the form and take
// the just-raised error message with it.
async function refreshOptions() {
  try {
    const options = await apiService.hocusfocus.getStarDetectionOptions();
    if (options) store.starDetectionOptions = options;
  } catch (err) {
    console.error('[StarDetection] Error refreshing options:', err);
  }
}

const derivedRefreshKeys = new Set([
  'UseAdvanced',
  'UseOptimizedSettings',
  'Simple_NoiseLevel',
  'Simple_PixelScale',
  'Simple_FocusRange',
  'DetectionBinning',
]);

// --- Load / reset -------------------------------------------------------------------------
const showResetConfirm = ref(false);
const isResetting = ref(false);

async function loadStarDetectionOptions() {
  await store.loadStarDetectionOptions();
}

async function executeReset() {
  isResetting.value = true;
  try {
    await store.resetStarDetectionDefaults();
    optionErrors.value = {};
    optionStatus.value = {};
    showResetConfirm.value = false;
  } catch (err) {
    console.error('[StarDetection] Error resetting options:', err);
    store.detectionOptionsError = err.message || L('resetFailed');
    showResetConfirm.value = false;
  } finally {
    isResetting.value = false;
  }
}

watch(
  () => props.isTabActive,
  async (isActive) => {
    if (isActive) {
      await loadStarDetectionOptions();
      refreshOptimizerStatus();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  saveTimers.forEach((timer) => clearTimeout(timer));
  saveTimers.clear();
});
</script>
