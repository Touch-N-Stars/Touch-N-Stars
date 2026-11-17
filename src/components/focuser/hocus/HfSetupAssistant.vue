<template>
  <Modal :show="show" maxWidth="max-w-xl" :closeOnBackdropClick="false" @close="emit('close')">
    <template #header>
      <div class="flex flex-col">
        <h2 class="text-xl font-bold text-content">{{ L('title') }}</h2>
        <p class="text-sm text-content-muted">
          {{ L('stepCounter', { current: stepIndex + 1, total: STEPS.length }) }} —
          {{ L(`steps.${step}.title`) }}
        </p>
      </div>
    </template>
    <template #body>
      <div class="flex w-full flex-col gap-4">
        <p class="text-sm text-content-muted">{{ L(`steps.${step}.description`) }}</p>

        <!-- 1. Prerequisites -->
        <div v-if="step === 'check'" class="flex flex-col gap-2">
          <p v-for="c in checks" :key="c.key" class="flex items-start gap-2 text-sm text-content">
            <span
              class="tns-dot mt-1.5 shrink-0"
              :class="c.ok ? 'bg-status-ok' : 'bg-status-danger'"
            ></span>
            <span>{{ L(`checks.${c.key}`) }}</span>
          </p>
          <p class="text-sm text-content-muted">{{ L('checks.engineHint') }}</p>
        </div>

        <!-- 2. Optics -->
        <div v-else-if="step === 'optics'" class="flex flex-col gap-3">
          <NumberInputPicker
            v-model="focalLength"
            :label="L('focalLength')"
            labelKey="components.focuser.hfAssistant.focalLength"
            :min="1"
            :max="20000"
            :step="1"
            :decimalPlaces="0"
            :useDefaultSentinel="false"
            inputId="hf-assistant-focal-length"
            labelPosition="top"
            wrapperClass="w-full"
          />
          <NumberInputPicker
            v-model="pixelSize"
            :label="L('pixelSize')"
            labelKey="components.focuser.hfAssistant.pixelSize"
            :min="0.1"
            :max="50"
            :step="0.01"
            :decimalPlaces="2"
            :useDefaultSentinel="false"
            inputId="hf-assistant-pixel-size"
            labelPosition="top"
            wrapperClass="w-full"
          />
          <p v-if="scale" class="text-sm text-content">
            {{ L('imageScale', { scale: scale.toFixed(2) }) }}
          </p>
        </div>

        <!-- 3. Rig questions, mapped onto the simple-mode presets -->
        <div v-else-if="step === 'rig'" class="flex flex-col gap-3">
          <HfSelectField
            v-model="pixelScale"
            :label="L('pixelScale')"
            :help="L('help.pixelScale', { preset: suggestedLabel })"
            :options="pixelScaleOptions"
          />
          <HfToggleRow v-model="noisy" :label="L('noisy')" :help="L('help.noisy')" />
          <HfToggleRow
            v-model="narrowband"
            :label="L('narrowband')"
            :help="L('help.narrowband', { seconds: NARROWBAND_EXPOSURE })"
          />
        </div>

        <!-- 4. Rough focus by hand -->
        <div v-else-if="step === 'rough'" class="flex flex-col gap-3">
          <HfRoughFocusPreview />
          <MoveFocuser />
          <ButtonsFastChangePositon />
        </div>

        <!-- 5. Step size measured on the real optics -->
        <HfStepSizeProbe
          v-else-if="step === 'measure'"
          :hand-samples="handSamples"
          @running="probeRunning = $event"
        />

        <!-- 6. Test run -->
        <div v-else-if="step === 'run'" class="flex flex-col gap-3">
          <HfSetupIssues :only="SWEEP_ISSUES" />
          <HfSweepPreview />
          <button
            v-if="!running"
            class="tns-btn-primary min-h-touch"
            :disabled="!store.focuserInfo?.Connected"
            @click="startRun"
          >
            {{ L('startRun') }}
          </button>
          <button v-else class="tns-btn-danger min-h-touch" @click="stopRun">
            {{ L('stopRun') }}
          </button>
          <div v-if="running || runStarted" class="flex flex-col gap-2">
            <AfShowGraph />
            <AfStatus />
          </div>
          <p v-if="runError" class="text-sm text-status-danger">{{ runError }}</p>
        </div>

        <!-- 7. Evaluation -->
        <div v-else-if="step === 'review'" class="flex flex-col gap-3">
          <HfAfChart v-if="hfStore.lastRun?.Points?.length" :run="hfStore.lastRun" />
          <HfRunAdvice :max-shown="10" />
          <p v-if="!hasResult" class="text-sm text-content-muted">{{ L('noResult') }}</p>
          <button
            class="tns-btn-secondary min-h-touch"
            :disabled="running || !store.focuserInfo?.Connected"
            @click="runAgain"
          >
            {{ L('runAgain') }}
          </button>
        </div>

        <!-- 8. Optimizer -->
        <div v-else-if="step === 'optimize'" class="flex flex-col gap-3">
          <button class="tns-btn-secondary min-h-touch" @click="showOptimizer = true">
            {{ L('openOptimizer') }}
          </button>
          <HfToggleRow
            v-if="hfStore.starDetectionOptions?.HasOptimizedSettings"
            :model-value="hfStore.starDetectionOptions.UseOptimizedSettings"
            :label="L('useOptimized')"
            @change="hfStore.setStarDetectionOption('UseOptimizedSettings', $event)"
          />
        </div>

        <p v-if="saveError" class="text-sm text-status-danger">{{ saveError }}</p>

        <div class="flex gap-3">
          <button
            v-if="stepIndex > 0"
            class="tns-btn-secondary min-h-touch"
            :disabled="probeRunning"
            @click="back"
          >
            {{ L('back') }}
          </button>
          <button
            v-if="stepIndex < STEPS.length - 1"
            class="tns-btn-primary min-h-touch"
            :disabled="!canContinue || saving"
            @click="next"
          >
            {{ L('next') }}
          </button>
          <button v-else class="tns-btn-primary min-h-touch" @click="emit('close')">
            {{ L('finish') }}
          </button>
        </div>
      </div>
    </template>
  </Modal>

  <StarDetectionOptimizer
    :show="showOptimizer"
    @close="showOptimizer = false"
    @accepted="hfStore.loadStarDetectionOptions()"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useHocusFocusStore } from '@/store/hocusFocusStore';
