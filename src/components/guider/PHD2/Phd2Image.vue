<template>
  <div
    v-if="show && imageUrl"
    ref="containerElement"
    class="absolute inset-0 w-full h-full"
    style="z-index: 1"
  >
    <img
      ref="imageElement"
      :src="imageUrl"
      class="w-full h-full object-contain"
      alt="PHD2 Live Image"
      @load="onImageLoad"
    />

    <!-- Lock Position Overlay -->
    <div
      v-if="lockPosition && imageElement && imageDimensions.width > 0"
      class="absolute inset-0 pointer-events-none"
      :style="imageBoundsStyle"
    >
      <div class="absolute border-2 border-status-ok" :style="lockRectangleStyle"></div>
    </div>

    <!-- Guiding Cross Overlay -->
    <div
      v-if="showGuidingCross && lockPosition && imageElement && imageDimensions.width > 0"
      class="absolute inset-0 pointer-events-none"
      :style="imageBoundsStyle"
    >
      <!-- Vertical line -->
      <div
        class="absolute opacity-70"
        :style="guidingCrossVerticalStyle"
        :class="isCalibrating ? 'border-l-2 border-dashed border-status-ok' : 'bg-status-ok'"
      ></div>
      <!-- Horizontal line -->
      <div
        class="absolute opacity-70"
        :style="guidingCrossHorizontalStyle"
        :class="isCalibrating ? 'border-t-2 border-dashed border-status-ok' : 'bg-status-ok'"
      ></div>
    </div>

    <!-- Secondary Stars Overlay (multi-star guiding) -->
    <div
      v-if="secondaryStars.length > 0 && imageElement && imageDimensions.width > 0"
      class="absolute inset-0 pointer-events-none"
      :style="imageBoundsStyle"
    >
      <div
        v-for="(star, i) in secondaryStarStyles"
        :key="i"
        class="absolute rounded-full border-2 border-status-ok opacity-80"
        :style="star"
      ></div>
    </div>

    <!-- Reset Zoom Button -->
    <button
      v-if="isZoomed"
      @click.stop="resetZoom"
      class="absolute left-4 top-1/2 -translate-y-1/2 z-20 min-w-touch min-h-touch bg-surface-1/90 hover:bg-surface-2 text-content rounded-control shadow-lg flex items-center justify-center transition-colors"
      :title="$t('components.guider.phd2.resetZoom')"
    >
      <ArrowsPointingInIcon class="w-5 h-5" />
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import Panzoom from '@panzoom/panzoom';
import { ArrowsPointingInIcon } from '@heroicons/vue/24/outline';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useBackgroundAwarePolling } from '@/utils/appLifecycle';
import { calculateContainedImageBounds } from '@/utils/imageGeometry';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['close']);

const store = apiStore();
const settingsStore = useSettingsStore();
const imageUrl = ref(null);
const lockPosition = ref(null);
const secondaryStars = ref([]);
const imageElement = ref(null);
const containerElement = ref(null);
const imageDimensions = ref({ width: 0, height: 0 });
const imageBounds = ref(null);
const zoomLevel = ref(1);
const isZoomed = computed(() => Math.abs(zoomLevel.value - 1) > 0.05);
let lastImageData = null;
let panzoomInstance = null;
const savedZoom = ref(null);
const savedPan = ref(null);
let boundsFrame = null;
let resizeObserver = null;
let lastTapTime = 0;
const DOUBLE_TAP_DELAY = 300;
const isShown = computed(() => props.show);

const isGuiding = computed(() => store.guiderInfo?.State === 'Guiding');
const isCalibrating = computed(() => store.guiderInfo?.State === 'Calibrating');
const showGuidingCross = computed(() => isGuiding.value || isCalibrating.value);

const loadLockPosition = async () => {
  // Only fetch lock position when not stopped or lost lock
  const currentState = store.guiderInfo?.State;
  if (currentState === 'Stopped' || currentState === 'LostLock') {
    return;
  }

  try {
    const response = await apiService.getPhd2LockPosition();
    if (response?.Success && response?.Response?.LockPosition) {
      lockPosition.value = response.Response.LockPosition;
    }
  } catch (error) {
    console.log('PHD2 Image: Failed to load lock position:', error);
    lockPosition.value = null;
  }
};

const loadStarPositions = async () => {
  const currentState = store.guiderInfo?.State;
  if (currentState === 'Stopped' || currentState === 'LostLock') {
    secondaryStars.value = [];
    return;
  }
  try {
    const response = await apiService.getPhd2StarPositions();
    if (response?.Success && response?.Response?.Secondary) {
      secondaryStars.value = response.Response.Secondary;
    } else {
      secondaryStars.value = [];
    }
  } catch {
    secondaryStars.value = [];
  }
};

