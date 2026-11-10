<template>
  <div ref="stageRef" class="framing-stage w-full h-full flex items-center justify-center">
    <div
      v-if="isLoading"
      class="flex items-center justify-center"
      :style="{
        width: framingStore.containerWidth ? `${framingStore.containerWidth}px` : '100%',
        height: framingStore.containerHeight ? `${framingStore.containerHeight}px` : '100%',
      }"
    >
      <div
        class="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"
      ></div>
    </div>
    <div
      v-show="!isLoading"
      id="fov"
      class="relative overflow-hidden"
      :style="{
        width: `${framingStore.containerWidth}px`,
        height: `${framingStore.containerHeight}px`,
        position: 'relative',
      }"
      ref="containerRef"
    >
      <!-- TargetPic als Hintergrund -->
      <img class="absolute inset-0" :src="targetPic" />

      <!-- Verschiebbares / drehbares Ziel-Element (nur für Moveable Tracking) -->
      <div ref="targetRef" :style="mosaicTargetStyle"></div>

      <!-- Pan-Steuerung (oben links) -->
      <div class="absolute top-3 left-3 z-10">
        <div
          class="bg-surface-1/90 border border-line-strong rounded-lg p-1 grid grid-cols-3 grid-rows-3 gap-1"
        >
          <div></div>
          <button
            @click="pan(0, 1)"
            aria-label="Pan up"
            class="w-8 h-8 bg-surface-3 hover:bg-surface-2 rounded text-white text-sm font-bold transition-colors flex items-center justify-center"
          >
            ↑
          </button>
          <div></div>
          <button
            @click="pan(-1, 0)"
            aria-label="Pan left"
            class="w-8 h-8 bg-surface-3 hover:bg-surface-2 rounded text-white text-sm font-bold transition-colors flex items-center justify-center"
          >
            ←
          </button>
          <div></div>
          <button
            @click="pan(1, 0)"
            aria-label="Pan right"
            class="w-8 h-8 bg-surface-3 hover:bg-surface-2 rounded text-white text-sm font-bold transition-colors flex items-center justify-center"
          >
            →
          </button>
          <div></div>
          <button
            @click="pan(0, -1)"
            aria-label="Pan down"
            class="w-8 h-8 bg-surface-3 hover:bg-surface-2 rounded text-white text-sm font-bold transition-colors flex items-center justify-center"
          >
            ↓
          </button>
          <div></div>
        </div>
      </div>

      <!-- FOV und Rotation Steuerung (oben rechts) -->
      <div class="absolute top-3 right-3 z-10 flex gap-2">
        <!-- FOV Steuerung -->
        <div
          class="bg-surface-1/90 border border-line-strong rounded-lg p-2 flex items-center space-x-2"
        >
          <button
            @click="adjustFov(-1)"
            class="w-8 h-8 bg-surface-3 hover:bg-surface-2 rounded text-white text-sm font-bold transition-colors flex items-center justify-center"
          >
            -
          </button>
          <span class="text-xs text-content font-medium min-w-[2.5rem] text-center"
            >{{ Math.round(framingStore.fov) }}°</span
          >
          <button
            @click="adjustFov(1)"
            class="w-8 h-8 bg-surface-3 hover:bg-surface-2 rounded text-white text-sm font-bold transition-colors flex items-center justify-center"
          >
            +
          </button>
        </div>
        <!-- Rotation readout: the target angle and, once available, the angle
             measured by the last plate solve -->
        <div
          class="bg-surface-1/90 border min-w-14 border-line-strong rounded-lg px-3 py-2 flex flex-col items-center justify-center leading-tight"
        >
          <span class="text-xs text-content font-medium"
            >{{ Math.round(framingStore.rotationAngle) }}°</span
          >
          <span
            v-if="framingStore.hasSolvedRotation"
            class="text-[10px] text-accent font-medium whitespace-nowrap"
            :title="$t('components.framing.solvedRotation.tooltip')"
            >{{ $t('components.framing.solvedRotation.short') }}
            {{ Math.round(framingStore.solvedRotationAngle) }}°</span
          >
        </div>
      </div>

      <!-- RA/DEC Anzeige (Mitte der Kamera-Box, debug/diagnostik) -->
      <div class="absolute bottom-3 right-3 z-10">
        <div
          class="bg-surface-1/90 border border-line-strong rounded-lg px-3 py-2 font-mono text-xs text-content leading-tight text-right"
        >
          <div>RA: {{ framingStore.RAangleString }}</div>
          <div>DEC: {{ framingStore.DECangleString }}</div>
        </div>
      </div>

      <!-- Mosaic panel overlay -->
      <svg
        v-if="framingStore.isMosaicMode"
        class="absolute inset-0 pointer-events-none"
        :width="framingStore.containerWidth"
        :height="framingStore.containerHeight"
        style="z-index: 3"
      >
        <g
          :transform="`translate(${mosaicSvgOffset.x}, ${mosaicSvgOffset.y}) rotate(${rotationAngleVisu}, ${framingStore.containerWidth / 2}, ${framingStore.containerHeight / 2})`"
        >
          <g v-for="panel in mosaicPanels" :key="panel.label">
            <rect
              :x="panel.screenX - framingStore.camWidth / 2"
              :y="panel.screenY - framingStore.camHeight / 2"
              :width="framingStore.camWidth"
              :height="framingStore.camHeight"
              fill="rgba(59,130,246,0.12)"
              stroke="#3b82f6"
              stroke-width="1.5"
            />
            <text
              :x="panel.screenX"
              :y="panel.screenY"
              text-anchor="middle"
              dominant-baseline="middle"
              fill="white"
              font-size="11"
            >
              {{ panel.label }}
            </text>
          </g>
        </g>
      </svg>

      <!-- Actual frame: the angle of the last plate solve. Sits concentric
           with the target frame so that rotating the target frame makes the
           difference visible. -->
      <div
        class="absolute pointer-events-none"
        :class="
          framingStore.hasSolvedRotation
            ? 'tns-actual-frame'
            : 'tns-actual-frame tns-actual-frame--unsolved'
        "
        :style="actualFrameStyle"
      ></div>

      <!-- Moveable-->
      <Moveable
        ref="moveableRef"
        :target="targetRef"
        :draggable="true"
        :rotatable="true"
        @drag="onDrag"
        @rotate="onRotate"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import Moveable from 'vue3-moveable';
