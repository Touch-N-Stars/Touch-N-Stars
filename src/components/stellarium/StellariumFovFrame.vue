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
const mountFov = ref(null);
const targetFov = ref(null);
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
  if (!store.rotatorInfo?.Connected) return 0;
  return Number(store.rotatorInfo?.MechanicalPosition ?? 0);
});

function updateMountFov() {
  if (!mountFov.value) return;
  const fov = cameraFov.value;
  if (!store.mountInfo?.Connected || !fov.fovX || !fov.fovY) {
    mountFov.value.data = EMPTY_FEATURE_COLLECTION;
    return;
  }
  const raDeg = Number(store.mountInfo.Coordinates?.RADegrees);
  const decDeg = Number(store.mountInfo.Coordinates?.Dec);
  if (!Number.isFinite(raDeg) || !Number.isFinite(decDeg)) {
    mountFov.value.data = EMPTY_FEATURE_COLLECTION;
    return;
  }
  mountFov.value.data = buildFovPolygonGeoJSON({
    raDeg,
    decDeg,
    fovXDeg: fov.fovX,
    fovYDeg: fov.fovY,
    rotationDeg: rotationDeg.value,
    fillColor: '#00ff00',
    fillOpacity: 0.1,
    strokeColor: '#00ff00',
    strokeOpacity: 1,
    strokeWidth: 1.5,
  });
}

function updateTargetFov() {
  if (!targetFov.value) return;
  const fov = cameraFov.value;
  const hasTarget = framingStore.selectedItem != null;
  const raDeg = Number(framingStore.RAangle);
  const decDeg = Number(framingStore.DECangle);
  if (!hasTarget || !fov.fovX || !fov.fovY || !Number.isFinite(raDeg) || !Number.isFinite(decDeg)) {
    targetFov.value.data = EMPTY_FEATURE_COLLECTION;
    return;
  }
  targetFov.value.data = buildFovPolygonGeoJSON({
    raDeg,
    decDeg,
    fovXDeg: fov.fovX,
    fovYDeg: fov.fovY,
    rotationDeg: framingStore.rotationAngle ?? rotationDeg.value,
    fillColor: '#22d3ee',
    fillOpacity: 0,
    strokeColor: '#22d3ee',
    strokeOpacity: 1,
    strokeWidth: 1.5,
  });
}

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
  () => [
    store.mountInfo?.Connected,
    store.mountInfo?.Coordinates?.RADegrees,
    store.mountInfo?.Coordinates?.Dec,
    cameraFov.value.fovX,
    cameraFov.value.fovY,
    rotationDeg.value,
  ],
  () => updateMountFov()
);

watch(
  () => [cameraFov.value.fovX, cameraFov.value.fovY, rotationDeg.value],
  () => {
    lastViewRa = null;
    lastViewDec = null;
    updateViewFov();
  }
);

watch(
  () => [
    framingStore.selectedItem,
    framingStore.RAangle,
    framingStore.DECangle,
    framingStore.rotationAngle,
    cameraFov.value.fovX,
    cameraFov.value.fovY,
    rotationDeg.value,
  ],
  () => updateTargetFov()
);

onMounted(() => {
  const stel = stellariumStore.stel;
  if (!stel) return;

  fovLayer.value = stel.createLayer({ id: 'fovFrameLayer', z: 8, visible: true });
  mountFov.value = stel.createObj('geojson', { id: 'mountFovBox' });
  targetFov.value = stel.createObj('geojson', { id: 'targetFovBox' });
  viewFov.value = stel.createObj('geojson', { id: 'viewFovBox' });
  fovLayer.value.add(mountFov.value);
  fovLayer.value.add(targetFov.value);
  fovLayer.value.add(viewFov.value);
  mountFov.value.data = EMPTY_FEATURE_COLLECTION;
  targetFov.value.data = EMPTY_FEATURE_COLLECTION;
  viewFov.value.data = EMPTY_FEATURE_COLLECTION;

  updateMountFov();
  updateTargetFov();
  rafId = requestAnimationFrame(viewFovLoop);
});

onBeforeUnmount(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  mountFov.value = null;
  targetFov.value = null;
  viewFov.value = null;
  fovLayer.value = null;
});
</script>
