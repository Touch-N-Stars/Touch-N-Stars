<template>
  <!-- Nur anzeigen, wenn showModal true ist -->
  <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Halbtransparenter Overlay-Hintergrund -->
    <div class="absolute inset-0 bg-black/70" @click="closeModal"></div>
    <div v-if="isLoading">
      <!-- Spinner -->
      <div class="flex items-center justify-center w-full h-full">
        <div
          class="w-12 h-12 border-4 border-accent border-t-transparent border-solid rounded-full animate-spin"
        ></div>
      </div>
    </div>
    <!-- Inhalt der Modal -->
    <div v-else class="relative w-full h-full bg-ground z-60 flex items-center justify-center">
      <!-- Zoom Overlay -->
      <div
        class="absolute top-4 left-4 flex items-center gap-2 shadow-lg shadow-black bg-surface-2 text-content text-sm px-3 py-1 rounded-lg z-top pointer-events-none"
      >
        Zoom: {{ zoomLevel.toFixed(2) }}x
        <span
          v-if="isSwitching"
          class="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin"
        ></span>
      </div>

      <!-- Control Buttons Container -->
      <div class="absolute top-4 right-4 flex gap-2 z-70">
        <!-- Delete Button (image history only; the parent owns confirmation) -->
        <button
          v-if="imageData && deletable"
          @click="emits('delete')"
          class="w-10 h-10 bg-surface-1/90 hover:bg-status-danger/40 text-content rounded-lg shadow-lg flex items-center justify-center transition-colors backdrop-blur-sm"
          :aria-label="$t('components.sequence.imageHistoryDelete.button')"
          :title="$t('components.sequence.imageHistoryDelete.button')"
          data-testid="image-modal-delete"
        >
          <TrashIcon class="h-6" />
        </button>

        <!-- Histogram Toggle Button (only where raw data exists for the image) -->
        <button
          v-if="imageData && rawSource"
          @click="showHistogram = !showHistogram"
          class="w-10 h-10 rounded-lg shadow-lg flex items-center justify-center transition-colors backdrop-blur-sm"
          :class="
            showHistogram
              ? 'bg-accent-action text-white hover:brightness-110'
              : 'bg-surface-1/90 hover:bg-surface-2 text-content'
          "
          :title="$t('components.helpers.imageModal.histogram')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="w-6 h-6"
          >
            <!-- Astrophoto histogram: steep rise at start, then smooth decline -->
            <polyline
              points="2,18 3,16 4,12 5,8 6,5 7,4 8,3 10,3 12,4 14,6 16,9 18,12 20,15 22,17"
            />
            <!-- Base line -->
            <line x1="2" y1="20" x2="22" y2="20" />
          </svg>
        </button>

        <!-- Download Button -->
        <button
          v-if="imageData"
          @click="downloadImage"
          class="w-10 h-10 bg-surface-1/90 hover:bg-surface-2 text-content rounded-lg shadow-lg flex items-center justify-center transition-colors backdrop-blur-sm"
        >
          <ArrowDownTrayIcon class="h-6" />
        </button>

        <!-- Close Button -->
        <button
          class="w-10 h-10 bg-surface-1/90 hover:bg-surface-2 text-content rounded-lg shadow-lg flex items-center justify-center transition-colors backdrop-blur-sm"
          @click="closeModal"
          aria-label="Schließen"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-6 h-6"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <BadButton
        v-if="settingsStore.showSpecial"
        class="absolute top-4 right-40 h-6 z-top"
        :index="index"
      />

      <!-- Browse arrows (image history only). While the next image loads the current one
           stays up, dimmed, so a quick tap sequence does not flicker through spinners. -->
      <button
        v-if="hasPrevious"
        type="button"
        class="absolute left-2 top-1/2 -translate-y-1/2 z-70 w-12 h-12 bg-surface-1/90 hover:bg-surface-2 text-content rounded-lg shadow-lg flex items-center justify-center transition-colors backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        :aria-label="$t('components.helpers.imageModal.previous')"
        :title="$t('components.helpers.imageModal.previous')"
        data-testid="image-modal-previous"
        @click="emits('previous')"
      >
        <ChevronLeftIcon class="w-7 h-7" />
      </button>
      <button
        v-if="hasNext"
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 z-70 w-12 h-12 bg-surface-1/90 hover:bg-surface-2 text-content rounded-lg shadow-lg flex items-center justify-center transition-colors backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        :aria-label="$t('components.helpers.imageModal.next')"
        :title="$t('components.helpers.imageModal.next')"
        data-testid="image-modal-next"
        @click="emits('next')"
      >
        <ChevronRightIcon class="w-7 h-7" />
      </button>

      <div
        ref="imageContainer"
        class="w-full h-full overflow-hidden relative flex items-center justify-center shadow-md shadow-accent-action"
        @pointerdown.capture="onSwipeStart"
      >
        <div v-if="!imageData" class="text-white text-center">
          <p class="text-2xl mb-4">{{ $t('components.helpers.imageModal.no_image') }}</p>
        </div>
        <div
          v-if="imageData"
          ref="panzoomContainer"
          class="w-full h-full"
          :style="{
            transform: 'rotate(' + settingsStore.currentImageRotation + 'deg)',
            transformOrigin: 'center',
          }"
        >
          <img
            :src="displayUrl"
            ref="image"
            @load="onImageLoad"
            class="w-full h-full object-contain cursor-move transition-opacity"
            :class="{ 'opacity-60': isSwitching }"
            alt="Vergrößertes Bild"
          />
        </div>
      </div>

      <!-- Histogram Overlay -->
      <div
        v-if="showHistogram && imageData && rawSource"
        class="absolute bottom-4 left-4 right-4 z-70 max-h-[60%] overflow-y-auto"
      >
        <HistogramChart
          :imageUrl="imageData"
          height="100px"
          :extraStats="statistics"
          collapsibleStats
          toolbarInChart
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import Panzoom from '@panzoom/panzoom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import {
  ArrowDownTrayIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline';
