<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="spinner"></div>
      <p class="ml-4 text-gray-400">{{ L('loading') }}</p>
    </div>

    <!-- Error -->
    <div v-if="error" class="rounded-lg border border-red-700/50 bg-red-900/40 p-4">
      <p class="text-red-200">
        <span class="font-semibold">{{ L('error') }}</span> {{ error }}
      </p>
      <button class="tns-btn-secondary mt-3 w-auto px-4" @click="loadOptions()">
        {{ L('retry') }}
      </button>
    </div>

    <div v-if="ready && !isLoading" class="space-y-6">
      <div v-for="section in visibleSections" :key="section.title" :class="cardClass">
        <h3 :class="headingClass">{{ L(section.title) }}</h3>
        <div class="flex flex-col gap-3">
          <template v-for="f in section.fields" :key="f.key">
            <HfToggleRow
              v-if="f.type === 'bool'"
              :model-value="!!options[f.key]"
              :label="L(f.label)"
              :help="H(f.label)"
              :status="statusOf(f.key)"
              :error="errorOf(f.key)"
              @change="save(f.key, $event)"
            />
            <HfSelectField
              v-else-if="f.type === 'enum'"
              :model-value="String(options[f.key])"
              :label="L(f.label)"
              :help="H(f.label)"
              :options="f.options"
              :status="statusOf(f.key)"
              :error="errorOf(f.key)"
              @change="save(f.key, $event)"
            />
            <HfNumberField
              v-else
              :model-value="Number(options[f.key])"
              :label="L(f.label)"
              :help="H(f.label)"
              :hint="fieldHint(f)"
              :warning="fieldWarning(f)"
              :auto="!!f.auto"
              :auto-active-label="autoActiveLabel(f)"
              :auto-reset-label="L('autoReset')"
              :min="f.min"
              :max="f.max"
              :step="f.step"
              :decimals="f.decimals"
              :inputId="'hf-ai-' + f.key"
              :status="statusOf(f.key)"
              :error="errorOf(f.key)"
              @change="save(f.key, $event)"
            />
          </template>
        </div>
      </div>

      <!-- Reset -->
      <div class="flex justify-start">
        <button class="tns-btn-secondary w-auto px-6" @click="showResetConfirm = true">
          {{ L('resetToDefaults') }}
        </button>
      </div>
    </div>

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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiService from '@/services/apiService';
import Modal from '@/components/helpers/Modal.vue';
import HfToggleRow from './fields/HfToggleRow.vue';
import HfNumberField from './fields/HfNumberField.vue';
import HfSelectField from './fields/HfSelectField.vue';

const { t } = useI18n();
const L = (key) => t(`plugins.hocusfocus.aberrationInspectorOptions.${key}`);
const H = (key) => t(`plugins.hocusfocus.aberrationInspectorOptions.help.${key}`);

const cardClass =
  'p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50';
const headingClass = 'font-bold text-base text-cyan-400';

const options = reactive({});
const isLoading = ref(false);
const error = ref(null);
const ready = ref(false);

