<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="store.isLoadingAutoFocusOptions" class="flex items-center justify-center py-12">
      <div class="spinner"></div>
      <p class="ml-4 text-gray-400">{{ L('loading') }}</p>
    </div>

    <!-- Error -->
    <div
      v-if="store.autoFocusOptionsError"
      class="rounded-lg border border-red-700/50 bg-red-900/40 p-4"
    >
      <p class="text-red-200">
        <span class="font-semibold">{{ L('error') }}</span> {{ store.autoFocusOptionsError }}
      </p>
      <button class="tns-btn-secondary mt-3 w-auto px-4" @click="loadAutoFocusOptions()">
        {{ L('retry') }}
      </button>
    </div>

    <div v-if="o && !store.isLoadingAutoFocusOptions" class="space-y-6">
      <!-- Basic -->
      <div :class="cardClass">
        <h3 :class="headingClass">{{ L('basicSettings') }}</h3>
        <div class="flex flex-col gap-3">
          <HfNumberField
            v-for="f in basicNumbers"
            :key="f.key"
            :model-value="Number(o[f.key])"
            :label="L(f.label)"
            :help="H(f.label)"
            :hint="f.hint ? L(f.hint) : ''"
            :min="f.min"
            :max="f.max"
            :step="f.step"
            :decimals="f.decimals"
            :inputId="'hf-af-' + f.key"
            :status="statusOf(f.key)"
            :error="errorOf(f.key)"
            @change="save(f.key, $event)"
          />
          <!-- Lives in InspectorOptions, but the plugin surfaces it here on the AutoFocus page
               because it is the focuser convention every AutoFocus direction label reads. -->
          <HfSelectField
            v-if="inspectorReady"
            :model-value="String(inspectorOptions.FocuserIncreasesTowardObjective)"
            :label="L('focuserIncreasesTowardObjective')"
            :help="H('focuserIncreasesTowardObjective')"
            :options="focuserDirectionOptions"
            :status="statusOf('FocuserIncreasesTowardObjective')"
            :error="errorOf('FocuserIncreasesTowardObjective')"
            @change="saveInspector('FocuserIncreasesTowardObjective', $event === 'true')"
          />
        </div>
      </div>

      <!-- HFR validation -->
      <div :class="cardClass">
        <h3 :class="headingClass">{{ L('hfrValidation') }}</h3>
        <div class="flex flex-col gap-3">
          <HfToggleRow
            :model-value="o.ValidateHfrImprovement"
            :label="L('validateHfrImprovement')"
            :help="H('validateHfrImprovement')"
            :status="statusOf('ValidateHfrImprovement')"
            :error="errorOf('ValidateHfrImprovement')"
            @change="save('ValidateHfrImprovement', $event)"
          />
          <HfNumberField
            :model-value="Number(o.HFRImprovementThreshold)"
            :label="L('hfrImprovementThreshold')"
            :help="H('hfrImprovementThreshold')"
            :min="0"
            :max="1"
            :step="0.01"
            :decimals="2"
            inputId="hf-af-HFRImprovementThreshold"
            :status="statusOf('HFRImprovementThreshold')"
            :error="errorOf('HFRImprovementThreshold')"
            @change="save('HFRImprovementThreshold', $event)"
          />
        </div>
      </div>

      <!-- Curve fitting -->
      <div :class="cardClass">
        <h3 :class="headingClass">{{ L('curveFitting') }}</h3>
        <div class="flex flex-col gap-3">
          <HfSelectField
            :model-value="o.HyperbolicFitModel"
            :label="L('hyperbolicFitModel')"
            :help="H('hyperbolicFitModel')"
            :options="hyperbolicFitModelOptions"
            :status="statusOf('HyperbolicFitModel')"
            :error="errorOf('HyperbolicFitModel')"
            @change="save('HyperbolicFitModel', $event)"
          />
          <HfToggleRow
            :model-value="o.WeightedHyperbolicFitEnabled"
            :label="L('weightedHyperbolicFitEnabled')"
            :help="H('weightedHyperbolicFitEnabled')"
            :status="statusOf('WeightedHyperbolicFitEnabled')"
            :error="errorOf('WeightedHyperbolicFitEnabled')"
            @change="save('WeightedHyperbolicFitEnabled', $event)"
          />
          <HfSelectField
            :model-value="o.FitRejectionCriterion"
            :label="L('fitRejectionCriterion')"
            :help="H('fitRejectionCriterion')"
            :options="fitRejectionCriterionOptions"
            :status="statusOf('FitRejectionCriterion')"
            :error="errorOf('FitRejectionCriterion')"
            @change="save('FitRejectionCriterion', $event)"
          />
          <!-- The two thresholds are alternatives: only the one the criterion selects applies. -->
          <HfNumberField
            v-if="o.FitRejectionCriterion === 'RSquared'"
            :model-value="Number(o.RSquaredRejectionThreshold)"
            :label="L('rSquaredRejectionThreshold')"
            :help="H('rSquaredRejectionThreshold')"
            :min="0"
            :max="1"
            :step="0.01"
            :decimals="2"
            inputId="hf-af-RSquaredRejectionThreshold"
            :status="statusOf('RSquaredRejectionThreshold')"
            :error="errorOf('RSquaredRejectionThreshold')"
            @change="save('RSquaredRejectionThreshold', $event)"
          />
          <HfNumberField
            v-if="o.FitRejectionCriterion === 'ReducedChiSquared'"
            :model-value="Number(o.ReducedChiSquaredRejectionThreshold)"
            :label="L('reducedChiSquaredRejectionThreshold')"
            :help="H('reducedChiSquaredRejectionThreshold')"
            :min="0"
            :max="1000"
            :step="0.5"
            :decimals="2"
            inputId="hf-af-ReducedChiSquaredRejectionThreshold"
            :status="statusOf('ReducedChiSquaredRejectionThreshold')"
            :error="errorOf('ReducedChiSquaredRejectionThreshold')"
            @change="save('ReducedChiSquaredRejectionThreshold', $event)"
          />
        </div>
      </div>

      <!-- Outlier rejection -->
      <div :class="cardClass">
        <h3 :class="headingClass">{{ L('outlierRejection') }}</h3>
        <div class="flex flex-col gap-3">
          <HfNumberField
            :model-value="Number(o.MaxOutlierRejections)"
            :label="L('maxOutlierRejections')"
            :help="H('maxOutlierRejections')"
            :min="0"
            :max="20"
            :step="1"
            :decimals="0"
            inputId="hf-af-MaxOutlierRejections"
            :status="statusOf('MaxOutlierRejections')"
            :error="errorOf('MaxOutlierRejections')"
            @change="save('MaxOutlierRejections', $event)"
          />
          <HfNumberField
            :model-value="Number(o.OutlierRejectionConfidence)"
            :label="L('outlierRejectionConfidence')"
            :help="H('outlierRejectionConfidence')"
            :min="0.5001"
            :max="0.9999"
            :step="0.001"
            :decimals="4"
            inputId="hf-af-OutlierRejectionConfidence"
            :status="statusOf('OutlierRejectionConfidence')"
            :error="errorOf('OutlierRejectionConfidence')"
            @change="save('OutlierRejectionConfidence', $event)"
          />
        </div>
      </div>

      <!-- Storage -->
      <div :class="cardClass">
        <h3 :class="headingClass">{{ L('storage') }}</h3>
        <div class="flex flex-col gap-3">
          <HfToggleRow
            :model-value="o.Save"
            :label="L('save')"
            :help="H('save')"
            :status="statusOf('Save')"
            :error="errorOf('Save')"
            @change="save('Save', $event)"
          />
          <HfToggleRow
            :model-value="o.KeepFramesForReview"
            :label="L('keepFramesForReview')"
            :help="H('keepFramesForReview')"
            :status="statusOf('KeepFramesForReview')"
            :error="errorOf('KeepFramesForReview')"
            @change="save('KeepFramesForReview', $event)"
          />
          <div v-if="o.Save">
            <DirectoryBrowser
              :model-value="o.SavePath"
              :label="L('savePath')"
              @update:model-value="save('SavePath', $event)"
            />
            <p v-if="errorOf('SavePath')" class="mt-1 text-xs text-red-400">
              {{ errorOf('SavePath') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Reset -->
      <div class="flex justify-start">
        <button
          class="tns-btn-secondary w-auto px-6"
          :disabled="store.isLoadingAutoFocusOptions"
          @click="showResetConfirm = true"
        >
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
import { useHocusFocusStore } from '../store/hocusfocusStore';
import apiService from '@/services/apiService';
import Modal from '@/components/helpers/Modal.vue';
import DirectoryBrowser from './DirectoryBrowser.vue';
import HfToggleRow from './fields/HfToggleRow.vue';
import HfNumberField from './fields/HfNumberField.vue';
import HfSelectField from './fields/HfSelectField.vue';

const { t } = useI18n();
const store = useHocusFocusStore();

const L = (key) => t(`plugins.hocusfocus.autoFocusOptions.${key}`);
const H = (key) => t(`plugins.hocusfocus.autoFocusOptions.help.${key}`);

const o = computed(() => store.autoFocusOptions);

const cardClass =
  'p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50';
const headingClass = 'font-bold text-base text-cyan-400';

// Ranges follow the validation rules on the plugin's own options page. 0 means "no limit" for
// both MaxConcurrent and MaxBlindStepsPerDirection, so neither can start at 1.
const basicNumbers = [
  {
    key: 'MaxConcurrent',
    label: 'maxConcurrent',
    min: 0,
    max: 16,
    step: 1,
    decimals: 0,
    hint: 'noLimit',
  },
  {
    key: 'AutoFocusTimeoutSeconds',
    label: 'autoFocusTimeoutSeconds',
    min: 1,
    max: 7200,
    step: 10,
    decimals: 0,
  },
  { key: 'FocuserOffset', label: 'focuserOffset', min: -1000, max: 1000, step: 1, decimals: 0 },
  {
    key: 'MaxBlindStepsPerDirection',
    label: 'maxBlindStepsPerDirection',
    min: 0,
    max: 50,
    step: 1,
    decimals: 0,
    hint: 'noLimit',
  },
];

const hyperbolicFitModelOptions = [
  { value: 'Hybrid', label: 'Hybrid (Best Fit)' },
  { value: 'Symmetric', label: 'Symmetric' },
  { value: 'UnevenBlend', label: 'Uneven Blend' },
  { value: 'TiltedHyperbola', label: 'Tilted Hyperbola' },
  { value: 'SmoothBlend', label: 'Smooth Blend' },
];
const fitRejectionCriterionOptions = [
  { value: 'RSquared', label: 'R²' },
  { value: 'ReducedChiSquared', label: 'Reduced χ²' },
];
const focuserDirectionOptions = computed(() => [
  { value: 'false', label: L('focuserAwayFromObjective') },
  { value: 'true', label: L('focuserTowardObjective') },
]);

// --- The one InspectorOptions field this page owns -----------------------------------------
const inspectorOptions = reactive({});
const inspectorReady = ref(false);

async function loadInspectorOptions() {
  try {
    const { options } = await apiService.hocusfocus.getAberrationInspectorOptions();
    Object.assign(inspectorOptions, options);
    inspectorReady.value = 'FocuserIncreasesTowardObjective' in inspectorOptions;
  } catch (err) {
    // Non-fatal: the rest of the page still works without it.
    console.error('[AutoFocusOptions] Error loading inspector options:', err);
    inspectorReady.value = false;
  }
}

// --- Saving -------------------------------------------------------------------------------
const optionStatus = ref({});
const optionErrors = ref({});
const saveTimers = new Map();

const statusOf = (key) => optionStatus.value[key] || '';
const errorOf = (key) => optionErrors.value[key] || '';

function setStatus(key, status) {
  optionStatus.value = { ...optionStatus.value, [key]: status };
}

function setError(key, message) {
  optionErrors.value = { ...optionErrors.value, [key]: message };
}

// The number fields commit on every keystroke, so coalesce before hitting the plugin.
function schedule(key, fn) {
  clearTimeout(saveTimers.get(key));
  saveTimers.set(
    key,
    setTimeout(() => {
      saveTimers.delete(key);
      fn();
    }, 300)
  );
}

function save(key, value) {
  if (value === undefined || value === null) return;
  if (!store.autoFocusOptions) return;
  store.autoFocusOptions[key] = value;
  schedule(key, () => pushOption(key, value));
}

function saveInspector(key, value) {
  inspectorOptions[key] = value;
  schedule(key, () => pushInspectorOption(key, value));
}

async function pushOption(key, value) {
  setStatus(key, 'saving');
  setError(key, '');
  try {
    const response = await apiService.hocusfocus.setAutoFocusOption(key, value);
    if (response && response.Success === false) {
      throw new Error(response.Error || L('saveFailed'));
    }
    flashSaved(key);
  } catch (err) {
    await reportFailure(key, err, refreshOptions);
  }
}

async function pushInspectorOption(key, value) {
  setStatus(key, 'saving');
  setError(key, '');
  try {
    const response = await apiService.hocusfocus.setAberrationInspectorOption(key, value);
    if (response && response.Success === false) {
      throw new Error(response.Error || L('saveFailed'));
    }
    flashSaved(key);
  } catch (err) {
    await reportFailure(key, err, loadInspectorOptions);
  }
}

function flashSaved(key) {
  setStatus(key, 'saved');
  setTimeout(() => setStatus(key, ''), 1000);
}

async function reportFailure(key, err, resync) {
  console.error(`[AutoFocusOptions] Error saving ${key}:`, err);
  // A rejected value comes back as HTTP 400 with the plugin's own validation message.
  const detail = err.response?.data?.Error || err.response?.data?.error || err.message;
  setStatus(key, 'error');
  setError(key, detail || L('saveFailed'));
  // The plugin kept its previous value, so put the shown value back in sync.
  await resync();
}

// Re-reads the options WITHOUT the store's loading flag, which would unmount the form and take
// the just-raised error message with it.
async function refreshOptions() {
  try {
    const { options, enumOptions } = await apiService.hocusfocus.getAutoFocusOptions();
    store.autoFocusOptions = options;
    store.autoFocusEnumOptions = enumOptions;
  } catch (err) {
    console.error('[AutoFocusOptions] Error refreshing options:', err);
  }
}

// --- Load / reset -------------------------------------------------------------------------
const showResetConfirm = ref(false);
const isResetting = ref(false);

async function loadAutoFocusOptions() {
  await store.loadAutoFocusOptions();
}

async function executeReset() {
  isResetting.value = true;
  try {
    const response = await apiService.hocusfocus.resetAutoFocusDefaults();
    if (response && response.Success === false) {
      throw new Error(response.Error || L('resetFailed'));
    }
    optionStatus.value = {};
    optionErrors.value = {};
    await refreshOptions();
    showResetConfirm.value = false;
  } catch (err) {
    console.error('[AutoFocusOptions] Error resetting options:', err);
    store.autoFocusOptionsError = err.message || L('resetFailed');
    showResetConfirm.value = false;
  } finally {
    isResetting.value = false;
  }
}

onMounted(async () => {
  await loadAutoFocusOptions();
  await loadInspectorOptions();
});

onBeforeUnmount(() => {
  saveTimers.forEach((timer) => clearTimeout(timer));
  saveTimers.clear();
});
</script>
