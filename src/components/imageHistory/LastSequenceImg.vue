<template>
  <div class="relative w-full">
    <!-- Image Container -->
    <div v-if="settingsStore.monitorViewSetting.showImage && imageData" class="relative">
      <SequenceImage
        :index="lastImgIndex"
        :image="imageData"
        :showStats="settingsStore.monitorViewSetting.showImageStats"
        :displayStatusUnderImage="settingsStore.monitorViewSetting.displayStatusUnderImage"
        :stats="{
          Date: dateValue,
          ExposureTime,
          HFR,
          Min,
          Max,
          Mean,
          Median,
          StDev,
          HFRStDev,
          RmsText,
          Temperature,
          Stars,
          Filter,
          Gain,
          Offset,
          TargetName,
        }"
        :deletable="del.canDelete.value"
        @delete="requestDelete"
      />

      <!-- Loading Spinner Overlay -->
      <div
        v-if="isLoadingImg && imageData"
        class="absolute inset-0 flex items-center justify-center bg-black/20 z-40"
      >
        <div class="flex flex-col items-center text-white">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-2"></div>
          <p class="text-sm">Loading image...</p>
        </div>
      </div>
    </div>

    <!-- Loading Spinner when no image yet -->
    <div v-else-if="isLoadingImg" class="flex items-center justify-center w-full h-64">
      <div class="flex flex-col items-center text-blue-500">
        <div
          class="w-12 h-12 border-4 border-blue-500 border-t-transparent border-solid rounded-full animate-spin"
        ></div>
        <p class="text-sm mt-2">Loading image...</p>
      </div>
    </div>

    <ImageDeleteConfirm
      :pending="del.pending.value"
      :is-deleting="del.isDeleting.value"
      :progress="del.progress.value"
      @confirm="confirmDelete"
      @cancel="del.cancel"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useSequenceStore } from '@/store/sequenceStore';
import SequenceImage from '@/components/imageHistory/SequenceImage.vue';
import ImageDeleteConfirm from '@/components/imageHistory/ImageDeleteConfirm.vue';
import { useImagetStore } from '@/store/imageStore';
import { useImageHistoryDelete } from '@/composables/useImageHistoryDelete';
import { historyEntryKey, isHistoryEntryDeleted } from '@/utils/imageHistoryUtils';

let isLoadingImg = ref(true);
const store = apiStore();
const settingsStore = useSettingsStore();
const sequenceStore = useSequenceStore();
const imageStore = useImagetStore();
const del = useImageHistoryDelete();
const imageData = ref(null);
const Filter = ref(null);
const HFR = ref(null);
const Mean = ref(null);
const Median = ref(null);
const RmsText = ref(null);
const StDev = ref(null);
const Stars = ref(null);
const Temperature = ref(null);
const ExposureTime = ref(null);
const dateValue = ref(null);
const lastImgIndex = ref(null);
const TargetName = ref(null);
const Min = ref(null);
const Max = ref(null);
const HFRStDev = ref(null);
const Gain = ref(null);
const Offset = ref(null);

async function loadImage(index) {
  try {
    isLoadingImg.value = true;
    imageData.value = await imageStore.getImageByIndex(index);

    if (imageData.value) {
      setSelectedDataset(index);
      lastImgIndex.value = index;
      console.log('[LastSequneceImg] Image loaded successfully:', index);
    }
  } catch (error) {
    console.error('Error loading image:', error.message);
  } finally {
    isLoadingImg.value = false;
  }
}

function requestDelete() {
  const index = lastImgIndex.value;
  if (!Number.isInteger(index) || index < 0) return;
  del.request({ index, stats: store.imageHistoryInfo?.[index] });
}

// Newest history entry that is not deleted, or -1.
function latestAvailableIndex() {
  const history = store.imageHistoryInfo ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (!isHistoryEntryDeleted(entry, historyEntryKey(i, entry), imageStore.deletedHistoryKeys)) {
      return i;
    }
  }
  return -1;
}

async function confirmDelete() {
  const { deleted } = await del.confirm();
  if (!deleted.some((item) => item.index === lastImgIndex.value)) return;
  // The shown image is gone: fall back to the newest remaining one.
  const next = latestAvailableIndex();
  if (next >= 0) {
    loadImage(next);
  } else {
    imageData.value = null;
    lastImgIndex.value = null;
  }
}

function setSelectedDataset(datasetIndex) {
  if (!store.imageHistoryInfo || store.imageHistoryInfo.length === 0) return;

  const selectedData = store.imageHistoryInfo[datasetIndex];
  if (selectedData) {
    Filter.value = selectedData.Filter;
    HFR.value = selectedData.HFR;
    Mean.value = selectedData.Mean;
    Median.value = selectedData.Median;
    RmsText.value = selectedData.RmsText;
    StDev.value = selectedData.StDev;
    Stars.value = selectedData.Stars;
    Temperature.value = selectedData.Temperature;
    ExposureTime.value = selectedData.ExposureTime;
    dateValue.value = selectedData.Date;
    TargetName.value = resolveTargetName(selectedData, datasetIndex);
    Min.value = selectedData.Min;
    Max.value = selectedData.Max;
    HFRStDev.value = selectedData.HFRStDev;
    Gain.value = selectedData.Gain;
    Offset.value = selectedData.Offset;
  }
}

function resolveTargetName(selectedData, imageIndex) {
  if (!Number.isInteger(imageIndex) || imageIndex < 0) {
    return sequenceStore.targetName || sequenceStore.lastTargetName;
  }

  const persistedName = sequenceStore.getImageTargetName(imageIndex);
  if (persistedName) {
    return persistedName;
  }

  const derivedName = extractTargetName(selectedData);
  if (derivedName) {
    sequenceStore.setImageTargetName(imageIndex, derivedName);
    return derivedName;
  }

  const fallback = sequenceStore.targetName || sequenceStore.lastTargetName;
  if (fallback) {
    sequenceStore.setImageTargetName(imageIndex, fallback);
    return fallback;
  }

  return '';
}

function extractTargetName(stats) {
  if (!stats) return '';

  const candidateValues = [
    stats.TargetName,
    stats.Target?.TargetName,
    stats.Target?.Name,
    stats.Target,
    stats.SequenceTargetName,
    stats.Name,
  ];

  for (const candidate of candidateValues) {
    const normalized = normalizePossibleRef(candidate);
    if (typeof normalized === 'string' && normalized.trim().length > 0) {
      return normalized.trim();
    }
  }

  return '';
}

function normalizePossibleRef(value) {
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value;
  }

  return value;
}

watch(
  () => store.imageHistoryInfo,
  async (newVal, oldVal) => {
    if (!oldVal || newVal.length > oldVal.length) {
      const latestIndex = latestAvailableIndex();
      console.log('[LastSequenceImg] latestIndex: ', latestIndex);

      loadImage(latestIndex);
    }
  },
  { immediate: false }
);

watch(
  () => sequenceStore.selectedImageIndex,
  (newIndex) => {
    if (typeof newIndex === 'number' && newIndex >= 0) {
      console.log('[LastSequenceImg] Loading image from graph click:', newIndex);
      loadImage(newIndex);
      // Reset the selected index so the same image can be selected again
      sequenceStore.setSelectedImageIndex(null);
    }
  }
);

onMounted(() => {
  const latestIndex = latestAvailableIndex();
  loadImage(latestIndex);
  console.log('[LastSequenceImg] Mounted');
  console.log('[LastSequenceImg] latestIndex: ', latestIndex);
  //console.log('isLoadingImg: ', isLoadingImg.value);
});
</script>

<style scoped></style>
