<template>
  <div v-if="show && imageUrl" class="absolute inset-0 w-full h-full" style="z-index: 1">
    <img
      ref="imageElement"
      :src="imageUrl"
      class="w-full h-full object-contain"
      alt="PHD2 Guidstar"
      @load="onImageLoad"
      style="image-rendering: pixelated"
    />

    <!-- Dünnes Kreuz in der Mitte wie in PHD2 -->
    <div class="absolute inset-0 pointer-events-none">
      <!-- Vertikale Linie -->
      <div
        class="absolute bg-status-ok opacity-90"
        style="left: 50%; top: 0; width: 2px; height: 100%; transform: translateX(-1px)"
      ></div>
      <!-- Horizontale Linie -->
      <div
        class="absolute bg-status-ok opacity-90"
        style="top: 50%; left: 0; height: 2px; width: 100%; transform: translateY(-1px)"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted, computed } from 'vue';
import apiService from '@/services/apiService';
import { useBackgroundAwarePolling } from '@/utils/appLifecycle';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['close']);

const imageUrl = ref(null);
const imageElement = ref(null);
let lastImageData = null;
const isShown = computed(() => props.show);

const onImageLoad = () => {
  // Image loaded successfully
};

const loadPhd2StarImage = async () => {
  try {
    // Neue Blob-URL holen
    const newUrl = await apiService.getPhd2StarImage();

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
    console.error('PHD2 Guidstar: Failed to load star image:', error);
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value);
      imageUrl.value = null;
    }
    lastImageData = null;
  }
};

// Nur laden wenn Modal geöffnet ist - und pausiert wenn die App im Hintergrund ist
// (siehe src/utils/appLifecycle.js)
useBackgroundAwarePolling(loadPhd2StarImage, 2000, isShown, { immediate: true });

onUnmounted(() => {
  // URL freigeben
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
  }
});
</script>