import { useFramingStore } from '@/store/framingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';

const framingStore = useFramingStore();
const settingsStore = useSettingsStore();
const store = apiStore();
const isLoading = ref(true);
const targetPic = ref(null);
const scaleDegPerPixel = ref(0.004); // Grad pro Pixel
const cameraFovX = ref(0); // Echter Kamera-FOV in Grad (fest)
const cameraFovY = ref(0); // Echter Kamera-FOV in Grad (fest)
let baseRA = framingStore.RAangle;
let baseDec = framingStore.DECangle;
const x = ref(0);
const y = ref(0);
const containerRef = ref(null);
const stageRef = ref(null);
const targetRef = ref(null);
const moveableRef = ref(null);
const rotationAngleVisu = ref(0);
let resizeObserver = null;

// ── Mosaic helpers ──────────────────────────────────────────────────────────
function computeMosaicPanels(store) {
  const overlap = store.mosaicOverlap / 100;
  const scale = store.fov / store.containerWidth;
  const fovX = store.camWidth * scale;
  const fovY = store.camHeight * scale;
  const stepRa = fovX * (1 - overlap);
  const stepDec = fovY * (1 - overlap);
  let cosDec = Math.cos((store.DECangle * Math.PI) / 180);
  if (Math.abs(cosDec) < 1e-8) cosDec = 1e-8;

  const centerRA = store.RAangle;
  const centerDec = store.DECangle;
  const centerRot = store.rotationAngle;
  const centerX = store.containerWidth / 2;
  const centerY = store.containerHeight / 2;
  const panels = [];

  for (let row = 0; row < store.mosaicRows; row++) {
    for (let col = 0; col < store.mosaicCols; col++) {
      const dc = col - (store.mosaicCols - 1) / 2;
      const dr = row - (store.mosaicRows - 1) / 2;
      const panelRA = centerRA - (dc * stepRa) / cosDec;
      const panelDec = centerDec - dr * stepDec;
      const panelRot = centerRot;
      panels.push({
        label: `${col + 1}-${row + 1}`,
        screenX: centerX + dc * (store.camWidth * (1 - overlap)),
        screenY: centerY + dr * (store.camHeight * (1 - overlap)),
        ra: panelRA,
        dec: panelDec,
        rotation: panelRot,
      });
    }
  }
  return panels;
}

const mosaicPanels = computed(() =>
  framingStore.isMosaicMode ? computeMosaicPanels(framingStore) : []
);

// Sky-Koordinaten der Panels aus den TATSÄCHLICH gerenderten Pixelpositionen
// ableiten (Basis-Raster + SVG-Rotation um die Container-Mitte + Drag-Offset)
// und im Store ablegen. So entsprechen gespeicherte Favoriten exakt dem Overlay.
function updateMosaicPanelCoords() {
  if (!framingStore.isMosaicMode) {
    framingStore.mosaicPanelCoords = [];
    return;
  }
  const cx = framingStore.containerWidth / 2;
  const cy = framingStore.containerHeight / 2;
  // SVG dreht um rotationAngleVisu (= 360 − rotationAngle) im Uhrzeigersinn.
  const ang = (rotationAngleVisu.value * Math.PI) / 180;
  const cosA = Math.cos(ang);
  const sinA = Math.sin(ang);
  const off = mosaicSvgOffset.value;

  framingStore.mosaicPanelCoords = mosaicPanels.value.map((panel) => {
    // Position relativ zur Container-Mitte
    const px = panel.screenX - cx;
    const py = panel.screenY - cy;
    // SVG-Rotation (clockwise, Y nach unten): Standard-Rotationsmatrix
    const rx = px * cosA - py * sinA;
    const ry = px * sinA + py * cosA;
    // zurück in absolute Container-Koordinaten + Drag-Offset
    const finalX = cx + rx + off.x;
    const finalY = cy + ry + off.y;
    const { ra, dec } = pixelToRaDec(finalX, finalY);
    return { label: panel.label, ra, dec, rotation: framingStore.rotationAngle };
  });
}

