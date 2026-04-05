<template>
  <div class="absolute inset-0 overflow-hidden flex items-center justify-center">
    <!-- Fullscreen Zoomable Image -->
    <ZoomableImage
      :imageData="allskyStore.currentImageUrl"
      :loading="false"
      :showControls="true"
      :showDownload="false"
      :showFullscreen="false"
      height="100%"
      :altText="'allsky snapshot'"
      :placeholderText="t('plugins.allsky.noImageAvailable')"
      @image-load="allskyStore.onCurrentImageLoad"
      @image-error="allskyStore.onCurrentImageError"
      class="bg-black shadow-inner flex items-center justify-center"
    >
      <!-- Custom placeholder -->
      <template #placeholder>
        <div class="flex flex-col items-center justify-center text-gray-500 p-8">
          <svg
            class="h-20 w-20 mb-4 opacity-20"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p class="text-lg font-medium">{{ t('plugins.allsky.noImageAvailable') }}</p>
          <p class="text-sm mt-1 max-w-xs text-center opacity-60">
            {{ t('plugins.allsky.configureUrl') }}
          </p>
        </div>
      </template>
    </ZoomableImage>

    <!-- Invisible preloader for next image -->
    <img
      v-if="allskyStore.nextImageUrl"
      :src="allskyStore.nextImageUrl"
      class="hidden"
      @error="allskyStore.onNextImageError"
      @load="allskyStore.onNextImageLoad"
    />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useallskyStore } from '../store/allskyStore.js';
import ZoomableImage from '@/components/helpers/ZoomableImage.vue';

const { t } = useI18n();
const allskyStore = useallskyStore();

onMounted(() => {
  // Ensure settings are loaded first since child components mount before parents
  allskyStore.loadFromLocalStorage();

  // Reset any loading states from previous navigation
  allskyStore.resetImageState();

  // Load initial image if URL is configured
  if (allskyStore.isValid) {
    allskyStore.refreshSnapshot();
  }

  if (allskyStore.autoRefresh) {
    allskyStore.startAutoRefresh();
  }
});

onUnmounted(() => {
  allskyStore.stopAutoRefresh();
});
</script>
