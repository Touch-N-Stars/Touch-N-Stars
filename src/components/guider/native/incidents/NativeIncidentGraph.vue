<template>
  <div class="tns-card p-3! flex flex-col gap-2 min-w-0">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-content">{{ k('replay.graph') }}</h3>
      <div class="seg" role="group" :aria-label="t('components.guider.native.graph.unit')">
        <button
          v-for="u in UNITS"
          :key="u"
          type="button"
          class="seg-btn"
          :class="{ 'seg-btn-active': unit === u }"
          :aria-pressed="unit === u"
          @click="unit = u"
        >
          {{
            u === 'px'
              ? t('components.guider.native.graph.px')
              : t('components.guider.native.graph.arcsec')
          }}
        </button>
      </div>
    </div>

    <!-- Tap/click the plot to jump to that frame -->
    <div ref="containerEl" class="relative w-full min-w-0 cursor-pointer">
      <div ref="mainEl" class="w-full" role="img" :aria-label="mainAriaLabel"></div>
    </div>
    <div class="text-[10px] font-bold uppercase tracking-wider text-content-faint">
      {{ t('components.guider.native.graph.snrTitle') }}
    </div>
    <div
      ref="subEl"
      class="w-full cursor-pointer"
      role="img"
      :aria-label="t('components.guider.native.graph.snrTitle')"
    ></div>

    <div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-content-muted">
      <span class="legend-item">
        <span class="legend-line" :style="{ background: RA_COLOR }"></span>
        {{ t('components.guider.native.graph.ra') }}
      </span>
      <span class="legend-item">
        <span class="legend-line" :style="{ background: DEC_COLOR }"></span>
        {{ t('components.guider.native.graph.dec') }}
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
        <span class="legend-bar" :style="{ background: SETTLE_LEGEND_COLOR }"></span>
        {{ t('components.guider.native.graph.settling') }}
      </span>
      <span v-for="type in legendMarkers" :key="type" class="legend-item">
        <span class="legend-marker" :style="{ borderColor: INCIDENT_MARKER_COLORS[type] }"></span>
        {{ marker(type) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { windowRms } from '@/utils/nativeGuider';
import {
  INCIDENT_MARKER_COLORS,
  graphIndexOfFrame,
  incidentGraphSteps,
} from '@/utils/nativeGuiderIncidents';
import {
  buildGraphData,
  graphAriaLabel,
  niceCeil,
  pulseRange,
  settlingSpans,
  symmetricRange,
} from '../graphData';
import { useIncidentText } from './useIncidentText';

const props = defineProps({
  /** AdvancedIncidentFrame[], oldest first. */
  frames: { type: Array, default: () => [] },
  /** timelineMarkers() of the incident. */
  markers: { type: Array, default: () => [] },
  /** imageGapSpans() of the incident (frame index ranges without images). */
  gaps: { type: Array, default: () => [] },
  /** Index of the frame shown in the replay (the cursor line). */
  currentIndex: { type: Number, default: 0 },
});
const emit = defineEmits(['seek']);

const { t, k, marker } = useIncidentText();

const UNITS = ['arcsec', 'px'];
const RA_COLOR = '#60a5fa';
const DEC_COLOR = '#f87171';
const RA_BAR_COLOR = 'rgba(96, 165, 250, 0.35)';
const DEC_BAR_COLOR = 'rgba(248, 113, 113, 0.35)';
const SNR_COLOR = '#22d3ee';
const MASS_COLOR = 'rgba(167, 139, 250, 0.6)';
const SETTLE_SHADE = 'rgba(251, 191, 36, 0.08)';
const SETTLE_LEGEND_COLOR = 'rgba(251, 191, 36, 0.35)';
const GAP_SHADE = 'rgba(148, 163, 184, 0.12)';
const CURSOR_COLOR = 'rgba(248, 250, 252, 0.9)';
const FONT = '10px system-ui, -apple-system, sans-serif';
const AXIS_COLOR = cssVar('--color-content-muted', '#8fa3bf');
const GRID_COLOR = cssVar('--color-line', 'rgba(148, 163, 184, 0.16)');
const ZERO_COLOR = cssVar('--color-line-strong', 'rgba(148, 163, 184, 0.32)');
const MAIN_HEIGHT = 190;
const SUB_HEIGHT = 110;

const unit = ref('arcsec');
const containerEl = ref(null);
const mainEl = ref(null);
const subEl = ref(null);
const series = shallowRef(buildSeries());

let mainPlot = null;
let subPlot = null;
let resizeObserver = null;
let lastWidth = 0;

const syncKey = `native-guider-incident-${Math.random().toString(36).slice(2)}`;

const legendMarkers = computed(() => {
  const types = new Set(props.markers.map((m) => m.type));
  if (props.gaps.length) types.add('gap');
  return ['trigger', 'recovered', 'note', 'gap', 'end'].filter((type) => types.has(type));
});

function cssVar(name, fallback) {
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

function buildSeries() {
  const { steps, frameIndexes } = incidentGraphSteps(props.frames);
  const g = buildGraphData(steps, { window: 0, unit: unit.value });
  let snrMax = 0;
  for (const v of g.snr) if (v !== null && v > snrMax) snrMax = v;
  return {
    g,
    frameIndexes,
    yRange: symmetricRange([g.ra, g.dec], { minAbs: unit.value === 'px' ? 0.5 : 1 }),
    msRange: pulseRange(g.raPulse, g.decPulse),
    snrRange: [0, Math.max(10, niceCeil(snrMax * 1.1))],
    settling: settlingSpans(g.xs, g.settling),
    rms: windowRms(steps, unit.value),
  };
}

const mainAriaLabel = computed(() =>
  graphAriaLabel(
    {
      title: k('replay.graph'),
      rms: t('components.guider.native.graph.rmsTotal'),
      ra: t('components.guider.native.graph.ra'),
      dec: t('components.guider.native.graph.dec'),
    },
    series.value.rms,
    unit.value
  )
);

/** x (epoch seconds) of a frame index, via its graph point. */
function xOfFrame(frameIndex) {
  const { g, frameIndexes } = series.value;
  const i = graphIndexOfFrame(frameIndexes, frameIndex);
  return i >= 0 ? g.xs[i] : null;
}

function spanRect(u, x0, x1, minWidth) {
  let left = u.valToPos(x0, 'x', true);
  let right = u.valToPos(x1, 'x', true);
  if (right - left < minWidth) {
    left -= minWidth / 2;
    right += minWidth / 2;
  }
  return [Math.max(left, u.bbox.left), Math.min(right, u.bbox.left + u.bbox.width)];
}

/** Settling and no-image stretches behind the series; zero line on the main plot. */
function drawBackground(u, { zero = false } = {}) {
  const { ctx, bbox } = u;
  const ratio = uPlot.pxRatio;
  ctx.save();
  ctx.fillStyle = GAP_SHADE;
  for (const gap of props.gaps) {
    const x0 = xOfFrame(gap.from);
    const x1 = xOfFrame(gap.to);
    if (x0 === null || x1 === null) continue;
    const [left, right] = spanRect(u, x0, x1, 4 * ratio);
    if (right > left) ctx.fillRect(left, bbox.top, right - left, bbox.height);
  }
  ctx.fillStyle = SETTLE_SHADE;
  for (const [x0, x1] of series.value.settling) {
    const [left, right] = spanRect(u, x0, x1, 4 * ratio);
    if (right > left) ctx.fillRect(left, bbox.top, right - left, bbox.height);
  }
  if (zero) {
    const y0 = u.valToPos(0, 'y', true);
    if (Number.isFinite(y0)) {
      ctx.strokeStyle = ZERO_COLOR;
      ctx.lineWidth = ratio;
      ctx.beginPath();
      ctx.moveTo(bbox.left, y0);
      ctx.lineTo(bbox.left + bbox.width, y0);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Marker lines (dashed, coloured by type) and the replay cursor (solid). */
function drawMarkers(u) {
  const { ctx, bbox } = u;
  const ratio = uPlot.pxRatio;
  const line = (x) => {
    ctx.beginPath();
    ctx.moveTo(x, bbox.top);
    ctx.lineTo(x, bbox.top + bbox.height);
    ctx.stroke();
  };
  ctx.save();
  ctx.lineWidth = 1.5 * ratio;
  ctx.setLineDash([4 * ratio, 3 * ratio]);
  for (const m of props.markers) {
    const value = xOfFrame(m.index);
    if (value === null) continue;
    const x = u.valToPos(value, 'x', true);
    if (!Number.isFinite(x) || x < bbox.left || x > bbox.left + bbox.width) continue;
    ctx.strokeStyle = INCIDENT_MARKER_COLORS[m.type] || AXIS_COLOR;
    line(x);
  }
  const current = xOfFrame(props.currentIndex);
  if (current !== null) {
    const x = u.valToPos(current, 'x', true);
    if (Number.isFinite(x)) {
      ctx.setLineDash([]);
      ctx.lineWidth = 2 * ratio;
      ctx.strokeStyle = CURSOR_COLOR;
      line(x);
    }
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

function formatTick(value) {
  if (Math.abs(value) < 1e-9) return '0';
  return String(Number(value.toFixed(2)));
}

function mainOptions(width) {
  const bars = uPlot.paths.bars;
  return {
    width,
    height: MAIN_HEIGHT,
    legend: { show: false },
    cursor: { sync: { key: syncKey }, drag: { x: false, y: false }, points: { size: 6 } },
    scales: {
      x: { time: true },
      y: { range: () => series.value.yRange },
      ms: { range: () => series.value.msRange },
    },
    axes: [
      { ...axisBase(), size: 26, space: 70, values: (u, splits) => splits.map(formatTime) },
      { ...axisBase(), scale: 'y', size: 40, values: (u, splits) => splits.map(formatTick) },
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
        scale: 'ms',
        width: 0,
        fill: RA_BAR_COLOR,
        stroke: RA_BAR_COLOR,
        paths: bars({ size: [0.45, 8], align: -1 }),
        points: { show: false },
      },
      {
        scale: 'ms',
        width: 0,
        fill: DEC_BAR_COLOR,
        stroke: DEC_BAR_COLOR,
        paths: bars({ size: [0.45, 8], align: 1 }),
        points: { show: false },
      },
      { scale: 'y', stroke: RA_COLOR, width: 1.5, points: { show: false } },
      { scale: 'y', stroke: DEC_COLOR, width: 1.5, points: { show: false } },
    ],
    hooks: {
      drawAxes: [(u) => drawBackground(u, { zero: true })],
      draw: [drawMarkers],
    },
  };
}

function subOptions(width) {
  return {
    width,
    height: SUB_HEIGHT,
    legend: { show: false },
    cursor: { sync: { key: syncKey }, drag: { x: false, y: false }, points: { size: 5 } },
    scales: {
      x: { time: true },
      snr: { range: () => series.value.snrRange },
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
      { scale: 'snr', stroke: SNR_COLOR, width: 1.25, points: { show: false } },
      { scale: 'mass', stroke: MASS_COLOR, width: 1, points: { show: false } },
    ],
    hooks: {
      drawAxes: [(u) => drawBackground(u)],
      draw: [drawMarkers],
    },
  };
}

function mainData() {
  const { g } = series.value;
  return [g.xs, g.raPulse, g.decPulse, g.ra, g.dec];
}

function subData() {
  const { g } = series.value;
  return [g.xs, g.snr, g.massNorm];
}

/** A tap on a plot jumps the replay to the frame under it. */
function onPlotClick(u, event) {
  const rect = u.over.getBoundingClientRect();
  const idx = u.posToIdx(event.clientX - rect.left);
  const frameIndex = series.value.frameIndexes[idx];
  if (Number.isInteger(frameIndex)) emit('seek', frameIndex);
}

function createPlots() {
  destroyPlots();
  const width = Math.floor(containerEl.value?.clientWidth || 300);
  lastWidth = width;
  mainPlot = new uPlot(mainOptions(width), mainData(), mainEl.value);
  subPlot = new uPlot(subOptions(width), subData(), subEl.value);
  for (const plot of [mainPlot, subPlot]) {
    plot.over.addEventListener('click', (event) => onPlotClick(plot, event));
  }
}

function destroyPlots() {
  mainPlot?.destroy();
  subPlot?.destroy();
  mainPlot = null;
  subPlot = null;
}

function handleResize() {
  const width = Math.floor(containerEl.value?.clientWidth || 0);
  if (width <= 0 || width === lastWidth) return;
  lastWidth = width;
  mainPlot?.setSize({ width, height: MAIN_HEIGHT });
  subPlot?.setSize({ width, height: SUB_HEIGHT });
}

watch([() => props.frames, unit], () => {
  series.value = buildSeries();
  mainPlot?.setData(mainData());
  subPlot?.setData(subData());
});

// Cursor and markers only need a redraw, not new data.
watch([() => props.currentIndex, () => props.markers, () => props.gaps], () => {
  mainPlot?.redraw(false, false);
  subPlot?.redraw(false, false);
});

onMounted(() => {
  createPlots();
  if (typeof ResizeObserver !== 'undefined' && containerEl.value) {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerEl.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  destroyPlots();
});
</script>

<style scoped>
@reference '../../../../assets/tailwind.css';

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

:deep(.u-cursor-x),
:deep(.u-cursor-y) {
  border-color: var(--color-content-faint);
}
</style>