const interpolationAlgoOptions = [
  { value: 'MultiQuadric', label: 'Multi Quadric' },
  { value: 'Hierarchical', label: 'Hierarchical' },
  { value: 'ThinPlateSpline', label: 'Thin Plate Spline' },
  { value: 'BiHarmonic', label: 'Bi-Harmonic' },
];
const interpolationAmountOptions = [
  { value: 'Small', label: 'Small' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Large', label: 'Large' },
];

// Mirrors the Inspector pane in HocusFocus v4: same fields, same wording, same gating.
// `auto: true` marks the options where -1 means "inherit the AutoFocus value" and the box is blank.
const sections = [
  {
    title: 'analysisRun',
    fields: [
      { key: 'StepCount', label: 'stepCount', auto: true, min: -1, max: 30, step: 1, decimals: 0 },
      { key: 'StepSize', label: 'stepSize', auto: true, min: -1, max: 1000, step: 1, decimals: 0 },
      {
        key: 'FramesPerPoint',
        label: 'framesPerPoint',
        auto: true,
        min: -1,
        max: 20,
        step: 1,
        decimals: 0,
      },
      {
        key: 'DetailedAnalysisExposureSeconds',
        label: 'detailedAnalysisExposureSeconds',
        auto: true,
        min: -1,
        max: 600,
        step: 0.5,
        decimals: 2,
      },
      {
        key: 'SimpleExposureSeconds',
        label: 'simpleExposureSeconds',
        auto: true,
        min: -1,
        max: 600,
        step: 0.5,
        decimals: 2,
      },
      {
        key: 'TimeoutSeconds',
        label: 'timeoutSeconds',
        auto: true,
        min: -1,
        max: 7200,
        step: 10,
        decimals: 0,
      },
      {
        key: 'SignalAmplification',
        label: 'signalAmplification',
        min: 1,
        max: 10,
        step: 1,
        decimals: 0,
      },
      { key: 'CenterFocuserBeforeRun', label: 'centerFocuserBeforeRun', type: 'bool' },
    ],
  },
  {
    title: 'eccentricityDisplay',
    fields: [
      // PositiveOddIntegerRule upstream, hence the step of 2 from an odd minimum.
      { key: 'NumRegionsWide', label: 'numRegionsWide', min: 3, max: 21, step: 2, decimals: 0 },
      { key: 'EccentricityColorMapEnabled', label: 'eccentricityColorMapEnabled', type: 'bool' },
      { key: 'InterpolationEnabled', label: 'interpolationEnabled', type: 'bool' },
      {
        key: 'InterpolationAlgo',
        label: 'interpolationAlgo',
        type: 'enum',
        options: interpolationAlgoOptions,
        when: (v) => v.InterpolationEnabled,
      },
      {
        key: 'InterpolationAmount',
        label: 'interpolationAmount',
        type: 'enum',
        options: interpolationAmountOptions,
        when: (v) => v.InterpolationEnabled,
      },
    ],
  },
  {
    title: 'sensorModel',
    fields: [
      { key: 'SensorCurveModelEnabled', label: 'sensorCurveModelEnabled', type: 'bool' },
      {
        key: 'ShowSensorModel',
        label: 'showSensorModel',
        type: 'bool',
        when: (v) => v.SensorCurveModelEnabled,
      },
      {
        key: 'FrameReviewEnabled',
        label: 'frameReviewEnabled',
        type: 'bool',
        when: (v) => v.SensorCurveModelEnabled,
      },
      {
        key: 'MicronsPerFocuserStep',
        label: 'micronsPerFocuserStep',
        auto: true,
        min: -1,
        max: 100,
        step: 0.1,
        decimals: 2,
      },
      { key: 'SensorROI', label: 'sensorROI', min: 0.1, max: 1, step: 0.01, decimals: 2 },
      { key: 'CornersROI', label: 'cornersROI', min: 0.1, max: 1, step: 0.01, decimals: 2 },
      { key: 'FixedSensorCenter', label: 'fixedSensorCenter', type: 'bool' },
      { key: 'AstigmaticCurvatureEnabled', label: 'astigmaticCurvatureEnabled', type: 'bool' },
      {
        key: 'AcceptableRSquaredMin',
        label: 'acceptableRSquaredMin',
        min: 0,
        max: 0.9999,
        step: 0.01,
        decimals: 2,
      },
    ],
  },
  {
    title: 'frameMatching',
    fields: [
      { key: 'UseRANSAC', label: 'useRANSAC', type: 'bool' },
      {
        key: 'UseAffineAlignment',
        label: 'useAffineAlignment',
        type: 'bool',
        when: (v) => v.UseRANSAC,
      },
      { key: 'RejectBadlyFittingMatches', label: 'rejectBadlyFittingMatches', type: 'bool' },
      { key: 'RejectBadBrightnessMatches', label: 'rejectBadBrightnessMatches', type: 'bool' },
      {
        key: 'StartingBrightnessDiff',
        label: 'startingBrightnessDiff',
        auto: true,
        min: -1,
        max: 5,
        step: 0.05,
        decimals: 2,
        when: (v) => v.RejectBadBrightnessMatches,
      },
    ],
  },
];

// Only render what the backend actually reports, so an older plugin build degrades instead of
// showing dead rows.
const visibleSections = computed(() =>
  sections
    .map((s) => ({
      ...s,
      fields: s.fields.filter((f) => f.key in options && (f.when ? f.when(options) : true)),
    }))
    .filter((s) => s.fields.length > 0)
);

// `auto` fields render their own affordance under the label instead of a range.
function fieldHint(field) {
  return field.auto ? '' : `${field.min} – ${field.max}`;
}

// HocusFocus computes the mismatch itself; it means the manual override disagrees with what the
// focuser driver reports.
function fieldWarning(field) {
  if (field.key !== 'MicronsPerFocuserStep') return '';
  if (options.HasFocuserStepSizeMismatch) return L('stepSizeMismatch');
  // Automatic resolves to the driver's value; with none (every INDI focuser, as INDI has no step
  // size property) HocusFocus hides all micron readouts rather than guess.
  if (Number(options.MicronsPerFocuserStep) <= 0 && !driverStepSize()) return L('noDriverStepSize');
  return '';
}

function driverStepSize() {
  const value = Number(options.DriverMicronsPerFocuserStep);
  return value > 0 ? value : null;
}

// Says what "automatic" resolves to where that is knowable.
function autoActiveLabel(field) {
  if (field.key === 'MicronsPerFocuserStep' && driverStepSize()) {
    return t('plugins.hocusfocus.aberrationInspectorOptions.autoFromDriver', {
      value: driverStepSize().toFixed(2),
    });
  }
  return L('autoActive');
}

// --- Saving -------------------------------------------------------------------------------
const optionStatus = ref({});
const optionErrors = ref({});
const saveTimers = new Map();

const statusOf = (key) => optionStatus.value[key] || '';
const errorOf = (key) => optionErrors.value[key] || '';
const setStatus = (key, status) => (optionStatus.value = { ...optionStatus.value, [key]: status });
const setError = (key, message) => (optionErrors.value = { ...optionErrors.value, [key]: message });

// The number fields commit on every keystroke, so coalesce before hitting the plugin.
function save(key, value) {
  if (value === undefined || value === null) return;
  options[key] = value;
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
  setStatus(key, 'saving');
  setError(key, '');
  try {
    const response = await apiService.hocusfocus.setAberrationInspectorOption(key, value);
    if (response && response.Success === false) {
      throw new Error(response.Error || L('saveFailed'));
    }
    setStatus(key, 'saved');
    setTimeout(() => setStatus(key, ''), 1000);
    // MicronsPerFocuserStep drives HasFocuserStepSizeMismatch, which is computed server-side.
    if (key === 'MicronsPerFocuserStep') {
      await refreshOptions();
    }
  } catch (err) {
    console.error(`[AberrationInspectorOptions] Error saving ${key}:`, err);
    // A rejected value comes back as HTTP 400 with the plugin's own validation message.
    const detail = err.response?.data?.Error || err.response?.data?.error || err.message;
    setStatus(key, 'error');
    setError(key, detail || L('saveFailed'));
    // The plugin kept its previous value, so put the shown value back in sync.
    await refreshOptions();
  }
}

// Re-reads the options WITHOUT the loading flag, which would unmount the form and take the
// just-raised error message with it.
async function refreshOptions() {
  try {
    const { options: fresh } = await apiService.hocusfocus.getAberrationInspectorOptions();
    if (fresh) Object.assign(options, fresh);
  } catch (err) {
    console.error('[AberrationInspectorOptions] Error refreshing options:', err);
  }
}

// --- Load / reset -------------------------------------------------------------------------
const showResetConfirm = ref(false);
const isResetting = ref(false);

async function loadOptions() {
  isLoading.value = true;
  error.value = null;
  try {
    const { options: fresh } = await apiService.hocusfocus.getAberrationInspectorOptions();
    Object.assign(options, fresh);
    ready.value = Object.keys(options).length > 0;
  } catch (err) {
    console.error('[AberrationInspectorOptions] Error loading options:', err);
    error.value = err.message || L('saveFailed');
  } finally {
    isLoading.value = false;
  }
}

async function executeReset() {
  isResetting.value = true;
  try {
    const response = await apiService.hocusfocus.resetAberrationInspectorDefaults();
    if (response && response.Success === false) {
      throw new Error(response.Error || L('resetFailed'));
    }
    optionStatus.value = {};
    optionErrors.value = {};
    await refreshOptions();
    showResetConfirm.value = false;
  } catch (err) {
    console.error('[AberrationInspectorOptions] Error resetting options:', err);
    error.value = err.message || L('resetFailed');
    showResetConfirm.value = false;
  } finally {
    isResetting.value = false;
  }
}

onMounted(loadOptions);

onBeforeUnmount(() => {
  saveTimers.forEach((timer) => clearTimeout(timer));
  saveTimers.clear();
});
</script>
