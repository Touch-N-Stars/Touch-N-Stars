<template>
  <section class="tns-card flex flex-col gap-4">
    <div class="flex items-start gap-3">
      <AcademicCapIcon class="mt-0.5 h-7 w-7 shrink-0 text-accent" />
      <div class="flex min-w-0 flex-col gap-1">
        <h3 class="text-lg font-semibold text-content">{{ k('title') }}</h3>
        <p class="text-sm text-content-muted">{{ k('intro') }}</p>
        <p class="text-xs text-content-faint">{{ k('introSafe') }}</p>
      </div>
    </div>

    <!-- Guiding is active: imaging will be disturbed -->
    <div
      v-if="guidingActive"
      class="flex items-start gap-2 rounded-control border border-status-warn/50 bg-status-warn/10 p-3 text-sm text-status-warn"
    >
      <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 shrink-0" />
      <span>{{ k('guidingWarning') }}</span>
    </div>

    <!-- Steps -->
    <div class="flex flex-col gap-1.5">
      <span class="text-xs font-bold uppercase tracking-wider text-content-faint">
        {{ k('stepsTitle') }}
      </span>
      <button
        v-for="step in COACH_STEPS"
        :key="step"
        type="button"
        role="checkbox"
        :aria-checked="selected.includes(step)"
        class="flex min-h-touch w-full items-center gap-3 rounded-control border px-3 py-2 text-left transition-colors"
        :class="
          selected.includes(step)
            ? 'border-accent/50 bg-accent/10'
            : 'border-line bg-surface-2 opacity-80'
        "
        @click="toggleStep(step)"
      >
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2"
          :class="
            selected.includes(step) ? 'border-accent bg-accent text-white' : 'border-line-strong'
          "
        >
          <CheckIcon v-if="selected.includes(step)" class="h-4 w-4" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-semibold text-content">{{ stepName(step) }}</span>
          <span class="text-xs text-content-muted">{{ k(`steps.${step}.desc`) }}</span>
        </span>
        <span class="shrink-0 text-xs tabular-nums text-content-muted">
          {{ k('estimate', { duration: duration(estimateStepSeconds(step, estimateOptions)) }) }}
        </span>
      </button>
      <p v-if="!selected.length" class="text-xs text-status-danger">{{ k('noSteps') }}</p>
      <div v-else class="flex flex-col gap-0.5 text-right">
        <span class="text-sm font-semibold tabular-nums text-content">
          {{ k('total', { duration: duration(totalSeconds) }) }}
        </span>
        <span v-if="needsCalibration" class="text-xs text-content-muted">
          {{ k('calibrationExtra') }}
        </span>
      </div>
    </div>

    <!-- Advanced options -->
    <div class="rounded-control border border-line">
      <button
        type="button"
        class="flex min-h-touch w-full items-center justify-between gap-2 px-3 text-left"
        :aria-expanded="advancedOpen"
        @click="advancedOpen = !advancedOpen"
      >
        <span class="text-sm font-semibold text-content">{{ k('options.advanced') }}</span>
        <ChevronDownIcon
          class="h-5 w-5 shrink-0 text-content-muted transition-transform"
          :class="{ 'rotate-180': advancedOpen }"
        />
      </button>
      <div v-if="advancedOpen" class="flex flex-col gap-4 border-t border-line px-3 py-3">
        <!-- Camera check -->
        <div v-if="selected.includes('CameraCheck')" class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-sm text-content">{{ k('options.exposures') }}</span>
            <span class="text-xs text-content-faint">{{ k('options.exposuresHint') }}</span>
            <NativeCoachChips
              v-model="exposures"
              unit="s"
              :min="0.01"
              :max="30"
              :placeholder="k('options.exposurePlaceholder')"
              :add-label="k('options.add')"
              :invalid-text="k('options.invalidExposure')"
              :too-many-text="k('options.tooManyValues')"
              :remove-label="(v) => k('options.remove', { value: `${v} s` })"
            />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-sm text-content">{{ k('options.gains') }}</span>
            <span class="text-xs text-content-faint">
              {{
                hasGainRange
                  ? k('options.gainsAuto', { min: gainMin, max: gainMax })
                  : k('options.gainsNoRange')
              }}
            </span>
            <NativeCoachChips
              v-model="gains"
              integer
              :min="hasGainRange ? gainMin : 0"
              :max="hasGainRange ? gainMax : 10000"
              :placeholder="k('options.gainPlaceholder')"
              :add-label="k('options.add')"
              :invalid-text="
                k('options.invalidGain', {
                  min: hasGainRange ? gainMin : 0,
                  max: hasGainRange ? gainMax : 10000,
                })
              "
              :too-many-text="k('options.tooManyValues')"
              :remove-label="(v) => k('options.remove', { value: v })"
            />
          </div>
          <p v-if="combinationsError" class="text-xs text-status-danger">{{ combinationsError }}</p>
          <div class="flex flex-col gap-1">
            <span class="text-sm text-content">{{ k('options.frames') }}</span>
            <div class="seg">
              <button
                v-for="n in FRAME_CHOICES"
                :key="n"
                type="button"
                class="seg-btn"
                :class="{ 'seg-btn-active': frames === n }"
                :aria-pressed="frames === n"
                @click="frames = n"
              >
                {{ n }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="selected.includes('Drift')" class="flex flex-col gap-1">
          <span class="text-sm text-content">{{ k('options.driftSeconds') }}</span>
          <div class="seg">
            <button
              v-for="s in DRIFT_CHOICES"
              :key="s"
              type="button"
              class="seg-btn"
              :class="{ 'seg-btn-active': driftSeconds === s }"
              :aria-pressed="driftSeconds === s"
              @click="driftSeconds = s"
            >
              {{ k('options.minutes', { value: s / 60 }) }}
            </button>
          </div>
        </div>

        <div v-if="selected.includes('Trials')" class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-sm text-content">{{ k('options.trialSeconds') }}</span>
            <div class="seg">
              <button
                v-for="s in TRIAL_CHOICES"
                :key="s"
                type="button"
                class="seg-btn"
                :class="{ 'seg-btn-active': trialSeconds === s }"
                :aria-pressed="trialSeconds === s"
                @click="trialSeconds = s"
              >
                {{ k('options.minutes', { value: s / 60 }) }}
              </button>
            </div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 flex-col">
              <span class="text-sm text-content">{{ k('options.repeatBaseline') }}</span>
              <span class="text-xs text-content-faint">{{ k('options.repeatBaselineHint') }}</span>
            </div>
            <toggleButton v-model:statusValue="repeatBaseline" />
          </div>
        </div>

        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 flex-col">
            <span class="text-sm text-content">{{ k('options.allowCalibration') }}</span>
            <span class="text-xs text-content-faint">{{ k('options.allowCalibrationHint') }}</span>
          </div>
          <toggleButton v-model:statusValue="allowCalibration" />
        </div>

        <button type="button" class="tns-btn-secondary" @click="resetOptions">
          <ArrowUturnLeftIcon class="h-4 w-4" />
          {{ k('options.reset') }}
        </button>
      </div>
    </div>

    <!-- Start -->
    <div class="flex flex-col gap-2">
      <p v-if="blocker" class="text-sm text-content-muted">{{ blocker }}</p>
      <div
        v-if="startError"
        class="flex items-start gap-2 rounded-control border border-status-danger/40 bg-status-danger/10 p-3 text-sm"
        role="alert"
      >
        <XCircleIcon class="mt-0.5 h-5 w-5 shrink-0 text-status-danger" />
        <div class="flex min-w-0 flex-col gap-1">
          <span class="font-semibold text-status-danger">{{ startError.title }}</span>
          <span v-if="startError.why" class="text-content-muted">{{ startError.why }}</span>
          <span v-if="startError.fix" class="text-content">{{ startError.fix }}</span>
        </div>
      </div>
      <button type="button" class="tns-btn-primary" :disabled="!canStart" @click="start">
        <ArrowPathIcon v-if="starting" class="h-5 w-5 animate-spin" />
        <PlayIcon v-else class="h-5 w-5" />
        {{ starting ? k('starting') : k('start') }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import {
  AcademicCapIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline';
import toggleButton from '@/components/helpers/toggleButton.vue';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import {
  COACH_STEPS,
  DEFAULT_EXPOSURES,
  defaultGains,
  estimateStepSeconds,
  estimateTotalSeconds,
} from '@/utils/nativeGuiderCoach';
import NativeCoachChips from './NativeCoachChips.vue';
import { useCoachText } from './useCoachText';

const OPTIONS_KEY = 'nativeGuider.coach.options';
const FRAME_CHOICES = [3, 5, 8, 10];
const DRIFT_CHOICES = [120, 180, 300, 600];
const TRIAL_CHOICES = [60, 120, 180, 300];
const DEFAULTS = {
  steps: [...COACH_STEPS],
  frames: 5,
  driftSeconds: 180,
  trialSeconds: 120,
  repeatBaseline: true,
  allowCalibration: true,
};

const store = useNativeGuiderStore();
const { k, stepName, duration, message } = useCoachText();

const stored = readStored();
const selected = ref(stored.steps ?? [...DEFAULTS.steps]);
const frames = ref(stored.frames ?? DEFAULTS.frames);
const driftSeconds = ref(stored.driftSeconds ?? DEFAULTS.driftSeconds);
const trialSeconds = ref(stored.trialSeconds ?? DEFAULTS.trialSeconds);
const repeatBaseline = ref(stored.repeatBaseline ?? DEFAULTS.repeatBaseline);
const allowCalibration = ref(stored.allowCalibration ?? DEFAULTS.allowCalibration);
const advancedOpen = ref(false);
const starting = ref(false);
const startError = ref(null);

// Exposures/gains: shown pre-filled with the defaults, but sent only when changed - an empty
// list lets the guider choose (it knows the current gain best).
const exposures = ref(stored.exposures ?? [...DEFAULT_EXPOSURES]);
const gainMin = computed(() => store.coach?.gainMin ?? null);
const gainMax = computed(() => store.coach?.gainMax ?? null);
const hasGainRange = computed(
  () =>
    Number.isInteger(gainMin.value) &&
    Number.isInteger(gainMax.value) &&
    gainMax.value > gainMin.value
);
const suggestedGains = computed(() =>
  defaultGains({
    gainMin: gainMin.value,
    gainMax: gainMax.value,
    currentGain: store.coach?.currentGain ?? null,
  })
);
const gainsCustom = ref(Array.isArray(stored.gains) && stored.gains.length > 0);
const gains = ref(gainsCustom.value ? stored.gains : suggestedGains.value);
watch(suggestedGains, (value) => {
  if (!gainsCustom.value) gains.value = value;
});
watch(gains, (value) => {
  gainsCustom.value = JSON.stringify(value) !== JSON.stringify(suggestedGains.value);
});

const exposuresCustom = computed(
  () => JSON.stringify(exposures.value) !== JSON.stringify(DEFAULT_EXPOSURES)
);

function readStored() {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStored() {
  try {
    localStorage.setItem(
      OPTIONS_KEY,
      JSON.stringify({
        steps: selected.value,
        frames: frames.value,
        driftSeconds: driftSeconds.value,
        trialSeconds: trialSeconds.value,
        repeatBaseline: repeatBaseline.value,
        allowCalibration: allowCalibration.value,
        exposures: exposuresCustom.value ? exposures.value : undefined,
        gains: gainsCustom.value ? gains.value : undefined,
      })
    );
  } catch {
    // storage unavailable: the options are just not remembered
  }
}

function toggleStep(step) {
  selected.value = selected.value.includes(step)
    ? selected.value.filter((s) => s !== step)
    : COACH_STEPS.filter((s) => s === step || selected.value.includes(s));
  startError.value = null;
}

function resetOptions() {
  selected.value = [...DEFAULTS.steps];
  frames.value = DEFAULTS.frames;
  driftSeconds.value = DEFAULTS.driftSeconds;
  trialSeconds.value = DEFAULTS.trialSeconds;
  repeatBaseline.value = DEFAULTS.repeatBaseline;
  allowCalibration.value = DEFAULTS.allowCalibration;
  exposures.value = [...DEFAULT_EXPOSURES];
  gains.value = suggestedGains.value;
  gainsCustom.value = false;
}

const estimateOptions = computed(() => ({
  exposureSeconds: exposures.value,
  gains: gains.value,
  framesPerCombination: frames.value,
  driftSeconds: driftSeconds.value,
  trialSeconds: trialSeconds.value,
  repeatBaseline: repeatBaseline.value,
  allowCalibration: allowCalibration.value,
}));

const needsCalibration = computed(
  () =>
    !store.isCalibrated && allowCalibration.value && selected.value.some((s) => s !== 'CameraCheck')
);

const totalSeconds = computed(() =>
  estimateTotalSeconds(selected.value, estimateOptions.value, { calibrated: store.isCalibrated })
);

const combinationsError = computed(() => {
  const count = exposures.value.length * Math.max(1, gains.value.length);
  return count > 60 ? k('options.tooManyCombinations', { count }) : '';
});

const guidingActive = computed(() =>
  ['Guiding', 'Paused', 'LostLock', 'Reacquiring'].includes(store.state)
);

const darksRunning = computed(() =>
  ['starting', 'capturing'].includes(String(store.darks?.status || '').toLowerCase())
);

const blocker = computed(() => {
  if (!store.isAvailable) return k('notConnected');
  if (store.state === 'Calibrating') return k('calibratingBlock');
  if (darksRunning.value) return k('darksBlock');
  return '';
});

const canStart = computed(
  () =>
    !starting.value &&
    !blocker.value &&
    selected.value.length > 0 &&
    !combinationsError.value &&
    !store.coachPending
);

async function start() {
  if (!canStart.value) return;
  startError.value = null;
  starting.value = true;
  writeStored();
  try {
    const result = await store.startCoach({
      steps: COACH_STEPS.filter((s) => selected.value.includes(s)),
      exposureSeconds: exposuresCustom.value ? exposures.value : [],
      gains: gainsCustom.value ? gains.value : [],
      framesPerCombination: frames.value,
      driftSeconds: driftSeconds.value,
      trialSeconds: trialSeconds.value,
      repeatBaseline: repeatBaseline.value,
      allowCalibration: allowCalibration.value,
    });
    if (!result.ok && !result.cancelled) {
      const text = message(result.messageCode, result.message, result.messageParameters);
      startError.value = {
        title: text.known ? text.title : k('startFailed'),
        why: text.known ? text.why : result.message,
        fix: text.known ? text.fix : '',
      };
    }
  } finally {
    starting.value = false;
  }
}
</script>

<style scoped>
@reference '../../../../assets/tailwind.css';

.seg {
  @apply flex overflow-hidden rounded-chip border border-line-strong bg-surface-2;
}

.seg-btn {
  @apply min-h-10 flex-1 px-2 text-sm font-semibold tabular-nums text-content-muted
    transition-colors border-r border-line last:border-r-0;
}

.seg-btn-active {
  @apply bg-accent/15 text-accent;
}
</style>