const updateImageBounds = () => {
  imageBounds.value = calculateContainedImageBounds(imageElement.value, containerElement.value, 0);
};

const scheduleBoundsUpdate = () => {
  if (boundsFrame !== null) {
    cancelAnimationFrame(boundsFrame);
  }
  boundsFrame = requestAnimationFrame(() => {
    boundsFrame = null;
    updateImageBounds();
  });
};

// Panzoom lifecycle (same pattern as ZoomableImage.vue, no toolbar/loupe here)
const handlePanzoomChange = () => {
  if (panzoomInstance) {
    zoomLevel.value = panzoomInstance.getScale();
  }
  scheduleBoundsUpdate();
};

const resetZoom = () => {
  if (!panzoomInstance) return;
  panzoomInstance.reset();
};

const handleWheel = (event) => {
  if (!panzoomInstance) return;
  panzoomInstance.zoomWithWheel(event);
};

const doubleTapZoom = (touch) => {
  if (!panzoomInstance || !imageElement.value || !containerElement.value) return;
  const currentScale = panzoomInstance.getScale();

  if (Math.abs(currentScale - 1) < 0.1) {
    const containerRect = containerElement.value.getBoundingClientRect();
    const fitScale = Math.min(
      containerRect.width / imageElement.value.naturalWidth,
      containerRect.height / imageElement.value.naturalHeight
    );
    const targetScale = 1 / fitScale;
    panzoomInstance.zoomToPoint(targetScale, { clientX: touch.clientX, clientY: touch.clientY });
  } else {
    panzoomInstance.reset();
  }
};

const handleTouchStart = (event) => {
  if (event.touches.length !== 1) return;
  const now = Date.now();
  const diff = now - lastTapTime;
  if (diff < DOUBLE_TAP_DELAY && diff > 0) {
    event.preventDefault();
    event.stopPropagation();
    doubleTapZoom(event.touches[0]);
    lastTapTime = 0;
  } else {
    lastTapTime = now;
  }
};

const initPanzoom = () => {
  if (panzoomInstance) {
    savedZoom.value = panzoomInstance.getScale();
    savedPan.value = panzoomInstance.getPan();
    destroyPanzoom();
  }

  if (!imageElement.value || !containerElement.value) return;

  try {
    panzoomInstance = Panzoom(imageElement.value, {
      maxScale: 40,
      minScale: 0.8,
      contain: 'outside',
      step: 1.5,
      friction: 0.15,
      startScale: savedZoom.value || 1,
      startX: savedPan.value?.x || 0,
      startY: savedPan.value?.y || 0,
    });

    zoomLevel.value = panzoomInstance.getScale();
    imageElement.value.addEventListener('panzoomchange', handlePanzoomChange);
    containerElement.value.addEventListener('wheel', handleWheel);
    imageElement.value.addEventListener('touchstart', handleTouchStart, { passive: false });
    scheduleBoundsUpdate();
  } catch (error) {
    console.error('PHD2 Image: Error initializing Panzoom:', error);
  }
};

const destroyPanzoom = () => {
  if (imageElement.value) {
    imageElement.value.removeEventListener('panzoomchange', handlePanzoomChange);
    imageElement.value.removeEventListener('touchstart', handleTouchStart);
  }
  if (containerElement.value) {
    containerElement.value.removeEventListener('wheel', handleWheel);
  }
  if (panzoomInstance) {
    try {
      panzoomInstance.destroy();
    } catch (error) {
      console.warn('PHD2 Image: Error destroying Panzoom:', error);
    }
    panzoomInstance = null;
  }
};

const onImageLoad = () => {
  if (imageElement.value) {
    imageDimensions.value = {
      width: imageElement.value.naturalWidth,
      height: imageElement.value.naturalHeight,
    };
  }
  if (resizeObserver) {
    if (imageElement.value) resizeObserver.observe(imageElement.value);
    if (containerElement.value) resizeObserver.observe(containerElement.value);
  }
  nextTick(() => {
    initPanzoom();
  });
};

const imageBoundsStyle = computed(() => {
  if (!imageBounds.value) return {};
  const b = imageBounds.value;
  return {
    width: `${b.width}px`,
    height: `${b.height}px`,
    top: `${b.top}px`,
    left: `${b.left}px`,
  };
});

