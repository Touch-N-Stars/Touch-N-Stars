<template>
  <div class="space-y-6">
    <!-- Actions -->
    <div :class="cardClass">
      <h3 :class="headingClass">{{ L('title') }}</h3>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          v-if="analysisRunning"
          class="tns-btn-danger"
          :disabled="isCancelling"
          @click="$emit('stop')"
        >
          {{ L('cancelButton') }}
        </button>
        <button v-else class="tns-btn-primary" :disabled="!canRunAutoFocus" @click="$emit('run')">
          {{ L('runButton') }}
        </button>
        <button class="tns-btn-secondary" :disabled="!backendCanRerun" @click="$emit('rerun')">
          {{ L('loadSaved') }}
        </button>
        <button class="tns-btn-secondary" :disabled="!backendCanRerun" @click="$emit('clear')">
          {{ L('clearAnalyses') }}
        </button>
      </div>
      <p v-if="!cameraConnected || !focuserConnected" class="text-xs text-gray-400">
        {{ L('needsCameraAndFocuser') }}
      </p>
      <!-- A live run would move the focuser mid-sequence; replaying a saved run is fine -->
      <p v-else-if="sequenceRunning && !analysisRunning" class="text-xs text-amber-300">
        {{ L('sequenceRunningHint') }}
      </p>
    </div>

    <!-- Action errors (run / cancel / load saved / clear) -->
    <div
      v-if="error"
      class="flex items-start justify-between gap-3 rounded-lg border border-red-700/50 bg-red-900/40 p-3 text-sm text-red-200"
    >
      <span>{{ error }}</span>
      <button class="shrink-0 text-red-300 hover:text-red-100" @click="$emit('dismiss-error')">
        <XMarkIcon class="h-5 w-5" />
      </button>
    </div>

    <!-- Focus curves -->
    <div v-if="autoFocusChartActive" :class="cardClass">
      <h3 :class="headingClass">{{ L('focusCurveAnalysis') }}</h3>
      <div class="h-72 md:h-96">
        <canvas ref="focusCurveChart"></canvas>
      </div>
    </div>

    <!-- Backfocus / HFR summary -->
    <div v-if="autoFocusCompleted" :class="cardClass">
      <h3 :class="headingClass">{{ L('finalFocusDataSummary') }}</h3>
      <div class="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
        <div :class="summaryRowClass">
          <span class="text-gray-400">{{ L('backfocusError') }}</span>
          <span class="text-right text-gray-100 tabular-nums">{{ backfocusText }}</span>
        </div>
        <div :class="summaryRowClass">
          <span class="text-gray-400">{{ L('backfocusAdjustment') }}</span>
          <span class="text-right text-gray-100">{{ backfocusDirectionText }}</span>
        </div>
        <div :class="summaryRowClass">
          <span class="text-gray-400">{{ L('hfrDifference') }}</span>
          <span class="text-gray-100 tabular-nums">{{ fixed(finalFocusData?.BackfocusHFR) }}</span>
        </div>
        <div :class="summaryRowClass">
          <span class="text-gray-400">{{ L('innerOuterHFR') }}</span>
          <span class="text-gray-100 tabular-nums">
            {{ fixed(finalFocusData?.InnerHFR) }} / {{ fixed(finalFocusData?.OuterHFR) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Tilt corner measurements -->
    <div v-if="autoFocusCompleted" :class="cardClass">
      <h3 :class="headingClass">{{ L('tiltCornerMeasurements') }}</h3>
      <HfDataTable
        :columns="cornerColumns"
        :rows="tiltMeasurements || []"
        :empty-text="L('noTiltCornerMeasurements')"
      />
    </div>

    <!-- Tilt history, newest last -->
    <div v-if="autoFocusChartActivatedOnce" :class="cardClass">
      <div class="flex items-center justify-between gap-3">
        <h3 :class="headingClass">{{ L('tiltMeasurementHistory') }}</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">{{ L('showFitQuality') }}</span>
          <toggleButton
            :status-value="showFitQuality"
            @update:statusValue="showFitQuality = $event"
          />
        </div>
      </div>
      <HfDataTable
        :columns="historyColumns"
        :rows="historyRows"
        row-key="historyId"
        :empty-text="L('noTiltMeasurementHistory')"
      />
    </div>

    <!-- Sensor curve model (only produced while the option is enabled). Cheap text, fetched with
         the run's results; the section only exists when there is a model or one was expected. -->
    <HfCollapsibleCard
      v-if="
        autoFocusCompleted && (sensorModel?.ModelLoaded || sensorModel?.SensorCurveModelEnabled)
      "
      :title="L('sensorModel')"
      :open="store.resultSections.sensorModel"
      @update:open="store.resultSections.sensorModel = $event"
    >
      <SensorModelPanel v-if="sensorModel?.ModelLoaded" :model="sensorModel" />
      <p v-else class="text-sm text-gray-400">{{ L('sensorModelMissing') }}</p>
    </HfCollapsibleCard>

    <!-- The two plots from the run's final exposure. Collapsed by default and fetched only while
         open, so slow devices do no work for them unless asked. -->
    <template v-if="autoFocusCompleted && exposureAnalyzed !== false">
      <HfCollapsibleCard
        :title="L('fwhmContour')"
        :open="store.resultSections.fwhmContour"
        @update:open="store.resultSections.fwhmContour = $event"
      >
        <p v-if="loadingPlots.fwhmContour" class="text-sm text-gray-400">{{ L('loadingPlot') }}</p>
        <FwhmContourPlot v-else-if="fwhmContour?.Available" :data="fwhmContour" />
        <p v-else class="text-sm text-gray-400">{{ L('noPlotData') }}</p>
      </HfCollapsibleCard>

      <HfCollapsibleCard
        :title="L('eccentricity')"
        :open="store.resultSections.eccentricity"
        @update:open="store.resultSections.eccentricity = $event"
      >
        <p v-if="loadingPlots.eccentricity" class="text-sm text-gray-400">{{ L('loadingPlot') }}</p>
        <EccentricityPlot v-else-if="eccentricity?.Available" :data="eccentricity" />
        <p v-else class="text-sm text-gray-400">{{ L('noPlotData') }}</p>
      </HfCollapsibleCard>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import Chart from 'chart.js/auto';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import toggleButton from '@/components/helpers/toggleButton.vue';
import HfDataTable from './fields/HfDataTable.vue';
import SensorModelPanel from './SensorModelPanel.vue';
import EccentricityPlot from './EccentricityPlot.vue';
import FwhmContourPlot from './FwhmContourPlot.vue';
import HfCollapsibleCard from './fields/HfCollapsibleCard.vue';
import { useHocusFocusStore } from '../store/hocusfocusStore';

const props = defineProps({
  autoFocusChartActive: Boolean,
  autoFocusChartActivatedOnce: Boolean,
  autoFocusCompleted: Boolean,
  tiltMeasurements: Array,
  tiltMeasurementHistory: Array,
  finalFocusData: Object,
  sensorModel: Object,
  eccentricity: Object,
  fwhmContour: Object,
  // From /hocusfocus/status. undefined on a plugin build that predates the flag: then the plot
  // sections show and say so themselves if there is nothing to draw.
  exposureAnalyzed: { type: Boolean, default: undefined },
  error: { type: String, default: '' },
  cameraConnected: Boolean,
  focuserConnected: Boolean,
  isCancelling: Boolean,
  sequenceRunning: Boolean,
  backendCanRun: Boolean,
  backendCanRerun: Boolean,
  isTabActive: Boolean,
  // Callbacks for data updates
  onUpdateStatus: Function,
  onUpdateFinalFocusData: Function,
  onUpdateTiltMeasurements: Function,
  onUpdateTiltMeasurementHistory: Function,
  onUpdateSensorModel: Function,
  onUpdateEccentricity: Function,
  onUpdateFwhmContour: Function,
  getRegionFocusPoints: Function,
});

defineEmits(['run', 'stop', 'rerun', 'clear', 'dismiss-error']);

const { t } = useI18n();
const L = (key) => t(`plugins.hocusfocus.aberrationInspector.${key}`);
const store = useHocusFocusStore();

const cardClass =
  'p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50';
const headingClass = 'font-bold text-base text-cyan-400';
const summaryRowClass =
  'flex items-center justify-between gap-3 border-b border-gray-700/40 py-1.5 text-sm';

// An Inspector run is in progress: the backend refuses a new one while both devices are connected.
const analysisRunning = computed(
  () => props.cameraConnected && props.focuserConnected && !props.backendCanRun
);

const canRunAutoFocus = computed(
  () =>
    props.cameraConnected &&
    props.focuserConnected &&
    props.backendCanRun &&
    !props.isCancelling &&
    !props.sequenceRunning
);

// --- Formatting -----------------------------------------------------------------------------

// The backend passes unmeasured values as null, NaN or the string "NaN".
function toNumber(value) {
  if (value === null || value === undefined || value === '' || value === 'NaN') return NaN;
  return Number(value);
}

function fixed(value, digits = 2) {
  const num = toNumber(value);
  return Number.isFinite(num) ? num.toFixed(digits) : '--';
}

// Microns when HocusFocus knows the focuser step size, steps otherwise.
const backfocusText = computed(() => {
  const microns = toNumber(props.finalFocusData?.BackfocusMicronDelta);
  if (Number.isFinite(microns)) return `${Math.abs(microns).toFixed(2)} ${L('unitMicrons')}`;
  const steps = toNumber(props.finalFocusData?.BackfocusFocuserPositionDelta);
  if (Number.isFinite(steps)) return `${Math.abs(Math.round(steps))} ${L('unitSteps')}`;
  return '--';
});

// HocusFocus reports the direction as "TOWARDS" / "AWAY FROM" (the flattener).
const backfocusDirectionText = computed(() => {
  const direction = props.finalFocusData?.BackfocusDirection;
  if (direction === 'TOWARDS') return L('moveSensorTowards');
  if (direction === 'AWAY FROM') return L('moveSensorAway');
  return direction || '--';
});

const cornerColumns = computed(() => [
  { key: 'sensorSide', label: L('sensorSide'), align: 'left', format: regionLabel },
  { key: 'focuserPosition', label: L('focuserPosition'), format: 'int' },
  { key: 'adjustmentRequiredSteps', label: L('adjustmentSteps'), format: 'int' },
  { key: 'adjustmentRequiredMicrons', label: L('adjustmentMicrons'), format: 'num' },
  { key: 'rSquared', label: L('rSquared'), format: 'num' },
]);

// The corner steps are what you act on; the R² columns are diagnostics, so they sit behind a toggle.
const showFitQuality = ref(false);

const historyColumns = computed(() => {
  const steps = [
    { key: 'historyId', label: L('historyId'), align: 'left' },
    { key: 'topleftAdjustmentSteps', label: L('topLeftSteps'), format: 'int' },
    { key: 'toprightAdjustmentSteps', label: L('topRightSteps'), format: 'int' },
    { key: 'bottomleftAdjustmentSteps', label: L('bottomLeftSteps'), format: 'int' },
    { key: 'bottomrightAdjustmentSteps', label: L('bottomRightSteps'), format: 'int' },
    { key: 'backfocusSteps', label: L('backfocusSteps'), format: 'int' },
  ];
  if (!showFitQuality.value) return steps;
  return [
    ...steps,
    { key: 'centerRSquared', label: L('centerRSquared'), format: 'num' },
    { key: 'topleftRSquared', label: L('topLeftRSquared'), format: 'num' },
    { key: 'toprightRSquared', label: L('topRightRSquared'), format: 'num' },
    { key: 'bottomleftRSquared', label: L('bottomLeftRSquared'), format: 'num' },
    { key: 'bottomrightRSquared', label: L('bottomRightRSquared'), format: 'num' },
  ];
});

// HocusFocus keeps history newest-first; show it in run order.
const historyRows = computed(() => [...(props.tiltMeasurementHistory || [])].reverse());

// Region names come from the backend in English; localize the known ones.
const regionKeys = {
  Full: 'regionFull',
  Center: 'regionCenter',
  TopLeft: 'regionTopLeft',
  TopRight: 'regionTopRight',
  BottomLeft: 'regionBottomLeft',
  BottomRight: 'regionBottomRight',
};

function regionLabel(name) {
  if (!name) return '--';
  return regionKeys[name] ? L(regionKeys[name]) : name;
}

// --- Chart ----------------------------------------------------------------------------------

const focusCurveChart = ref(null);
let chartInstance = null;

// One colour per region index, shared by the measured points, the fitted curve and the final-focus
// star. Order matches the backend's regions: 0 Full, 1 Center, 2 TopLeft, 3 TopRight,
// 4 BottomLeft, 5 BottomRight.
const regionColors = [
  { border: 'rgb(255, 255, 255)', bg: 'rgba(255, 255, 255, 0.05)' }, // Full
  { border: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.1)' }, // Center
  { border: 'rgb(249, 115, 22)', bg: 'rgba(249, 115, 22, 0.1)' }, // TopLeft
  { border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.1)' }, // TopRight
  { border: 'rgb(239, 68, 68)', bg: 'rgba(239, 68, 68, 0.1)' }, // BottomLeft
  { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' }, // BottomRight
];

// HocusFocus fixes the region grid at six today; fall back rather than crash if that ever grows.
const colorFor = (idx) => regionColors[idx] || regionColors[0];

const pointX = (p) => (p.x !== undefined ? p.x : p.X);
const pointY = (p) => (p.y !== undefined ? p.y : p.Y);
const pointError = (p) => {
  const err = p.errorY ?? p.ErrorY ?? p.error ?? p.yError ?? p.HFRError ?? p.stdDev;
  return err === undefined ? null : err;
};

// RegionFinalFocusPoints is index-aligned with the regions. Entry 0 (Full) is never filled and stays
// a (-1, 0) placeholder, so it is skipped; the rest keep their own index.
function finalFocusPointsFor(finalFocusData) {
  const points = finalFocusData?.RegionFinalFocusPoints;
  if (!props.autoFocusCompleted || !Array.isArray(points)) return [];
  return points
    .map((point, regionIdx) => ({ regionIdx, x: pointX(point), y: pointY(point) }))
    .filter((p) => p.regionIdx > 0 && p.x !== -1);
}

function buildDatasets(regions, finalPoints) {
  const datasets = [];

  regions.forEach((region, idx) => {
    if (!region?.focusPoints?.length) return;
    const color = colorFor(idx);

    datasets.push({
      label: regionLabel(region.regionName || `Region${idx}`),
      data: region.focusPoints.map((p) => {
        const point = { x: pointX(p), y: pointY(p) };
        const err = pointError(p);
        if (err !== null) point.errorY = err;
        return point;
      }),
      borderColor: color.border,
      backgroundColor: color.bg,
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    });

    const curve = region.curveFit?.CurvePoints;
    if (curve?.length) {
      datasets.push({
        label: '', // fitted curve: no legend entry of its own
        data: curve.map((p) => ({ x: pointX(p), y: pointY(p) })),
        borderColor: color.border,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.4,
        showLine: true,
      });
    }
  });

  finalPoints.forEach((p) => {
    const color = colorFor(p.regionIdx);
    datasets.push({
      label: '', // final-focus star: no legend entry of its own
      data: [{ x: p.x, y: p.y }],
      borderColor: color.border,
      backgroundColor: color.bg,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointStyle: 'star',
      showLine: false,
    });
  });

  return datasets;
}

function yRange(datasets) {
  let min = Infinity;
  let max = -Infinity;
  datasets.forEach((dataset) =>
    dataset.data.forEach((point) => {
      if (point?.y === undefined) return;
      const err = point.errorY || 0;
      min = Math.min(min, point.y - err);
      max = Math.max(max, point.y + err);
    })
  );
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: undefined, max: undefined };
  const padding = (max - min) * 0.1;
  return { min: Math.max(0, min - padding), max: max + padding };
}

// Chart.js has no built-in error bars; draw HFR ± σ whiskers after the points.
const errorBarPlugin = {
  id: 'errorBars',
  afterDatasetsDraw(chart) {
    const yScale = chart.scales.y;
    const ctx = chart.ctx;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      dataset.data.forEach((datapoint, index) => {
        if (!datapoint.errorY) return;
        const element = meta.data[index];
        if (!element) return;
        const top = yScale.getPixelForValue(datapoint.y + datapoint.errorY);
        const bottom = yScale.getPixelForValue(datapoint.y - datapoint.errorY);
        ctx.save();
        ctx.strokeStyle = dataset.borderColor || '#999';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(element.x - 3, top);
        ctx.lineTo(element.x + 3, top);
        ctx.moveTo(element.x, top);
        ctx.lineTo(element.x, bottom);
        ctx.moveTo(element.x - 3, bottom);
        ctx.lineTo(element.x + 3, bottom);
        ctx.stroke();
        ctx.restore();
      });
    });
  },
};

