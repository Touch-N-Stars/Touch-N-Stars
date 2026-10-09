<template>
  <section class="flex flex-col gap-2 min-w-0">
    <h4 class="text-sm font-semibold text-content">{{ k('trials.title') }}</h4>
    <p v-if="!rows.length" class="text-xs text-content-muted">{{ k('trials.noData') }}</p>

    <div
      v-for="trial in rows"
      :key="trial.id"
      class="flex flex-col gap-1.5 rounded-control border p-2"
      :class="trial.isWinner ? 'border-status-ok/50 bg-status-ok/5' : 'border-line bg-surface-2/50'"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span class="flex min-w-0 items-baseline gap-2">
          <span class="text-sm font-bold text-content tabular-nums">{{ trial.id }}</span>
          <span class="truncate text-xs text-content-muted">{{ kindLabel(trial.kind) }}</span>
          <span
            v-if="trial.isWinner"
            class="rounded-chip bg-status-ok/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-status-ok"
          >
            {{ k('trials.winner') }}
          </span>
        </span>
        <span class="text-xs tabular-nums" :class="stateClass(trial.state)">
          {{ trialState(trial) }}
        </span>
      </div>

      <!-- RMS bar (scaled to the worst trial) -->
      <div class="flex items-center gap-2">
        <div class="relative h-3 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div
            class="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            :class="trial.isWinner ? 'bg-status-ok' : 'bg-accent/70'"
            :style="{ width: `${barWidth(trial.rmsTotalArcsec)}%` }"
          ></div>
        </div>
        <span class="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-content">
          {{ arcsec(trial.rmsTotalArcsec) }}
        </span>
      </div>
      <div
        v-if="Number.isFinite(trial.rmsRaArcsec) || trial.frames"
        class="flex flex-wrap gap-x-3 text-[11px] text-content-faint tabular-nums"
      >
        <span>{{
          k('trials.raDec', { ra: arcsec(trial.rmsRaArcsec), dec: arcsec(trial.rmsDecArcsec) })
        }}</span>
        <span v-if="trial.frames">{{ k('trials.frames', { count: trial.frames }) }}</span>
      </div>

      <!-- Settings diff -->
      <ul v-if="trial.changes.length" class="flex flex-col gap-0.5 text-xs">
        <li
          v-for="change in trial.changes"
          :key="change.name"
          class="flex flex-wrap items-baseline justify-between gap-x-3"
        >
          <span class="text-content-muted">{{ change.label }}</span>
          <span class="tabular-nums">
            <span class="text-content-faint">{{ change.from }}</span> →
            <span class="font-semibold text-content">{{ change.to }}</span>
            <span v-if="change.unit" class="ml-0.5 text-content-faint">{{ change.unit }}</span>
          </span>
        </li>
      </ul>
      <p v-else class="text-[11px] text-content-faint">{{ k('trials.noChanges') }}</p>

      <div v-if="showApply && trial.changes.length" class="flex justify-end">
        <button
          type="button"
          class="w-auto! px-3! text-xs!"
          :class="
            trial.applied
              ? 'tns-btn-secondary'
              : trial.isWinner
                ? 'tns-btn-primary'
                : 'tns-btn-secondary'
          "
          :disabled="trial.applied || applyDisabled || applying === trial.id"
          @click="apply(trial)"
        >
          <CheckIcon v-if="trial.applied" class="h-4 w-4" />
          {{ trial.applied ? k('finding.applied') : k('trials.apply', { id: trial.id }) }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { CheckIcon } from '@heroicons/vue/24/outline';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useToastStore } from '@/store/toastStore';
import { fmt } from '@/utils/nativeGuider';
import { orderedTrials } from '@/utils/nativeGuiderCoach';
import { useCoachText } from './useCoachText';

const props = defineProps({
  trials: { type: Array, default: () => [] },
  showApply: { type: Boolean, default: false },
  applyDisabled: { type: Boolean, default: false },
});

const store = useNativeGuiderStore();
const { k, te, stepState, duration, settingChange } = useCoachText();
const applying = ref(null);

const rows = computed(() =>
  orderedTrials(props.trials).map((trial) => ({
    ...trial,
    changes: (trial.settings || []).map((c) => settingChange(c, store.settings)),
  }))
);

const maxRms = computed(() =>
  Math.max(0, ...rows.value.map((r) => (Number.isFinite(r.rmsTotalArcsec) ? r.rmsTotalArcsec : 0)))
);

function barWidth(value) {
  if (!Number.isFinite(value) || !(maxRms.value > 0)) return 0;
  return Math.max(3, (value / maxRms.value) * 100);
}

function arcsec(value) {
  return Number.isFinite(value) ? `${fmt(value, 2)}″` : '–';
}

function kindLabel(kind) {
  const key = `components.guider.native.coach.trials.kinds.${kind}`;
  return kind && te(key) ? k(`trials.kinds.${kind}`) : kind || '';
}

function trialState(trial) {
  const label = stepState(trial.state);
  if (trial.state === 'Running' && Number.isFinite(trial.elapsedSeconds)) {
    return `${label} · ${duration(trial.elapsedSeconds)}`;
  }
  return label;
}

function stateClass(state) {
  switch (state) {
    case 'Running':
    case 'Settling':
      return 'text-accent font-semibold';
    case 'Failed':
      return 'text-status-danger';
    case 'Done':
      return 'text-content-muted';
    default:
      return 'text-content-faint';
  }
}

async function apply(trial) {
  applying.value = trial.id;
  try {
    const ok = await store.applyCoachActions([`trial:${trial.id}`], {
      title: k('finding.applyFailed'),
    });
    if (ok) {
      useToastStore().showToast({
        type: 'success',
        title: k('finding.appliedToast', { title: k('trials.apply', { id: trial.id }) }),
      });
    }
  } finally {
    applying.value = null;
  }
}
</script>
