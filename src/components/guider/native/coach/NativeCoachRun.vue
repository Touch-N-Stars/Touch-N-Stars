<template>
  <section class="flex flex-col gap-3">
    <!-- Progress + stepper -->
    <div class="tns-card flex flex-col gap-3">
      <div class="flex items-start justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <AcademicCapIcon class="h-6 w-6 shrink-0 text-accent" />
          <div class="flex min-w-0 flex-col">
            <h3 class="text-base font-semibold text-content">{{ k('title') }}</h3>
            <span class="truncate text-xs text-accent">{{ currentText }}</span>
          </div>
        </div>
        <span class="shrink-0 text-2xl font-bold tabular-nums text-content">{{ percent }}%</span>
      </div>

      <div class="h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          class="h-full rounded-full bg-accent transition-all duration-700"
          :style="{ width: `${percent}%` }"
        ></div>
      </div>
      <div class="flex flex-wrap justify-between gap-x-3 text-xs tabular-nums text-content-muted">
        <span>{{ elapsedText }}</span>
        <span v-if="remainingText">{{ remainingText }}</span>
      </div>

      <ol class="flex flex-col gap-1">
        <li
          v-for="step in steps"
          :key="step.name"
          class="flex flex-col gap-1 rounded-control px-2 py-1.5"
          :class="step.state === 'Running' ? 'bg-accent/10' : ''"
        >
          <div class="flex items-center gap-2">
            <component
              :is="stateIcon(step.state)"
              class="h-5 w-5 shrink-0"
              :class="[stateColor(step.state), iconClass(step.state)]"
            />
            <span
              class="min-w-0 flex-1 truncate text-sm"
              :class="
                step.state === 'Running' ? 'font-semibold text-content' : 'text-content-muted'
              "
            >
              {{ stepName(step.name) }}
            </span>
            <span class="shrink-0 text-xs tabular-nums" :class="stateColor(step.state)">
              {{ stepSummary(step) }}
            </span>
          </div>
          <div v-if="step.state === 'Running'" class="ml-7 flex flex-col gap-1">
            <span v-if="stepDetail(step)" class="text-xs text-content-muted">
              {{ stepDetail(step) }}
            </span>
            <div class="h-1 overflow-hidden rounded-full bg-surface-3">
              <div
                class="h-full bg-accent transition-all duration-500"
                :style="{ width: `${Math.round((step.progress || 0) * 100)}%` }"
              ></div>
            </div>
          </div>
          <p
            v-if="step.state === 'Failed' && step.messageCode"
            class="ml-7 text-xs text-status-danger"
          >
            {{ message(step.messageCode, step.message, step.messageParameters).title }}
          </p>
        </li>
      </ol>

      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="tns-btn-secondary"
          :disabled="Boolean(store.coachPending)"
          @click="skip"
        >
          <ForwardIcon class="h-5 w-5" />
          {{ k('run.skip') }}
        </button>
        <button
          type="button"
          class="tns-btn-danger"
          :disabled="store.coachPending === 'cancel'"
          @click="cancel"
        >
          <StopIcon class="h-5 w-5" />
          {{ k('run.cancel') }}
        </button>
      </div>
    </div>

    <!-- Live view of the running step -->
    <div class="tns-card">
      <NativeCoachCameraGrid v-if="coach.step === 'CameraCheck'" :camera="coach.camera" />
      <NativeCoachDriftView v-else-if="coach.step === 'Drift'" :drift="coach.drift" live />
      <NativeCoachResponseView
        v-else-if="coach.step === 'MountResponse'"
        :response="coach.response"
        :drift="coach.drift"
      />
      <NativeCoachTrialsView v-else-if="coach.step === 'Trials'" :trials="coach.trials" />
      <p v-else-if="coach.step === 'Calibrating'" class="text-sm text-content-muted">
        {{ k('run.calibratingHint') }}
      </p>
      <p v-else class="text-sm text-content-muted">{{ k('run.waiting') }}</p>
    </div>

    <!-- Findings so far -->
    <div v-if="findings.length" class="flex flex-col gap-2">
      <div class="flex flex-col gap-0.5">
        <h4 class="text-sm font-semibold text-content">{{ k('run.findingsSoFar') }}</h4>
        <span class="text-[11px] text-content-faint">{{ k('run.applyLater') }}</span>
      </div>
      <NativeCoachFinding
        v-for="finding in findings"
        :key="finding.id"
        :finding="finding"
        :show-apply="false"
      />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import {
  AcademicCapIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ForwardIcon,
  MinusCircleIcon,
  StopIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useToastStore } from '@/store/toastStore';