function renderChart(regions, finalPoints) {
  if (!focusCurveChart.value) return;
  const datasets = buildDatasets(regions, finalPoints);
  const range = yRange(datasets);

  if (chartInstance) {
    chartInstance.data.datasets = datasets;
    chartInstance.options.scales.y.min = range.min;
    chartInstance.options.scales.y.max = range.max;
    chartInstance.update('none');
    return;
  }

  const axis = (title) => ({
    title: { display: true, text: title, color: '#9ca3af' },
    ticks: { color: '#9ca3af' },
    grid: { color: 'rgba(107, 114, 128, 0.1)' },
  });

  chartInstance = new Chart(focusCurveChart.value, {
    type: 'scatter',
    data: { datasets },
    plugins: [errorBarPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: {
          labels: {
            color: '#e5e7eb',
            font: { size: 12, weight: 'bold' },
            // Curves and final-focus stars share their region's colour; only regions get an entry.
            filter: (item) => item.text !== '',
          },
        },
      },
      scales: {
        x: { type: 'linear', position: 'bottom', ...axis(L('axisFocuserPosition')) },
        y: { ...axis(L('axisHFR')), min: range.min, max: range.max },
      },
    },
  });
}

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

async function refreshChart() {
  if (!props.autoFocusChartActive) return;
  const data = await props.getRegionFocusPoints();
  if (data?.regionFocusPoints) {
    renderChart(data.regionFocusPoints, finalFocusPointsFor(props.finalFocusData));
  }
}