const lockRectangleStyle = computed(() => {
  if (!lockPosition.value || !imageBounds.value) return {};

  const overlay = imageBounds.value;
  const renderedWidth = overlay.width;
  const renderedHeight = overlay.height;

  const scaleX = renderedWidth / imageDimensions.value.width;
  const scaleY = renderedHeight / imageDimensions.value.height;

  // Lock position rectangle (typically 15x15 pixels around lock position)
  const rectSize = 30; // 30x30 pixel rectangle
  const scaledSize = rectSize * Math.min(scaleX, scaleY);

  const x = lockPosition.value.X * scaleX - scaledSize / 2;
  const y = lockPosition.value.Y * scaleY - scaledSize / 2;

  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${scaledSize}px`,
    height: `${scaledSize}px`,
  };
});

// Computed styles for guiding cross centered on lock position
const guidingCrossVerticalStyle = computed(() => {
  if (!lockPosition.value || !imageBounds.value) return {};

  const overlay = imageBounds.value;
  const renderedWidth = overlay.width;
  const renderedHeight = overlay.height;

  const scaleX = renderedWidth / imageDimensions.value.width;
  const centerX = lockPosition.value.X * scaleX;

  return {
    left: `${centerX - 1}px`,
    top: '0px',
    width: '2px',
    height: `${renderedHeight}px`,
  };
});

const secondaryStarStyles = computed(() => {
  if (!secondaryStars.value.length || !imageBounds.value) return [];
  const overlay = imageBounds.value;
  const renderedWidth = overlay.width;
  const renderedHeight = overlay.height;
  const scaleX = renderedWidth / imageDimensions.value.width;
  const scaleY = renderedHeight / imageDimensions.value.height;
  const circleSize = 20 * Math.min(scaleX, scaleY);
  return secondaryStars.value.map((star) => {
    const cx = star.X * scaleX;
    const cy = star.Y * scaleY;
    return {
      left: `${cx - circleSize / 2}px`,
      top: `${cy - circleSize / 2}px`,
      width: `${circleSize}px`,
      height: `${circleSize}px`,
    };
  });
});

const guidingCrossHorizontalStyle = computed(() => {
  if (!lockPosition.value || !imageBounds.value) return {};

  const overlay = imageBounds.value;
  const renderedWidth = overlay.width;
  const renderedHeight = overlay.height;

  const scaleY = renderedHeight / imageDimensions.value.height;
  const centerY = lockPosition.value.Y * scaleY;

  return {
    left: '0px',
    top: `${centerY - 1}px`,
    width: `${renderedWidth}px`,
    height: '2px',
  };
});

const loadPhd2Image = async () => {
  try {
    // Neue Blob-URL holen
    const newUrl = await apiService.getPhd2CurrentImage(settingsStore.guider.phd2ImageGamma);

    // Fetch der Blob-Daten um sie zu vergleichen
    const response = await fetch(newUrl);
    const newBlob = await response.blob();
    const newSize = newBlob.size;

    // Nur aktualisieren wenn sich die Bildgröße geändert hat (primitiver Vergleich)
    if (lastImageData !== newSize) {
      // Alte URL freigeben
      if (imageUrl.value) {
        URL.revokeObjectURL(imageUrl.value);
      }

      imageUrl.value = newUrl;
      lastImageData = newSize;
    } else {
      // Neue URL freigeben da sie nicht verwendet wird
      URL.revokeObjectURL(newUrl);
    }
  } catch (error) {
    console.error('PHD2 Image: Failed to load image:', error);
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value);
      imageUrl.value = null;
    }
    lastImageData = null;
  }
};

// Nur laden wenn Modal geöffnet ist - und pausiert wenn die App im Hintergrund ist
// (siehe src/utils/appLifecycle.js)
useBackgroundAwarePolling(loadPhd2Image, 2000, isShown, { immediate: true });
useBackgroundAwarePolling(loadLockPosition, 3000, isShown, { immediate: true });
useBackgroundAwarePolling(loadStarPositions, 3000, isShown, { immediate: true });

watch(
  () => props.show,
  (newShow) => {
    if (!newShow) {
      lockPosition.value = null;
      secondaryStars.value = [];
      destroyPanzoom();
      imageBounds.value = null;
    }
  }
);

onMounted(() => {
  window.addEventListener('resize', scheduleBoundsUpdate);
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => scheduleBoundsUpdate());
    if (containerElement.value) {
      resizeObserver.observe(containerElement.value);
    }
  }
});

onUnmounted(() => {
  // URL freigeben
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
  }
  destroyPanzoom();
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (boundsFrame !== null) {
    cancelAnimationFrame(boundsFrame);
    boundsFrame = null;
  }
  window.removeEventListener('resize', scheduleBoundsUpdate);
});
</script>
