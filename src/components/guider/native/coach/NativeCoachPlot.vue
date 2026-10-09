<template>
  <div ref="containerEl" class="w-full min-w-0">
    <div ref="plotEl" :role="label ? 'img' : undefined" :aria-label="label || undefined"></div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { FONT, AXIS_COLOR, GRID_COLOR, formatTick as tick } from '../uplotTheme';

/**
 * Minimal uPlot line/point plot with a numeric x axis for the coach views (drift vs time,
 * Dec position vs pulse time). Series: [{ label, stroke, width, dash, points }].
 */
const props = defineProps({
  /** [xs, ys1, ys2, ...] - xs ascending. */
  data: { type: Array, required: true },
  series: { type: Array, required: true },
  height: { type: Number, default: 200 },
  xLabel: { type: String, default: '' },
  yLabel: { type: String, default: '' },
  /** Keep 0 in the middle of the y axis (symmetric range). */
  symmetric: { type: Boolean, default: false },
  /** Accessible name: what the plot shows and its summary numbers (e.g. the seeing RMS). */
  label: { type: String, default: '' },
});

const containerEl = ref(null);
const plotEl = ref(null);
let plot = null;
let resizeObserver = null;
let lastWidth = 0;

function axis(label) {
  return {
    stroke: AXIS_COLOR,
    font: FONT,
    labelFont: FONT,
    label,
    labelSize: label ? 14 : 0,
    grid: { stroke: GRID_COLOR, width: 1 },
    ticks: { stroke: GRID_COLOR, width: 1, size: 4 },
    values: (u, splits) => splits.map(tick),
  };
}

function yRange(u, min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
  if (props.symmetric) {
    const m = Math.max(0.5, Math.abs(min), Math.abs(max)) * 1.1;
    return [-m, m];
  }
  const pad = Math.max(0.1, (max - min) * 0.1);
  return [min - pad, max + pad];
}

function options(width) {
  return {
    width,
    height: props.height,
    legend: { show: false },
    cursor: { drag: { x: false, y: false }, points: { size: 5 } },
    scales: {
      x: { time: false },
      y: { range: yRange },
    },
    axes: [axis(props.xLabel), { ...axis(props.yLabel), size: 44 }],
    series: [
      {},
      ...props.series.map((s) => ({
        label: s.label,
        stroke: s.stroke,
        width: s.width ?? 1.5,
        dash: s.dash,
        spanGaps: true,
        points: s.points ?? { show: false },
      })),
    ],
  };
}

function width() {
  const w = containerEl.value?.clientWidth || 0;
  return w > 0 ? Math.floor(w) : 300;
}

function create() {
  plot?.destroy();
  lastWidth = width();
  plot = new uPlot(options(lastWidth), toRaw(props.data), plotEl.value);
}

watch(
  () => props.data,
  (data) => plot?.setData(toRaw(data))
);
watch(
  () => [props.series.length, props.height, props.xLabel, props.yLabel],
  () => create()
);

onMounted(() => {
  create();
  if (typeof ResizeObserver !== 'undefined' && containerEl.value) {
    resizeObserver = new ResizeObserver(() => {
      const w = width();
      if (w === lastWidth) return;
      lastWidth = w;
      plot?.setSize({ width: w, height: props.height });
    });
    resizeObserver.observe(containerEl.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  plot?.destroy();
  plot = null;
});
</script>

<style scoped>
:deep(.u-cursor-x),
:deep(.u-cursor-y) {
  border-color: var(--color-content-faint);
}
</style>