function mosaicTotalSize() {
  const ov = framingStore.mosaicOverlap / 100;
  return {
    w: framingStore.camWidth + (framingStore.mosaicCols - 1) * framingStore.camWidth * (1 - ov),
    h: framingStore.camHeight + (framingStore.mosaicRows - 1) * framingStore.camHeight * (1 - ov),
  };
}

const mosaicTargetStyle = computed(() => {
  if (!framingStore.isMosaicMode) {
    return {
      width: `${framingStore.camWidth}px`,
      height: `${framingStore.camHeight}px`,
      transform: `translate(${x.value}px, ${y.value}px) rotate(${rotationAngleVisu.value}deg)`,
      zIndex: 2,
    };
  }
  const { w, h } = mosaicTotalSize();
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `translate(${x.value}px, ${y.value}px) rotate(${rotationAngleVisu.value}deg)`,
    zIndex: 2,
    opacity: 0,
  };
});

// ── Actual frame (last plate solve) ─────────────────────────────────────────
// Concentric with the target frame (in mosaic mode too, where the target frame
// is the whole bounding box), but always camera-sized and drawn at the measured
// angle. Without a solve it falls back to the target angle; its own style is
// what marks it as "not measured yet".
const actualFrameStyle = computed(() => {
  const effectiveW = framingStore.isMosaicMode ? mosaicTotalSize().w : framingStore.camWidth;
  const effectiveH = framingStore.isMosaicMode ? mosaicTotalSize().h : framingStore.camHeight;
  const centerX = x.value + effectiveW / 2;
  const centerY = y.value + effectiveH / 2;
  const angle = framingStore.hasSolvedRotation
    ? framingStore.solvedRotationAngle
    : framingStore.rotationAngle;
  return {
    width: `${framingStore.camWidth}px`,
    height: `${framingStore.camHeight}px`,
    left: `${centerX - framingStore.camWidth / 2}px`,
    top: `${centerY - framingStore.camHeight / 2}px`,
    transform: `rotate(${(360 - angle) % 360}deg)`,
    zIndex: 4,
  };
});

// Visuelle Verschiebung des SVG-Overlays während des Drags
const mosaicSvgOffset = computed(() => {
  if (!framingStore.isMosaicMode) return { x: 0, y: 0 };
  const { w, h } = mosaicTotalSize();
  return {
    x: x.value + w / 2 - framingStore.containerWidth / 2,
    y: y.value + h / 2 - framingStore.containerHeight / 2,
  };
});

// ─────────────────────────────────────────────────────────────────────────────

onMounted(async () => {
  // Initial: Stage messen, Container-Größe bestimmen (vor dem Fetch,
  // damit das Bild sofort in passender Auflösung geladen werden kann)
  await nextTick();
  measureStage();

  // ResizeObserver starten, um Container-Größe an Stage anzupassen
  if (stageRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      handleStageResize();
    });
    resizeObserver.observe(stageRef.value);
  }

  await runInit();
});

// Cleanup beim Unmount
onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

// Reload-Key: erlaubt externen Komponenten (z.B. FitsPlateSolve),
// ein vollständiges Neu-Initialisieren auszulösen, auch wenn die
// Framing-Seite bereits aktiv ist.
watch(
  () => framingStore.framingReloadKey,
  async () => {
    isLoading.value = true;
    baseRA = framingStore.RAangle;
    baseDec = framingStore.DECangle;
    await runInit();
  }
);

async function runInit() {
  await fetchFramingInfo();

  // Einmalig echten Kamera-FOV berechnen (basierend auf Hardware)
  calculateRealCameraFov();

  // Init rotationAngleVisu
  rotationAngleVisu.value = 360 - framingStore.rotationAngle;

  // Sinnvollen Start-FOV nur beim allerersten Laden berechnen
  if (!framingStore.initialFovSet) {
    ensureReasonableStartFov();
    framingStore.initialFovSet = true;
  }

  // Container anpassen falls nötig (OHNE FOV zu ändern)
  adjustContainerIfNeeded();

  // Kamera-Box Größe basierend auf User-FOV berechnen
  updateCameraBoxSize();

  // Bild abrufen
  await getTargetPic();

  // Bounding Box in die Mitte setzen (Mosaik-Gitter oder einzelne Kamera)
  centerBoundingBox();

  // Position im Store speichern
  framingStore.cameraX = x.value;
  framingStore.cameraY = y.value;
  framingStore.cameraRelativeX = 0.5;
  framingStore.cameraRelativeY = 0.5;

  await nextTick();
  isLoading.value = false;
  // Moveable aktualisieren, nachdem das Container-Element sichtbar ist
  updateMoveable();
}