// --- Data loading ---------------------------------------------------------------------------

// The plots are fetched only while their section is open. The flag keeps the previous run's plot
// from showing while the current one loads.
const loadingPlots = reactive({ fwhmContour: false, eccentricity: false });
const plotLoaders = {
  fwhmContour: () => props.onUpdateFwhmContour?.(),
  eccentricity: () => props.onUpdateEccentricity?.(),
};

async function loadPlot(section) {
  if (!store.resultSections[section] || !props.autoFocusCompleted) return;
  loadingPlots[section] = true;
  try {
    await plotLoaders[section]();
  } catch (err) {
    console.error(`[AberrationInspector] Error loading ${section}:`, err);
  } finally {
    loadingPlots[section] = false;
  }
}

async function loadResults() {
  await props.onUpdateFinalFocusData?.();
  await props.onUpdateTiltMeasurements?.();
  await props.onUpdateSensorModel?.();
  await Promise.all([loadPlot('fwhmContour'), loadPlot('eccentricity')]);
}

// Opening a plot section fetches it then.
watch(
  () => store.resultSections.fwhmContour,
  (open) => open && loadPlot('fwhmContour')
);
watch(
  () => store.resultSections.eccentricity,
  (open) => open && loadPlot('eccentricity')
);

async function loadAll() {
  try {
    await props.onUpdateStatus?.();
    if (props.autoFocusCompleted) await loadResults();
    await refreshChart();
    if (props.autoFocusChartActivatedOnce) await props.onUpdateTiltMeasurementHistory?.();
  } catch (err) {
    console.error('[AberrationInspector] Error loading data:', err);
  }
}

