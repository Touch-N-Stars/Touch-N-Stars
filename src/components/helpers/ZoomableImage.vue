<template>
  <div
    ref="container"
    class="zoomable-image-container relative w-full overflow-hidden"
    :style="{ height: height }"
  >
    <!-- Action Buttons -->
    <div
      v-if="imageData"
      class="absolute top-2 right-2 z-30 flex flex-wrap justify-end gap-2 portrait:top-24 portrait:left-20 landscape:left-40"
    >
      <!-- Download Button -->
      <button
        v-if="showDownload"
        @click.stop="handleDownload"
        class="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-colors"
        title="Download Image"
      >
        <ArrowDownTrayIcon class="w-5 h-5" />
      </button>

      <!-- Fullscreen Button -->
      <button
        v-if="showFullscreen"
        @click.stop="handleFullscreen"
        class="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-colors"
        title="Open Fullscreen"
      >
        <MagnifyingGlassPlusIcon class="w-5 h-5" />
      </button>

      <!-- Histogram Button -->
      <button
        v-if="showHistogram"
        @click.stop="handleHistogramToggle"
        class="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-colors"
        :class="{ 'bg-cyan-700 hover:bg-cyan-600': showHistogramActive }"
        title="Toggle Histogram"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          class="w-5 h-5"
        >
          <polyline points="2,18 3,16 4,12 5,8 6,5 7,4 8,3 10,3 12,4 14,6 16,9 18,12 20,15 22,17" />
          <line x1="2" y1="20" x2="22" y2="20" />
        </svg>
      </button>

      <!-- Crosshair Button -->
      <ImageCrosshairButton
        v-if="showCrosshair"
        :active="showCrosshairActive"
        :label="$t('components.helpers.zoomableImage.toggleCrosshair')"
        @toggle="handleCrosshairToggle"
      />

      <!-- Loupe Button -->
      <ImageLoupeButton
        v-if="showLoupe"
        :active="isLoupeActive"
        :label="$t('components.helpers.zoomableImage.toggleLoupe')"
        @toggle="handleLoupeToggle"
      />

      <!-- Loupe Zoom Stepper -->
      <button
        v-if="showLoupe && isLoupeActive"
        @click.stop="cycleLoupeZoom"
        class="h-10 min-w-10 px-2 bg-gray-800/90 hover:bg-gray-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-colors text-sm font-semibold tabular-nums"
        :title="$t('components.helpers.zoomableImage.loupeZoom')"
        :aria-label="$t('components.helpers.zoomableImage.loupeZoom')"
      >
        {{ loupeZoomFactor }}×
      </button>

      <!-- Plate Solve Button -->
      <SolvePreparedImage v-if="showSolve" />

      <!-- Extra Buttons Slot -->
      <slot name="extra-buttons" />
    </div>

    <!-- Main Image -->
    <div
      v-if="imageData && !imageLoadError"
      class="w-full h-full absolute inset-0 flex items-center justify-center"
      :style="{ transform: 'rotate(' + imageRotation + 'deg)', transformOrigin: 'center' }"
    >
      <img
        ref="image"
        :src="imageData"
        :alt="altText"
        class="w-full h-full object-contain"
        @load="onImageLoad"
        @error="onImageError"
        @click="handleImageClick"
      />
    </div>

    <ImageCrosshairOverlay
      v-if="showCrosshair && showCrosshairActive && crosshairBounds"
      :bounds="crosshairBounds"
      class="z-20"
    />

    <ImageLoupePreview
      v-if="showLoupe && isLoupeActive && loupePreview"
      :image-data="imageData"
      :natural-x="loupePreview.naturalX"
      :natural-y="loupePreview.naturalY"
      :natural-width="loupePreview.naturalWidth"
      :natural-height="loupePreview.naturalHeight"
      :client-x="loupePreview.clientX"
      :client-y="loupePreview.clientY"
      :image-rotation="imageRotation"
      :zoom-factor="loupeZoomFactor"
    />

    <!-- Loading Spinner -->
    <div
      v-if="loading && imageData"
      class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 z-40"
    >
      <div class="flex flex-col items-center text-white">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-2"></div>
        <p class="text-sm">Loading...</p>
      </div>
    </div>

    <!-- Placeholder -->
    <div
      v-else-if="!imageData || imageLoadError"
      class="flex items-center justify-center w-full h-full bg-gray-800/20"
    >
      <slot name="placeholder">
        <div class="text-gray-400 text-center">
          <PhotoIcon class="w-16 h-16 mx-auto mb-2 opacity-50" />
          <p class="text-sm">{{ placeholderText }}</p>
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount, computed, toRef } from 'vue';
import Panzoom from '@panzoom/panzoom';
import { ArrowDownTrayIcon, MagnifyingGlassPlusIcon, PhotoIcon } from '@heroicons/vue/24/outline';
import SolvePreparedImage from '@/components/platesolve/solvePreparedImage.vue';
import ImageCrosshairButton from '@/components/helpers/ImageCrosshairButton.vue';
import ImageCrosshairOverlay from '@/components/helpers/ImageCrosshairOverlay.vue';
import ImageLoupeButton from '@/components/helpers/ImageLoupeButton.vue';
import ImageLoupePreview from '@/components/helpers/ImageLoupePreview.vue';
import { useImageCrosshair } from '@/composables/useImageCrosshair';
import { useImageLoupe } from '@/composables/useImageLoupe';
import { useSettingsStore } from '@/store/settingsStore';