import { downloadImage as downloadImageHelper } from '@/utils/imageDownloader';
import BadButton from './BadButton.vue';
import HistogramChart from '@/components/helpers/HistogramChart.vue';
import { useSettingsStore } from '@/store/settingsStore';
import { useHistogramStore } from '@/store/histogramStore';
import { useRawStretch } from '@/composables/useRawStretch';
import { swipeStep } from '@/utils/swipeGesture';

const settingsStore = useSettingsStore();
const histogramStore = useHistogramStore();

const props = defineProps({
  showModal: {
    type: Boolean,
    default: false,
  },
  imageData: {
    type: String,
    default: null,
  },
  imageDate: {
    type: String,
    default: '0000-00-00',
  },
  isLoading: {
    type: Boolean,
    default: true,
  },
  index: {
    type: Number,
    default: 0,
  },
  statistics: {
    type: Object,
    default: null,
  },
  // Shows a delete button next to download/close; the parent handles the rest.
  deletable: {
    type: Boolean,
    default: false,
  },
  // Raw-data source for histogram and stretch (see histogramStore); null hides the histogram.
  rawSource: {
    type: Object,
    default: null,
  },
  // Browsing: arrows, the arrow keys and a swipe emit previous/next; the parent picks
  // the image and swaps imageData. Off by default, so only the image history browses.
  hasPrevious: {
    type: Boolean,
    default: false,
  },
  hasNext: {
    type: Boolean,
    default: false,
  },
  // The parent is loading the image browsed to; the current one stays up until then.
  isSwitching: {
    type: Boolean,
    default: false,
  },
});

const emits = defineEmits(['close', 'delete', 'previous', 'next']);
const image = ref(null);
const imageContainer = ref(null);
let panzoomInstance = null;
let wheelContainer = null; // where the wheel listener of panzoomInstance is bound
const zoomLevel = ref(1);
const showHistogram = ref(false);

function closeModal() {
  emits('close');
}

const initializePanzoom = () => {
  // Destroy old instance if exists
  destroyPanzoom();

  if (!image.value || !imageContainer.value) return;

  try {
    // Create new Panzoom instance on the image element directly
    panzoomInstance = Panzoom(image.value, {
      maxScale: 40,
      minScale: 0.5,
      contain: 'outside',
      step: 1.5, // Zoom increment per mousewheel/pinch event
      friction: 0.15, // Drag deceleration (lower = slower/more resistance)
    });

    zoomLevel.value = 1;

    // Listen to zoom changes
    image.value.addEventListener('panzoomchange', () => {
      if (panzoomInstance) {
        zoomLevel.value = panzoomInstance.getScale();
      }
    });

    // Add mousewheel support. Removed again in destroyPanzoom: every image load
    // creates a new instance, and a stale listener would zoom a second time.
    wheelContainer = imageContainer.value;
    wheelContainer.addEventListener('wheel', panzoomInstance.zoomWithWheel);
  } catch (error) {
    console.error('Error initializing Panzoom:', error);
  }
};

