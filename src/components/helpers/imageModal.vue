<template>
  <!-- Nur anzeigen, wenn showModal true ist -->
  <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Halbtransparenter Overlay-Hintergrund -->
    <div class="absolute inset-0 bg-black/70" @click="closeModal"></div>
    <div v-if="isLoading">
      <!-- Spinner -->
      <div class="flex items-center justify-center w-full h-full">
        <div
          class="w-12 h-12 border-4 border-blue-500 border-t-transparent border-solid rounded-full animate-spin"
        ></div>
      </div>
    </div>
    <!-- Inhalt der Modal -->
    <div v-else class="relative w-full h-full bg-gray-900 z-60 flex items-center justify-center">
      <!-- Zoom Overlay -->
      <div
        class="absolute top-4 left-4 shadow-lg shadow-black bg-gray-800 text-white text-sm px-3 py-1 rounded-lg z-top pointer-events-none"
      >
        Zoom: {{ zoomLevel.toFixed(2) }}x
      </div>

      <!-- Control Buttons Container -->
      <div class="absolute top-4 right-4 flex gap-2 z-70">
        <!-- Delete Button (image history only; the parent owns confirmation) -->
        <button
          v-if="imageData && deletable"
          @click="emits('delete')"
          class="w-10 h-10 bg-gray-800/90 hover:bg-red-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-colors backdrop-blur-sm"
          :aria-label="$t('components.sequence.imageHistoryDelete.button')"
          :title="$t('components.sequence.imageHistoryDelete.button')"
          data-testid="image-modal-delete"
        >
          <TrashIcon class="h-6" />
        </button>

        <!-- Histogram Toggle Button -->
        <button
          v-if="imageData"
          @click="showHistogram = !showHistogram"
          class="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-colors backdrop-blur-sm"
          :class="{ 'bg-cyan-700 hover:bg-cyan-600': showHistogram }"
          title="Histogram anzeigen"
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
          class="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-colors backdrop-blur-sm"
        >
          <ArrowDownTrayIcon class="h-6" />
        </button>

        <!-- Close Button -->
        <button
          class="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-colors backdrop-blur-sm"
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

      <div
        ref="imageContainer"
        class="w-full h-full overflow-hidden relative flex items-center justify-center shadow-md shadow-cyan-900"
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
            :src="getStretchSettings().stretchedImageData || imageData"
            ref="image"
            @load="onImageLoad"
            class="w-full h-full object-contain cursor-move"
            alt="Vergrößertes Bild"
          />
        </div>
      </div>

      <!-- Histogram Overlay -->
      <div
        v-if="showHistogram && imageData"
        class="absolute bottom-4 left-4 right-4 z-70 bg-gray-900/80 rounded-lg p-3 backdrop-blur-sm"
      >
        <HistogramChart
          :data="getHistogram()"
          height="100px"
          :showStats="false"
          :blackPoint="getStretchSettings().blackPoint"
          :midPoint="getStretchSettings().midPoint"
          :whitePoint="getStretchSettings().whitePoint"
          :statistics="statistics"
          @levels-changed="onLevelsChanged"
          @levels-reset="onLevelsReset"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import Panzoom from '@panzoom/panzoom';
import { ArrowDownTrayIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { downloadImage as downloadImageHelper } from '@/utils/imageDownloader';
import BadButton from './BadButton.vue';
import HistogramChart from '@/components/helpers/HistogramChart.vue';
import { useSettingsStore } from '@/store/settingsStore';
import { useHistogramStore } from '@/store/histogramStore';

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
});

const emits = defineEmits(['close', 'delete']);
const image = ref(null);
const imageContainer = ref(null);
let panzoomInstance = null;
const zoomLevel = ref(1);
const showHistogram = ref(false);

function closeModal() {
  emits('close');
}

const initializePanzoom = () => {
  // Destroy old instance if exists
  if (panzoomInstance) {
    panzoomInstance.destroy();
  }

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

    // Listen to zoom changes
    image.value.addEventListener('panzoomchange', () => {
      if (panzoomInstance) {
        zoomLevel.value = panzoomInstance.getScale();
      }
    });

    // Add mousewheel support
    imageContainer.value.addEventListener('wheel', panzoomInstance.zoomWithWheel);
  } catch (error) {
    console.error('Error initializing Panzoom:', error);
  }
};

const destroyPanzoom = () => {
  if (panzoomInstance) {
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

watch(
  () => props.showModal,
  (newVal) => {
    if (!newVal) {
      destroyPanzoom();
    }
  }
);

watch([() => props.imageData, showHistogram], ([imageData, panelOpen]) => {
  if (imageData && panelOpen) {
    histogramStore.requestHistogram(imageData);
  }
});

const getHistogram = () => {
  if (!props.imageData) return null;
  return histogramStore.getHistogram(props.imageData);
};

const getStretchSettings = () => {
  if (!props.imageData) {
    return {
      blackPoint: 0,
      whitePoint: 255,
      midPoint: 127,
      stretchedImageData: null,
    };
  }
  return histogramStore.getStretchSettings(props.imageData);
};

const onLevelsChanged = async (event) => {
  if (!props.imageData) return;
  const { blackPoint, whitePoint, midPoint } = event;
  await histogramStore.applyStretch(props.imageData, blackPoint, whitePoint, midPoint);
};

const onLevelsReset = () => {
  if (!props.imageData) return;
  histogramStore.resetStretch(props.imageData);
};

onBeforeUnmount(() => {
  destroyPanzoom();
  histogramStore.resetStretch(props.imageData);
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
