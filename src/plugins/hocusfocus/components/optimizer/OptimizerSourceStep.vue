<template>
  <div class="flex flex-col gap-4">
    <p class="text-sm text-gray-300">{{ v.IsLive ? L('liveIntro') : L('replayIntro') }}</p>

    <div class="flex flex-col gap-3">
      <HfSelectField
        :model-value="v.SourceMode"
        :label="L('source')"
        :help="H('sourceMode')"
        :options="enumOptions('SourceMode')"
        @change="emit('set', 'SourceMode', $event)"
      />
      <HfSelectField
        v-if="v.IsPerFilterEnabled"
        :model-value="v.TargetFilterName || ''"
        :label="L('targetFilter')"
        :help="H('targetFilter')"
        :options="(state.AvailableFilterNames || []).map((n) => ({ value: n, label: n }))"
        @change="emit('set', 'TargetFilterName', $event)"
      />
      <HfSelectField
        :model-value="v.OptimizeMode"
        :label="L('mode')"
        :help="H('optimizeMode')"
        :options="[
          { value: 'Optimize', label: L('modeOptimize') },
          { value: 'UseCurrentSettings', label: L('modeUseCurrent') },
        ]"
        @change="emit('set', 'OptimizeMode', $event)"
      />
      <HfToggleRow
        :model-value="!!v.StartFromCurrentSettings"
        :label="L('startFromCurrent')"
        :help="H('startFromCurrent')"
        :disabled="v.OptimizeMode !== 'Optimize'"
        @change="emit('set', 'StartFromCurrentSettings', $event)"
      />
      <HfToggleRow
        :model-value="!!v.DefocusAwareDonutDetection"
        :label="L('donutDetection')"
        :help="H('donutDetection')"
        @change="emit('set', 'DefocusAwareDonutDetection', $event)"
      />
      <HfToggleRow
        :model-value="!!v.OptimizeForAberrationInspection"
        :label="L('forInspection')"
        :help="H('forInspection')"
        @change="emit('set', 'OptimizeForAberrationInspection', $event)"
      />
      <HfToggleRow
        :model-value="!!v.GpuAccelerationEnabled"
        :label="L('gpuAcceleration')"
        :help="H('gpuAcceleration')"
        @change="emit('set', 'GpuAccelerationEnabled', $event)"
      />
    </div>

    <!-- Saved run: the same attempt folders "Load Saved AF" offers -->
    <div v-if="v.IsReplay" class="flex flex-col gap-2">
      <label class="text-sm font-medium text-gray-300">{{ L('savedRun') }}</label>
      <p v-if="loadingRuns" class="text-sm text-gray-400">{{ L('loadingRuns') }}</p>
      <p v-else-if="savedRuns.length === 0" class="text-sm text-amber-300">
        {{ L('noSavedRuns') }}
      </p>
      <select
        v-else
        class="tns-select"
        :value="state.SourcePaths?.[0] || ''"
        @change="emit('source', $event.target.value || null)"
      >
        <option value="" disabled>{{ L('chooseSavedRun') }}</option>
        <option v-for="run in savedRuns" :key="run" :value="run">{{ run }}</option>
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <HfSelectField
        :model-value="v.SweepDetectionBinning"
        :label="L('detectionBinning')"
        :help="H('detectionBinningRec')"
        :options="enumOptions('SweepDetectionBinning')"
        @change="emit('set', 'SweepDetectionBinning', $event)"
      />
      <p
        v-if="v.SweepDetectionBinningRecommendationVisible && v.SweepDetectionBinningRecommendation"
        class="text-sm italic text-cyan-300"
        :title="v.SweepDetectionBinningRecommendationDetail"
      >
        {{ v.SweepDetectionBinningRecommendation }}
      </p>
    </div>

    <!-- Live sweep: what it will capture, plus the three things the user can change -->
    <div v-if="v.IsLive" class="flex flex-col gap-3">
      <p
        v-if="state.SequenceRunning"
        class="rounded-lg border border-amber-600/50 bg-amber-900/25 p-2 text-sm text-amber-200"
      >
        {{ L('sequenceRunningLive') }}
      </p>
      <div class="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
        <div v-for="row in liveReadouts" :key="row.key" :class="readoutRowClass">
          <span class="text-gray-400">{{ L(row.key) }}</span>
          <span class="text-gray-100 tabular-nums">{{ row.value ?? '--' }}</span>
        </div>
      </div>
      <HfNumberField
        :model-value="Number(v.FocusRecoverySteps ?? 0)"
        :label="L('focusRecovery')"
        :help="H('focusRecovery')"
        :min="0"
        :max="25"
        :step="1"
        :decimals="0"
        input-id="hf-opt-recovery"
        @change="emit('set', 'FocusRecoverySteps', $event)"
      />
      <HfNumberField
        :model-value="Number(v.LiveExposureSeconds ?? 1)"
        :label="L('exposure')"
        :help="H('liveExposure')"
        hint="s"
        :min="0.1"
        :max="600"
        :step="0.5"
        :decimals="1"
        input-id="hf-opt-exposure"
        @change="emit('set', 'LiveExposureSeconds', $event)"
      />
      <DirectoryBrowser
        :model-value="v.SaveFolderPath || ''"
        :label="L('saveFolder')"
        @update:model-value="emit('set', 'SaveFolderPath', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HfSelectField from '../fields/HfSelectField.vue';
import HfToggleRow from '../fields/HfToggleRow.vue';
import HfNumberField from '../fields/HfNumberField.vue';
import DirectoryBrowser from '../DirectoryBrowser.vue';

const props = defineProps({
  state: { type: Object, required: true },
  savedRuns: { type: Array, default: () => [] },
  loadingRuns: { type: Boolean, default: false },
});

const emit = defineEmits(['set', 'source']);

const { t } = useI18n();
const L = (key) => t(`plugins.hocusfocus.optimizer.${key}`);
const H = (key) => t(`plugins.hocusfocus.optimizer.help.${key}`);

const v = computed(() => props.state.Values || {});
const readoutRowClass =
  'flex items-center justify-between gap-3 border-b border-gray-700/40 py-1.5 text-sm';

// Options for the wizard's enum inputs, with its own display text where it has one.
function enumOptions(name) {
  return (props.state.EnumOptions?.[name] || []).map((o) => ({ value: o.Value, label: o.Label }));
}

const liveReadouts = computed(() => [
  { key: 'stepSize', value: v.value.SweepStepSize },
  { key: 'numberOfPoints', value: v.value.SweepPointCount },
  { key: 'captureBinning', value: v.value.SweepCaptureBinning },
  { key: 'filter', value: v.value.SweepFilterName },
  { key: 'gain', value: v.value.SweepGain },
  { key: 'totalFrames', value: v.value.SweepEstimatedFrames },
  { key: 'estimatedTime', value: v.value.SweepEstimatedDurationText },
]);
</script>
