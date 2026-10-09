<template>
  <div class="tns-card flex flex-col gap-2 min-w-0">
    <!-- Header: title + clear / unit / window / y-scale controls (wrap on narrow phones) -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-content">
        {{ t('components.guider.native.graph.title') }}
      </h3>
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          :disabled="isClearing"
          :title="t('components.guider.clearGraph')"
          :aria-label="t('components.guider.clearGraph')"
          class="min-w-12 min-h-12 flex items-center justify-center text-content-muted hover:text-content disabled:opacity-50"
          @click="clearGraph"
        >
          <TrashIcon class="w-5 h-5" />
        </button>
        <div class="seg" role="group" :aria-label="t('components.guider.native.graph.unit')">
          <button
            v-for="u in UNITS"
            :key="u"
            type="button"
            class="seg-btn"
            :class="{ 'seg-btn-active': unitValue === u }"
            :aria-pressed="unitValue === u"
            @click="setUnit(u)"
          >
            {{
              u === 'px'
                ? t('components.guider.native.graph.px')
                : t('components.guider.native.graph.arcsec')
            }}
          </button>
        </div>
        <div class="seg" role="group" :aria-label="t('components.guider.native.graph.window')">
          <button
            v-for="w in GRAPH_WINDOWS"
            :key="w"
            type="button"
            class="seg-btn"
            :class="{ 'seg-btn-active': windowValue === w }"
            :aria-pressed="windowValue === w"
            @click="setWindow(w)"
          >
            {{ w }}
          </button>
        </div>
        <div class="seg" role="group" :aria-label="t('components.guider.native.graph.yScale')">
          <button
            v-for="s in scaleOptions"
            :key="s"
            type="button"
            class="seg-btn"
            :class="{ 'seg-btn-active': yScale === s }"
            :aria-pressed="yScale === s"
            @click="yScale = s"
          >
            {{ s === 'auto' ? t('components.guider.native.graph.auto') : `±${s}` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Readout of the hovered (or newest) step -->
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] tabular-nums min-h-4">
      <span class="text-content-faint">{{ readout.time }}</span>
      <span :style="{ color: RA_COLOR }">
        {{ t('components.guider.native.graph.ra') }} {{ readout.ra }}
      </span>
      <span :style="{ color: DEC_COLOR }">
        {{ t('components.guider.native.graph.dec') }} {{ readout.dec }}
      </span>
      <span class="text-content-muted">
        {{ t('components.guider.native.graph.pulses') }} {{ readout.raPulse }} /
        {{ readout.decPulse }} {{ t('components.guider.native.graph.ms') }}
      </span>
      <span class="text-content-muted">
        {{ t('components.guider.native.graph.snr') }} {{ readout.snr }}
      </span>
      <span :style="{ color: RMS_COLOR }">
        {{ t('components.guider.native.graph.rmsLineShort', { count: RMS_ROLLING_STEPS }) }}
        {{ readout.rms }}
      </span>
      <!-- RMS of the visible window (settling and dither recenter frames excluded, like PHD2) -->
      <span
        v-if="windowStats.total !== null"
        class="ml-auto font-semibold text-content"
        :title="t('components.guider.native.graph.rmsHint', { count: windowStats.count })"
      >
        {{ t('components.guider.native.graph.rmsTotal') }} {{ fmtRms(windowStats.total) }}
        <span class="font-normal text-content-muted">
          (<span :style="{ color: RA_COLOR }">{{ fmtRms(windowStats.ra) }}</span> ·
          <span :style="{ color: DEC_COLOR }">{{ fmtRms(windowStats.dec) }}</span
          >)
        </span>
      </span>
    </div>

    <!-- Main plot: error lines + correction bars -->
    <div ref="containerEl" class="relative w-full min-w-0">
      <div ref="mainEl" class="w-full" role="img" :aria-label="mainAriaLabel"></div>
      <div
        v-if="graph.count === 0"
        class="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-content-muted pointer-events-none"
      >
        {{ t('components.guider.native.graph.empty') }}
      </div>
    </div>

    <!-- Sub-trace: SNR and normalised star mass -->
    <div class="text-[10px] font-bold uppercase tracking-wider text-content-faint">
      {{ t('components.guider.native.graph.snrTitle') }}
    </div>
    <div
      ref="subEl"
      class="w-full"
      role="img"
      :aria-label="t('components.guider.native.graph.snrTitle')"
    ></div>

    <!-- Legend -->
    <div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-content-muted">
      <span class="legend-item">
        <span class="legend-line" :style="{ background: RA_COLOR }"></span>
        {{ t('components.guider.native.graph.ra') }}
      </span>
      <span class="legend-item">
        <span class="legend-line" :style="{ background: DEC_COLOR }"></span>
        {{ t('components.guider.native.graph.dec') }}
      </span>
      <span
        class="legend-item"
        :title="t('components.guider.native.graph.rmsLineHint', { count: RMS_ROLLING_STEPS })"
      >
        <span class="legend-dash" :style="{ borderColor: RMS_COLOR }"></span>
        {{ t('components.guider.native.graph.rmsLine', { count: RMS_ROLLING_STEPS }) }}
      </span>
      <span class="legend-item">
        <span class="legend-bar" :style="{ background: RA_BAR_COLOR }"></span>
        {{ t('components.guider.native.graph.raPulse') }}
      </span>
      <span class="legend-item">
        <span class="legend-bar" :style="{ background: DEC_BAR_COLOR }"></span>
        {{ t('components.guider.native.graph.decPulse') }}
      </span>
      <span class="legend-item">
        <span class="legend-line" :style="{ background: SNR_COLOR }"></span>
        {{ t('components.guider.native.graph.snr') }}
      </span>
      <span class="legend-item">
        <span class="legend-line" :style="{ background: MASS_COLOR }"></span>
        {{ t('components.guider.native.graph.mass') }}
      </span>
      <span class="legend-item">
        <span class="legend-bar" :style="{ background: SETTLE_LEGEND_COLOR }"></span>
        {{ t('components.guider.native.graph.settling') }}
      </span>
      <span v-for="(color, kind) in MARKER_COLORS" :key="kind" class="legend-item">
        <span class="legend-marker" :style="{ borderColor: color }"></span>
        {{ t(`components.guider.native.graph.markers.${kind}`) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { TrashIcon } from '@heroicons/vue/24/outline';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useToastStore } from '@/store/toastStore';
import { fmt, windowRms } from '@/utils/nativeGuider';
import {
  GRAPH_WINDOWS,
  MARKER_COLORS,
  RMS_ROLLING_STEPS,
  Y_SCALES,
  buildGraphData,
  formatRms,
  graphAriaLabel,
  markersInRange,
  niceCeil,
  pulseRange,
  settlingSpans,
  symmetricRange,
} from './graphData';

const props = defineProps({
  /** Smaller plot heights for the tablet/desktop grid. */
  compact: { type: Boolean, default: false },
  /** Steps shown (v-model:window); shared with the target plot by the parent. */
  window: { type: Number, default: 100 },
  /** 'arcsec' | 'px' (v-model:unit). */
  unit: { type: String, default: 'arcsec' },
});
const emit = defineEmits(['update:window', 'update:unit']);

const { t } = useI18n();
const store = useNativeGuiderStore();
const toastStore = useToastStore();
const isClearing = ref(false);

async function clearGraph() {
  isClearing.value = true;
  try {
    const confirmed = await toastStore.showConfirmation(
      t('components.guider.clearGraph'),
      t('components.guider.clearGraphConfirm'),
      t('components.guider.clearGraph'),
      t('common.cancel')
    );
    if (confirmed) store.clearGraph();
  } finally {
    isClearing.value = false;
  }
}

const UNITS = ['arcsec', 'px'];
const RA_COLOR = '#60a5fa';
const DEC_COLOR = '#f87171';
const RMS_COLOR = 'rgba(226, 232, 240, 0.85)';
const RA_BAR_COLOR = 'rgba(96, 165, 250, 0.35)';
const DEC_BAR_COLOR = 'rgba(248, 113, 113, 0.35)';
const SNR_COLOR = '#22d3ee';
const MASS_COLOR = 'rgba(167, 139, 250, 0.6)';
const SETTLE_SHADE = 'rgba(251, 191, 36, 0.08)';
const SETTLE_LEGEND_COLOR = 'rgba(251, 191, 36, 0.35)';
const FONT = '10px system-ui, -apple-system, sans-serif';
// uPlot draws on canvas, so theme tokens are resolved once from the CSS variables.
const AXIS_COLOR = cssVar('--color-content-muted', '#8fa3bf');
const GRID_COLOR = cssVar('--color-line', 'rgba(148, 163, 184, 0.16)');
const ZERO_COLOR = cssVar('--color-line-strong', 'rgba(148, 163, 184, 0.32)');

const scaleOptions = ['auto', ...Y_SCALES];

// Local copies so the component also works without v-model bindings.
const windowValue = ref(props.window);
const unitValue = ref(props.unit);
const yScale = ref('auto');
watch(
  () => props.window,
  (v) => (windowValue.value = v)
);
watch(
  () => props.unit,
  (v) => (unitValue.value = v)
);

function setWindow(value) {
  windowValue.value = value;
  emit('update:window', value);
}

function setUnit(value) {
  unitValue.value = value;
  emit('update:unit', value);
}

const containerEl = ref(null);
const mainEl = ref(null);
const subEl = ref(null);
const graph = shallowRef(buildGraphData([], {}));
const hoverIdx = ref(null);

let mainPlot = null;
let subPlot = null;
let resizeObserver = null;
let rafId = null;
let lastWidth = 0;

// Read by the uPlot range functions and draw hooks; replaced on every update.
let yRange = [-1, 1];
let msRange = [-100, 100];
let snrRange = [0, 10];
let overlay = { spans: [], markers: [] };
let showPoints = true;

const syncKey = `native-guider-graph-${Math.random().toString(36).slice(2)}`;

const mainHeight = computed(() => (props.compact ? 170 : 220));
// As tall as the error plot: at a few dozen pixels the SNR/mass lines were flat
const subHeight = mainHeight;

function cssVar(name, fallback) {
  // Note: `window` is a prop in this component, so only document/getComputedStyle are used here.
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatTime(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatTick(value) {
  if (Math.abs(value) < 1e-9) return '0';
  return String(Number(value.toFixed(2)));
}

const unitSymbol = computed(() =>
  unitValue.value === 'px'
    ? t('components.guider.native.graph.px')
    : t('components.guider.native.graph.arcsec')
);

const windowStats = computed(() =>
  windowRms(toRaw(store.steps).slice(-windowValue.value), unitValue.value)
);

function fmtRms(value) {
  return formatRms(value, unitValue.value);
}

const mainAriaLabel = computed(() =>
  graphAriaLabel(
    {
      title: t('components.guider.native.graph.title'),
      rms: t('components.guider.native.graph.rmsTotal'),
      ra: t('components.guider.native.graph.ra'),
      dec: t('components.guider.native.graph.dec'),
    },
    windowStats.value,
    unitValue.value
  )
);

const readout = computed(() => {
  const g = graph.value;
  const idx = hoverIdx.value !== null && hoverIdx.value < g.count ? hoverIdx.value : g.count - 1;
  if (idx < 0) {
    return { time: '–', ra: '–', dec: '–', raPulse: '–', decPulse: '–', snr: '–', rms: '–' };
  }
  const withUnit = (v) => (v === null ? '–' : `${fmt(v, 2)}${unitSymbol.value}`);
  return {
    time: formatTime(g.xs[idx]),
    ra: withUnit(g.ra[idx]),
    dec: withUnit(g.dec[idx]),
    raPulse: g.raPulse[idx] === null ? '0' : Math.round(g.raPulse[idx]),
    decPulse: g.decPulse[idx] === null ? '0' : Math.round(g.decPulse[idx]),
    snr: fmt(g.snr[idx], 1),
    rms: withUnit(g.rms[idx]),
  };
});

// --- uPlot hooks ----------------------------------------------------------------

function drawBackground(u) {
  const { ctx, bbox } = u;
  const ratio = uPlot.pxRatio;
  ctx.save();
  // Settling steps: shaded band behind the series.
  ctx.fillStyle = SETTLE_SHADE;
  const minWidth = 4 * ratio;
  for (const [x0, x1] of overlay.spans) {
    let left = u.valToPos(x0, 'x', true);
    let right = u.valToPos(x1, 'x', true);
    if (right - left < minWidth) {
      left -= minWidth / 2;
      right += minWidth / 2;
    }
    left = Math.max(left, bbox.left);
    right = Math.min(right, bbox.left + bbox.width);
    if (right > left) ctx.fillRect(left, bbox.top, right - left, bbox.height);
  }
  // Zero line of the error axis.
  const y0 = u.valToPos(0, 'y', true);
  if (Number.isFinite(y0)) {
    ctx.strokeStyle = ZERO_COLOR;
    ctx.lineWidth = ratio;
    ctx.beginPath();
    ctx.moveTo(bbox.left, y0);
    ctx.lineTo(bbox.left + bbox.width, y0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMarkers(u) {
  if (!overlay.markers.length) return;
  const { ctx, bbox } = u;
  const ratio = uPlot.pxRatio;
  ctx.save();
  ctx.lineWidth = 1.5 * ratio;
  ctx.setLineDash([4 * ratio, 3 * ratio]);
  for (const marker of overlay.markers) {
    const x = u.valToPos(marker.t, 'x', true);
    if (!Number.isFinite(x) || x < bbox.left || x > bbox.left + bbox.width) continue;
    ctx.strokeStyle = MARKER_COLORS[marker.kind] || AXIS_COLOR;
    ctx.beginPath();
    ctx.moveTo(x, bbox.top);
    ctx.lineTo(x, bbox.top + bbox.height);
    ctx.stroke();
  }
  ctx.restore();
}

function axisBase() {
  return {
    stroke: AXIS_COLOR,
    font: FONT,
    grid: { stroke: GRID_COLOR, width: 1 },
    ticks: { stroke: GRID_COLOR, width: 1, size: 4 },
  };
}

function mainOptions(width) {
  const bars = uPlot.paths.bars;
  return {
    width,
    height: mainHeight.value,
    legend: { show: false },
    cursor: {
      sync: { key: syncKey },
      drag: { x: false, y: false },
      points: { size: 6 },
    },
    scales: {
      x: { time: true },
      y: { range: () => yRange },
      ms: { range: () => msRange },
    },
    axes: [
      {
        ...axisBase(),
        size: 26,
        space: 70,
        values: (u, splits) => splits.map((v) => formatTime(v)),
      },
      {
        ...axisBase(),
        scale: 'y',
        size: 40,
        values: (u, splits) => splits.map((v) => formatTick(v)),
      },
      {
        ...axisBase(),
        scale: 'ms',
        side: 1,
        size: 40,
        grid: { show: false },
        values: (u, splits) => splits.map((v) => String(Math.round(v))),
      },
    ],
    series: [
      {},
      {
        label: 'raPulse',
        scale: 'ms',
        width: 0,
        fill: RA_BAR_COLOR,
        stroke: RA_BAR_COLOR,
        paths: bars({ size: [0.45, 8], align: -1 }),
        points: { show: false },
      },
      {
        label: 'decPulse',
        scale: 'ms',
        width: 0,
        fill: DEC_BAR_COLOR,
        stroke: DEC_BAR_COLOR,
        paths: bars({ size: [0.45, 8], align: 1 }),
        points: { show: false },
      },
      {
        label: 'ra',
        scale: 'y',
        stroke: RA_COLOR,
        width: 1.5,
        points: { show: () => showPoints, size: 3, fill: RA_COLOR },
      },
      {
        label: 'dec',
        scale: 'y',
        stroke: DEC_COLOR,
        width: 1.5,
        points: { show: () => showPoints, size: 3, fill: DEC_COLOR },
      },
      {
        label: 'rms',
        scale: 'y',
        stroke: RMS_COLOR,
        width: 1.5,
        dash: [6, 4],
        points: { show: false },
      },
    ],
    hooks: {
      drawAxes: [drawBackground],
      draw: [drawMarkers],
      setCursor: [
        (u) => {
          hoverIdx.value = u.cursor.idx ?? null;
        },
      ],
    },
  };
}

function subOptions(width) {
  return {
    width,
    height: subHeight.value,
    legend: { show: false },
    cursor: {
      sync: { key: syncKey },
      drag: { x: false, y: false },
      points: { size: 5 },
    },
    scales: {
      x: { time: true },
      snr: { range: () => snrRange },
      mass: { range: () => [0, 1.05] },
    },
    axes: [
      { show: false },
      {
        ...axisBase(),
        scale: 'snr',
        size: 40,
        values: (u, splits) => splits.map((v) => String(Math.round(v))),
      },
      // Invisible right axis: keeps the plot area aligned with the main plot's ms axis.
      {
        ...axisBase(),
        scale: 'mass',
        side: 1,
        size: 40,
        grid: { show: false },
        ticks: { show: false },
        values: (u, splits) => splits.map(() => ''),
      },
    ],
    series: [
      {},
      { label: 'snr', scale: 'snr', stroke: SNR_COLOR, width: 1.25, points: { show: false } },
      { label: 'mass', scale: 'mass', stroke: MASS_COLOR, width: 1, points: { show: false } },
    ],
    hooks: {
      setCursor: [
        (u) => {
          hoverIdx.value = u.cursor.idx ?? null;
        },
      ],
    },
  };
}

// --- Data -------------------------------------------------------------------------

function applyData() {
  rafId = null;
  const g = buildGraphData(toRaw(store.steps), {
    window: windowValue.value,
    unit: unitValue.value,
  });
  graph.value = g;

  yRange = symmetricRange([g.ra, g.dec, g.rms], { scale: yScale.value, minAbs: 1 });
  msRange = pulseRange(g.raPulse, g.decPulse);
  let snrMax = 0;
  for (const v of g.snr) if (v !== null && v > snrMax) snrMax = v;
  snrRange = [0, Math.max(10, niceCeil(snrMax * 1.1))];
  overlay = {
    spans: settlingSpans(g.xs, g.settling),
    markers: g.count ? markersInRange(toRaw(store.markers), g.xs[0], g.xs[g.count - 1] + 2) : [],
  };
  showPoints = g.count <= 120;

  mainPlot?.setData([g.xs, g.raPulse, g.decPulse, g.ra, g.dec, g.rms]);
  subPlot?.setData([g.xs, g.snr, g.massNorm]);
}

function scheduleUpdate() {
  if (rafId !== null) return;
  if (typeof requestAnimationFrame === 'function') {
    rafId = requestAnimationFrame(applyData);
  } else {
    applyData();
  }
}

function currentWidth() {
  const width = containerEl.value?.clientWidth || 0;
  return width > 0 ? Math.floor(width) : 300;
}

function createPlots() {
  destroyPlots();
  const width = currentWidth();
  lastWidth = width;
  const g = graph.value;
  mainPlot = new uPlot(
    mainOptions(width),
    [g.xs, g.raPulse, g.decPulse, g.ra, g.dec, g.rms],
    mainEl.value
  );
  subPlot = new uPlot(subOptions(width), [g.xs, g.snr, g.massNorm], subEl.value);
}

function destroyPlots() {
  mainPlot?.destroy();
  subPlot?.destroy();
  mainPlot = null;
  subPlot = null;
}

function handleResize() {
  const width = containerEl.value?.clientWidth || 0;
  if (width <= 0 || Math.floor(width) === lastWidth) return;
  lastWidth = Math.floor(width);
  mainPlot?.setSize({ width: lastWidth, height: mainHeight.value });
  subPlot?.setSize({ width: lastWidth, height: subHeight.value });
}

watch([() => store.steps, () => store.markers, windowValue, unitValue, yScale], scheduleUpdate);

watch([mainHeight, subHeight], () => {
  const width = lastWidth || currentWidth();
  mainPlot?.setSize({ width, height: mainHeight.value });
  subPlot?.setSize({ width, height: subHeight.value });
});

onMounted(() => {
  applyData();
  createPlots();
  if (typeof ResizeObserver !== 'undefined' && containerEl.value) {
    resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerEl.value);
  }
});

onBeforeUnmount(() => {
  if (rafId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
  rafId = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  destroyPlots();
});
</script>

<style scoped>
@reference '../../../assets/tailwind.css';

.seg {
  @apply flex overflow-hidden rounded-chip border border-line-strong bg-surface-2;
}

.seg-btn {
  @apply h-9 min-w-9 px-2 text-xs font-semibold tabular-nums text-content-muted
    transition-colors border-r border-line last:border-r-0;
}

.seg-btn-active {
  @apply bg-accent/15 text-accent;
}

.legend-item {
  @apply inline-flex items-center gap-1 whitespace-nowrap;
}

.legend-line {
  @apply inline-block h-0.5 w-3.5 rounded-full;
}

.legend-bar {
  @apply inline-block h-2.5 w-2.5 rounded-sm;
}

.legend-marker {
  @apply inline-block h-3 w-0 border-l-2 border-dashed;
}
.legend-dash {
  @apply inline-block h-0 w-3.5 border-t-2 border-dashed;
}

/* The uPlot cursor crosshair in the theme's muted colour. */
:deep(.u-cursor-x),
:deep(.u-cursor-y) {
  border-color: var(--color-content-faint);
}
</style>