const props = defineProps({
  imageData: {
    type: String,
    default: null,
  },
  altText: {
    type: String,
    default: 'Zoomable Image',
  },
  placeholderText: {
    type: String,
    default: 'No image available',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  showDownload: {
    type: Boolean,
    default: true,
  },
  showFullscreen: {
    type: Boolean,
    default: true,
  },
  showHistogram: {
    type: Boolean,
    default: false,
  },
  showCrosshair: {
    type: Boolean,
    default: true,
  },
  showLoupe: {
    type: Boolean,
    default: true,
  },
  showSolve: {
    type: Boolean,
    default: false,
  },
  minZoom: {
    type: Number,
    default: 0.8,
  },
  maxZoom: {
    type: Number,
    default: 40,
  },
  height: {
    type: String,
    default: '60vh',
  },
});

const emits = defineEmits([
  'download',
  'fullscreen',
  'histogram-toggle',
  'zoom-change',
  'image-load',
  'image-error',
  'click',
]);

const settingsStore = useSettingsStore();
const imageRotation = computed(() => settingsStore.currentImageRotation);

// Refs
const container = ref(null);
const image = ref(null);
let panzoomInstance = null;

// Double-tap detection
let lastTapTime = 0;
const DOUBLE_TAP_DELAY = 300;

// State
const zoomLevel = ref(1);
const imageLoadError = ref(false);
const showHistogramActive = ref(false);

// Store zoom and pan state
const savedZoom = ref(null);
const savedPan = ref(null);
const {
  isCrosshairVisible: showCrosshairActive,
  crosshairBounds,
  clearCrosshairBounds,
  scheduleCrosshairUpdate,
  toggleCrosshair,
} = useImageCrosshair({
  containerRef: container,
  imageRef: image,
  imageRotationRef: imageRotation,
  imageDataRef: toRef(props, 'imageData'),
});

const {
  isLoupeActive,
  loupePreview,
  loupeZoomFactor,
  toggleLoupe,
  cycleLoupeZoom,
  attachLoupePointerHandlers,
  detachLoupePointerHandlers,
} = useImageLoupe({
  containerRef: container,
  imageRef: image,
  imageRotationRef: imageRotation,
});

// Initialize Panzoom when image loads
const onImageLoad = () => {
  imageLoadError.value = false;
  nextTick(() => {
    if (isLoupeActive.value) {
      if (image.value) attachLoupePointerHandlers(image.value);
    } else {
      initPanzoom();
    }
    emits('image-load');
  });
};

const onImageError = (event) => {
  imageLoadError.value = true;
  clearCrosshairBounds();
  emits('image-error', event);
};

const handlePanzoomChange = () => {
  if (!panzoomInstance) return;

  zoomLevel.value = panzoomInstance.getScale();
  scheduleCrosshairUpdate();
  emits('zoom-change', zoomLevel.value);
};

const handleWheel = (event) => {
  if (!panzoomInstance) return;
  panzoomInstance.zoomWithWheel(event);
};

const initPanzoom = () => {
  // Save current zoom and pan state before destroying
  if (panzoomInstance) {
    savedZoom.value = panzoomInstance.getScale();
    savedPan.value = panzoomInstance.getPan();
    destroyPanzoom();
  }

  if (!image.value || !container.value) return;

  try {
    // Create new Panzoom instance on the image element directly
    panzoomInstance = Panzoom(image.value, {
      maxScale: props.maxZoom,
      minScale: props.minZoom,
      contain: 'outside',
      step: 1.5, // Zoom increment per mousewheel/pinch event
      friction: 0.15, // Drag deceleration (lower = slower/more resistance)
      startScale: savedZoom.value || 1,
      startX: savedPan.value?.x || 0,
      startY: savedPan.value?.y || 0,
    });

    // Listen to zoom changes
    image.value.addEventListener('panzoomchange', handlePanzoomChange);

    // Add mousewheel support
    container.value.addEventListener('wheel', handleWheel);

    // Add double-tap support
    image.value.addEventListener('touchstart', handleTouchStart, { passive: false });
    scheduleCrosshairUpdate();
  } catch (error) {
    console.error('Error initializing Panzoom:', error);
  }
};

const destroyPanzoom = () => {
  if (image.value) {
    image.value.removeEventListener('panzoomchange', handlePanzoomChange);
    image.value.removeEventListener('touchstart', handleTouchStart);
  }
  if (container.value) {
    container.value.removeEventListener('wheel', handleWheel);
  }
  if (panzoomInstance) {
    try {
      panzoomInstance.destroy();
    } catch (error) {
      console.warn('Error destroying Panzoom:', error);
    }
    panzoomInstance = null;
  }
};

const handleDownload = () => {
  emits('download', { imageData: props.imageData, zoomLevel: zoomLevel.value });
};

const handleFullscreen = () => {
  emits('fullscreen', { imageData: props.imageData, zoomLevel: zoomLevel.value });
};

const handleHistogramToggle = () => {
  showHistogramActive.value = !showHistogramActive.value;
  emits('histogram-toggle');
};

const handleCrosshairToggle = () => {
  toggleCrosshair();
};

const handleLoupeToggle = () => {
  toggleLoupe();
};

const handleImageClick = () => {
  if (isLoupeActive.value) return;
  emits('click', { imageData: props.imageData, zoomLevel: zoomLevel.value });
};

const doubleTapZoom = (touch) => {
  if (!panzoomInstance || !image.value || !container.value) return;
  const currentScale = panzoomInstance.getScale();

  if (Math.abs(currentScale - 1) < 0.1) {
    // At fit view → zoom to 1:1 pixels centered on tap point
    const containerRect = container.value.getBoundingClientRect();
    const fitScale = Math.min(
      containerRect.width / image.value.naturalWidth,
      containerRect.height / image.value.naturalHeight
    );
    const targetScale = 1 / fitScale;
    panzoomInstance.zoomToPoint(targetScale, { clientX: touch.clientX, clientY: touch.clientY });
  } else {
    // Not at fit view → reset to fit
    panzoomInstance.reset();
  }
};

const handleTouchStart = (event) => {
  if (isLoupeActive.value) return;
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

// Watch for image changes
watch(
  () => props.imageData,
  (newVal, oldVal) => {
    if (!newVal && oldVal) {
      destroyPanzoom();
      detachLoupePointerHandlers();
      clearCrosshairBounds();
      zoomLevel.value = 1;
    }
  }
);

// Pause Panzoom while the loupe is active so single-finger gestures drive the loupe preview.
watch(isLoupeActive, (active) => {
  if (active) {
    if (panzoomInstance) {
      savedZoom.value = panzoomInstance.getScale();
      savedPan.value = panzoomInstance.getPan();
      destroyPanzoom();
    }
    if (image.value) attachLoupePointerHandlers(image.value);
  } else {
    detachLoupePointerHandlers();
    if (image.value && props.imageData && !imageLoadError.value) {
      initPanzoom();
    }
  }
});

// Cleanup on unmount
onBeforeUnmount(() => {
  destroyPanzoom();
  detachLoupePointerHandlers();
});
</script>

<style scoped>
.zoomable-image-container {
  position: relative;
  background-color: transparent;
}

.zoomable-image-container img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  pointer-events: auto;
}
</style>
