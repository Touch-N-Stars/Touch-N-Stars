<template>
  <div class="flex flex-col gap-1">
    <!-- Per-filter breakdown when no specific filter is selected -->
    <template v-if="!filter.selectedFilter && filterBreakdown.length > 1">
      <div
        v-for="entry in filterBreakdown"
        :key="entry.filterName"
        class="flex justify-between items-center px-3 py-1"
      >
        <span class="text-xs text-content-muted">{{
          entry.filterName || $t('components.sequence.totalExposureTime.noFilter')
        }}</span>
        <span class="text-right">
          <span class="text-xs text-content-faint mr-2"
            >{{ entry.imageCount }} {{ $t('components.sequence.totalExposureTime.Pictures') }}</span
          >
          <span class="font-mono text-sm text-content font-bold">{{
            formatExposureTime(entry.totalTime)
          }}</span>
        </span>
      </div>
      <!-- Total row -->
      <div class="flex justify-between items-center px-3 py-1 border-t border-line mt-1 pt-2">
        <span class="text-xs text-content-muted">{{
          $t('components.sequence.totalExposureTime.total')
        }}</span>
        <span class="text-right">
          <span class="text-xs text-content-faint mr-2"
            >{{ totalData.imageCount }}
            {{ $t('components.sequence.totalExposureTime.Pictures') }}</span
          >
          <span class="font-mono text-sm text-content font-bold">{{
            formatExposureTime(totalData.totalTime)
          }}</span>
        </span>
      </div>
    </template>

    <!-- Single row when a filter is selected or only one filter exists -->
    <div v-else-if="totalData" class="flex justify-between items-center px-3 py-1">
      <span class="text-xs text-content-muted">{{ displayLabel }}</span>
      <span class="text-right">
        <span class="text-xs text-content-faint mr-2"
          >{{ totalData.imageCount }}
          {{ $t('components.sequence.totalExposureTime.Pictures') }}</span
        >
        <span class="font-mono text-sm text-content font-bold">{{
          formatExposureTime(totalData.totalTime)
        }}</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useImageFilter } from '@/composables/useImageFilter';

const { t } = useI18n();
const { filter, filteredImages } = useImageFilter();

const lightFilteredImages = computed(() =>
  filteredImages.value.filter((img) => img.ImageType === 'LIGHT' || img.ImageType === 'SNAPSHOT')
);

const filterBreakdown = computed(() => {
  const images = lightFilteredImages.value;
  if (!images || images.length === 0) return [];

  const map = new Map();
  for (const img of images) {
    const key = img.Filter || '';
    if (!map.has(key)) map.set(key, { filterName: img.Filter || '', imageCount: 0, totalTime: 0 });
    const entry = map.get(key);
    entry.imageCount++;
    entry.totalTime += img.ExposureTime || 0;
  }
  return [...map.values()].sort((a, b) => a.filterName.localeCompare(b.filterName));
});

const totalData = computed(() => {
  const images = lightFilteredImages.value;
  if (!images || images.length === 0) return null;
  return {
    imageCount: images.length,
    totalTime: images.reduce((sum, img) => sum + (img.ExposureTime || 0), 0),
  };
});

const displayLabel = computed(() => {
  const parts = [];
  if (filter.value.selectedTarget) parts.push(filter.value.selectedTarget);
  if (filter.value.selectedFilter) parts.push(filter.value.selectedFilter);
  return parts.length > 0 ? parts.join(' / ') : t('components.sequence.imageFilter.allTargets');
});

const formatExposureTime = (seconds) => {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m ${remainingSeconds.toFixed(1)}s`;
};
</script>

<style scoped></style>
