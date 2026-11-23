<template>
  <div class="flex flex-col gap-3">
    <p class="text-sm text-content-muted">
      {{
        M('current', { stepSize: current.stepSize ?? '–', offsetSteps: current.offsetSteps ?? '–' })
      }}
    </p>
    <p class="text-sm text-content-muted">
      {{
        B('current', {
          model: t(`components.focuser.settings.${current.model}`),
          backlashIn: current.in,
          backlashOut: current.out,
        })
      }}
    </p>
    <HfSweepPreview :frozen="probe.running.value" />

    <!-- ABSOLUTE with In ≠ Out shifts NINA's position scale on every reversal -->
    <div
      v-if="blocked && !probe.running.value"
      class="flex flex-col gap-2 rounded-control bg-surface-2 p-3"
    >
      <p class="text-sm text-status-warn">
        {{ B('lopsided', { backlashIn: current.in, backlashOut: current.out }) }}
      </p>
      <button
        class="tns-btn-secondary min-h-touch"
        :disabled="resetState === 'busy'"
        @click="resetCompensation"
      >
        {{ B('resetCompensation') }}
      </button>
      <p v-if="resetState === 'error'" class="text-xs text-status-danger">
        {{ t('components.focuser.hfAdvice.applyFailed') }}
      </p>
    </div>

    <button
      v-if="!probe.running.value"
      class="tns-btn-primary min-h-touch"
      :disabled="!canStart"
      @click="probe.start(handSamples)"
    >
      {{ measured ? M('restart') : M('start') }}
    </button>
    <button
      v-else
      class="tns-btn-danger min-h-touch"
      :disabled="probe.phase.value === 'return'"
      @click="probe.stop()"
    >
      {{ M('stop') }}
    </button>

    <p v-if="probe.phase.value" class="text-sm text-content">
      {{ M(`phase.${probe.phase.value}`) }}
    </p>

    <!-- Every frame of the measurement, so the user sees the stars grow and stay put -->
    <div
      v-if="probe.scan.value.length"
      class="flex flex-col gap-1 rounded-control bg-surface-2 p-3 text-sm text-content"
    >
      <p v-for="(p, i) in probe.scan.value" :key="`s${i}`">
        <template v-if="p.offset === 0">
          {{ M('reference', { hfr: p.hfr.toFixed(2), stars: p.stars }) }}
        </template>
        <template v-else>
          {{
            t(
              'components.focuser.hfAssistant.measure.probe',
              { offset: p.offset, hfr: p.hfr.toFixed(2), stars: p.stars },
              p.offset
            )
          }}
        </template>
      </p>
      <p v-for="(p, i) in probe.calibration.value" :key="`c${i}`">
        {{ B('calibration', { offset: p.offset, hfr: p.hfr.toFixed(2), stars: p.stars }) }}
      </p>
      <p v-for="(w, i) in probe.walk.value" :key="`w${i}`">
        {{
          B(w.sign < 0 ? 'walkIn' : 'walkOut', {
            steps: w.steps,
            hfr: w.hfr.toFixed(2),
            stars: w.stars,
          })
        }}
      </p>
    </div>

    <p v-if="probe.failure.value" class="text-sm text-status-danger">
      {{ M(`failure.${probe.failure.value}`) }}
    </p>

    <!-- Step size -->
    <div v-if="stepSuggestion" class="flex flex-col gap-2 rounded-control bg-surface-2 p-3">
      <p class="text-sm text-content">
        {{
          M('result', {
            stepSize: stepSuggestion.stepSize,
            offsetSteps: stepSuggestion.offsetSteps,
          })
        }}
      </p>
      <p v-if="stepSuggestion.limited" class="text-sm text-content-muted">{{ M('limited') }}</p>
      <HfSweepPreview
        :step-size="stepSuggestion.stepSize"
        :offset-steps="stepSuggestion.offsetSteps"
        :frozen="probe.running.value"
      />
      <p v-if="stepApply === 'done'" class="text-xs text-status-ok">{{ M('applied') }}</p>
      <button
        v-else
        class="tns-btn-primary min-h-touch"
        :disabled="stepApply === 'busy' || probe.running.value"
        @click="applyStep"
      >
        {{ M('apply') }}
      </button>
      <p v-if="stepApply === 'error'" class="text-xs text-status-danger">
        {{ t('components.focuser.hfAdvice.applyFailed') }}
      </p>
    </div>

    <!-- Backlash -->
    <p v-if="probe.backlashFailure.value" class="text-sm text-status-danger">
      {{
        B(`failure.${probe.backlashFailure.value}`, {
          reach,
          position: probe.sharpestPosition.value ?? '–',
        })
      }}
    </p>
    <div v-if="backlash" class="flex flex-col gap-2 rounded-control bg-surface-2 p-3">
      <p class="text-sm text-content">{{ backlashSummary }}</p>
      <template v-if="backlash.changes.length">
        <p v-for="c in backlash.changes" :key="c.key" class="text-sm text-content">
          {{ B('change', { label: changeLabel(c.key), from: c.current, to: c.value }) }}
        </p>
        <p v-if="backlash.model === 'OVERSHOOT'" class="text-sm text-content-muted">
          {{ B('overshootHint') }}
        </p>
        <template v-if="backlashApply === 'done'">
          <p class="text-xs text-status-ok">{{ B('applied') }}</p>
          <p class="text-sm text-status-warn">{{ B('refocus') }}</p>
          <button class="tns-btn-secondary min-h-touch" @click="emit('refocus')">
            {{ B('toRoughFocus') }}
          </button>
        </template>
        <button
          v-else
          class="tns-btn-primary min-h-touch"
          :disabled="backlashApply === 'busy' || probe.running.value"
          @click="applyBacklash"
        >
          {{ B('apply') }}
        </button>
        <p v-if="backlashApply === 'error'" class="text-xs text-status-danger">
          {{ t('components.focuser.hfAdvice.applyFailed') }}
        </p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useHocusFocusStore } from '@/store/hocusFocusStore';