function centerBoundingBox() {
  if (framingStore.isMosaicMode) {
    const { w, h } = mosaicTotalSize();
    x.value = framingStore.containerWidth / 2 - w / 2;
    y.value = framingStore.containerHeight / 2 - h / 2;
  } else {
    x.value = framingStore.containerWidth / 2 - framingStore.camWidth / 2;
    y.value = framingStore.containerHeight / 2 - framingStore.camHeight / 2;
  }
}

function computeContainerDims() {
  const el = stageRef.value;
  const fallbackW = framingStore.containerWidth || 500;
  const fallbackH = framingStore.containerHeight || 500;
  if (!el) return { w: fallbackW, h: fallbackH };
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { w: fallbackW, h: fallbackH };
  // NINA's targetpic-API erwartet ein quadratisches FOV — wir messen die Stage,
  // nehmen die kleinere Dimension und nutzen sie für Width und Height. Das hält
  // die FOV-Mathematik exakt (1° = fov°/containerSize · 1px in beiden Achsen)
  // und verhindert, dass das Bild von NINA verzerrt zurückgegeben wird.
  const side = Math.max(Math.floor(Math.min(rect.width, rect.height) / 20) * 20, 200);
  return { w: side, h: side };
}

function measureStage() {
  const { w, h } = computeContainerDims();
  framingStore.containerWidth = w;
  framingStore.containerHeight = h;
  framingStore.containerSize = Math.min(w, h);
}

let resizeTimeout;
function handleStageResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const { w, h } = computeContainerDims();
    if (w !== framingStore.containerWidth || h !== framingStore.containerHeight) {
      framingStore.containerWidth = w;
      framingStore.containerHeight = h;
      framingStore.containerSize = Math.min(w, h);
      updateCameraBoxSize();
      const relX = framingStore.cameraRelativeX ?? 0.5;
      const relY = framingStore.cameraRelativeY ?? 0.5;
      const effectiveW = framingStore.isMosaicMode ? mosaicTotalSize().w : framingStore.camWidth;
      const effectiveH = framingStore.isMosaicMode ? mosaicTotalSize().h : framingStore.camHeight;
      x.value = relX * framingStore.containerWidth - effectiveW / 2;
      y.value = relY * framingStore.containerHeight - effectiveH / 2;
      framingStore.cameraX = x.value;
      framingStore.cameraY = y.value;
      debouncedImageReload();
      updateMoveable();
    }
  }, 300);
}

// Mindest-FOV: Wert, ab dem das Framing-Rechteck (bzw. Mosaikgitter) gerade
// noch komplett in den Container passt. Verhindert den Bug-Zustand "Frame
// größer als Container", in dem die Clamp-Logik im FOV-Watcher die Position
// in die Ecke ziehen und RA/DEC mit einer dezentrierten Position überschreiben
// würde — was beim Rauszoomen zu versetzter Position führte.
function computeMinFov() {
  if (
    cameraFovX.value <= 0 ||
    cameraFovY.value <= 0 ||
    framingStore.containerWidth <= 0 ||
    framingStore.containerHeight <= 0
  ) {
    return 0;
  }

  let effDegW;
  let effDegH;
  if (framingStore.isMosaicMode) {
    const { w, h } = mosaicTotalSize();
    effDegW = w * scaleDegPerPixel.value;
    effDegH = h * scaleDegPerPixel.value;
  } else {
    effDegW = cameraFovX.value;
    effDegH = cameraFovY.value;
  }

  const minFovForWidth = effDegW;
  const minFovForHeight = (effDegH * framingStore.containerWidth) / framingStore.containerHeight;
  return Math.max(minFovForWidth, minFovForHeight);
}