import {
  evaluateRun,
  historyEntryId,
  historySamples,
  imageScale,
  suggestPixelScalePreset,
} from '@/utils/hocusFocusAdvisor';
import Modal from '@/components/helpers/Modal.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import MoveFocuser from '@/components/focuser/MoveFocuser.vue';
import ButtonsFastChangePositon from '@/components/focuser/ButtonsFastChangePositon.vue';
import AfShowGraph from '@/components/focuser/AfShowGraph.vue';
import AfStatus from '@/components/focuser/AfStatus.vue';
import HfAfChart from '@/components/focuser/HfAfChart.vue';
import HfSelectField from './fields/HfSelectField.vue';
import HfToggleRow from './fields/HfToggleRow.vue';
import HfRunAdvice from './HfRunAdvice.vue';
import HfRoughFocusPreview from './HfRoughFocusPreview.vue';
import HfStepSizeProbe from './HfStepSizeProbe.vue';
import HfSweepPreview from './HfSweepPreview.vue';
import { autofocusStartRefusal } from '@/utils/backendErrors';
import HfSetupIssues from './HfSetupIssues.vue';
import StarDetectionOptimizer from './optimizer/StarDetectionOptimizer.vue';

const props = defineProps({
  show: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);

const STEPS = ['check', 'optics', 'rig', 'rough', 'measure', 'run', 'review', 'optimize'];
// Setup issues that make the test run itself go wrong; the others are shown on the focus page.
const SWEEP_ISSUES = ['offsetStepsUnusual', 'sweepTooLarge'];
// Starting exposure for narrowband focusing; the optimizer can shorten it later.
const NARROWBAND_EXPOSURE = 10;
const PIXEL_SCALE_PRESETS = ['WideField', 'Typical', 'LongFocalLength'];

const { t } = useI18n();
const L = (key, params) => t(`components.focuser.hfAssistant.${key}`, params || {});
const store = apiStore();
const hfStore = useHocusFocusStore();

const stepIndex = ref(0);
const step = computed(() => STEPS[stepIndex.value]);
const saving = ref(false);
const saveError = ref('');

// --- 1. Prerequisites --------------------------------------------------------------------
const checks = computed(() => [
  { key: 'camera', ok: !!store.cameraInfo?.Connected },
  { key: 'focuser', ok: !!store.focuserInfo?.Connected },
  { key: 'hocusFocus', ok: !!hfStore.available },
]);

// --- 2. Optics ---------------------------------------------------------------------------
const focalLength = ref(0);
const pixelSize = ref(0);
const scale = computed(() =>
  imageScale(
    focalLength.value,
    pixelSize.value,
    store.profileInfo?.FocuserSettings?.AutoFocusBinning
  )
);

// --- 3. Rig ------------------------------------------------------------------------------
const pixelScale = ref('Typical');
const noisy = ref(false);
const narrowband = ref(false);
const pixelScaleOptions = computed(() =>
  PIXEL_SCALE_PRESETS.map((value) => ({
    value,
    label: t(`components.focuser.hfSimple.presets.pixelScale.${value}`),
  }))
);
const suggestedLabel = computed(() => {
  const preset = suggestPixelScalePreset(scale.value);
  return preset ? t(`components.focuser.hfSimple.presets.pixelScale.${preset}`) : '–';
});

// --- 4. Rough focus ----------------------------------------------------------------------
// Frames taken before the rough-focus step are not hand-focus samples.
const roughIgnoredFrames = ref(new Set());
watch(
  () => step.value === 'rough',
  (isRough) => {
    if (!isRough) return;
    roughIgnoredFrames.value = new Set(
      (Array.isArray(store.imageHistoryInfo) ? store.imageHistoryInfo : []).map(historyEntryId)
    );
  }
);

// --- 5. Measure --------------------------------------------------------------------------
const probeRunning = ref(false);
const handSamples = computed(() =>
  historySamples(store.imageHistoryInfo, roughIgnoredFrames.value)
);

// --- 6. Run ------------------------------------------------------------------------------
const running = computed(() => !!store.focuserAfInfo?.autofocus_running);
const runStarted = ref(false);
const runError = ref('');

async function startRun() {
  runError.value = '';
  try {
    const response = await apiService.focuserAfAction('start');
    const refusal = autofocusStartRefusal(response);
    if (refusal !== null) {
      runError.value = refusal || L('runFailed');
      return;
    }
    store.afTimestampLastStart = Date.now();
    store.afCurveData = [];
    runStarted.value = true;
  } catch (err) {
    console.error('[HfSetupAssistant] Error starting autofocus:', err);
    runError.value = err.message || L('runFailed');
  }
}

// Starts the next run right away instead of only returning to the run step; the watcher on
// `running` brings the user back to the review once it finishes.
async function runAgain() {
  goTo('run');
  await startRun();
}

async function stopRun() {
  try {
    await apiService.focuserAfAction('stopp');
  } catch (err) {
    console.error('[HfSetupAssistant] Error stopping autofocus:', err);
  }
}

// A finished run moves on to the evaluation by itself; that only reads, it changes nothing.
watch(running, async (now, before) => {
  if (before && !now && step.value === 'run' && runStarted.value) {
    runStarted.value = false;
    await loadRun();
    goTo('review');
  }
});

// --- 7. Review ---------------------------------------------------------------------------
const hasResult = computed(() => !!evaluateRun(hfStore.lastRun));

async function loadRun() {
  try {
    await hfStore.loadLastRun();
  } catch (err) {
    console.error('[HfSetupAssistant] Error loading the last run:', err);
  }
}

// --- 8. Optimizer ------------------------------------------------------------------------
const showOptimizer = ref(false);

// --- Navigation --------------------------------------------------------------------------
const canContinue = computed(() => {
  if (step.value === 'check') return checks.value.every((c) => c.ok);
  if (step.value === 'optics') return focalLength.value > 0 && pixelSize.value > 0;
  if (step.value === 'measure') return !probeRunning.value;
  if (step.value === 'run') return !running.value;
  return true;
});

function goTo(id) {
  stepIndex.value = STEPS.indexOf(id);
}

function back() {
  saveError.value = '';
  stepIndex.value = Math.max(0, stepIndex.value - 1);
}

// "Next" is the explicit confirmation of what the step shows: only then is anything written.
async function next() {
  saving.value = true;
  saveError.value = '';
  try {
    if (step.value === 'optics') await saveOptics();
    if (step.value === 'rig') await saveRig();
    if (step.value === 'run') await loadRun();
    stepIndex.value += 1;
  } catch (err) {
    console.error('[HfSetupAssistant] Error saving step:', err);
    saveError.value = err.response?.data?.Error || err.message || L('saveFailed');
  } finally {
    saving.value = false;
  }
}

async function writeProfile(key, value, current) {
  if (Number(current) === Number(value)) return;
  await apiService.profileChangeValue(key, String(value));
}

async function saveOptics() {
  await writeProfile(
    'TelescopeSettings-FocalLength',
    focalLength.value,
    store.profileInfo?.TelescopeSettings?.FocalLength
  );
  await writeProfile(
    'CameraSettings-PixelSize',
    pixelSize.value,
    store.profileInfo?.CameraSettings?.PixelSize
  );
  await store.fetchProfilInfos();
  // The rig step starts from the suggestion for the confirmed optics.
  pixelScale.value = suggestPixelScalePreset(scale.value) || pixelScale.value;
}

async function saveRig() {
  const sd = hfStore.starDetectionOptions || {};
  if (sd.Simple_PixelScale !== pixelScale.value) {
    await hfStore.setStarDetectionOption('Simple_PixelScale', pixelScale.value);
  }
  const noise = noisy.value ? 'High' : 'Typical';
  if (sd.Simple_NoiseLevel !== noise) {
    await hfStore.setStarDetectionOption('Simple_NoiseLevel', noise);
  }
  const exposure = Number(store.profileInfo?.FocuserSettings?.AutoFocusExposureTime);
  if (narrowband.value && !(exposure >= NARROWBAND_EXPOSURE)) {
    await apiService.profileChangeValue(
      'FocuserSettings-AutoFocusExposureTime',
      String(NARROWBAND_EXPOSURE)
    );
    await store.fetchProfilInfos();
  }
}

// Every opening starts at the first step with the current values.
watch(
  () => props.show,
  async (visible) => {
    if (!visible) return;
    stepIndex.value = 0;
    saveError.value = '';
    runError.value = '';
    runStarted.value = false;
    probeRunning.value = false;
    focalLength.value = Number(store.profileInfo?.TelescopeSettings?.FocalLength) || 0;
    pixelSize.value = Number(store.profileInfo?.CameraSettings?.PixelSize) || 0;
    try {
      await Promise.all([
        hfStore.checkAvailability(),
        hfStore.loadStarDetectionOptions(),
        hfStore.loadAutoFocusOptions(),
      ]);
    } catch (err) {
      console.error('[HfSetupAssistant] Error loading Hocus Focus options:', err);
    }
    const sd = hfStore.starDetectionOptions;
    if (sd) {
      pixelScale.value = sd.Simple_PixelScale || 'Typical';
      noisy.value = sd.Simple_NoiseLevel === 'High';
    }
  },
  { immediate: true }
);
</script>
