<template>
  <div
    @click="onTileClick"
    @pointerdown="onPointerDown"
    @pointerup="cancelHold"
    @pointercancel="cancelHold"
    @pointerleave="cancelHold"
    @contextmenu="onContextMenu"
    ref="imageContainer"
    class="image-container relative overflow-hidden touch-auto bg-gray-800 shadow-lg shadow-cyan-700/40 rounded-xl border cursor-pointer transition-shadow"
    :class="selected ? 'border-cyan-400 ring-2 ring-cyan-400' : 'border-cyan-700'"
  >
    <img
      ref="image"
      :src="image"
      alt="Sequence Image"
      class="block w-full max-h-[80vh] object-contain"
      :style="{ transform: 'rotate(' + settingsStore.currentImageRotation + 'deg)' }"
    />
    <!-- Selection checkbox (selection mode only). The whole tile toggles too; the
         button is the visible affordance and a 48 px target of its own. -->
    <button
      v-if="selectable"
      type="button"
      class="absolute top-2 left-2 z-10 flex items-center justify-center min-h-touch min-w-touch rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      role="checkbox"
      :aria-checked="selected"
      :aria-label="$t('components.sequence.imageHistoryDelete.select')"
      data-testid="image-history-select"
      @click.stop="emit('toggle-select')"
    >
      <span
        class="flex items-center justify-center w-7 h-7 rounded-full border-2 transition-colors"
        :class="
          selected ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-gray-900/60 border-white/80'
        "
      >
        <CheckIcon v-if="selected" class="w-5 h-5" />
      </span>
    </button>
    <!-- .stop: the tile itself opens the full-size modal; the delete button must not.
         Hidden in selection mode, where the batch action bar owns deleting. -->
    <button
      v-if="deletable && !selectable"
      type="button"
      class="absolute top-2 right-2 z-10 flex items-center justify-center min-h-touch min-w-touch rounded-lg bg-gray-900/75 text-gray-200 hover:bg-red-700/90 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
      :aria-label="$t('components.sequence.imageHistoryDelete.button')"
      :title="$t('components.sequence.imageHistoryDelete.button')"
      data-testid="image-history-delete"
      @click.stop="emit('delete')"
    >
      <TrashIcon class="w-6 h-6" />
    </button>
    <div
      v-if="showStats"
      :class="[
        'flex flex-col w-full bottom-0 shadow-lg shadow-cyan-700/40 rounded-xl p-2 text-xs text-gray-300 bg-black/10',
        { absolute: !displayStatusUnderImage },
      ]"
    >
      <div class="grid grid-cols-2 gap-x-1 gap-y-0.5">
        <div v-if="targetName" class="flex gap-1 col-span-2 min-w-0">
          <span class="font-bold whitespace-nowrap">
            {{ $t('components.sequence.targetName') }}:
          </span>
          <span class="truncate">{{ targetName }}</span>
        </div>

        <div v-if="stats.Date" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.time') }}:</span>
          <span class="truncate">{{ formatDate(stats.Date) }}</span>
        </div>

        <div v-if="isValidNumber(stats.ExposureTime)" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.duration') }}:</span>
          <span class="truncate">{{ stats.ExposureTime.toFixed(2) }}s</span>
        </div>

        <div v-if="isValidNumber(stats.HFR)" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.hfr') }}:</span>
          <span class="truncate">{{ stats.HFR.toFixed(2) }}</span>
        </div>

        <div v-if="isValidNumber(stats.Min)" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.Min') }}:</span>
          <span class="truncate">{{ stats.Min.toFixed(0) }}</span>
        </div>

        <div v-if="isValidNumber(stats.Max)" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.Max') }}:</span>
          <span class="truncate">{{ stats.Max.toFixed(0) }}</span>
        </div>

        <div v-if="isValidNumber(stats.Mean)" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.mean') }}:</span>
          <span class="truncate">{{ stats.Mean.toFixed(2) }}</span>
        </div>

        <div v-if="isValidNumber(stats.Median)" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.median') }}:</span>
          <span class="truncate">{{ stats.Median.toFixed(2) }}</span>
        </div>

        <div v-if="isValidNumber(stats.StDev)" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.stDev') }}:</span>
          <span class="truncate">{{ stats.StDev.toFixed(2) }}</span>
        </div>

        <div v-if="isValidNumber(stats.HFRStDev)" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.HFRStDev') }}:</span>
          <span class="truncate">{{ stats.HFRStDev.toFixed(2) }}</span>
        </div>

        <div v-if="stats.RmsText" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.rmsText') }}:</span>
          <span class="truncate">{{ formatRms(stats.RmsText) }}</span>
        </div>

        <div v-if="isValidNumber(stats.Temperature)" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap"
            >{{ $t('components.sequence.temperatureShort') }}:</span
          >
          <span class="truncate">{{ stats.Temperature.toFixed(1) }}°C</span>
        </div>

        <div v-if="isValidNumber(stats.Gain)" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.gain') }}:</span>
          <span class="truncate">{{ stats.Gain }}</span>
        </div>

        <div v-if="isValidNumber(stats.Offset)" class="flex gap-1 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.offset') }}:</span>
          <span class="truncate">{{ stats.Offset }}</span>
        </div>

        <div v-if="stats.Filter" class="flex gap-1 col-span-2 min-w-0">
          <span class="font-bold whitespace-nowrap">{{ $t('components.sequence.filter') }}:</span>
          <span class="truncate">{{ stats.Filter }}</span>
        </div>
      </div>
    </div>
  </div>

  <ImageModal
    :showModal="showModal"
    :imageData="fullResImage"
    :imageDate="stats.Date"
    :isLoading="isLoadingModal"
    :index="index"
    :statistics="stats"
    :deletable="deletable"
    @close="closeModal"
    @delete="onModalDelete"
  />
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { TrashIcon, CheckIcon } from '@heroicons/vue/24/outline';
import { createHoldTimer } from '@/utils/holdTimer';
import ImageModal from '@/components/helpers/imageModal.vue';
import { useSequenceStore } from '@/store/sequenceStore';
import { useImagetStore } from '@/store/imageStore';
import { useSettingsStore } from '@/store/settingsStore';

