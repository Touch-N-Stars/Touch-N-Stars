<template>
  <!-- Teleported like the per-tile modal before it: the fullscreen view must not
       depend on the stacking contexts of the monitor page around the grid. -->
  <Teleport to="body">
    <ImageModal
      :showModal="modelValue !== null"
      :imageData="shown?.url ?? null"
      :imageDate="shownStats?.Date"
      :isLoading="!shown"
      :isSwitching="!!shown && shown.index !== modelValue"
      :index="shown?.index ?? 0"
      :statistics="shownStats"
      :deletable="deletable"
      :rawSource="rawSource"
      :hasPrevious="previousIndex !== null"
      :hasNext="nextIndex !== null"
      @previous="browseTo(previousIndex)"
      @next="browseTo(nextIndex)"
      @close="emit('update:modelValue', null)"
      @delete="onDelete"
    />
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import ImageModal from '@/components/helpers/imageModal.vue';
import { useImagetStore } from '@/store/imageStore';
import { createLatestLoader, historyRawSource, neighbourInOrder } from '@/utils/imageHistoryUtils';

// Full-size view of the image history that browses through the grid: the arrows follow
// the grid's sort order and filter, so they show exactly the tiles before and after.

const props = defineProps({
  // Absolute history index to show; null keeps the view closed.
  modelValue: {
    type: Number,
    default: null,
  },
  // Absolute history indices in the order the grid shows them.
  order: {
    type: Array,
    default: () => [],
  },
  // Absolute history index -> statistics of the entry.
  entries: {
    type: Array,
    default: () => [],
  },
  deletable: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'delete']);
const imageStore = useImagetStore();

// The image on screen. It lags behind modelValue while the next one downloads, and it
// is kept after closing so the modal can release the right histogram entry.
const shown = ref(null); // { index, url }

const loader = createLatestLoader(
  (index) => imageStore.getImageByIndex(index),
  (index, url) => {
    shown.value = { index, url };
  }
);

watch(
  () => props.modelValue,
  (index, previous) => {
    if (index === null) {
      loader.cancel();
      return;
    }
    // A fresh open starts with the spinner, not with the image of the last visit.
    if (previous === null || previous === undefined) shown.value = null;
    loader.request(index);
  },
  { immediate: true }
);

onBeforeUnmount(() => loader.cancel());

const shownStats = computed(() => (shown.value ? props.entries[shown.value.index] : null));

const rawSource = computed(() =>
  shown.value ? historyRawSource(shown.value.index, shownStats.value) : null
);

// Stepping from the requested image rather than the shown one lets quick taps run ahead
// of the downloads.
const previousIndex = computed(() =>
  props.modelValue === null ? null : neighbourInOrder(props.order, props.modelValue, -1)
);
const nextIndex = computed(() =>
  props.modelValue === null ? null : neighbourInOrder(props.order, props.modelValue, 1)
);

function browseTo(index) {
  if (index !== null) emit('update:modelValue', index);
}

function onDelete() {
  if (shown.value) emit('delete', shown.value.index);
}
</script>