// FOV-Watcher: Nur Bild und Kamera-Box aktualisieren (KEINE Komponenten-Reload)
watch(
  () => framingStore.fov,
  async (newFov, oldFov) => {
    if (cameraFovX.value > 0 && newFov !== oldFov) {
      // Untergrenze durchsetzen, damit Frame nie größer als Container wird
      const minAllowedFov = computeMinFov();
      if (minAllowedFov > 0 && newFov < minAllowedFov) {
        framingStore.fov = Math.ceil(minAllowedFov);
        return;
      }

      // Kamera-Box-Größe und Skala neu berechnen
      updateCameraBoxSize();

      // Effektive Abmessungen (Mosaikgitter oder einzelne Kamera)
      const effectiveW = framingStore.isMosaicMode ? mosaicTotalSize().w : framingStore.camWidth;
      const effectiveH = framingStore.isMosaicMode ? mosaicTotalSize().h : framingStore.camHeight;

      // Pixelposition aus aktuellem RA/DEC + neuer Skala neu berechnen.
      // So bleibt das Rechteck auf demselben Himmelsausschnitt; nur seine
      // Größe (und damit die Bildschirm-Position relativ zum Container) ändert sich.
      let cosDec = Math.cos((baseDec * Math.PI) / 180);
      if (Math.abs(cosDec) < 1e-8) cosDec = 1e-8;
      // RA-Differenz auf kürzesten Winkelabstand (-180…180) normalisieren,
      // sonst entsteht an der 0°/360°-Grenze ein riesiger Sprung.
      let raDiff = ((baseRA - framingStore.RAangle + 540) % 360) - 180;
      const deltaX = (raDiff * cosDec) / scaleDegPerPixel.value;
      const deltaY = (framingStore.DECangle - baseDec) / scaleDegPerPixel.value;
      const targetCenterX = framingStore.containerWidth / 2 + deltaX;
      const targetCenterY = framingStore.containerHeight / 2 - deltaY;
      x.value = targetCenterX - effectiveW / 2;
      y.value = targetCenterY - effectiveH / 2;

      // Wenn das Rechteck durch den FOV-Wechsel aus dem Container heraus
      // wandert (z.B. starkes Hineinzoomen nach vorherigem Drag), klemmen.
      let clamped = false;
      if (x.value < 0) {
        x.value = 0;
        clamped = true;
      }
      if (y.value < 0) {
        y.value = 0;
        clamped = true;
      }
      if (x.value > framingStore.containerWidth - effectiveW) {
        x.value = framingStore.containerWidth - effectiveW;
        clamped = true;
      }
      if (y.value > framingStore.containerHeight - effectiveH) {
        y.value = framingStore.containerHeight - effectiveH;
        clamped = true;
      }

      // Position im Store speichern (absolut und relativ)
      framingStore.cameraX = x.value;
      framingStore.cameraY = y.value;
      framingStore.cameraRelativeX = (x.value + effectiveW / 2) / framingStore.containerWidth;
      framingStore.cameraRelativeY = (y.value + effectiveH / 2) / framingStore.containerHeight;

      // Nach Klemmen RA/DEC aktualisieren, damit Position und Koordinaten konsistent bleiben
      if (clamped) {
        calculateRaDec();
      }

      // Nur Hintergrundbild neu laden (mit Debounce)
      debouncedImageReload();

      // Moveable manuell aktualisieren damit der blaue Rahmen neu gerendert wird
      updateMoveable();
    }
  }
);

// Rotation-Watcher: Moveable-Rahmen aktualisieren wenn Winkel sich ändert
watch(
  () => framingStore.rotationAngle,
  (newAngle) => {
    rotationAngleVisu.value = 360 - newAngle;
    updateMoveable();
  }
);

// Mosaik-Panel-Koordinaten neu berechnen, sobald sich Position, Rotation, FOV
// oder Gitter-Parameter ändern. Hält framingStore.mosaicPanelCoords aktuell,
// damit beim Speichern als Favorit exakt die sichtbaren Panel-Zentren landen.
watch(
  () => [
    x.value,
    y.value,
    rotationAngleVisu.value,
    framingStore.fov,
    framingStore.isMosaicMode,
    framingStore.mosaicCols,
    framingStore.mosaicRows,
    framingStore.mosaicOverlap,
    framingStore.RAangle,
    framingStore.DECangle,
  ],
  () => updateMosaicPanelCoords(),
  { immediate: true }
);

// Mosaic-Watcher: Bounding Box zentrieren wenn Mosaik-Modus (de)aktiviert wird
watch(
  () => framingStore.isMosaicMode,
  (active) => {
    if (active) {
      // FOV anheben falls das Mosaikgitter bei aktuellem FOV größer als der
      // Container wäre — der FOV-Watcher übernimmt dann die Neuberechnung.
      const minAllowedFov = computeMinFov();
      if (minAllowedFov > 0 && framingStore.fov < minAllowedFov) {
        framingStore.fov = Math.ceil(minAllowedFov);
        return;
      }
      const { w, h } = mosaicTotalSize();
      x.value = framingStore.containerWidth / 2 - w / 2;
      y.value = framingStore.containerHeight / 2 - h / 2;
    } else {
      x.value = framingStore.containerWidth / 2 - framingStore.camWidth / 2;
      y.value = framingStore.containerHeight / 2 - framingStore.camHeight / 2;
    }
    framingStore.cameraRelativeX = 0.5;
    framingStore.cameraRelativeY = 0.5;
    nextTick(() => updateMoveable());
  }
);

let imageReloadTimeout;
function debouncedImageReload() {
  clearTimeout(imageReloadTimeout);
  imageReloadTimeout = setTimeout(async () => {
    await getTargetPic();
  }, 300);
}