const sequenceStore = useSequenceStore();
const imageStore = useImagetStore();
const settingsStore = useSettingsStore();

const props = defineProps({
  index: {
    type: Number,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  stats: {
    type: Object,
    required: false,
  },
  showStats: {
    type: Boolean,
    required: false,
    default: false,
  },
  displayStatusUnderImage: {
    type: Boolean,
    required: false,
    default: false,
  },
  // Shows the delete overlay. The parent owns confirmation and the API call.
  deletable: {
    type: Boolean,
    required: false,
    default: false,
  },
  // Selection mode: a checkbox replaces the delete overlay and tapping the tile
  // toggles the selection instead of opening the full-size modal.
  selectable: {
    type: Boolean,
    required: false,
    default: false,
  },
  selected: {
    type: Boolean,
    required: false,
    default: false,
  },
  // Long-pressing the tile emits `hold` (used to enter selection mode).
  holdToSelect: {
    type: Boolean,
    required: false,
    default: false,
  },
});

const emit = defineEmits(['delete', 'toggle-select', 'hold']);

// --- long press -----------------------------------------------------------
// A completed hold must not also count as a tap, so the click that follows the
// pointer release is swallowed once.
const HOLD_MS = 500;
let holdFired = false;
const holdTimer = createHoldTimer({
  durationMs: HOLD_MS,
  onComplete: () => {
    holdFired = true;
    emit('hold');
  },
});

function onPointerDown(event) {
  if (!props.holdToSelect || props.selectable) return;
  if (event.button !== undefined && event.button !== 0) return;
  holdFired = false;
  holdTimer.start();
}

function cancelHold() {
  holdTimer.cancel();
}

function onContextMenu(event) {
  // The browser's long-press menu would compete with the hold gesture.
  if (props.holdToSelect) event.preventDefault();
}

onBeforeUnmount(() => holdTimer.dispose());

function onTileClick() {
  if (holdFired) {
    holdFired = false;
    return;
  }
  if (props.selectable) {
    emit('toggle-select');
    return;
  }
  openModal();
}

function onModalDelete() {
  // The confirmation belongs to the parent; close the full-size view first so
  // the dialog is not shown over an image that is about to disappear.
  closeModal();
  emit('delete');
}

const isLoadingModal = ref(false);
const showModal = ref(false);
const fullResImage = ref(props.image);

watch(
  () => [props.index, props.stats],
  () => {
    if (!Number.isInteger(props.index) || props.index < 0) return;

    const statsTargetName = extractTargetNameFromStats(props.stats);
    const existingName = sequenceStore.getImageTargetName(props.index);
    if (!existingName && statsTargetName) {
      sequenceStore.setImageTargetName(props.index, statsTargetName);
    }
  },
  { immediate: true, deep: true }
);

const targetName = computed(() => {
  const persistedTargetName = sequenceStore.getImageTargetName(props.index);
  if (persistedTargetName) {
    return persistedTargetName;
  }

  const statsTargetName = extractTargetNameFromStats(props.stats);
  if (statsTargetName) {
    return statsTargetName;
  }

  return sequenceStore.targetName?.trim() || sequenceStore.lastTargetName?.trim() || '';
});

function normalizePossibleRef(value) {
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value;
  }

  return value;
}

function extractTargetNameFromStats(stats) {
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

function openModal() {
  isLoadingModal.value = true;
  showModal.value = true;

  imageStore
    .getImageByIndex(props.index)
    .then((image) => {
      fullResImage.value = image;
    })
    .finally(() => {
      isLoadingModal.value = false;
    });
}

function closeModal() {
  showModal.value = false;
}

function isValidNumber(value) {
  return typeof value === 'number' && !isNaN(value);
}

function formatDate(dateStr) {
  const dateObject = new Date(dateStr);
  // Return only the time portion of the date string (e.g 12:33:01)
  return dateObject.toLocaleTimeString();
}

function formatRms(rmsText) {
  return rmsText.replace('Tot: ', '');
}
</script>