const destroyPanzoom = () => {
  if (panzoomInstance) {
    wheelContainer?.removeEventListener('wheel', panzoomInstance.zoomWithWheel);
    wheelContainer = null;
    try {
      panzoomInstance.destroy();
    } catch (error) {
      console.warn('Error destroying Panzoom:', error);
    }
    panzoomInstance = null;
  }
};

async function downloadImage() {
  if (!props.imageData) return;

  await downloadImageHelper(props.imageData, props.imageDate, {
    folderPrefix: 'TNS-Images',
    filePrefix: 'TNS',
  });
}

const onImageLoad = () => {
  nextTick(() => {
    destroyPanzoom();
    initializePanzoom();
  });
};

function browse(step) {
  if (step < 0 && props.hasPrevious) emits('previous');
  else if (step > 0 && props.hasNext) emits('next');
}

function onKeydown(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  browse(event.key === 'ArrowLeft' ? -1 : 1);
}

// Swipe to browse, only unzoomed: zoomed in, a drag pans the image. Panzoom stops
// pointerdown from bubbling, hence the capture listener on the container; up and
// cancel are watched on the window so a release outside the image is not lost.
const activePointers = new Set();
let swipeStart = null;

function onSwipeStart(event) {
  if (!props.hasPrevious && !props.hasNext) return;
  activePointers.add(event.pointerId);
  // A second finger makes it a pinch, which never browses.
  swipeStart =
    activePointers.size === 1 && zoomLevel.value <= 1.05
      ? { x: event.clientX, y: event.clientY }
      : null;
}

function onSwipeEnd(event) {
  if (!activePointers.delete(event.pointerId)) return;
  if (activePointers.size > 0 || !swipeStart) return;
  const start = swipeStart;
  swipeStart = null;
  if (event.type !== 'pointerup') return;
  browse(swipeStep(event.clientX - start.x, event.clientY - start.y));
}

function bindBrowseListeners(bind) {
  const method = bind ? 'addEventListener' : 'removeEventListener';
  window[method]('keydown', onKeydown);
  window[method]('pointerup', onSwipeEnd);
  window[method]('pointercancel', onSwipeEnd);
  if (!bind) {
    activePointers.clear();
    swipeStart = null;
  }
}

watch(
  () => props.showModal && (props.hasPrevious || props.hasNext),
  (browsing) => bindBrowseListeners(browsing),
  { immediate: true }
);

const { displayUrl } = useRawStretch(
  () => props.imageData,
  () => props.rawSource,
  showHistogram,
  { releaseOnChange: true, releaseOnUnmount: true }
);

watch(
  () => props.showModal,
  (newVal) => {
    if (!newVal) {
      destroyPanzoom();
      // Closing drops the stretch and the raw data; reopening starts from the original.
      histogramStore.clearImageCache(props.imageData);
      showHistogram.value = false;
    }
  }
);

// Android: the back button/gesture closes the open image instead of navigating the router
// back to the previous page. A registered listener replaces Capacitor's default.
let backButtonHandle = null;
let backButtonWanted = false;
async function bindBackButton(bind) {
  backButtonWanted = bind;
  if (!bind) {
    backButtonHandle?.remove();
    backButtonHandle = null;
    return;
  }
  if (backButtonHandle || Capacitor.getPlatform() !== 'android') return;
  const handle = await CapacitorApp.addListener('backButton', closeModal);
  // The modal may have closed while the listener was being registered.
  if (!backButtonWanted || backButtonHandle) handle.remove();
  else backButtonHandle = handle;
}

watch(
  () => props.showModal,
  (open) => bindBackButton(open),
  { immediate: true }
);

onBeforeUnmount(() => {
  bindBrowseListeners(false);
  bindBackButton(false);
  destroyPanzoom();
});
</script>

<style scoped>
.modal-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.image-container {
  overflow: hidden;
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-container img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: move;
}

img {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

button[aria-label='Schließen'] {
  z-index: 70;
}
</style>
