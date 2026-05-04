<template>
  <div></div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { apiStore } from '@/store/store';
import { useStellariumStore } from '@/store/stellariumStore';
import { useFramingStore } from '@/store/framingStore';
import {
  computeCameraFovDeg,
  buildFovPolygonGeoJSON,
  EMPTY_FEATURE_COLLECTION,
} from '@/utils/fovGeometry';

const store = apiStore();
const stellariumStore = useStellariumStore();
const framingStore = useFramingStore();

const fovLayer = ref(null);
const viewFov = ref(null);
let rafId = null;
let lastViewRa = null;
let lastViewDec = null;

const cameraFov = computed(() => {
  const pixelSizeMicrons = store.profileInfo?.CameraSettings?.PixelSize;
  const focalLengthMm = store.profileInfo?.TelescopeSettings?.FocalLength;
  const sensorWidthPx = store.profileInfo?.FramingAssistantSettings?.CameraWidth;
  const sensorHeightPx = store.profileInfo?.FramingAssistantSettings?.CameraHeight;
  return computeCameraFovDeg({
    pixelSizeMicrons,
    focalLengthMm,
    sensorWidthPx,
    sensorHeightPx,
  });
});

const rotationDeg = computed(() => {
  return Number(framingStore.rotationAngle ?? 0);
});

function updateViewFov() {
  const stel = stellariumStore.stel;
  if (!stel || !viewFov.value) return;
  const fov = cameraFov.value;
  if (!fov.fovX || !fov.fovY) {
    viewFov.value.data = EMPTY_FEATURE_COLLECTION;
    lastViewRa = null;
    lastViewDec = null;
    return;
  }
  const icrfVec = stel.convertFrame(stel.observer, 'VIEW', 'ICRF', [0, 0, -1]);
  const raDecRad = stel.c2s(icrfVec);
  let raDeg = raDecRad[0] * stel.R2D;
  const decDeg = raDecRad[1] * stel.R2D;
  if (raDeg < 0) raDeg += 360;
  if (
    lastViewRa !== null &&
    Math.abs(lastViewRa - raDeg) < 0.005 &&
    Math.abs(lastViewDec - decDeg) < 0.005
  ) {
    return;
  }
  lastViewRa = raDeg;
  lastViewDec = decDeg;
  console.log('[StellariumFovFrame] applying rotationDeg =', rotationDeg.value);
  viewFov.value.data = buildFovPolygonGeoJSON({
    raDeg,
    decDeg,
    fovXDeg: fov.fovX,
    fovYDeg: fov.fovY,
    rotationDeg: rotationDeg.value,
    fillColor: '#facc15',
    fillOpacity: 0,
    strokeColor: '#facc15',
    strokeOpacity: 0.9,
    strokeWidth: 1.5,
  });
}

function viewFovLoop() {
  updateViewFov();
  rafId = requestAnimationFrame(viewFovLoop);
}

watch(
  () => [cameraFov.value.fovX, cameraFov.value.fovY, rotationDeg.value],
  () => {
    lastViewRa = null;
    lastViewDec = null;
    updateViewFov();
  }
);

onMounted(() => {
  const stel = stellariumStore.stel;
  if (!stel) return;

  fovLayer.value = stel.createLayer({ id: 'fovFrameLayer', z: 8, visible: true });
  viewFov.value = stel.createObj('geojson', { id: 'viewFovBox' });
  fovLayer.value.add(viewFov.value);
  viewFov.value.data = EMPTY_FEATURE_COLLECTION;

  rafId = requestAnimationFrame(viewFovLoop);
});

onBeforeUnmount(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  viewFov.value = null;
  fovLayer.value = null;
});
</script>