// Moveable-Komponente manuell aktualisieren
function updateMoveable() {
  if (moveableRef.value) {
    // Kurz warten bis DOM-Updates abgeschlossen sind
    nextTick(() => {
      moveableRef.value.updateRect();
    });
  }
}

// Einmalig den echten Kamera-FOV berechnen (basierend auf Hardware)
function calculateRealCameraFov() {
  const sensorWidthPx = framingStore.framingInfo.CameraWidth;
  const sensorHeightPx = framingStore.framingInfo.CameraHeight;
  const pixelSizeM = store.profileInfo.CameraSettings.PixelSize / 1_000_000;
  const focalLengthM = store.profileInfo.TelescopeSettings.FocalLength / 1000;

  // Sensor-Größe
  const sensorWidthM = sensorWidthPx * pixelSizeM;
  const sensorHeightM = sensorHeightPx * pixelSizeM;

  // Echter Kamera-FOV in Grad (fest, ändert sich nie)
  cameraFovX.value = 2 * rad2deg(Math.atan(sensorWidthM / 2 / focalLengthM));
  cameraFovY.value = 2 * rad2deg(Math.atan(sensorHeightM / 2 / focalLengthM));
}

// Kamera-Box Größe basierend auf User-gewähltem Hintergrund-FOV berechnen
function updateCameraBoxSize() {
  // Skalierung basierend auf User-gewähltem Hintergrund-FOV.
  // Konvention: `fov` entspricht der horizontalen Ausdehnung (Width) in Grad;
  // Pixel sind auf dem Bildschirm quadratisch, daher gilt derselbe Maßstab
  // auch vertikal.
  scaleDegPerPixel.value = framingStore.fov / framingStore.containerWidth;

  // Kamera-Box in Pixeln (basierend auf echtem Kamera-FOV)
  const fovPxX = cameraFovX.value / scaleDegPerPixel.value;
  const fovPxY = cameraFovY.value / scaleDegPerPixel.value;

  framingStore.camWidth = fovPxX;
  framingStore.camHeight = fovPxY;
}

// Sinnvollen Start-FOV sicherstellen damit Kamera sichtbar ist
function ensureReasonableStartFov() {
  // Erst mal grob testen mit aktuellem FOV
  updateCameraBoxSize();

  // Wenn Kamera-Box mehr als 70% der kleineren Container-Dimension ausfüllt, FOV vergrößern
  const maxCamSize = Math.max(framingStore.camWidth, framingStore.camHeight);
  const minContainerDim = Math.min(framingStore.containerWidth, framingStore.containerHeight);
  const maxAllowedSize = minContainerDim * 0.7;

  // Nur anpassen wenn FOV wirklich zu klein ist UND kleiner als ein vernünftiger Mindestwert
  if (maxCamSize > maxAllowedSize && framingStore.fov < 5) {
    const targetCamSize = minContainerDim * 0.5;
    const scaleFactor = maxCamSize / targetCamSize;
    const requiredFov = framingStore.fov * scaleFactor;

    const newFov = Math.max(requiredFov, framingStore.fov * 1.5, 5); // Mindestens 5° oder 1.5x aktueller FOV

    framingStore.fov = Math.round(newFov); // Auf ganze Grad runden
  }
}

// Container anpassen falls Kamera-Box nicht passt (OHNE User-FOV zu ändern)
function adjustContainerIfNeeded() {
  // Zuerst mit aktuellem FOV testen
  updateCameraBoxSize();

  const minContainerWidth = framingStore.camWidth + 100;
  const minContainerHeight = framingStore.camHeight + 100;

  const stageEl = stageRef.value;
  const maxW = stageEl ? Math.floor(stageEl.clientWidth / 20) * 20 : framingStore.containerWidth;
  const maxH = stageEl ? Math.floor(stageEl.clientHeight / 20) * 20 : framingStore.containerHeight;

  if (framingStore.containerWidth < minContainerWidth) {
    const newW = Math.ceil(minContainerWidth / 20) * 20;
    if (newW <= maxW) framingStore.containerWidth = newW;
  }
  if (framingStore.containerHeight < minContainerHeight) {
    const newH = Math.ceil(minContainerHeight / 20) * 20;
    if (newH <= maxH) framingStore.containerHeight = newH;
  }
  framingStore.containerSize = Math.min(framingStore.containerWidth, framingStore.containerHeight);
  // User kann bewusst kleine FOV-Werte wählen, auch wenn die Kamera groß wird
}

let dragDebounceTimeout;
let rotateDebounceTimeout;