import { severityRank } from '@/utils/nativeGuiderCoach';
import NativeCoachCameraGrid from './NativeCoachCameraGrid.vue';
import NativeCoachDriftView from './NativeCoachDriftView.vue';
import NativeCoachFinding from './NativeCoachFinding.vue';
import NativeCoachResponseView from './NativeCoachResponseView.vue';
import NativeCoachTrialsView from './NativeCoachTrialsView.vue';
import { useCoachText } from './useCoachText';

const store = useNativeGuiderStore();
const { k, stepName, stepState, stepDetail, duration, message } = useCoachText();

const coach = computed(() => store.coach || {});
const steps = computed(() => coach.value.steps || []);

const percent = computed(() => {
  const p = Number(coach.value.progress);
  return Number.isFinite(p) ? Math.round(Math.min(1, Math.max(0, p)) * 100) : 0;
});

const currentText = computed(() => {
  const step = coach.value.step;
  if (!step) return '';
  const running = steps.value.find((s) => s.name === step);
  const detail = running ? stepDetail(running) : '';
  const name = k('run.current', { step: stepName(step) });
  return detail ? `${name} · ${detail}` : name;
});

const elapsedText = computed(() => {
  const elapsed = coach.value.elapsedSeconds;
  if (!Number.isFinite(elapsed)) return '';
  return k('run.elapsed', { elapsed: duration(elapsed) });
});

// Only the steps not started yet: the total is the sum of fixed step estimates, which
// running and finished steps can overrun (25 min of ≈ 15 min, ≈ 0 min left).
const remainingText = computed(() => {
  const remaining = steps.value
    .filter((s) => s.state === 'Pending' && s.estimatedSeconds > 0)
    .reduce((sum, s) => sum + s.estimatedSeconds, 0);
  return remaining > 0 ? k('run.remaining', { duration: duration(remaining) }) : '';
});

// The estimate only until a step starts: a running step can overrun it (5 min / 3 min).
function stepSummary(step) {
  if (step.state === 'Running' && Number.isFinite(step.elapsedSeconds)) {
    return duration(step.elapsedSeconds);
  }
  if (step.state === 'Pending' && step.estimatedSeconds > 0) {
    return `≈ ${duration(step.estimatedSeconds)}`;
  }
  return stepState(step.state);
}

function stateIcon(state) {
  switch (state) {
    case 'Running':
      return ArrowPathIcon;
    case 'Done':
      return CheckCircleIcon;
    case 'Skipped':
      return MinusCircleIcon;
    case 'Failed':
      return XCircleIcon;
    default:
      return 'span';
  }
}

function stateColor(state) {
  switch (state) {
    case 'Running':
      return 'text-accent';
    case 'Done':
      return 'text-status-ok';
    case 'Failed':
      return 'text-status-danger';
    default:
      return 'text-content-faint';
  }
}

function iconClass(state) {
  if (state === 'Running') return 'animate-spin-slow';
  // Pending/unknown: an empty ring in place of an icon
  if (!['Done', 'Skipped', 'Failed'].includes(state)) {
    return 'inline-block scale-75 rounded-full border-2 border-line-strong';
  }
  return '';
}

// Newest first, most severe first within the same step; at most 6 while running.
const findings = computed(() =>
  [...(coach.value.findings || [])]
    .sort(
      (a, b) =>
        (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0) ||
        severityRank(b.severity) - severityRank(a.severity)
    )
    .slice(0, 6)
);

async function skip() {
  await store.skipCoachStep({ title: k('run.skipFailed') });
}

async function cancel() {
  const confirmed = await useToastStore().showConfirmation(
    k('run.confirmCancelTitle'),
    k('run.confirmCancel'),
    k('run.cancel'),
    k('run.keepRunning')
  );
  if (!confirmed) return;
  await store.cancelCoach({ title: k('run.cancelFailed') });
}
</script>

<style scoped>
.animate-spin-slow {
  animation: spin 2.5s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
