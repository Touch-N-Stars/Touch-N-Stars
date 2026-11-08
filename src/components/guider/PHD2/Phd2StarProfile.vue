<template>
  <div class="w-full h-full flex flex-col text-content text-xs overflow-hidden">
    <!-- Header mit Star-Werten -->
    <div class="px-2 pt-1 pb-1 shrink-0">
      <h3 class="font-semibold text-center mb-1">Star Profile</h3>
      <div class="flex justify-between">
        <span
          >SNR: <span :class="snrClass">{{ snrValue }}</span></span
        >
        <span
          >HFD: <span :class="hfdClass">{{ hfdValue }}</span></span
        >
      </div>
    </div>

    <!-- Star Profile Graph -->
    <div class="flex-1 flex items-center justify-center px-2">
      <div class="relative">
        <canvas
          ref="profileCanvas"
          :width="canvasWidth"
          :height="canvasHeight"
          class="border border-line-strong bg-black rounded"
        ></canvas>

        <!-- Crosshair overlay -->
        <div class="absolute inset-0 pointer-events-none">
          <div class="absolute bg-status-ok opacity-50" :style="crosshairVerticalStyle"></div>
          <div class="absolute bg-status-ok opacity-50" :style="crosshairHorizontalStyle"></div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-2 pb-1 shrink-0 text-content-muted text-center">Mass: {{ massValue }}</div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch, nextTick } from 'vue';
import { useGuiderStore } from '@/store/guiderStore';

const guiderStore = useGuiderStore();
const profileCanvas = ref(null);

const starInfo = computed(() => guiderStore.phd2StarInfo);

// Dynamische Canvas-Größe basierend auf Container
const canvasWidth = ref(200);
const canvasHeight = ref(150);

// Props für Container-Größe (falls von Parent übergeben)
const props = defineProps({
  containerWidth: {
    type: Number,
    default: 200,
  },
  containerHeight: {
    type: Number,
    default: 150,
  },
});

// Canvas-Größe an Container anpassen
const updateCanvasSize = () => {
  // Exakte Berechnung für verfügbaren Platz
  const availableWidth = props.containerWidth - 16; // 16px für seitliches Padding
  const availableHeight = props.containerHeight - 50; // 50px für Header + Footer

  // Canvas soll genau in den verfügbaren Platz passen
  canvasWidth.value = Math.max(100, availableWidth);
  canvasHeight.value = Math.max(60, availableHeight);
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

// Crosshair styles (centered)
const crosshairVerticalStyle = computed(() => ({
  left: `${canvasWidth.value / 2 - 0.5}px`,
  top: '0px',
  width: '1px',
  height: `${canvasHeight.value}px`,
}));

const crosshairHorizontalStyle = computed(() => ({
  left: '0px',
  top: `${canvasHeight.value / 2 - 0.5}px`,
  width: `${canvasWidth.value}px`,
  height: '1px',
}));

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

    const scaledIntensity = intensity * (canvasHeight.value - 30) * (Math.log10(mass) / 6);
    const y = canvasHeight.value - 10 - scaledIntensity;

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

// Watch für Änderungen der Container-Größe
watch([() => props.containerWidth, () => props.containerHeight], () => {
  updateCanvasSize();
  nextTick(() => drawStarProfile());
});

// Watch für Änderungen der Star-Info und beim Laden
watch(starInfo, drawStarProfile, { deep: true });

// Auch bei showStarImage-Änderungen neu zeichnen
watch(() => guiderStore.phd2Connection?.IsConnected, drawStarProfile);

onMounted(() => {
  updateCanvasSize();
  drawStarProfile();
});
</script>
