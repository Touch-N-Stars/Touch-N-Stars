<template>
  <div class="flex flex-col gap-3">
    <p class="text-sm text-content-muted">
      {{
        L('current', { stepSize: current.stepSize ?? '–', offsetSteps: current.offsetSteps ?? '–' })
      }}
    </p>
    <HfSweepPreview />

    <button
      v-if="!probe.running.value"
      class="tns-btn-primary min-h-touch"
      :disabled="!canStart"
      @click="probe.start(handSamples)"
    >
      {{ probe.result.value || probe.failure.value ? L('restart') : L('start') }}
    </button>
    <button
      v-else
      class="tns-btn-danger min-h-touch"
      :disabled="probe.phase.value === 'return'"
      @click="probe.stop()"
    >
      {{ L('stop') }}
    </button>

    <p v-if="probe.phase.value" class="text-sm text-content">
      {{ L(`phase.${probe.phase.value}`) }}
    </p>

    <!-- Every frame of the measurement, so the user sees the stars grow -->
    <div
      v-if="probe.reference.value"
      class="flex flex-col gap-1 rounded-control bg-surface-2 p-3 text-sm text-content"
    >
      <p>
        {{
          L('reference', {
            hfr: probe.reference.value.hfr.toFixed(2),
            stars: probe.reference.value.stars,
          })
        }}
      </p>
      <p v-for="(p, i) in probe.probes.value" :key="i">
        {{
          t(
            'components.focuser.hfAssistant.measure.probe',
            { offset: p.offset, hfr: p.hfr.toFixed(2), stars: p.stars },
            p.offset
          )
        }}
      </p>
    </div>

    <p v-if="probe.failure.value" class="text-sm text-status-danger">
      {{ L(`failure.${probe.failure.value}`) }}
    </p>

    <div v-if="suggestion" class="flex flex-col gap-2 rounded-control bg-surface-2 p-3">
      <p class="text-sm text-content">
        {{ L('result', { stepSize: suggestion.stepSize, offsetSteps: suggestion.offsetSteps }) }}
      </p>
      <p v-if="suggestion.limited" class="text-sm text-content-muted">{{ L('limited') }}</p>
      <HfSweepPreview :step-size="suggestion.stepSize" :offset-steps="suggestion.offsetSteps" />
      <p v-if="applyState === 'done'" class="text-xs text-status-ok">{{ L('applied') }}</p>
      <button
        v-else
        class="tns-btn-primary min-h-touch"
        :disabled="applyState === 'busy' || probe.running.value"
        @click="apply"
      >
        {{ L('apply') }}
      </button>
      <p v-if="applyState === 'error'" class="text-xs text-status-danger">
        {{ $t('components.focuser.hfAdvice.applyFailed') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useHocusFocusStore } from '@/store/hocusFocusStore';
import { useStepSizeProbe } from '@/composables/useStepSizeProbe';
import HfSweepPreview from './HfSweepPreview.vue';

// Assistant step that measures the autofocus step size on the real optics and offers it, together
// with the points per side, for one-tap use. Nothing is written without the "apply" tap.
defineProps({
  // Frames taken while focusing by hand; they pick the first probe distance.
  handSamples: { type: Array, default: () => [] },
});
const emit = defineEmits(['running']);

const { t } = useI18n();
const L = (key, params) => t(`components.focuser.hfAssistant.measure.${key}`, params || {});
const store = apiStore();
const hfStore = useHocusFocusStore();
const probe = useStepSizeProbe();

const current = computed(() => ({
  stepSize: store.profileInfo?.FocuserSettings?.AutoFocusStepSize,
  offsetSteps: store.profileInfo?.FocuserSettings?.AutoFocusInitialOffsetSteps,
}));
const canStart = computed(
  () =>
    !!store.cameraInfo?.Connected && !!store.focuserInfo?.Connected && !store.focuserInfo?.IsMoving
);
const suggestion = computed(() => (probe.result.value?.stepSize ? probe.result.value : null));

const applyState = ref('');
watch(probe.result, () => {
  applyState.value = '';
});
watch(probe.running, (running) => emit('running', running));

async function apply() {
  const { stepSize, offsetSteps } = suggestion.value;
  applyState.value = 'busy';
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
    applyState.value = 'done';
  } catch (err) {
    console.error('[HfStepSizeProbe] Error applying the measured step size:', err);
    applyState.value = 'error';
  }
}

// Leaving the step ends the measurement; the composable still drives the focuser back.
onBeforeUnmount(() => {
  probe.stop();
  emit('running', false);
});
</script>
