<template>
  <div class="w-full space-y-2">
    <!-- Running: spinner + progress bar -->
    <template v-if="flatsStore.status.State === 'Running'">
      <div class="flex items-center gap-2 text-sm text-content">
        <svg
          class="animate-spin h-4 w-4 text-accent shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>{{ runningStatusText }}</span>
      </div>
      <div v-if="flatsStore.status.TotalFilters > 1" class="text-xs text-content-muted">
        {{
          $t('components.flatassistant.status_filter_progress', {
            completed: flatsStore.status.CompletedFilters + 1,
            total: flatsStore.status.TotalFilters,
          })
        }}
      </div>
      <div class="w-full bg-surface-3 rounded-full h-2">
        <div
          class="bg-accent h-2 rounded-full transition-all duration-500"
          :style="{ width: progressPercent + '%' }"
        />
      </div>
      <div v-if="flatsStore.currentADU !== null" class="text-xs text-content-muted">
        {{ $t('components.flatassistant.status_adu_live', { adu: flatsStore.currentADU }) }}
      </div>
    </template>

    <!-- Finished: show locked outcome (set once when the run completes, never recomputed) -->
    <template v-else-if="flatsStore.lastRunOutcome">
      <div :class="['flex items-center gap-2 text-sm', outcomeColorClass]">
        <CheckCircleIcon
          v-if="
            flatsStore.lastRunOutcome.type === 'success' ||
            flatsStore.lastRunOutcome.type === 'info'
          "
          class="w-4 h-4 shrink-0"
        />
        <ExclamationTriangleIcon
          v-else-if="flatsStore.lastRunOutcome.type === 'warning'"
          class="w-4 h-4 shrink-0"
        />
        <XCircleIcon v-else class="w-4 h-4 shrink-0" />
        <span>{{ flatsStore.lastRunOutcome.message }}</span>
      </div>
      <div
        v-if="flatsStore.lastRun?.lastADU !== null && flatsStore.lastRunOutcome.type === 'error'"
        class="text-xs text-content-muted pl-5"
      >
        {{ $t('components.flatassistant.status_adu_live', { adu: flatsStore.lastRun.lastADU }) }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useFlatassistantStore } from '@/store/flatassistantStore';
import { useI18n } from 'vue-i18n';
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/vue/24/outline';

const flatsStore = useFlatassistantStore();
const { t } = useI18n();

const iterationsTracked = computed(
  () => flatsStore.status.TotalIterations > 0 && flatsStore.status.CompletedIterations >= 0
);

const runningStatusText = computed(() => {
  const filterPrefix = flatsStore.currentFilterName
    ? `${t('components.flatassistant.filter_label')} ${flatsStore.currentFilterName} — `
    : '';

  if (flatsStore.status.WaitingForCover) {
    return filterPrefix + t('components.flatassistant.status_waiting_cover');
  }
  if (!iterationsTracked.value) {
    return filterPrefix + t('components.flatassistant.status_running_unknown');
  }
  return (
    filterPrefix +
    t(
      flatsStore.currentRunType === 'darks'
        ? 'components.flatassistant.status_running_darks'
        : 'components.flatassistant.status_running_flats',
      {
        completed: flatsStore.status.CompletedIterations,
        total: flatsStore.status.TotalIterations,
      }
    )
  );
});

const outcomeColorClass = computed(() => {
  switch (flatsStore.lastRunOutcome?.type) {
    case 'success':
      return 'text-status-ok';
    case 'warning':
      return 'text-status-warn';
    case 'error':
      return 'text-status-danger';
    default:
      return 'text-content';
  }
});

const progressPercent = computed(() => {
  const { TotalIterations, CompletedIterations } = flatsStore.status;
  if (TotalIterations <= 0 || CompletedIterations < 0) return 0;
  return Math.min(100, Math.round((CompletedIterations / TotalIterations) * 100));
});
</script>
