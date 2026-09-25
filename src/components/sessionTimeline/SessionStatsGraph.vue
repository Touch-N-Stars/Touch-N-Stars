<template>
  <div class="w-full min-h-44 touch-pan-y select-none" :style="{ height: paneHeight }">
    <canvas
      ref="canvas"
      @pointerdown="gestures.onPointerDown"
      @pointermove="gestures.onPointerMove"
      @pointerup="gestures.onPointerUp"
      @pointercancel="gestures.onPointerUp"
    ></canvas>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Chart, Interaction } from 'chart.js/auto';
import { getRelativePosition } from 'chart.js/helpers';
import {
  formatClock,
  nearestIndex,
  paddedRange,
  symmetricLimit,
} from '@/utils/sessionTimelineUtils';
import { tickCount, timeTicks } from '@/utils/timeWindow';
import { useTimeWindowGestures } from '@/composables/useTimeWindowGestures';

const props = defineProps({
  // The series to draw: [{ key, label, color, data: [{x, y, i?}], unit, dense, axis }]
  series: { type: Array, required: true },
  view: { type: Object, required: true }, // { start, end } in ms
  bounds: { type: Object, required: true }, // zoom and pan stay inside
  // Shared with the timeline rows so both plot areas line up
  labelWidth: { type: Number, required: true },
  padRight: { type: Number, required: true },
});

const emit = defineEmits(['select-image', 'update:view', 'reset']);

const BAND_HEIGHT_PX = 84;
const DENSE_REACH_PX = 24;
const FRAME_TAP_PX = 20;

// Hover mode: the nearest point of every series at the hovered time, so the
// tooltip lists all of them. 'nearest' only returns the closest point overall
// and 'index' needs shared x values. Dense series only answer close to the
// cursor: a value from across a guiding pause would mislead.
const hoverTimes = new WeakMap();
Interaction.modes.nearestPerDataset ??= (chart, event) => {
  const position = getRelativePosition(event, chart);
  const xScale = chart.scales.x;
  const time = xScale.getValueForPixel(position.x);
  hoverTimes.set(chart, time);
  const items = [];
  for (const meta of chart.getSortedVisibleDatasetMetas()) {
    const dataset = chart.data.datasets[meta.index];
    const index = nearestIndex(dataset.data, time);
    const point = dataset.data[index];
    const element = meta.data[index];
    if (!element || point.x < xScale.min || point.x > xScale.max) continue;
    if (dataset.dense && Math.abs(element.x - position.x) > DENSE_REACH_PX) continue;
    items.push({ element, datasetIndex: meta.index, index });
  }
  return items;
};

const canvas = ref(null);
let chart = null;

// One horizontal band per axis, top to bottom: series with an axis of their
// own, then the shared ones (the guiding errors), which hold several lines.
const bands = computed(() => {
  const own = props.series
    .filter((s) => !s.axis)
    .map((s) => ({ id: `y_${s.key}`, members: [s], weight: 1 }));
  const shared = [...new Set(props.series.filter((s) => s.axis).map((s) => s.axis))].map(
    (axis) => ({
      id: `y_${axis}`,
      members: props.series.filter((s) => s.axis === axis),
      symmetric: true,
      weight: 1.5,
    })
  );
  return [...own, ...shared];
});

const paneHeight = computed(() => {
  const weights = bands.value.reduce((sum, band) => sum + band.weight, 0);
  return `max(28vh, ${56 + weights * BAND_HEIGHT_PX}px)`;
});

// Guide steps are not joined across a guiding pause. Decimation thins a wide
// view out to a few hundred points, so the threshold follows the zoom.
const denseGapMs = () => Math.max(60e3, ((props.view.end - props.view.start) / 400) * 4);

function buildDatasets() {
  return props.series.map((s) => ({
    label: s.unit ? `${s.label} (${s.unit})` : s.label,
    data: s.data,
    borderColor: s.color,
    backgroundColor: s.color,
    yAxisID: `y_${s.axis ?? s.key}`,
    dense: s.dense,
    borderWidth: 1.5,
    pointRadius: s.dense ? 0 : 3,
    pointHoverRadius: 4,
    tension: 0,
    spanGaps: s.dense ? denseGapMs() : true,
  }));
}

