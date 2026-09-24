<template>
  <div class="h-72 md:h-96">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Chart from 'chart.js/auto';

// The HocusFocus AutoFocus chart, drawn the way its own AF panel draws it: points with HFR error bars,
// outliers the fit rejected as red crosses, points outside the symmetric focus window as hollow rings,
// only the fits the curve-fitting setting uses, and the final point with its ±σ(focus) error bar.
const props = defineProps({
  // Response of GET /hocusfocus/autofocus/last-run
  run: { type: Object, required: true },
});

const { t } = useI18n();
const L = (key) => t(`components.focuser.hf.${key}`);

const canvas = ref(null);
let chart = null;

const COLORS = {
  point: 'rgb(34, 211, 238)',
  line: 'rgba(156, 163, 175, 0.5)',
  excluded: 'rgba(229, 231, 235, 0.6)',
  rejected: 'rgb(239, 68, 68)',
  hyperbolic: 'rgb(74, 222, 128)',
  quadratic: 'rgb(251, 113, 133)',
  trendlines: 'rgb(251, 191, 36)',
  gaussian: 'rgb(167, 139, 250)',
  final: 'rgb(248, 113, 113)',
};

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

function curveDataset(label, points, color) {
  return {
    label,
    data: (points || []).map(([x, y]) => ({ x, y })),
    borderColor: color,
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 0,
    pointHitRadius: 0,
    showLine: true,
    tension: 0,
    kind: 'curve',
  };
}

function markerDataset(label, point, color) {
  if (!point || !isFiniteNumber(point.Position) || !isFiniteNumber(point.Value)) return null;
  return {
    label,
    data: [{ x: point.Position, y: point.Value }],
    borderColor: color,
    backgroundColor: color,
    pointRadius: 5,
    pointStyle: 'rectRot',
    kind: 'marker',
  };
}

function datasets() {
  const run = props.run;
  const points = run.Points || [];
  const included = points.filter((p) => !p.Excluded);
  const excluded = points.filter((p) => p.Excluded);
  const rejected = points.filter((p) => p.Rejected);
  const toPoint = (p) => ({ x: p.Position, y: p.HFR, errorY: p.Error || 0, point: p });

  const out = [
    // Point-to-point line under the markers, a background cue for the raw sweep shape.
    {
      label: '',
      data: included.map((p) => ({ x: p.Position, y: p.HFR })),
      borderColor: COLORS.line,
      backgroundColor: 'transparent',
      borderWidth: 1,
      pointRadius: 0,
      pointHitRadius: 0,
      showLine: true,
      kind: 'line',
    },
    {
      label: L('chart.measured'),
      data: included.map(toPoint),
      borderColor: COLORS.point,
      backgroundColor: COLORS.point,
      pointRadius: 4,
      kind: 'points',
    },
  ];
  if (excluded.length) {
    out.push({
      label: L('chart.excluded'),
      data: excluded.map(toPoint),
      borderColor: COLORS.excluded,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 5,
      kind: 'points',
    });
  }
  if (rejected.length) {
    out.push({
      label: L('chart.rejected'),
      data: rejected.map((p) => ({ x: p.Position, y: p.HFR, point: p })),
      borderColor: COLORS.rejected,
      backgroundColor: COLORS.rejected,
      borderWidth: 2,
      pointRadius: 8,
      pointStyle: 'crossRot',
      kind: 'points',
    });
  }

  const curves = run.Curves || {};
  if (curves.Hyperbolic) {
    out.push(curveDataset(L('chart.hyperbolic'), curves.Hyperbolic.Points, COLORS.hyperbolic));
    out.push(markerDataset('', curves.Hyperbolic.Minimum, COLORS.hyperbolic));
  }
  if (curves.Quadratic) {
    out.push(curveDataset(L('chart.quadratic'), curves.Quadratic.Points, COLORS.quadratic));
    out.push(markerDataset('', curves.Quadratic.Minimum, COLORS.quadratic));
  }
  if (curves.Trendlines) {
    out.push(curveDataset(L('chart.trendlines'), curves.Trendlines.Left, COLORS.trendlines));
    out.push(curveDataset('', curves.Trendlines.Right, COLORS.trendlines));
    out.push(markerDataset('', curves.Trendlines.Intersection, COLORS.trendlines));
  }
  if (curves.Gaussian) {
    out.push(curveDataset(L('chart.gaussian'), curves.Gaussian.Points, COLORS.gaussian));
    out.push(markerDataset('', curves.Gaussian.Maximum, COLORS.gaussian));
  }

  const final = run.FinalFocusPoint;
  if (final && isFiniteNumber(final.Position) && isFiniteNumber(final.Value)) {
    out.push({
      label: L('chart.finalFocus'),
      data: [{ x: final.Position, y: final.Value, errorX: final.Error || 0 }],
      borderColor: COLORS.final,
      backgroundColor: COLORS.final,
      pointRadius: 7,
      pointStyle: 'star',
      borderWidth: 2,
      kind: 'final',
    });
  }
  return out.filter(Boolean);
}

