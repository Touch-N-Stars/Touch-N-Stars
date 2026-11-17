<template>
  <section class="flex flex-col gap-3">
    <!-- Grade, guided RMS and error budget -->
    <div class="tns-card flex flex-col gap-4">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-col">
          <h3 class="text-base font-semibold text-content">
            {{ k('title') }} · {{ k('report.title') }}
          </h3>
          <span class="text-xs text-content-faint">{{ sessionText }}</span>
        </div>
        <button
          type="button"
          class="tns-btn-secondary w-auto! shrink-0 px-3! text-xs!"
          @click="emit('new-session')"
        >
          <ArrowPathIcon class="h-4 w-4" />
          {{ k('report.newSession') }}
        </button>
      </div>

      <div class="flex items-center gap-4">
        <div
          class="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4"
          :class="gradeClasses"
          data-testid="coach-grade"
        >
          <span class="text-[10px] font-bold uppercase tracking-wider opacity-80">
            {{ k('report.grade') }}
          </span>
          <span class="px-1 text-center text-sm font-bold leading-tight">{{ gradeLabel }}</span>
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="text-xs text-content-muted">{{ k('report.guidedRms') }}</span>
          <span class="text-2xl font-bold tabular-nums text-content">
            {{ arcsec(report.guidedRmsArcsec) }}
          </span>
          <span class="text-xs text-content-muted tabular-nums">
            <template v-if="Number.isFinite(report.guidedRmsRaArcsec)">
              RA {{ arcsec(report.guidedRmsRaArcsec) }} · Dec
              {{ arcsec(report.guidedRmsDecArcsec) }} ·
            </template>
            {{ sourceLabel }}
          </span>
          <span class="text-xs text-content-faint">{{ ratioText }}</span>
        </div>
      </div>

      <!-- Error budget (quadrature shares) -->
      <div v-if="budget" class="flex flex-col gap-1.5">
        <span class="text-xs font-bold uppercase tracking-wider text-content-faint">
          {{ k('report.budget') }}
        </span>
        <div class="flex h-4 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            v-for="part in budget.parts"
            :key="part.key"
            class="h-full"
            :class="BUDGET_COLORS[part.key]"
            :style="{ width: `${Math.max(0, part.share * 100)}%` }"
            :title="`${k(`report.budgetParts.${part.key}`)} ${arcsec(part.arcsec)}`"
          ></div>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span
            v-for="part in budget.parts"
            :key="part.key"
            class="inline-flex items-center gap-1.5"
          >
            <span class="h-2.5 w-2.5 rounded-sm" :class="BUDGET_COLORS[part.key]"></span>
            <span class="text-content-muted">{{ k(`report.budgetParts.${part.key}`) }}</span>
            <span class="font-semibold tabular-nums text-content">{{ arcsec(part.arcsec) }}</span>
            <span class="text-content-faint tabular-nums"
              >({{ Math.round(part.share * 100) }} %)</span
            >
          </span>
        </div>
        <p class="text-[11px] text-content-faint">{{ k('report.budgetHint') }}</p>
      </div>
    </div>

    <!-- Ranked actions -->
    <div class="tns-card flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-content">{{ k('report.actions') }}</h3>
      <p v-if="!actions.length" class="text-sm text-content-muted">{{ k('report.noActions') }}</p>
      <NativeCoachFinding
        v-for="(finding, index) in actions"
        :key="finding.id"
        :finding="finding"
        :rank="index + 1"
        :default-open="index < 2"
        :apply-disabled="store.coachRunning"
      />
    </div>

    <!-- Trials with their settings (apply a trial) -->
    <div v-if="trials.length" class="tns-card">
      <NativeCoachTrialsView :trials="trials" show-apply :apply-disabled="store.coachRunning" />
    </div>

    <!-- Other findings, grouped by step -->
    <div v-if="others.length" class="tns-card flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-content">{{ k('report.others') }}</h3>
      <div v-for="group in others" :key="group.step" class="flex flex-col gap-1.5">
        <span class="text-[11px] font-bold uppercase tracking-wider text-content-faint">
          {{ stepName(group.step) }}
        </span>
        <NativeCoachFinding
          v-for="finding in group.findings"
          :key="finding.id"
          :finding="finding"
          :apply-disabled="store.coachRunning"
        />
      </div>
    </div>

    <!-- Raw measurements -->
    <div v-if="hasMeasurements" class="tns-card flex flex-col gap-3">
      <button
        type="button"
        class="flex min-h-touch w-full items-center justify-between gap-2 text-left"
        :aria-expanded="showMeasurements"
        @click="showMeasurements = !showMeasurements"
      >
        <span class="text-sm font-semibold text-content">{{ k('report.measurements') }}</span>
        <ChevronDownIcon
          class="h-5 w-5 text-content-muted transition-transform"
          :class="{ 'rotate-180': showMeasurements }"
        />
      </button>
      <template v-if="showMeasurements">
        <NativeCoachCameraGrid v-if="camera?.results?.length" :camera="camera" />
        <NativeCoachDriftView v-if="drift" :drift="drift" compact />
        <NativeCoachResponseView v-if="response" :response="response" :drift="drift" compact />
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ArrowPathIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { fmt } from '@/utils/nativeGuider';
import {
  errorBudget,
  gradeTone,
  otherFindingsByStep,
  rankedActions,
} from '@/utils/nativeGuiderCoach';
import NativeCoachCameraGrid from './NativeCoachCameraGrid.vue';
import NativeCoachDriftView from './NativeCoachDriftView.vue';
import NativeCoachFinding from './NativeCoachFinding.vue';
import NativeCoachResponseView from './NativeCoachResponseView.vue';
import NativeCoachTrialsView from './NativeCoachTrialsView.vue';
import { useCoachText } from './useCoachText';

