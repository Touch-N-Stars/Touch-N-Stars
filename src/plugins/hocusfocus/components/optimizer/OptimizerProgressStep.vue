<template>
  <div class="flex flex-col gap-3">
    <p class="text-base font-semibold text-gray-100">{{ v.Phase || L('working') }}</p>
    <p v-if="v.IsCapturing && v.CaptureContextText" class="text-sm text-gray-300">
      {{ v.CaptureContextText }}
    </p>

    <!-- Overall progress -->
    <div class="h-2 w-full overflow-hidden rounded bg-gray-700">
      <div
        v-if="v.IsProgressIndeterminate || !(v.ProgressTotal > 0)"
        class="h-full w-1/3 animate-pulse rounded bg-cyan-500"
      ></div>
      <div
        v-else
        class="h-full rounded bg-cyan-500 transition-all duration-500"
        :style="{ width: `${Math.min(100, (100 * v.ProgressCurrent) / v.ProgressTotal)}%` }"
      ></div>
    </div>
    <p v-if="v.HasEvaluationFrameProgress" class="text-sm text-gray-400">
      {{ v.EvaluationFrameProgressText }}
    </p>

    <!-- The current exposure while capturing -->
    <template v-if="v.HasExposureProgress">
      <p class="text-sm text-gray-300">{{ v.CaptureExposureText }}</p>
      <div class="h-1.5 w-full overflow-hidden rounded bg-gray-700">
        <div
          class="h-full rounded bg-cyan-700 transition-all duration-500"
          :style="{
            width: `${Math.min(100, (100 * v.ExposureProgressCurrent) / Math.max(1, v.ExposureProgressMax))}%`,
          }"
        ></div>
      </div>
    </template>

    <p v-if="v.ProgressCountElapsedText" class="text-sm text-gray-300 tabular-nums">
      {{ v.ProgressCountElapsedText }}
    </p>
    <p v-if="v.IsOptimizing && v.ProgressImprovementText" class="text-sm text-green-300">
      {{ v.ProgressImprovementText }}
    </p>
    <p v-if="v.ProgressTimingText" class="text-xs text-gray-400">{{ v.ProgressTimingText }}</p>
    <p
      v-if="v.HasSearchExposureAdvice"
      class="rounded-lg border border-amber-600/50 bg-amber-900/25 p-2 text-sm text-amber-200"
    >
      {{ v.SearchExposureAdvice }}
    </p>
    <p v-if="v.ProgressAbortNote" class="text-xs text-gray-400">{{ v.ProgressAbortNote }}</p>
    <p class="text-xs text-gray-500">{{ L('runsInBackground') }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  state: { type: Object, required: true },
});

const { t } = useI18n();
const L = (key) => t(`plugins.hocusfocus.optimizer.${key}`);
const v = computed(() => props.state.Values || {});
</script>
