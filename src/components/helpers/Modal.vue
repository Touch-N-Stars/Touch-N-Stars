<template>
  <teleport to="body">
    <!-- Overlay (nur wenn nicht minimiert) -->
    <div
      v-if="show && !isMinimized"
      :class="[
        'fixed inset-0 flex items-center justify-center text-gray-200 p-2 bg-black/30',
        zIndexClass,
      ]"
      @click="handleBackdropClick"
    >
      <div
        :class="[
          'p-6 bg-gradient-to-br from-gray-950 bg-gray-800 rounded-lg shadow-lg w-full relative',
          props.maxWidth,
        ]"
        @click.stop
      >
        <!-- Header (relative + z-index so it paints above fixed descendants like SubNav) -->
        <div class="relative z-20 mb-4 border-b pb-2 flex justify-between items-center">
          <slot name="header">
            <h2 class="text-xl font-bold">Standard Titel</h2>
          </slot>
          <button
            v-if="!disableClose"
            @click="handleClose"
            class="w-8 h-8 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon />
          </button>
        </div>

        <!-- Body -->
        <div class="flex justify-center mb-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          <slot name="body">
            <p>Standard-Inhalt</p>
          </slot>
        </div>
      </div>
    </div>

    <!-- Minimized chip (nur wenn minimiert) -->
    <div
      v-if="show && isMinimized"
      ref="chipElement"
      :class="['shadow-2xl', zIndexClass]"
      :style="{ position: 'absolute', ...chipPosition }"
      @mousedown="startDrag"
      @touchstart="startDrag"
    >
      <div
        class="flex items-center gap-2 py-2 pl-3 pr-2 bg-gradient-to-br from-gray-950 bg-gray-800 rounded-full shadow-lg cursor-move select-none touch-none max-w-[220px]"
      >
        <button
          @click="handleChipRestore"
          class="flex-1 min-w-0 text-left text-sm font-semibold text-gray-100 truncate"
        >
          {{ title || 'Dialog' }}
        </button>
        <button
          v-if="!disableClose"
          @click.stop="handleClose"
          class="w-6 h-6 shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-200"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </teleport>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  show: Boolean,
  zIndex: {
    type: String,
    default: 'z-40',
  },
  disableClose: {
    type: Boolean,
    default: false,
  },
  maxWidth: {
    type: String,
    default: 'max-w-2xl',
  },
  closeOnBackdropClick: {
    type: Boolean,
    default: true,
  },
  isMinimized: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
});

const zIndexClass = computed(() => props.zIndex);

const emit = defineEmits(['close', 'restore']);

function handleClose() {
  if (!props.disableClose) {
    emit('close');
  }
}

function handleBackdropClick(event) {
  if (event.target === event.currentTarget && props.closeOnBackdropClick) {
    handleClose();
  }
}

// Draggable minimized chip (same drag mechanics as ModalTransparent.vue's quick-access
// panels), but always dropped back at the default spot above the status bar whenever the
// dialog is (re-)minimized rather than remembering where it was last dragged to.
const chipElement = ref(null);
const DEFAULT_CHIP_BOTTOM = 'calc(var(--above-statusbar) + var(--status-panel-height))';
const chipPosition = ref({ bottom: DEFAULT_CHIP_BOTTOM, right: '16px' });
const isDragging = ref(false);
let offset = { x: 0, y: 0 };
let dragStart = { x: 0, y: 0 };
let hasMoved = false;
// Drag ends with the pointer still over the title button, so the browser fires a
// synthetic click there even after a real drag — this flag tells the click handler
// to ignore that one click instead of restoring the dialog.
let suppressNextClick = false;

function getEventCoordinates(e) {
  if (e.touches) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function startDrag(e) {
  isDragging.value = true;
  hasMoved = false;
  const { x, y } = getEventCoordinates(e);
  dragStart = { x, y };

  const rect = chipElement.value.getBoundingClientRect();
  offset.x = x - rect.left;
  offset.y = y - rect.top;

  chipPosition.value = { top: `${rect.top}px`, left: `${rect.left}px` };

  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
  window.addEventListener('touchmove', onDrag, { passive: false });
  window.addEventListener('touchend', stopDrag);
}

function onDrag(e) {
  if (!isDragging.value) return;
  e.preventDefault();

  const { x, y } = getEventCoordinates(e);
  if (Math.abs(x - dragStart.x) > 3 || Math.abs(y - dragStart.y) > 3) {
    hasMoved = true;
  }
  const newLeft = x - offset.x;
  const newTop = y - offset.y;

  const rect = chipElement.value.getBoundingClientRect();
  const maxLeft = window.innerWidth - rect.width;
  const maxTop = window.innerHeight - rect.height;

  chipPosition.value = {
    top: `${Math.max(0, Math.min(newTop, maxTop))}px`,
    left: `${Math.max(0, Math.min(newLeft, maxLeft))}px`,
  };
}

function stopDrag() {
  isDragging.value = false;
  suppressNextClick = hasMoved;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
  window.removeEventListener('touchmove', onDrag);
  window.removeEventListener('touchend', stopDrag);
}

function handleChipRestore() {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  emit('restore');
}

watch(
  () => props.isMinimized,
  (minimized) => {
    if (minimized) {
      chipPosition.value = { bottom: DEFAULT_CHIP_BOTTOM, right: '16px' };
    }
  }
);
</script>

<style scoped>
/* Smooth scroll behavior */
.scrollbar-thin {
  scrollbar-width: thin;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: #4a5568;
  border-radius: 20px;
}

/* High z-index for modals */
:deep(.z-\[80\]) {
  z-index: 80 !important;
}
</style>