// The fitted curves run past the measured range and can climb far beyond it; scale the y axis to the
// points (with their error bars) and the final point instead, and let the chart area clip the curves.
function yRange() {
  const run = props.run;
  const values = [];
  for (const p of run.Points || []) {
    values.push(p.HFR + (p.Error || 0), p.HFR - (p.Error || 0));
  }
  if (isFiniteNumber(run.FinalFocusPoint?.Value)) values.push(run.FinalFocusPoint.Value);
  const finite = values.filter(isFiniteNumber);
  if (!finite.length) return {};
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const pad = (max - min || Math.abs(max) || 1) * 0.1;
  return { min: Math.max(0, min - pad), max: max + pad };
}

function xRange() {
  const run = props.run;
  const values = (run.Points || []).map((p) => p.Position);
  if (isFiniteNumber(run.FinalFocusPoint?.Position)) values.push(run.FinalFocusPoint.Position);
  const finite = values.filter(isFiniteNumber);
  if (!finite.length) return {};
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const pad = (max - min || Math.abs(max) || 1) * 0.1;
  return { min: min - pad, max: max + pad };
}

// Vertical HFR ± σ whiskers on the measured points, horizontal ±σ(focus) on the final point.
const errorBars = {
  id: 'hfAfErrorBars',
  afterDatasetsDraw(c) {
    const { x: xScale, y: yScale } = c.scales;
    const ctx = c.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(c.chartArea.left, c.chartArea.top, c.chartArea.width, c.chartArea.height);
    ctx.clip();
    c.data.datasets.forEach((dataset, i) => {
      const meta = c.getDatasetMeta(i);
      if (meta.hidden) return;
      dataset.data.forEach((point, j) => {
        const el = meta.data[j];
        if (!el) return;
        ctx.strokeStyle = dataset.borderColor;
        ctx.lineWidth = dataset.kind === 'final' ? 2 : 1;
        ctx.beginPath();
        if (point.errorY) {
          const top = yScale.getPixelForValue(point.y + point.errorY);
          const bottom = yScale.getPixelForValue(point.y - point.errorY);
          ctx.moveTo(el.x - 3, top);
          ctx.lineTo(el.x + 3, top);
          ctx.moveTo(el.x, top);
          ctx.lineTo(el.x, bottom);
          ctx.moveTo(el.x - 3, bottom);
          ctx.lineTo(el.x + 3, bottom);
        }
        if (point.errorX) {
          const left = xScale.getPixelForValue(point.x - point.errorX);
          const right = xScale.getPixelForValue(point.x + point.errorX);
          ctx.moveTo(left, el.y - 4);
          ctx.lineTo(left, el.y + 4);
          ctx.moveTo(left, el.y);
          ctx.lineTo(right, el.y);
          ctx.moveTo(right, el.y - 4);
          ctx.lineTo(right, el.y + 4);
        }
        ctx.stroke();
      });
    });
    ctx.restore();
  },
};

function axis(title) {
  return {
    title: { display: true, text: title, color: '#9ca3af' },
    ticks: { color: '#9ca3af' },
    grid: { color: 'rgba(107, 114, 128, 0.15)' },
  };
}

function tooltipLabel(item) {
  const raw = item.raw;
  const kind = item.dataset.kind;
  if (kind === 'final') {
    const error = raw.errorX ? ` ± ${raw.errorX.toFixed(0)}` : '';
    return `${L('chart.finalFocus')}: ${raw.x.toFixed(0)}${error}, ${raw.y.toFixed(2)}`;
  }
  const error = raw.errorY ? ` ± ${raw.errorY.toFixed(2)}` : '';
  const flags = [];
  if (raw.point?.Rejected) flags.push(L('chart.rejected'));
  if (raw.point?.Excluded) flags.push(L('chart.excluded'));
  const suffix = flags.length ? ` (${flags.join(', ')})` : '';
  return `${raw.x.toFixed(0)}: ${raw.y.toFixed(2)}${error}${suffix}`;
}

function yTitle() {
  return props.run.Method === 'CONTRASTDETECTION' ? L('chart.contrast') : L('chart.hfr');
}

function render() {
  if (!canvas.value) return;
  if (chart) {
    chart.data.datasets = datasets();
    const x = xRange();
    const y = yRange();
    chart.options.scales.x.min = x.min;
    chart.options.scales.x.max = x.max;
    chart.options.scales.y.min = y.min;
    chart.options.scales.y.max = y.max;
    chart.options.scales.y.title.text = yTitle();
    chart.update('none');
    return;
  }
  chart = new Chart(canvas.value, {
    type: 'scatter',
    data: { datasets: datasets() },
    plugins: [errorBars],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: {
          labels: {
            color: '#e5e7eb',
            usePointStyle: true,
            // Unlabelled datasets are the connecting line, fit minima and the second trend line.
            filter: (item, data) => !!data.datasets[item.datasetIndex].label,
          },
        },
        tooltip: {
          filter: (item) => ['points', 'final', 'marker'].includes(item.dataset.kind),
          callbacks: { label: tooltipLabel },
        },
      },
      scales: {
        x: { type: 'linear', ...axis(L('chart.focuserPosition')), ...xRange() },
        y: { ...axis(yTitle()), ...yRange() },
      },
    },
  });
}

onMounted(render);
watch(() => props.run, render, { deep: true });
onBeforeUnmount(() => {
  chart?.destroy();
  chart = null;
});
</script>
