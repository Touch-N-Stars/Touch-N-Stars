<template>
  <div class="flex flex-col gap-3">
    <p class="text-base font-semibold text-content">{{ v.Phase || L('working') }}</p>
    <p v-if="v.IsCapturing && v.CaptureContextText" class="text-sm text-content">
      {{ v.CaptureContextText }}
    </p>

    <!-- Overall progress -->
    <div class="h-2 w-full overflow-hidden rounded bg-surface-3">
      <div
        v-if="v.IsProgressIndeterminate || !(v.ProgressTotal > 0)"
        class="h-full w-1/3 animate-pulse rounded bg-accent"
      ></div>
      <div
        v-else
        class="h-full rounded bg-accent transition-all duration-500"
        :style="{ width: `${Math.min(100, (100 * v.ProgressCurrent) / v.ProgressTotal)}%` }"
      ></div>
    </div>
    <p v-if="v.HasEvaluationFrameProgress" class="text-sm text-content-muted">
      {{ v.EvaluationFrameProgressText }}
    </p>

    <!-- The current exposure while capturing -->
    <template v-if="v.HasExposureProgress">
      <p class="text-sm text-content">{{ v.CaptureExposureText }}</p>
      <div class="h-1.5 w-full overflow-hidden rounded bg-surface-3">
        <div
          class="h-full rounded bg-accent-action transition-all duration-500"
          :style="{
            width: `${Math.min(100, (100 * v.ExposureProgressCurrent) / Math.max(1, v.ExposureProgressMax))}%`,
          }"
        ></div>
      </div>
    </template>

    <p v-if="v.ProgressCountElapsedText" class="text-sm text-content tabular-nums">
      {{ v.ProgressCountElapsedText }}
    </p>
    <p v-if="v.IsOptimizing && v.ProgressImprovementText" class="text-sm text-status-ok">
      {{ v.ProgressImprovementText }}
    </p>
    <p v-if="v.ProgressTimingText" class="text-xs text-content-muted">{{ v.ProgressTimingText }}</p>
    <p
      v-if="v.HasSearchExposureAdvice"
      class="rounded-control border border-status-warn/40 bg-status-warn/10 p-2 text-sm text-status-warn"
    >
      {{ v.SearchExposureAdvice }}
    </p>
    <p v-if="v.ProgressAbortNote" class="text-xs text-content-muted">{{ v.ProgressAbortNote }}</p>
    <p class="text-xs text-content-faint">{{ L('runsInBackground') }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  state: { type: Object, required: true },
});

const { t } = useI18n();
const L = (key) => t(`components.focuser.hocus.optimizer.${key}`);
const v = computed(() => props.state.Values || {});
</script>