const props = defineProps({
  /** AdvancedCoachStatus with a report. */
  status: { type: Object, required: true },
});
const emit = defineEmits(['new-session']);

const store = useNativeGuiderStore();
const { k, te, stepName } = useCoachText();
const showMeasurements = ref(false);

const BUDGET_COLORS = {
  seeing: 'bg-sky-500/80',
  noise: 'bg-violet-500/80',
  mount: 'bg-amber-500/80',
};

const report = computed(() => props.status.report || {});
const budget = computed(() => errorBudget(report.value));
const actions = computed(() => rankedActions(report.value));
const others = computed(() =>
  otherFindingsByStep(
    report.value,
    actions.value.map((f) => f.id)
  )
);

const camera = computed(() => report.value.camera || props.status.camera || null);
const drift = computed(() => report.value.drift || props.status.drift || null);
const response = computed(() => report.value.response || props.status.response || null);
const trials = computed(() => {
  const list = report.value.trials?.length ? report.value.trials : props.status.trials;
  return Array.isArray(list) ? list : [];
});
const hasMeasurements = computed(
  () => Boolean(camera.value?.results?.length) || Boolean(drift.value) || Boolean(response.value)
);

function arcsec(value) {
  return Number.isFinite(value) ? `${fmt(value, 2)}″` : '–';
}

const grade = computed(() => String(report.value.grade || 'unknown').toLowerCase());
const gradeLabel = computed(() =>
  te(`components.guider.native.coach.report.grades.${grade.value}`)
    ? k(`report.grades.${grade.value}`)
    : report.value.grade
);
const gradeClasses = computed(
  () =>
    ({
      ok: 'border-status-ok bg-status-ok/10 text-status-ok',
      warn: 'border-status-warn bg-status-warn/10 text-status-warn',
      danger: 'border-status-danger bg-status-danger/10 text-status-danger',
      idle: 'border-line-strong bg-surface-2 text-content-muted',
    })[gradeTone(grade.value)]
);

const sourceLabel = computed(() => {
  const source = report.value.guidedSource || 'none';
  return te(`components.guider.native.coach.report.guidedSources.${source}`)
    ? k(`report.guidedSources.${source}`)
    : source;
});

const ratioText = computed(() => {
  const ratio = report.value.gradeRatio;
  if (Number.isFinite(report.value.imagingScale) && Number.isFinite(ratio)) {
    return k('report.gradeRatio', { ratio: fmt(ratio, 2) });
  }
  return report.value.grade && grade.value !== 'unknown' ? k('report.gradeArcsec') : '';
});

const sessionText = computed(() => {
  const ms = Date.parse(report.value.timestamp);
  const date = Number.isFinite(ms)
    ? new Date(ms).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  return [date, report.value.cameraName].filter(Boolean).join(' · ');
});
</script>
