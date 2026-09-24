<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <p class="text-base font-semibold text-gray-100">{{ L('complete') }}</p>
      <p v-if="v.HasSummaryFilter" class="text-sm text-gray-400">
        {{ L('filter') }}: <span class="text-gray-200">{{ v.SummaryFilterName }}</span>
      </p>
    </div>

    <!-- Which settings the chart and the summary describe; Accept applies this one -->
    <HfSelectField
      v-if="v.HasOptimized"
      :model-value="v.SelectedVariant"
      :label="L('variant')"
      :help="H('variant')"
      :options="variantOptions"
      @change="emit('set', 'SelectedVariant', $event)"
    />

    <p v-if="v.ShowNoImprovementNote" :class="noteClass">{{ v.OptimizerNoImprovementNote }}</p>
    <p v-if="v.HasExposureBlock && v.LowSignalChartNote" :class="noteClass">
      {{ v.LowSignalChartNote }}
    </p>
    <p v-if="v.HasUndersampledStarsNote" :class="noteClass">{{ v.UndersampledStarsChartNote }}</p>

    <OptimizerCurveChart
      v-if="v.HasSelectedCurve && state.SelectedCurve"
      :curve="state.SelectedCurve"
    />

    <div class="flex flex-col">
      <div :class="rowClass">
        <span class="text-gray-400">{{ L('focusPrecision') }}</span>
        <span class="text-right text-gray-100">{{ v.FocusPrecisionText || '--' }}</span>
      </div>
      <div v-if="summary.HasFeedbackComparison" :class="rowClass">
        <span class="text-gray-400">{{ L('vsOptimized') }}</span>
        <span class="text-right text-gray-100">{{ summary.FeedbackVsOptimizedText }}</span>
      </div>
      <div v-if="v.HasRunDuration" :class="rowClass">
        <span class="text-gray-400">{{ L('optimizationTime') }}</span>
        <span class="text-right text-gray-100 tabular-nums">{{ v.RunDurationText }}</span>
      </div>
    </div>

    <!-- Stars found on each frame, and how that changed -->
    <div v-if="v.HasStarsPerFrame" class="flex flex-col gap-2">
      <h4 :class="subheadingClass">{{ v.StarsPerFrameLabel }}</h4>
      <HfDataTable :columns="starsColumns" :rows="state.StarsPerFrame || []" />
    </div>

    <!-- Star signal / exposure advice -->
    <div v-if="v.HasExposureBlock" class="flex flex-col gap-2">
      <h4 :class="subheadingClass">
        {{ L('starSignal') }}
        <InfoModal :title="L('starSignal')" :message="H('starSignal')" size="w-4 h-4" />
      </h4>
      <div v-if="v.HasRecommendedExposure" :class="rowClass">
        <span class="text-gray-400">{{ L('recommendedExposure') }}</span>
        <span class="text-right text-gray-100" :title="v.ExposureDerivationDetail">
          {{ v.RecommendedExposureText }}
        </span>
      </div>
      <p v-if="v.HasExposureBody" class="text-sm text-gray-300">{{ v.ExposureBodyText }}</p>
    </div>

    <!-- Auto-focus sweep settings the run recommends -->
    <div class="flex flex-col gap-2">
      <h4 :class="subheadingClass">{{ L('autoFocusSettings') }}</h4>
      <div :class="rowClass">
        <span class="text-gray-400">{{ L('recommendedStepSize') }}</span>
        <span class="text-right text-gray-100">{{ summary.StepSizeText || '--' }}</span>
      </div>
      <div :class="rowClass">
        <span class="text-gray-400">{{ L('recommendedOffsetSteps') }}</span>
        <span class="text-right text-gray-100">{{ summary.OffsetStepsText || '--' }}</span>
      </div>
      <div v-if="v.CanApplyExposureTime" :class="rowClass">
        <span class="text-gray-400">{{ L('exposure') }}</span>
        <span class="text-right text-gray-100">{{ v.SweepExposureChangeText }}</span>
      </div>
      <HfToggleRow
        :model-value="!!v.ApplyRecommendedStepSize"
        :label="v.ApplyRecommendedSettingsLabel || L('applyRecommended')"
        :help="H('applyStepSize')"
        :disabled="!v.CanApplyRecommendedStepSize"
        @change="emit('set', 'ApplyRecommendedStepSize', $event)"
      />
    </div>

    <!-- Live runs: re-capture at a better exposure and optimize again -->
    <div v-if="v.ShowCaptureNewSweep" class="flex flex-col gap-2">
      <p v-if="v.CaptureNewSweepCarriesText" class="text-sm text-gray-300">
        {{ v.CaptureNewSweepCarriesText }}
      </p>
      <HfNumberField
        :model-value="Number(v.RecaptureExposureSeconds ?? 1)"
        :label="L('newSweepExposure')"
        hint="s"
        :min="0.1"
        :max="600"
        :step="0.5"
        :decimals="1"
        input-id="hf-opt-recapture"
        @change="emit('set', 'RecaptureExposureSeconds', $event)"
      />
      <button
        class="tns-btn-secondary"
        :disabled="!canRun('CaptureNewSweepCommand') || state.SequenceRunning"
        @click="emit('command', 'CaptureNewSweepCommand')"
      >
        {{ L('captureNewSweep') }}
      </button>
    </div>

    <!-- Detection binning recommendation from this run -->
    <div v-if="v.HasDetectionBinningBlock" class="flex flex-col gap-2">
      <h4 :class="subheadingClass">{{ L('detectionBinning') }}</h4>
      <div :class="rowClass">
        <span class="text-gray-400">{{ L('recommendedFactor') }}</span>
        <span class="text-right text-gray-100">{{ v.DetectionBinningRecommendationText }}</span>
      </div>
      <p v-if="v.HasDetectionBinningBody" class="text-sm text-gray-300">
        {{ v.DetectionBinningBodyText }}
      </p>
      <button
        v-if="v.ShowOptimizeAgainAtRecommendedBinning"
        class="tns-btn-secondary"
        :disabled="!canRun('OptimizeAgainAtRecommendedBinningCommand')"
        @click="emit('command', 'OptimizeAgainAtRecommendedBinningCommand')"
      >
        {{ v.OptimizeAgainAtRecommendedBinningText }}
      </button>
    </div>

    <p v-if="v.HasContinueOptimizingAdvice" class="text-sm text-gray-300">
      {{ v.ContinueOptimizingAdviceText }}
    </p>

    <!-- What the optimizer changed -->
    <div class="flex flex-col gap-2">
      <h4 :class="subheadingClass">{{ L('changedParameters') }}</h4>
      <p v-if="v.HasRoundsSummary" class="text-sm text-gray-400">{{ v.RoundsSummaryText }}</p>
      <HfDataTable
        :columns="changedColumns"
        :rows="state.ChangedParameters || []"
        :empty-text="L('noChangedParameters')"
      />
    </div>

    <p class="text-xs text-gray-400">{{ L('acceptHint') }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import InfoModal from '@/components/helpers/infoModal.vue';
import HfSelectField from '../fields/HfSelectField.vue';
import HfToggleRow from '../fields/HfToggleRow.vue';
import HfNumberField from '../fields/HfNumberField.vue';
import HfDataTable from '../fields/HfDataTable.vue';
import OptimizerCurveChart from './OptimizerCurveChart.vue';

const props = defineProps({
  state: { type: Object, required: true },
});

const emit = defineEmits(['set', 'command']);

const { t } = useI18n();
const L = (key) => t(`plugins.hocusfocus.optimizer.${key}`);
const H = (key) => t(`plugins.hocusfocus.optimizer.help.${key}`);

const v = computed(() => props.state.Values || {});
const summary = computed(() => props.state.Summary || {});

const rowClass =
  'flex items-center justify-between gap-3 border-b border-gray-700/40 py-1.5 text-sm';
const subheadingClass = 'flex items-center gap-1 text-sm font-semibold text-gray-300';
const noteClass =
  'rounded-lg border border-amber-600/50 bg-amber-900/25 p-2 text-sm text-amber-200';

const canRun = (name) => !!props.state.Commands?.[name]?.CanExecute;

const variantOptions = computed(() => {
  const options = [
    { value: 'Current', label: L('variantCurrent') },
    { value: 'Optimized', label: L('variantOptimized') },
  ];
  if (v.value.HasFeedback) options.push({ value: 'Feedback', label: L('variantFeedback') });
  return options;
});

const starsColumns = computed(() => [
  { key: 'FocuserPosition', label: L('focuserPosition'), align: 'left', format: 'int' },
  { key: 'CountsText', label: L('stars') },
  { key: 'DeltaText', label: L('change') },
]);

const changedColumns = computed(() => [
  { key: 'Name', label: L('parameter'), align: 'left' },
  { key: 'Trajectory', label: L('currentToOptimized') },
]);
</script>