import { useFocuserProbe } from '@/composables/useFocuserProbe';
import { compensationBlocksMeasurement } from '@/utils/hocusFocusAdvisor';
import HfSweepPreview from './HfSweepPreview.vue';

// Assistant step that measures the autofocus step size and the focuser's backlash on the real
// optics in one run, and offers both for one-tap use. Nothing is written without an "apply" tap;
// the compensation model itself is left alone (NINA only picks it up on reconnecting the
// focuser). A new compensation changes which side every position is reached from, which moves
// focus on the focuser's scale by up to the backlash: 'refocus' asks the assistant to go back to
// rough focus.
defineProps({
  // Frames taken while focusing by hand; they pick the first probe distance.
  handSamples: { type: Array, default: () => [] },
});
const emit = defineEmits(['running', 'refocus']);

const { t } = useI18n();
const M = (key, params) => t(`components.focuser.hfAssistant.measure.${key}`, params || {});
const B = (key, params) => t(`components.focuser.hfAssistant.backlash.${key}`, params || {});
const store = apiStore();
const hfStore = useHocusFocusStore();
const probe = useFocuserProbe();

const current = computed(() => {
  const settings = store.profileInfo?.FocuserSettings || {};
  return {
    stepSize: settings.AutoFocusStepSize,
    offsetSteps: settings.AutoFocusInitialOffsetSteps,
    model: settings.BacklashCompensationModel === 'ABSOLUTE' ? 'ABSOLUTE' : 'OVERSHOOT',
    in: Number(settings.BacklashIn) || 0,
    out: Number(settings.BacklashOut) || 0,
  };
});
const blocked = computed(() => !!compensationBlocksMeasurement(store.profileInfo?.FocuserSettings));
const canStart = computed(
  () =>
    !blocked.value &&
    !!store.cameraInfo?.Connected &&
    !!store.focuserInfo?.Connected &&
    !store.focuserInfo?.IsMoving
);
const measured = computed(
  () => !!(probe.stepResult.value || probe.failure.value || probe.backlashFailure.value)
);
const stepSuggestion = computed(() =>
  probe.stepResult.value?.stepSize ? probe.stepResult.value : null
);
const backlash = computed(() => probe.backlashResult.value);
// Largest backlash one walk can read, for the 'tooLarge' message.
const reach = computed(() => {
  const plan = probe.plan.value;
  return plan ? plan.maxSteps * plan.step : '–';
});

const backlashSummary = computed(() => {
  const r = backlash.value;
  if (r.backlash === null) return B('covered');
  if (r.backlash === 0) return B('none');
  return B('measured', { steps: r.backlash });
});

function changeLabel(key) {
  return t(`components.focuser.settings.${key.replace('FocuserSettings-', '')}`);
}

const stepApply = ref('');
const backlashApply = ref('');
watch(probe.stepResult, () => {
  stepApply.value = '';
});
watch(probe.backlashResult, () => {
  backlashApply.value = '';
});
watch(probe.running, (running) => emit('running', running));

async function applyStep() {
  const { stepSize, offsetSteps } = stepSuggestion.value;
  stepApply.value = 'busy';
  try {
    await hfStore.applyFix({
      target: 'profile',
      key: 'FocuserSettings-AutoFocusStepSize',
      value: stepSize,
    });
    if (Number(current.value.offsetSteps) !== offsetSteps) {
      await hfStore.applyFix({
        target: 'profile',
        key: 'FocuserSettings-AutoFocusInitialOffsetSteps',
        value: offsetSteps,
      });
    }
    stepApply.value = 'done';
  } catch (err) {
    console.error('[HfFocuserProbe] Error applying the measured step size:', err);
    stepApply.value = 'error';
  }
}

async function applyBacklash() {
  backlashApply.value = 'busy';
  try {
    for (const c of backlash.value.changes) {
      await hfStore.applyFix({ target: 'profile', key: c.key, value: c.value });
    }
    backlashApply.value = 'done';
  } catch (err) {
    console.error('[HfFocuserProbe] Error applying the measured backlash:', err);
    backlashApply.value = 'error';
  }
}

// Explicit tap only: clears both values so that the measurement can suggest them afresh.
const resetState = ref('');
async function resetCompensation() {
  resetState.value = 'busy';
  try {
    for (const key of ['FocuserSettings-BacklashIn', 'FocuserSettings-BacklashOut']) {
      await hfStore.applyFix({ target: 'profile', key, value: 0 });
    }
    resetState.value = '';
  } catch (err) {
    console.error('[HfFocuserProbe] Error clearing the backlash compensation:', err);
    resetState.value = 'error';
  }
}

// Leaving the step ends the measurement; the composable still drives the focuser back.
onBeforeUnmount(() => {
  probe.stop();
  emit('running', false);
});
</script>
