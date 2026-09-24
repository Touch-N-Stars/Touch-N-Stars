<template>
  <div class="h-64 md:h-80">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Chart from 'chart.js/auto';

const props = defineProps({
  // SelectedCurve from the optimizer state: Points/CorePoints/RecoveryPoints ({X, Y, ErrorY}),
  // FitCurve ({X, Y}) and Minimum ({X, Y}).
  curve: { type: Object, required: true },
});

const { t } = useI18n();
const L = (key) => t(`plugins.hocusfocus.optimizer.${key}`);

const canvas = ref(null);
let chart = null;

const toPoint = (p) => ({ x: p.X, y: p.Y, errorY: p.ErrorY || 0 });

function datasets() {
  const c = props.curve;
  // The desktop draws the sweep's core points and the focus-recovery points apart; without a split,
  // every point is a core point.
  const core = (c.CorePoints?.length ? c.CorePoints : c.Points) || [];
  const recovery = c.RecoveryPoints || [];
  const out = [
    {
      label: L('chartMeasured'),
      data: core.map(toPoint),
      borderColor: 'rgb(34, 211, 238)',
      backgroundColor: 'rgba(34, 211, 238, 0.35)',
      pointRadius: 4,
    },
  ];
  if (recovery.length) {
    out.push({
      label: L('chartRecovery'),
      data: recovery.map(toPoint),
      borderColor: 'rgb(251, 191, 36)',
      backgroundColor: 'transparent',
      pointRadius: 4,
      pointStyle: 'rectRot',
    });
  }
  if (c.FitCurve?.length) {
    out.push({
      label: L('chartFit'),
      data: c.FitCurve.map((p) => ({ x: p.X, y: p.Y })),
      borderColor: 'rgb(229, 231, 235)',
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      showLine: true,
      tension: 0.3,
    });
  }
  if (Number.isFinite(c.Minimum?.X) && Number.isFinite(c.Minimum?.Y)) {
    out.push({
      label: L('chartMinimum'),
      data: [{ x: c.Minimum.X, y: c.Minimum.Y }],
      borderColor: 'rgb(74, 222, 128)',
      backgroundColor: 'rgb(74, 222, 128)',
      pointRadius: 7,
      pointStyle: 'star',
    });
  }
  return out;
}

// HFR ± σ whiskers, as on the Inspector's focus-curve chart.
const errorBars = {
  id: 'optimizerErrorBars',
  afterDatasetsDraw(c) {
    const y = c.scales.y;
    const ctx = c.ctx;
    c.data.datasets.forEach((dataset, i) => {
      const meta = c.getDatasetMeta(i);
      if (meta.hidden) return;
      dataset.data.forEach((point, j) => {
        const el = meta.data[j];
        if (!point.errorY || !el) return;
        const top = y.getPixelForValue(point.y + point.errorY);
        const bottom = y.getPixelForValue(point.y - point.errorY);
        ctx.save();
        ctx.strokeStyle = dataset.borderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(el.x - 3, top);
        ctx.lineTo(el.x + 3, top);
        ctx.moveTo(el.x, top);
        ctx.lineTo(el.x, bottom);
        ctx.moveTo(el.x - 3, bottom);
        ctx.lineTo(el.x + 3, bottom);
        ctx.stroke();
        ctx.restore();
      });
    });
  },
};

function axis(title) {
  return {
    title: { display: true, text: title, color: '#9ca3af' },
    ticks: { color: '#9ca3af' },
    grid: { color: 'rgba(107, 114, 128, 0.15)' },
  };
}

function render() {
  if (!canvas.value) return;
  if (chart) {
    chart.data.datasets = datasets();
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
      plugins: { legend: { labels: { color: '#e5e7eb' } } },
      scales: {
        x: { type: 'linear', ...axis(L('chartFocuserPosition')) },
        y: axis(L('chartHFR')),
      },
    },
  });
}

onMounted(render);
watch(() => props.curve, render, { deep: true });
onBeforeUnmount(() => {
  chart?.destroy();
  chart = null;
});
</script>
