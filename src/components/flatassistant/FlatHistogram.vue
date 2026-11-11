<template>
  <div class="mt-2 w-full">
    <canvas ref="canvasEl" class="block w-full rounded" style="height: 56px" />
    <div class="flex justify-between text-[10px] mt-0.5 px-0.5 select-none">
      <span class="text-content-faint">0</span>
      <span
        v-if="flatsStore.currentADU !== null"
        :class="inTolerance ? 'text-status-ok' : 'text-status-warn'"
      >
        {{ flatsStore.currentADU.toLocaleString() }} ADU
      </span>
      <span v-else class="text-status-ok/80">
        {{ $t('components.flatassistant.target') }}:
        {{ Math.round(flatsStore.histogramMean * 100) }}% ±{{
          Math.round(flatsStore.meanTolerance * 100)
        }}%
      </span>
      <span class="text-content-faint">{{ MAX_ADU.toLocaleString() }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useFlatassistantStore } from '@/store/flatassistantStore';

const flatsStore = useFlatassistantStore();
const canvasEl = ref(null);

const MAX_ADU = computed(() => flatsStore.maxADU);
const PADDING = 10;

const inTolerance = computed(() => {
  if (flatsStore.currentADU === null) return false;
  const fraction = flatsStore.currentADU / MAX_ADU.value;
  return Math.abs(fraction - flatsStore.histogramMean) <= flatsStore.meanTolerance / 2;
});

function draw() {
  const canvas = canvasEl.value;
  if (!canvas) return;

  canvas.width = canvas.parentElement?.clientWidth || 300;
  canvas.height = 56;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const graphW = w - PADDING * 2;
  const graphH = h - PADDING * 2;

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, w, h);

  const mean = flatsStore.histogramMean;
  const halfTol = flatsStore.meanTolerance / 2;
  const lo = PADDING + Math.max(0, mean - halfTol) * graphW;
  const hi = PADDING + Math.min(1, mean + halfTol) * graphW;
  const mx = PADDING + mean * graphW;

  // Tolerance band
  ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
  ctx.fillRect(lo, PADDING, hi - lo, graphH);

  // Tolerance edge lines
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(lo, PADDING);
  ctx.lineTo(lo, PADDING + graphH);
  ctx.moveTo(hi, PADDING);
  ctx.lineTo(hi, PADDING + graphH);
  ctx.stroke();

  // Target mean line
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(mx, PADDING);
  ctx.lineTo(mx, PADDING + graphH);
  ctx.stroke();

  // Current ADU marker
  if (flatsStore.currentADU !== null) {
    const ax = PADDING + Math.min(Math.max(flatsStore.currentADU / MAX_ADU.value, 0), 1) * graphW;
    ctx.strokeStyle = inTolerance.value ? '#4ade80' : '#facc15';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(ax, PADDING);
    ctx.lineTo(ax, PADDING + graphH);
    ctx.stroke();
  }

  // Axis frame
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(PADDING, PADDING);
  ctx.lineTo(PADDING, PADDING + graphH);
  ctx.lineTo(w - PADDING, PADDING + graphH);
  ctx.stroke();

  // Ticks
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const x = PADDING + (graphW / 10) * i;
    ctx.beginPath();
    ctx.moveTo(x, PADDING + graphH);
    ctx.lineTo(x, PADDING + graphH - (i % 5 === 0 ? 5 : 3));
    ctx.stroke();
  }
}

watch(
  [
    () => flatsStore.histogramMean,
    () => flatsStore.meanTolerance,
    () => flatsStore.currentADU,
    MAX_ADU,
  ],
  draw
);

const onResize = () => draw();

onMounted(() => {
  draw();
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => window.removeEventListener('resize', onResize));
</script>
