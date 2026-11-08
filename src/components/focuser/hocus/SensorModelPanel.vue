<template>
  <div class="flex flex-col gap-4">
    <!-- Summary, same values and order as the Inspector pane in HocusFocus -->
    <div class="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
      <div
        v-for="row in summaryRows"
        :key="row.key"
        class="flex items-center justify-between gap-3 border-b border-line py-1.5 text-sm"
      >
        <span class="flex items-center gap-1 text-content-muted">
          {{ L(row.key) }}
          <InfoModal v-if="row.help" :title="L(row.key)" :message="H(row.key)" size="w-4 h-4" />
        </span>
        <span class="text-content tabular-nums">{{ row.value }}</span>
      </div>
    </div>

    <!-- HocusFocus' own verdict for each aspect of the model -->
    <div v-if="analysisResults.length > 0" class="flex flex-col gap-2">
      <h4 class="text-sm font-semibold text-content">{{ L('assessment') }}</h4>
      <div
        v-for="(result, idx) in analysisResults"
        :key="idx"
        class="flex gap-3 rounded-lg border p-2 text-sm"
        :class="
          result.Acceptable
            ? 'border-status-ok/40 bg-status-ok/10'
            : 'border-status-warn/40 bg-status-warn/10'
        "
      >
        <CheckCircleIcon v-if="result.Acceptable" class="h-5 w-5 shrink-0 text-status-ok" />
        <ExclamationTriangleIcon v-else class="h-5 w-5 shrink-0 text-status-warn" />
        <div class="min-w-0">
          <div class="flex flex-wrap items-baseline gap-x-2">
            <span class="font-medium text-content">{{ result.Name }}</span>
            <span v-if="result.Value" class="text-content tabular-nums">{{ result.Value }}</span>
          </div>
          <p v-if="result.Details" class="mt-0.5 text-content-muted">{{ result.Details }}</p>
        </div>
      </div>
    </div>

    <!-- Registration/fit warnings HocusFocus raised while building the model -->
    <div
      v-if="registrationReport.length > 0"
      class="rounded-control border border-status-warn/40 bg-status-warn/10 p-3 text-sm text-status-warn"
    >
      <h4 class="mb-1 font-semibold">{{ L('registrationWarnings') }}</h4>
      <ul class="list-disc space-y-0.5 pl-5">
        <li v-for="(line, idx) in registrationReport" :key="idx">{{ line }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import InfoModal from '@/components/helpers/infoModal.vue';

const props = defineProps({
  // Response of GET /hocusfocus/sensor-model with ModelLoaded === true
  model: { type: Object, required: true },
});

const { t } = useI18n();
const L = (key) => t(`components.focuser.hocus.sensorModel.${key}`);
const H = (key) => t(`components.focuser.hocus.sensorModel.help.${key}`);

function fixed(value, digits) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function withError(value, error, digits, unit) {
  const main = fixed(value, digits);
  if (main === '--') return main;
  const err = fixed(error, digits);
  return `${main}${err === '--' ? '' : ` ± ${err}`}${unit}`;
}

function withUnit(value, digits, unit) {
  const text = fixed(value, digits);
  return text === '--' ? text : `${text} ${unit}`;
}

const summaryRows = computed(() => {
  const s = props.model?.Summary || {};
  const um = L('unitMicrons');
  return [
    { key: 'starsInModel', help: true, value: fixed(s.StarsInModel, 0) },
    { key: 'goodnessOfFit', value: fixed(s.GoodnessOfFit, 2) },
    { key: 'rmsError', value: withUnit(s.RMSErrorMicrons, 1, um) },
    { key: 'tilt', help: true, value: withError(s.TiltDegrees, s.TiltStdErrorDegrees, 3, '°') },
    {
      key: 'curvatureRadius',
      help: true,
      value: withError(
        s.CurvatureRadiusMillimeters,
        s.CurvatureRadiusStdErrorMillimeters,
        0,
        ' mm'
      ),
    },
    { key: 'curvatureEffect', help: true, value: withUnit(s.CurvatureEffectMicrons, 0, um) },
    { key: 'tiltEffect', help: true, value: withUnit(s.TiltEffectMicrons, 0, um) },
    { key: 'meanFocuserPosition', help: true, value: fixed(s.SensorMeanPosition, 0) },
    {
      key: 'autoFocusOffset',
      help: true,
      value: withUnit(s.AutoFocusMeanOffset, 0, L('unitSteps')),
    },
    { key: 'pixelSize', value: withUnit(s.PixelSizeMicrons, 2, um) },
    { key: 'focuserStepSize', value: withUnit(s.FocuserStepSizeMicrons, 2, um) },
    { key: 'fRatio', value: fixed(s.FRatio, 1) },
    { key: 'criticalFocus', help: true, value: withUnit(s.CriticalFocusMicrons, 1, um) },
    { key: 'reducedChiSquared', help: true, value: fixed(s.ReducedChiSquared, 2) },
  ];
});

const analysisResults = computed(() => props.model?.AnalysisResults || []);
const registrationReport = computed(() =>
  (props.model?.RegistrationAndFitReport || []).filter(Boolean)
);
</script>
