<template>
  <div
    ref="rootEl"
    class="w-full h-full flex flex-col text-content overflow-hidden"
    :class="compact ? 'text-[10px] leading-tight' : 'text-xs'"
  >
    <!-- Header with star values; the title is dropped on small tiles to leave room for the graph -->
    <div class="shrink-0" :class="compact ? 'px-1 pt-0.5' : 'px-2 pt-1 pb-1'">
      <h3 v-if="!compact" class="font-semibold text-center mb-1">Star Profile</h3>
      <div class="flex flex-wrap justify-between gap-x-1">
        <span class="whitespace-nowrap"
          >SNR: <span :class="snrClass">{{ snrValue }}</span></span
        >
        <span class="whitespace-nowrap"
          >HFD: <span :class="hfdClass">{{ hfdValue }}</span></span
        >
      </div>
    </div>

    <!-- Star Profile Graph: takes whatever height is left, the canvas follows its measured size -->
    <div
      ref="graphEl"
      class="relative flex-1 min-h-0 bg-black rounded border border-line-strong overflow-hidden"
      :class="compact ? 'mx-1 my-0.5' : 'mx-2 my-1'"
    >
      <canvas
        ref="profileCanvas"
        :width="canvasWidth"
        :height="canvasHeight"
        class="absolute inset-0 block w-full h-full"
      ></canvas>

      <!-- Crosshair overlay -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute left-1/2 top-0 bottom-0 w-px bg-status-ok opacity-50"></div>
        <div class="absolute top-1/2 left-0 right-0 h-px bg-status-ok opacity-50"></div>
      </div>
    </div>

    <!-- Footer -->
    <div
      class="shrink-0 text-content-muted text-center truncate"
      :class="compact ? 'px-1 pb-0.5' : 'px-2 pb-1'"
    >
      Mass: {{ massValue }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useGuiderStore } from '@/store/guiderStore';

const guiderStore = useGuiderStore();
const profileCanvas = ref(null);

const starInfo = computed(() => guiderStore.phd2StarInfo);

// Tiles narrower than this drop the title and use smaller text
const COMPACT_WIDTH = 160;

const rootEl = ref(null);
const graphEl = ref(null);
const compact = ref(false);
const canvasWidth = ref(200);
const canvasHeight = ref(100);
let resizeObserver = null;

// Size the canvas drawing surface to the space the flex layout actually leaves for it,
// so header and footer always stay visible however small the tile gets.
const updateSizes = () => {
  if (rootEl.value) compact.value = rootEl.value.clientWidth < COMPACT_WIDTH;
  if (!graphEl.value) return;
  const width = Math.max(1, Math.floor(graphEl.value.clientWidth));
  const height = Math.max(1, Math.floor(graphEl.value.clientHeight));
  if (width === canvasWidth.value && height === canvasHeight.value) return;
  canvasWidth.value = width;
  canvasHeight.value = height;
  // Changing the canvas size clears it
  drawStarProfile();
};

const snrValue = computed(() => {
  if (!starInfo.value?.SNR) return 'N/A';
  return starInfo.value.SNR.toFixed(1);
});

const hfdValue = computed(() => {
  if (!starInfo.value?.HFD) return 'N/A';
  return starInfo.value.HFD.toFixed(2);
});

const massValue = computed(() => {
  if (!starInfo.value?.StarMass) return 'N/A';
  return starInfo.value.StarMass.toLocaleString();
});

// Color coding for SNR (Signal-to-Noise Ratio)
const snrClass = computed(() => {
  const snr = starInfo.value?.SNR;
  if (!snr) return 'text-content-muted';

  if (snr >= 50) return 'text-status-ok'; // Excellent
  if (snr >= 20) return 'text-content'; // Good
  if (snr >= 10) return 'text-status-warn'; // Fair
  return 'text-status-danger'; // Poor
});

// Color coding for HFD (Half Flux Diameter) - smaller is better for stars
const hfdClass = computed(() => {
  const hfd = starInfo.value?.HFD;
  if (!hfd) return 'text-content-muted';

  if (hfd <= 2.0) return 'text-status-ok'; // Excellent focus
  if (hfd <= 3.0) return 'text-content'; // Good focus
  if (hfd <= 4.0) return 'text-status-warn'; // Fair focus
  return 'text-status-danger'; // Poor focus
});

// Simuliere Sternprofil basierend auf HFD und SNR
const drawStarProfile = async () => {
  await nextTick();

  if (!profileCanvas.value) return;

  const canvas = profileCanvas.value;
  const ctx = canvas.getContext('2d');

  // Canvas löschen
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value);

  // Nur Kurve zeichnen wenn StarInfo Daten vorhanden sind
  if (!starInfo.value?.HFD || !starInfo.value?.SNR || !starInfo.value?.StarMass) {
    // Grid-Linien zeichnen auch ohne Daten
    drawGrid(ctx);
    return;
  }

  const hfd = starInfo.value.HFD;
  const mass = starInfo.value.StarMass;
  // Keep the curve readable on small canvases: margins shrink with the height
  const margin = Math.min(10, Math.round(canvasHeight.value / 8));

  // Sternprofil simulieren (Gaußsche Kurve)
  const centerX = canvasWidth.value / 2;

  // Intensitätsprofil zeichnen
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 1;

  // Nur horizontales Profil - steiler ansteigend mit flacher Spitze wie in PHD2
  ctx.beginPath();
  for (let x = 10; x < canvasWidth.value - 10; x += 2) {
    const distance = Math.abs(x - centerX);
    const widthFactor = Math.max(hfd * 4, 25); // Deutlich breiter

    let intensity;
    if (distance < widthFactor * 0.3) {
      // Flache Spitze in der Mitte
      intensity = 1.0;
    } else if (distance < widthFactor * 0.8) {
      // Steiler Abfall
      const normalizedDist = (distance - widthFactor * 0.3) / (widthFactor * 0.5);
      intensity = 1.0 - Math.pow(normalizedDist, 0.5); // Wurzelfunktion für steileren Abfall
    } else {
      // Sanfter Übergang zum Hintergrund
      const normalizedDist = (distance - widthFactor * 0.8) / (widthFactor * 0.7);
      intensity = Math.max(0, 0.3 * Math.exp(-normalizedDist * 3));
    }

    // Quantisierung für pixeligeren Look
    intensity = Math.round(intensity * 12) / 12;

    const scaledIntensity =
      intensity * Math.max(0, canvasHeight.value - 2 * margin) * (Math.log10(mass) / 6);
    const y = canvasHeight.value - margin - scaledIntensity;

    if (x === 10) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Grid-Linien zeichnen
  drawGrid(ctx);
};

// Separate Funktion für Grid-Linien
const drawGrid = (ctx) => {
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 0.5;

  // Vertikale Grid-Linien
  for (let x = 10; x < canvasWidth.value; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x, canvasHeight.value - 10);
    ctx.stroke();
  }

  // Horizontale Grid-Linien
  for (let y = 10; y < canvasHeight.value; y += 15) {
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(canvasWidth.value - 10, y);
    ctx.stroke();
  }
};

// Watch für Änderungen der Star-Info und beim Laden
watch(starInfo, drawStarProfile, { deep: true });

// Auch bei showStarImage-Änderungen neu zeichnen
watch(() => guiderStore.phd2Connection?.IsConnected, drawStarProfile);

onMounted(() => {
  resizeObserver = new ResizeObserver(updateSizes);
  if (rootEl.value) resizeObserver.observe(rootEl.value);
  if (graphEl.value) resizeObserver.observe(graphEl.value);
  updateSizes();
  drawStarProfile();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>
