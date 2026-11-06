<template>
  <teleport to="body">
    <!-- Overlay (nur wenn nicht minimiert) -->
    <div
      v-if="show && !isMinimized"
      ref="overlayElement"
      :class="[
        'fixed inset-0 flex items-center justify-center text-content p-2 bg-black/30',
        zIndexClass,
      ]"
      @click="handleBackdropClick"
    >
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="title || undefined"
        :aria-labelledby="title ? undefined : headerId"
        :class="[
          'p-6 bg-surface-1 border border-line rounded-card shadow-lg w-full relative',
          props.maxWidth,
        ]"
        @click.stop
      >
        <!-- Header (relative + z-index so it paints above fixed descendants like SubNav) -->
        <div class="relative z-20 mb-4 border-b border-line pb-2 flex justify-between items-center">
          <!-- contents: names the dialog without changing the flex layout of the slot -->
          <div :id="headerId" class="contents">
            <slot name="header">
              <h2 class="text-xl font-bold">Standard Titel</h2>
            </slot>
          </div>
          <button
            v-if="!disableClose"
            @click="handleClose"
            :aria-label="$t('common.close')"
            class="w-8 h-8 text-content-muted hover:text-content"
          >
            <XMarkIcon />
          </button>
        </div>

        <!-- Body -->
        <!-- *:min-w-0 lets the slot content shrink to the dialog width. Without it the
             flex item keeps min-width:auto, so a single <input> (whose min-content is its
             ~257px size-attribute width) makes the whole body wider than the dialog.
             justify-center-safe is the backstop for content that truly cannot shrink:
             plain justify-center centres the overflow and cuts off the *left* edge,
             which scrolling can never reach. -->
        <div
          class="flex justify-center-safe *:min-w-0 mb-4 max-h-[60vh] overflow-y-auto scrollbar-thin"
        >
          <slot name="body">
            <p>Standard-Inhalt</p>
          </slot>
        </div>
      </div>
    </div>

    <!-- Minimized chip (nur wenn minimiert) -->
    <div v-if="show && isMinimized" class="fixed inset-0 pointer-events-none" :class="zIndexClass">
      <div
        ref="chipElement"
        class="shadow-2xl pointer-events-auto"
        :style="{ position: 'absolute', ...chipPosition }"
        @mousedown="startDrag"
        @touchstart="startDrag"
      >
        <div
          class="flex items-center gap-2 py-2 pl-3 pr-2 bg-surface-1 border border-line rounded-full shadow-lg cursor-move select-none touch-none max-w-[220px]"
        >
          <button
            @click="handleChipRestore"
            class="flex-1 min-w-0 text-left text-sm font-semibold text-content truncate"
          >
            {{ title || 'Dialog' }}
          </button>
          <button
            v-if="!disableClose"
            @click.stop="handleClose"
            :aria-label="$t('common.close')"
            class="w-6 h-6 shrink-0 flex items-center justify-center text-content-muted hover:text-content"
          >
            <XMarkIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount, useId } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { useModalEscape } from '@/composables/useModalEscape';

const props = defineProps({
  show: Boolean,
  // A layer from the zIndex scale in tailwind.config.cjs.
  zIndex: {
    type: String,
    default: 'z-modal',
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

const headerId = useId();
const overlayElement = ref(null);

// Escape is a backdrop tap on the keyboard, never more: closeOnBackdropClick="false" guards
// dialogs whose close also ends a running operation, like the DialogModal for plate solving,
// autofocus and the meridian flip.
useModalEscape(overlayElement, () => {
  if (props.closeOnBackdropClick) handleClose();
});

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
  if (!isDragging.value || !chipElement.value) return;
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

onBeforeUnmount(stopDrag);

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