// Drag-Event von Moveable
function onDrag(e) {
  x.value += e.delta[0];
  y.value += e.delta[1];

  // Effektive Abmessungen (Mosaikgitter oder einzelne Kamera)
  const effectiveW = framingStore.isMosaicMode ? mosaicTotalSize().w : framingStore.camWidth;
  const effectiveH = framingStore.isMosaicMode ? mosaicTotalSize().h : framingStore.camHeight;

  // Begrenzung: nicht über Container hinausragen
  if (x.value < 0) x.value = 0;
  if (y.value < 0) y.value = 0;
  if (x.value > framingStore.containerWidth - effectiveW)
    x.value = framingStore.containerWidth - effectiveW;
  if (y.value > framingStore.containerHeight - effectiveH)
    y.value = framingStore.containerHeight - effectiveH;

  // Position im Store speichern für Reload-Persistenz
  framingStore.cameraX = x.value;
  framingStore.cameraY = y.value;

  // Relative Position berechnen und speichern (für bessere Wiederherstellung)
  const centerX = x.value + effectiveW / 2;
  const centerY = y.value + effectiveH / 2;
  framingStore.cameraRelativeX = centerX / framingStore.containerWidth;
  framingStore.cameraRelativeY = centerY / framingStore.containerHeight;

  // Debounced RA/DEC Berechnung
  clearTimeout(dragDebounceTimeout);
  dragDebounceTimeout = setTimeout(() => {
    calculateRaDec();
  }, 300);
}

// Rotate event from Moveable with debounce
function onRotate(e) {
  // Normalize angle to 0-360 range
  // Clockwise: 0 → 360
  // Counter-clockwise: 360 → 0
  const normalizedAngle = ((e.rotate % 360) + 360) % 360;
  framingStore.rotationAngle = (360 - normalizedAngle) % 360;
  rotationAngleVisu.value = normalizedAngle;
  //console.log( 'framingStore.rotationAngle',  framingStore.rotationAngle)

  // Debounced Berechnung
  clearTimeout(rotateDebounceTimeout);
  rotateDebounceTimeout = setTimeout(() => {
    calculateRaDec();
  }, 300);
}

async function getTargetPic() {
  try {
    // Bild bleibt auf dem Ursprungs-Target zentriert (baseRA/baseDec) — nicht
    // auf der per Drag verschobenen RAangle/DECangle. Sonst würde das Bild bei
    // FOV-/Resize-Reloads mitspringen und das Kamera-Rechteck wäre plötzlich
    // an einer anderen Stelle als zuvor.
    const ra = baseRA;
    const dec = baseDec;
    const width = framingStore.containerWidth;
    const height = framingStore.containerHeight;
    const fov = framingStore.fov;
    const useCache = settingsStore.framing.useNinaCache;

    updateCameraBoxSize();

    if (targetPic.value) {
      URL.revokeObjectURL(targetPic.value);
    }
    targetPic.value = await apiService.searchTargetPic(width, height, fov, ra, dec, useCache);
  } catch (error) {
    console.error('Error fetching image:', error);
  }
}

async function fetchFramingInfo() {
  try {
    const data = await apiService.framingAction('info');
    framingStore.framingInfo = data.Response;
  } catch (error) {
    console.error('Error fetching FramingInfo:', error);
  }
}

// Pixelposition (relativ zur Container-Mitte, Bildschirm-Koordinaten mit
// Y nach unten) → RA/DEC, ausgehend vom Bildzentrum baseRA/baseDec.
// Wird sowohl für die Kamera-Box als auch für einzelne Mosaik-Panels genutzt,
// damit gespeicherte Koordinaten exakt dem entsprechen, was im Overlay zu
// sehen ist (inkl. cos(dec)-Korrektur und korrekter Pol-Überquerung).
function pixelToRaDec(targetCenterX, targetCenterY) {
  const centerX = framingStore.containerWidth / 2;
  const centerY = framingStore.containerHeight / 2;
  const deltaX = targetCenterX - centerX;
  const deltaY = centerY - targetCenterY;

  // Roh-DEC (kann den Pol überschreiten)
  const rawDec = baseDec + deltaY * scaleDegPerPixel.value;

  // Pol-Überquerung: Schiebt man über den Pol hinaus (rawDec > 90 bzw. < -90),
  // läuft die Deklination auf der anderen Polseite zurück und die Rektaszension
  // dreht sich um 180°. Ohne diese Reflexion bleibt es am Pol "kleben"
  // (DEC=90, RA=0). Beispiel: rawDec = 92° → DEC = 88°, RA um 180° gedreht.
  let dec;
  let raFlip = 0;
  if (rawDec > 90) {
    dec = 180 - rawDec;
    raFlip = 180;
  } else if (rawDec < -90) {
    dec = -180 - rawDec;
    raFlip = 180;
  } else {
    dec = rawDec;
  }

  // RA-Korrektur (cos(dec)). Die 1/cos(dec)-Division ist physikalisch korrekt
  // (ein Pixel entspricht bei hoher Dec mehr RA-Grad), wird aber am exakten Pol
  // singulär: cos(±90°) = 0. Früher wurde cosDec hart auf 1e-8 geklemmt — das
  // verwandelte selbst eine Pixel-Rundung von <1px in einen RA-Sprung von ~200°.
  // Daher: am quasi-exakten Pol (Epsilon, da Math.cos(90°) ≈ 6e-17 ≠ 0) keinen
  // RA-Offset anwenden. cos(89°) ≈ 0.0175 liegt klar über dem Epsilon, sodass
  // Polnähe (Dec < 90) voll nutzbar bleibt.
  const cosDec = Math.cos((dec * Math.PI) / 180);
  const offsetRA = Math.abs(cosDec) < 1e-6 ? 0 : (deltaX * scaleDegPerPixel.value) / cosDec;
  const ra = (((baseRA - offsetRA + raFlip) % 360) + 360) % 360;

  return { ra, dec };
}

