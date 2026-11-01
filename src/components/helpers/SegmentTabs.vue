<template>
  <div class="relative overflow-hidden rounded-control border border-line-strong bg-surface-2">
    <!-- Scroll fades like SubNav, so tabs cut off at the edge read as scrollable. They also
         page the bar: with a mouse there is no swipe to reach the hidden tabs. -->
    <div
      v-if="canScrollStart"
      class="scroll-fade scroll-fade-left cursor-pointer"
      aria-hidden="true"
      @click="scrollPage(-1)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div
      v-if="canScrollEnd"
      class="scroll-fade scroll-fade-right cursor-pointer"
      aria-hidden="true"
      @click="scrollPage(1)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <!-- Only this bar scrolls on narrow screens, never the page -->
    <div
      ref="scrollRef"
      class="flex gap-1 overflow-x-auto scrollbar-hide p-1"
      role="tablist"
      @scroll="updateScrollIndicators"
      @wheel="onWheel"
    >
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        class="flex min-h-touch shrink-0 items-center justify-center whitespace-nowrap rounded-chip px-3 text-sm font-semibold transition-colors"
        :class="modelValue === tab.value ? 'bg-accent-action text-white' : 'text-content-muted'"
        :aria-selected="modelValue === tab.value"
        @click="selectTab(tab.value, $event)"
      >
        {{ tab.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  // [{ value, label }]
  tabs: { type: Array, required: true },
  modelValue: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

const scrollRef = ref(null);
const canScrollStart = ref(false);
const canScrollEnd = ref(false);

function updateScrollIndicators() {
  const el = scrollRef.value;
  if (!el) return;
  const threshold = 5;
  canScrollStart.value = el.scrollLeft > threshold;
  canScrollEnd.value = el.scrollLeft + el.clientWidth < el.scrollWidth - threshold;
}

function selectTab(value, event) {
  emit('update:modelValue', value);
  // Pull a half-hidden tab fully into view so it is not left under the fade
  event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function scrollPage(direction) {
  const el = scrollRef.value;
  if (!el) return;
  el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: 'smooth' });
}

// A plain mouse wheel only scrolls vertically: turn it sideways while the bar can still move
// that way, otherwise leave it to the surrounding page or dialog
function onWheel(event) {
  const el = scrollRef.value;
  if (!el || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  const canMove = event.deltaY < 0 ? canScrollStart.value : canScrollEnd.value;
  if (!canMove) return;
  event.preventDefault();
  el.scrollLeft += event.deltaY;
}

// Width changes (rotation, split view) can add or remove the overflow without a scroll event
let resizeObserver = null;

onMounted(() => {
  nextTick(updateScrollIndicators);
  if (typeof ResizeObserver !== 'undefined' && scrollRef.value) {
    resizeObserver = new ResizeObserver(updateScrollIndicators);
    resizeObserver.observe(scrollRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

watch(
  () => props.tabs,
  () => nextTick(updateScrollIndicators),
  { deep: true }
);
</script>

<style scoped>
.scroll-fade {
  --fade: var(--color-surface-2);
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  width: 40px;
  display: flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.4);
}
.scroll-fade svg {
  width: 16px;
  height: 16px;
}
.scroll-fade-left {
  left: 0;
  padding-left: 4px;
  justify-content: flex-start;
  background: linear-gradient(
    to right,
    var(--fade) 0%,
    color-mix(in srgb, var(--fade) 80%, transparent) 50%,
    transparent 100%
  );
}
.scroll-fade-right {
  right: 0;
  padding-right: 4px;
  justify-content: flex-end;
  background: linear-gradient(
    to left,
    var(--fade) 0%,
    color-mix(in srgb, var(--fade) 80%, transparent) 50%,
    transparent 100%
  );
}
</style>
