<template>
  <section class="tns-card flex flex-col gap-2 min-w-0" data-testid="history-scatter">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="text-sm font-semibold text-content">
        {{ t('plugins.guideLogViewer.scatter.title') }}
      </h3>
      <span class="text-[11px] tabular-nums text-content-muted">
        {{ t('plugins.guideLogViewer.scatter.radius', { value: radiusText }) }}
      </span>
    </div>
    <div ref="wrapEl" class="relative mx-auto aspect-square w-full max-w-80">
      <canvas
        ref="canvasEl"
        class="absolute inset-0 h-full w-full"
        role="img"
        :aria-label="t('plugins.guideLogViewer.scatter.title')"
      ></canvas>
    </div>
    <p class="text-[11px] text-content-muted">
      {{ t('plugins.guideLogViewer.scatter.hint') }}
      <template v-if="outsideCount">
        {{ t('plugins.guideLogViewer.scatter.outside', { count: outsideCount }) }}
      </template>
    </p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AXIS_COLOR,
  DEC_COLOR,
  FONT,
  GRID_COLOR,
  RA_COLOR,
  ZERO_COLOR,
} from '@/components/guider/native/uplotTheme';
import { niceCeil, niceStep, scatterPoints } from '../utils/logView';

const props = defineProps({
  model: { type: Object, required: true },
  range: { type: Object, required: true },
  stats: { type: Object, default: null },
  unit: { type: String, default: 'arcsec' },
  excludeSettling: { type: Boolean, default: true },
});
const { t } = useI18n();

const wrapEl = ref(null);
const canvasEl = ref(null);
let size = 0;
const outsideCount = ref(0);
let raf = null;
let resizeObserver = null;

const suffix = computed(() => (props.unit === 'px' ? ' px' : '″'));

const points = computed(() =>
  scatterPoints(props.model.series, props.range.from, props.range.to, {
    unit: props.unit,
    excludeSettling: props.excludeSettling,
  })
);

/** RMS radius in the chart's unit. */
const rmsRadius = computed(() => {
  const s = props.stats;
  if (!s || s.empty) return NaN;
  return s.rmsTotal * (s.unitScale ?? 1);
});

const radiusText = computed(() =>
  Number.isFinite(rmsRadius.value) ? `${rmsRadius.value.toFixed(2)}${suffix.value}` : '–'
);

function draw() {
  raf = null;
  const canvas = canvasEl.value;
  if (!canvas || !size) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const pts = points.value;
  // scale: the 99th percentile of the distances, at least twice the RMS
  const dists = pts.map(([x, y]) => Math.hypot(x, y)).sort((a, b) => a - b);
  const p99 = dists.length ? dists[Math.floor((dists.length - 1) * 0.99)] : 1;
  const extent = niceCeil(
    Math.max(p99 * 1.05, (rmsRadius.value || 0) * 2.2, props.unit === 'px' ? 0.3 : 1)
  );
  const c = size / 2;
  const k = (size / 2 - 14) / extent;

  // grid rings and axes
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.font = FONT;
  ctx.fillStyle = AXIS_COLOR;
  const step = niceStep(extent, 3);
  for (let r = step; r <= extent + 1e-9; r += step) {
    ctx.beginPath();
    ctx.arc(c, c, r * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(
      `${Number(r.toFixed(2))}${suffix.value}`,
      c + r * k * 0.71 + 2,
      c - r * k * 0.71 - 2
    );
  }
  ctx.strokeStyle = ZERO_COLOR;
  ctx.beginPath();
  ctx.moveTo(0, c);
  ctx.lineTo(size, c);
  ctx.moveTo(c, 0);
  ctx.lineTo(c, size);
  ctx.stroke();
  ctx.fillStyle = RA_COLOR;
  ctx.fillText(t('components.guider.native.graph.ra'), size - 18, c - 4);
  ctx.fillStyle = DEC_COLOR;
  ctx.fillText(t('components.guider.native.graph.dec'), c + 4, 10);

  // points, older ones fainter
  const n = pts.length;
  const dot = n > 5000 ? 1.2 : n > 1000 ? 1.6 : 2.2;
  let outside = 0;
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    if (Math.abs(x) > extent || Math.abs(y) > extent) {
      outside++;
      continue;
    }
    const age = n > 1 ? i / (n - 1) : 1;
    ctx.fillStyle = `rgba(163, 230, 53, ${0.25 + 0.55 * age})`;
    ctx.fillRect(c + x * k - dot / 2, c - y * k - dot / 2, dot, dot);
  }
  outsideCount.value = outside;

  // RMS circle
  if (Number.isFinite(rmsRadius.value)) {
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c, c, rmsRadius.value * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function schedule() {
  if (raf === null) raf = requestAnimationFrame(draw);
}

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    size = Math.floor(entries[0].contentRect.width);
    schedule();
  });
  resizeObserver.observe(wrapEl.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (raf !== null) cancelAnimationFrame(raf);
});

watch(() => [points.value, rmsRadius.value], schedule);
</script>