function calculateRaDec() {
  // Effektive Abmessungen (Mosaikgitter oder einzelne Kamera)
  const effectiveW = framingStore.isMosaicMode ? mosaicTotalSize().w : framingStore.camWidth;
  const effectiveH = framingStore.isMosaicMode ? mosaicTotalSize().h : framingStore.camHeight;

  // Center des Ziel-Rechtecks (Mitte des Mosaik-Gitters oder der einzelnen Kamera)
  const targetCenterX = x.value + effectiveW / 2;
  const targetCenterY = y.value + effectiveH / 2;

  const { ra: currentRA, dec: currentDec } = pixelToRaDec(targetCenterX, targetCenterY);

  // Als String speichern
  framingStore.RAangleString = degreesToHMS(currentRA);
  framingStore.DECangleString = degreesToDMS(currentDec);

  framingStore.RAangle = currentRA;
  framingStore.DECangle = currentDec;
}

function degreesToHMS(deg) {
  const totalHours = deg / 15;
  const h = Math.floor(totalHours);
  const remainingHours = totalHours - h;
  const totalMinutes = remainingHours * 60;
  const m = Math.floor(totalMinutes);
  const remainingMinutes = totalMinutes - m;
  const s = remainingMinutes * 60;

  const hStr = String(h);
  const mStr = String(m).padStart(2, '0');
  const sStr = s.toFixed(1).padStart(4, '0');

  return `${hStr}:${mStr}:${sStr}`;
}
function degreesToDMS(deg) {
  const sign = deg < 0 ? '-' : '+';
  deg = Math.abs(deg);
  const d = Math.floor(deg);
  const remainingDeg = deg - d;
  const totalMinutes = remainingDeg * 60;
  const m = Math.floor(totalMinutes);
  const remainingMinutes = totalMinutes - m;
  const s = remainingMinutes * 60;

  const dStr = String(d).padStart(2, '0');
  const mStr = String(m).padStart(2, '0');
  const sStr = s.toFixed(1).padStart(4, '0');

  return `${sign}${dStr}:${mStr}:${sStr}`;
}
function rad2deg(rad) {
  return rad * (180 / Math.PI);
}

// FOV Anpassung mit +/- Buttons
function adjustFov(delta) {
  const newValue = parseFloat(framingStore.fov) + delta;
  framingStore.fov = Math.max(1, Math.min(50, Math.round(newValue)));
}

// Bildausschnitt mit Pfeilen verschieben.
// dx: -1 = links, +1 = rechts.  dy: -1 = unten, +1 = oben.
// Schrittweite: 25 % des aktuellen FOV — proportional zur Sichtgröße,
// damit ein Klick bei hohem Zoom feine, bei niedrigem Zoom grobe Schritte
// macht.
function pan(dx, dy) {
  let cosDec = Math.cos((baseDec * Math.PI) / 180);
  if (Math.abs(cosDec) < 1e-8) cosDec = 1e-8;
  const stepDeg = framingStore.fov * 0.25;

  // Rechts auf dem Schirm = niedrigere RA (Astro-Konvention: East-Left,
  // wenn man nach oben in den Himmel schaut). Höhere DEC = nach oben.
  baseRA -= (dx * stepDeg) / cosDec;
  baseDec = Math.max(-89.9, Math.min(89.9, baseDec + dy * stepDeg));

  // RA in [0, 360) wrappen
  baseRA = ((baseRA % 360) + 360) % 360;

  // Frame-Sky-Koords aus aktueller Pixelposition + neuem baseRA/baseDec
  // neu berechnen, damit RAangle/DECangle mit dem verschobenen Bild
  // konsistent bleiben.
  calculateRaDec();

  // Hintergrundbild neu laden
  debouncedImageReload();
}
</script>

<style scoped>
/* Actual frame: dashed and clearly separated in colour from the blue Moveable
   target frame. Without a solve only faintly dotted - "not measured yet". */
.tns-actual-frame {
  border: 2px dashed rgb(103 232 249);
  box-sizing: border-box;
}

.tns-actual-frame--unsolved {
  border-style: dotted;
  border-color: rgba(148, 163, 184, 0.6);
}
</style>
