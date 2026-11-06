<template>
  <teleport to="body">
    <div v-if="show" class="fixed inset-0 text-content p-2 pointer-events-none" :class="zIndex">
      <div
        ref="modalElement"
        class="bg-gradient-to-br rounded-lg shadow-lg relative pointer-events-auto touch-none"
        :class="[getOpacityClass(), 'p-4 sm:p-6 w-full max-w-xs sm:max-w-sm mx-2']"
        :style="{ position: 'absolute', ...position }"
        @click.stop
      >
        <!-- Header = Drag-Handle -->
        <div
          class="mb-4 border-b pb-2 flex justify-between items-center cursor-move select-none touch-none gap-2"
          @mousedown="startDrag"
          @touchstart="startDrag"
        >
          <slot name="header">
            <h2 class="text-lg sm:text-xl font-bold truncate">Standard Titel</h2>
          </slot>
          <button
            @click="emit('close')"
            class="w-8 h-8 shrink-0 text-content-muted hover:text-content"
          >
            <XMarkIcon />
          </button>
        </div>
        <!-- Body -->
        <div
          class="flex flex-col w-full mb-4 max-h-[60vh] overflow-y-auto scrollbar-thin modal-content"
        >
          <slot name="body">
            <p>Standard-Inhalt</p>
          </slot>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { useSettingsStore } from '@/store/settingsStore';

const props = defineProps({
  show: Boolean,
  opacity: {
    type: Number,
    default: 20, // 0-100
  },
  zIndex: {
    type: String,
    default: 'z-modal-raised',
  },
  modalId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['close']);

const settingsStore = useSettingsStore();
const modalElement = ref(null);
const position = ref({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
const isDragging = ref(false);
const hasBeenMoved = ref(false); // Track ob das Modal schon mal bewegt wurde
let offset = { x: 0, y: 0 };

// Erkenne die aktuelle Ausrichtung (landscape oder portrait)
function getOrientation() {
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}

// Validiere, ob die Position noch auf dem Bildschirm passt
function validatePosition(pos) {
  if (!modalElement.value) return pos;

  const modalRect = modalElement.value.getBoundingClientRect();
  const top = parseInt(pos.top);
  const left = parseInt(pos.left);

  const maxLeft = window.innerWidth - modalRect.width;
  const maxTop = window.innerHeight - modalRect.height;

  return {
    top: `${Math.max(0, Math.min(top, maxTop))}px`,
    left: `${Math.max(0, Math.min(left, maxLeft))}px`,
    transform: 'none',
  };
}

function getEventCoordinates(e) {
  if (e.touches) {
    return {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }
  return {
    x: e.clientX,
    y: e.clientY,
  };
}

function startDrag(e) {
  isDragging.value = true;
  hasBeenMoved.value = true; // Markiere als bewegt
  const { x, y } = getEventCoordinates(e);

  // Berechne die aktuelle Position des Modals
  const rect = modalElement.value.getBoundingClientRect();
  const currentX = rect.left;
  const currentY = rect.top;

  offset.x = x - currentX;
  offset.y = y - currentY;

  // Entferne Transform beim Start des Draggings
  position.value.transform = 'none';
  position.value.left = `${currentX}px`;
  position.value.top = `${currentY}px`;

  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
  window.addEventListener('touchmove', onDrag, { passive: false });
  window.addEventListener('touchend', stopDrag);
}

function onDrag(e) {
  if (!isDragging.value) return;
  e.preventDefault();

  const { x, y } = getEventCoordinates(e);

  // Berechne neue Position
  const newLeft = x - offset.x;
  const newTop = y - offset.y;

  // Begrenze die Position auf den Bildschirm
  const modalRect = modalElement.value.getBoundingClientRect();
  const maxLeft = window.innerWidth - modalRect.width;
  const maxTop = window.innerHeight - modalRect.height;

  position.value.left = `${Math.max(0, Math.min(newLeft, maxLeft))}px`;
  position.value.top = `${Math.max(0, Math.min(newTop, maxTop))}px`;
}

function stopDrag() {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
  window.removeEventListener('touchmove', onDrag);
  window.removeEventListener('touchend', stopDrag);

  // Speichere die Position im Store (abhängig von Ausrichtung)
  if (props.modalId) {
    const orientation = getOrientation();
    settingsStore.setModalPosition(props.modalId, orientation, {
      top: position.value.top,
      left: position.value.left,
    });
  }
}

// Zentriere das Modal beim Öffnen
function centerModal() {
  position.value = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };
}

// Überwache das Öffnen des Modals - lade gespeicherte Position abhängig von Ausrichtung
watch(
  () => props.show,
  (newValue) => {
    if (newValue) {
      nextTick(() => {
        const orientation = getOrientation();
        const saved = props.modalId && settingsStore.modalPositions[props.modalId]?.[orientation];
        if (saved) {
          // Validiere die Position, bevor sie gesetzt wird
          position.value = validatePosition(saved);
          hasBeenMoved.value = true;
        } else if (!hasBeenMoved.value) {
          centerModal();
        }
      });
    }
  }
);

// Dynamische Klasse basierend auf Opacity
function getOpacityClass() {
  const opacity = props.opacity;
  if (opacity <= 20) return 'from-gray-950/20';
  if (opacity <= 30) return 'from-gray-950/30';
  if (opacity <= 40) return 'from-gray-950/40';
  if (opacity <= 50) return 'from-gray-950/50';
  if (opacity <= 60) return 'from-gray-950/60';
  if (opacity <= 70) return 'from-gray-950/70';
  if (opacity <= 80) return 'from-gray-950/80';
  if (opacity <= 90) return 'from-gray-950/90';
  return 'from-gray-950/95';
}
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

/* Modal Content Höhe im Landscape-Modus */
@media screen and (orientation: landscape) {
  .modal-content {
    max-height: 50vh;
  }
}

/* Für sehr kleine Bildschirme */
@media screen and (max-height: 600px) {
  .modal-content {
    max-height: 95vh;
  }
}
</style>