function buildScales() {
  const scales = {
    x: {
      type: 'linear',
      min: props.view.start,
      max: props.view.end,
      grid: { color: 'rgba(255,255,255,0.08)' },
      border: { display: false },
      ticks: {
        color: '#9ca3af',
        font: { size: 11 },
        maxRotation: 0,
        autoSkip: false,
        callback: (value) =>
          formatClock(value, { seconds: props.view.end - props.view.start < 5 * 60e3 }),
      },
      afterBuildTicks: (scale) => {
        scale.ticks = timeTicks(scale.min, scale.max, tickCount(scale.width)).map((value) => ({
          value,
        }));
      },
    },
  };
  // Chart.js fills a vertical stack from the bottom
  for (const band of [...bands.value].reverse()) {
    const unit = band.symmetric ? band.members[0].unit : '';
    const limit = band.symmetric
      ? symmetricLimit(
          band.members.map((s) => s.data),
          props.view
        )
      : null;
    scales[band.id] = {
      type: 'linear',
      position: 'left',
      stack: 'bands',
      stackWeight: band.weight,
      ...(band.symmetric
        ? { min: -limit, max: limit }
        : paddedRange(band.members[0].data, props.view)),
      // No width: the plot has to stay exactly under the timeline rows
      afterFit: (axis) => {
        axis.width = 0;
      },
      grid: {
        drawTicks: false,
        color: band.symmetric
          ? (context) => (context.tick?.value === 0 ? 'rgba(255,255,255,0.35)' : 'transparent')
          : 'rgba(255,255,255,0.06)',
      },
      border: { display: false },
      ticks: {
        mirror: true,
        color: band.symmetric ? '#9ca3af' : band.members[0].color,
        font: { size: 10 },
        padding: 2,
        maxTicksLimit: band.symmetric ? 5 : 4,
        // Labels next to a band border would collide with the neighbouring band
        callback(value) {
          const position = (value - this.min) / (this.max - this.min || 1);
          return position < 0.14 || position > 0.86 ? '' : `${formatValue(value)}${unit}`;
        },
      },
    };
  }
  return scales;
}

// Separates the bands and names each in the colours of its series
const bandLabels = {
  id: 'bandLabels',
  afterDatasetsDraw(chartInstance) {
    const { ctx, chartArea } = chartInstance;
    ctx.save();
    ctx.font = `10px ${Chart.defaults.font.family}`;
    ctx.textBaseline = 'top';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    bands.value.forEach((band, index) => {
      const scale = chartInstance.scales[band.id];
      if (!scale) return;
      if (index > 0) {
        const y = Math.round(scale.top) + 0.5;
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
      }
      let x = chartArea.left + 44;
      for (const member of band.members) {
        ctx.fillStyle = member.color;
        ctx.fillText(member.label, x, scale.top + 3);
        x += ctx.measureText(member.label).width + 10;
      }
    });
    ctx.restore();
  },
};

function formatValue(v) {
  if (Math.abs(v) >= 100) return v.toFixed(0);
  return v.toFixed(Math.abs(v) >= 10 ? 1 : 2);
}

// A tap on a frame point opens that frame; a tap elsewhere only shows the tooltip
function onChartClick(event) {
  if (gestures.isClickAfterDrag(event.native)) return;
  const hit = chart
    .getElementsAtEventForMode(event, 'nearestPerDataset', {}, true)
    .map(({ element, datasetIndex, index }) => ({
      point: chart.data.datasets[datasetIndex].data[index],
      distance: Math.hypot(element.x - event.x, element.y - event.y),
    }))
    .filter(({ point, distance }) => Number.isInteger(point.i) && distance <= FRAME_TAP_PX)
    .sort((a, b) => a.distance - b.distance)[0];
  if (hit) emit('select-image', hit.point.i);
}

function createChart() {
  chart = new Chart(canvas.value, {
    type: 'line',
    plugins: [bandLabels],
    data: { datasets: buildDatasets() },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      normalized: true,
      // No touchmove: the tooltip must not follow a pan
      events: ['mousemove', 'mouseout', 'click', 'touchstart'],
      layout: { padding: { left: props.labelWidth, right: props.padRight, top: 4 } },
      scales: buildScales(),
      interaction: { mode: 'nearestPerDataset', intersect: false },
      onClick: onChartClick,
      plugins: {
        legend: { display: false },
        decimation: { enabled: true, algorithm: 'lttb', samples: 400, threshold: 800 },
        tooltip: {
          callbacks: {
            title: (items) =>
              items.length ? formatClock(hoverTimes.get(items[0].chart), { seconds: true }) : '',
            // A frame value carries the time of its frame, which can be minutes away
            label: ({ dataset, parsed }) => {
              const text = `${dataset.label}: ${formatValue(parsed.y)}`;
              return dataset.dense ? text : `${text} · ${formatClock(parsed.x)}`;
            },
          },
        },
      },
    },
  });
}

const gestures = useTimeWindowGestures({
  element: () => canvas.value,
  getView: () => props.view,
  getBounds: () => props.bounds,
  getPlot: () => {
    const area = chart?.chartArea;
    return area
      ? { left: area.left, width: Math.max(1, area.right - area.left) }
      : { left: props.labelWidth, width: 1 };
  },
  onChange: (view) => emit('update:view', view),
  onReset: () => emit('reset'),
});

// New data rebuilds the datasets; a moved view only touches the scales, which
// keeps panning cheap.
function update({ data }) {
  if (!chart) return;
  if (data) chart.data.datasets = buildDatasets();
  else
    for (const dataset of chart.data.datasets) if (dataset.dense) dataset.spanGaps = denseGapMs();
  chart.options.scales = buildScales();
  chart.update('none');
}

onMounted(() => {
  createChart();
  canvas.value.addEventListener('wheel', gestures.onWheel, { passive: false });
});
onBeforeUnmount(() => {
  canvas.value?.removeEventListener('wheel', gestures.onWheel);
  chart?.destroy();
  chart = null;
});

watch(
  () => props.series,
  () => update({ data: true })
);
watch(
  () => [props.view.start, props.view.end],
  () => update({ data: false })
);
</script>