// --- Polling while a run is in progress -----------------------------------------------------

// Each start bumps the generation, so a poll whose request is still in flight when polling
// restarts sees it is stale and does not reschedule itself next to the new loop.
let pollTimer = null;
let pollGeneration = 0;

function startPolling() {
  stopPolling();
  const generation = pollGeneration;
  const poll = async () => {
    try {
      if (props.autoFocusChartActive && !props.autoFocusCompleted) await refreshChart();
    } catch (err) {
      console.error('[AberrationInspector] Error polling focus points:', err);
    }
    // Schedule the next poll only after this one completes, so requests never overlap.
    if (generation === pollGeneration) pollTimer = setTimeout(poll, 1000);
  };
  pollTimer = setTimeout(poll, 0);
}

function stopPolling() {
  pollGeneration++;
  clearTimeout(pollTimer);
  pollTimer = null;
}

// --- Lifecycle ------------------------------------------------------------------------------

watch(
  () => props.autoFocusChartActive,
  async (isActive) => {
    destroyChart();
    if (isActive && props.isTabActive) {
      await nextTick(); // the canvas only exists once the chart card renders
      await loadAll();
    }
  }
);

watch(
  () => props.autoFocusCompleted,
  async (isCompleted) => {
    if (!isCompleted || !props.isTabActive) return;
    try {
      await loadResults();
      await refreshChart();
    } catch (err) {
      console.error('[AberrationInspector] Error loading final results:', err);
    }
  }
);

watch(
  () => props.isTabActive,
  async (isActive) => {
    destroyChart();
    if (isActive) {
      await nextTick();
      await loadAll();
      startPolling();
    } else {
      stopPolling();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopPolling();
  destroyChart();
});
</script>
