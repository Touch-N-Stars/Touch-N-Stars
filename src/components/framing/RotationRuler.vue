<template>
  <div class="rotation-ruler flex flex-col gap-1 select-none">
    <div class="flex items-center justify-between text-xs text-content">
      <span>{{ $t('components.framing.rotationRuler.label') }}</span>
      <span class="font-medium text-white tabular-nums">{{ displayAngle }}°</span>
      <button
        type="button"
        class="flex items-center gap-1 text-content hover:text-white transition-colors"
        :disabled="displayAngle === 0"
        :class="{ 'opacity-40': displayAngle === 0 }"
        @click="reset"
      >
        <ArrowUturnLeftIcon class="w-4 h-4" />
        <span>{{ $t('components.framing.rotationRuler.reset') }}</span>
      </button>
    </div>

    <!-- Scrubbable ruler: the ticks move under a fixed centre marker. -->
    <div
      ref="rulerRef"
      class="relative h-9 overflow-hidden rounded cursor-ew-resize touch-none"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel.prevent="onWheel"
    >
      <div
        v-for="tick in ticks"
        :key="tick.angle"
        class="absolute bottom-1 w-px bg-content-muted pointer-events-none"
        :class="tick.major ? 'h-5' : tick.mid ? 'h-3.5' : 'h-2'"
        :style="{ left: `calc(50% + ${tick.offset}px)` }"
      ></div>
      <div
        class="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-red-500 pointer-events-none"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ArrowUturnLeftIcon } from '@heroicons/vue/24/outline';
import { useFramingStore } from '@/store/framingStore';

// `scrub` is true while the ruler is being dragged, so a hosting sheet can get
// out of the way and show the camera frame turning.
const emit = defineEmits(['scrub']);
const framingStore = useFramingStore();

// Horizontal distance between two 1° ticks. Larger = finer control per pixel.
const PX_PER_DEGREE = 6;
// Ticks rendered on each side of the centre marker; must cover half the
// widest possible ruler (the controls overlay caps at 22rem).
const HALF_RANGE_DEG = 60;

const rulerRef = ref(null);
const dragging = ref(false);
let lastX = 0;
// Un-rounded angle while scrubbing so slow drags still accumulate.
let dragAngle = 0;

const displayAngle = computed(() => Math.round(framingStore.rotationAngle) % 360);

const ticks = computed(() => {
  const base = framingStore.rotationAngle;
  const start = Math.ceil(base - HALF_RANGE_DEG);
  const end = Math.floor(base + HALF_RANGE_DEG);
  const result = [];
  for (let a = start; a <= end; a++) {
    const norm = ((a % 360) + 360) % 360;
    result.push({
      angle: a,
      offset: (a - base) * PX_PER_DEGREE,
      major: norm % 10 === 0,
      mid: norm % 5 === 0,
    });
  }
  return result;
});

function setAngle(value) {
  framingStore.rotationAngle = ((value % 360) + 360) % 360;
}

function onPointerDown(e) {
  dragging.value = true;
  emit('scrub', true);
  lastX = e.clientX;
  dragAngle = framingStore.rotationAngle;
  rulerRef.value?.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  if (!dragging.value) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  // Dragging the ruler to the left reveals the higher angles on the right.
  dragAngle -= dx / PX_PER_DEGREE;
  setAngle(Math.round(dragAngle));
}

function onPointerUp(e) {
  if (!dragging.value) return;
  dragging.value = false;
  emit('scrub', false);
  rulerRef.value?.releasePointerCapture(e.pointerId);
}

function onWheel(e) {
  const step = e.deltaY > 0 ? 1 : -1;
  setAngle(Math.round(framingStore.rotationAngle) + step);
}

function reset() {
  setAngle(0);
}
</script>
