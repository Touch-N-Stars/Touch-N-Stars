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
        class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
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

      <!-- FOV und Rotation Steuerung (oben rechts) -->
      <div class="absolute top-3 right-3 z-10 flex gap-2">
        <!-- FOV Steuerung -->
        <div
          class="bg-gray-800/90 border border-gray-600 rounded-lg p-2 flex items-center space-x-2"
        >
          <button
            @click="adjustFov(-0.5)"
            class="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm font-bold transition-colors flex items-center justify-center"
          >
            -
          </button>
          <span class="text-xs text-gray-300 font-medium min-w-[2.5rem] text-center"
            >{{ framingStore.fov.toFixed(1) }}°</span
          >
          <button
            @click="adjustFov(0.5)"
            class="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm font-bold transition-colors flex items-center justify-center"
          >
            +
          </button>
        </div>
        <!-- Rotation Anzeige -->
        <div
          class="bg-gray-800/90 border min-w-14 border-gray-600 rounded-lg px-3 py-2 flex items-center justify-center"
        >
          <span class="text-xs text-gray-300 font-medium"
            >{{ Math.round(framingStore.rotationAngle) }}°</span
          >
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
      centerBoundingBox();
      framingStore.cameraX = x.value;
      framingStore.cameraY = y.value;
      framingStore.cameraRelativeX = 0.5;
      framingStore.cameraRelativeY = 0.5;
      debouncedImageReload();
      updateMoveable();
    }
  }, 300);
}

// FOV-Watcher: Nur Bild und Kamera-Box aktualisieren (KEINE Komponenten-Reload)
watch(
  () => framingStore.fov,
  async (newFov, oldFov) => {
    if (cameraFovX.value > 0 && newFov !== oldFov) {
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
      const deltaX = ((baseRA - framingStore.RAangle) * cosDec) / scaleDegPerPixel.value;
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

// Mosaic-Watcher: Bounding Box zentrieren wenn Mosaik-Modus (de)aktiviert wird
watch(
  () => framingStore.isMosaicMode,
  (active) => {
    if (active) {
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

    framingStore.fov = Math.round(newFov * 10) / 10; // Auf 0.1 runden
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

function calculateRaDec() {
  // Effektive Abmessungen (Mosaikgitter oder einzelne Kamera)
  const effectiveW = framingStore.isMosaicMode ? mosaicTotalSize().w : framingStore.camWidth;
  const effectiveH = framingStore.isMosaicMode ? mosaicTotalSize().h : framingStore.camHeight;

  // Center des Ziel-Rechtecks (Mitte des Mosaik-Gitters oder der einzelnen Kamera)
  const targetCenterX = x.value + effectiveW / 2;
  const targetCenterY = y.value + effectiveH / 2;

  // Container-Mitte
  const centerX = framingStore.containerWidth / 2;
  const centerY = framingStore.containerHeight / 2;

  // Abweichung in Pixel
  const deltaX = targetCenterX - centerX;
  const deltaY = centerY - targetCenterY;

  // Offset DEC
  const offsetDec = deltaY * scaleDegPerPixel.value;

  // RA-Korrektur (cos(dec))
  let cosDec = Math.cos((baseDec * Math.PI) / 180);
  if (Math.abs(cosDec) < 1e-8) cosDec = 1e-8;
  const offsetRA = (deltaX * scaleDegPerPixel.value) / cosDec;

  // Aktuelle Koords
  const currentRA = baseRA - offsetRA;
  const currentDec = baseDec + offsetDec;

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
  framingStore.fov = Math.max(0.5, Math.min(50, Math.round(newValue * 10) / 10));
}
</script>

<style scoped></style>
