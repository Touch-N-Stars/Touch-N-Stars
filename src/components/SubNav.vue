<template>
  <div
    ref="subnavRef"
    class="subnav fixed z-10 overflow-hidden"
    :class="[subnavClasses, backgroundClasses]"
  >
    <!-- Scroll fade left -->
    <div v-if="canScrollStart" class="scroll-fade scroll-fade-left pointer-events-none">
      <div class="scroll-arrow arrow-left">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </div>
    <!-- Scroll fade right -->
    <div v-if="canScrollEnd" class="scroll-fade scroll-fade-right pointer-events-none">
      <div class="scroll-arrow arrow-right">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </div>

    <div
      ref="navContentRef"
      class="flex mx-auto h-12 items-center justify-start px-2 space-x-1 overflow-x-auto scrollbar-hide"
      @scroll="updateScrollIndicators"
    >
      <button
        v-for="item in items"
        :key="item.name"
        class="subnav-button"
        :class="{ 'active-subnav-button': item.value === activeItem }"
        @click="selectItem(item.value)"
        :title="item.name"
        :aria-label="item.badge ? `${item.name} (${item.badge})` : undefined"
      >
        {{ item.name }}
        <!-- Optional count badge (e.g. unseen items of a tab) -->
        <span v-if="item.badge" class="subnav-badge" aria-hidden="true">{{ item.badge }}</span>
      </button>
    </div>
  </div>
</template>
<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';

// The stage (App.vue) must start below the fixed SubNav so its rounded top
// corners stay visible instead of being covered by this bar. Registering via a
// root CSS variable keeps App.vue route-agnostic. The module-level counter
// guards against mount/unmount ordering during transitions between two pages
// that both have a SubNav.
let mountedSubnavCount = 0;

function applyStageOffset() {
  document.documentElement.style.setProperty(
    '--subnav-offset',
    mountedSubnavCount > 0 ? '3rem' : '0px'
  );
}
import { useOrientation } from '@/composables/useOrientation';
const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
  activeItem: {
    type: String,
    required: true,
  },
});
const emit = defineEmits(['update:activeItem']);
function selectItem(value) {
  emit('update:activeItem', value);
}
const { isLandscape } = useOrientation();
// Responsive positioning classes - basierend auf tatsächlicher Navbar-Breite
const subnavClasses = computed(() => ({
  // Portrait mode - below main navigation (left: 0, top: after nav)
  'left-0 top-20 w-full': !isLandscape.value,
  // Landscape mode - top of screen, starting after the navbar sidebar
  'left-(--nav-width) top-0 w-[calc(100vw-var(--nav-width))]': isLandscape.value,
}));
// Fixed frame surface color, matching Navbar/StatusBar so all bars read as one surface.
const backgroundClasses = ['bg-gray-900/95', 'backdrop-blur-sm'];

// Scroll fade gradients must match the actual background, which is an instance
// color class picked at runtime (see NavigationComp's updateNavFadeColor).
const subnavRef = ref(null);
function updateFadeColor() {
  nextTick(() => {
    const el = subnavRef.value;
    if (!el) return;
    const bg = getComputedStyle(el).backgroundColor;
    if (bg) {
      el.style.setProperty('--subnav-fade-color', bg);
    }
  });
}

// Scroll indicators
const navContentRef = ref(null);
const canScrollStart = ref(false);
const canScrollEnd = ref(false);

function updateScrollIndicators() {
  const el = navContentRef.value;
  if (!el) return;
  const threshold = 5;
  canScrollStart.value = el.scrollLeft > threshold;
  canScrollEnd.value = el.scrollLeft + el.clientWidth < el.scrollWidth - threshold;
}

onMounted(() => {
  mountedSubnavCount++;
  applyStageOffset();
  nextTick(() => updateScrollIndicators());
  updateFadeColor();
});

onBeforeUnmount(() => {
  mountedSubnavCount = Math.max(0, mountedSubnavCount - 1);
  applyStageOffset();
});

watch(
  () => props.items,
  () => nextTick(() => updateScrollIndicators()),
  { deep: true }
);
</script>
<style scoped>
@reference '../assets/tailwind.css';
.subnav {
  @apply transition-all duration-300 ease-in-out;
}
.subnav-button {
  @apply shrink-0 h-auto
    bg-transparent
    text-gray-400
    rounded-md
    hover:text-gray-200
    hover:bg-gray-800/30
    transition-all
    duration-200
    ease-out
    focus:outline-none
    px-2 py-1.5 sm:px-4 sm:py-2
    text-xs sm:text-sm
    max-w-52
    flex
    items-center
    justify-center
    gap-1 sm:gap-2
    relative;
}
.subnav-button::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background-color: transparent;
  transition: all 200ms ease-out;
}
.subnav-button:hover::after {
  background-color: rgba(6, 182, 212, 0.3);
}
.active-subnav-button {
  @apply text-cyan-400;
}
.subnav-badge {
  @apply min-w-4 h-4 px-1 rounded-full bg-status-danger text-[10px] font-bold leading-4 text-gray-950 tabular-nums;
}
.active-subnav-button::after {
  background-color: rgba(6, 182, 212, 1) !important;
  box-shadow: 0 0 8px rgba(6, 182, 212, 0.6);
}
/* Landscape mode specific styles */
@media screen and (orientation: landscape) {
  .subnav {
    left: var(--nav-width) !important; /* matches the navbar sidebar width */
    right: 0 !important; /* Bis zum rechten Rand */
    width: calc(100% - var(--nav-width)) !important; /* Volle Breite minus Navbar */
    top: 0 !important;
  }
}
/* Safe Area Support for portrait only */
@media screen and (orientation: portrait) {
  @supports (padding-top: env(safe-area-inset-top)) {
    .subnav {
      top: calc(5rem + env(safe-area-inset-top)) !important;
    }
  }
}

/* Scroll Fade Indicators */
.scroll-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
}
.scroll-fade {
  --fade: var(--subnav-fade-color, rgba(17, 24, 39, 0.95));
}
.scroll-fade-left {
  left: 0;
  width: 40px;
  background: linear-gradient(
    to right,
    var(--fade) 0%,
    color-mix(in srgb, var(--fade) 80%, transparent) 50%,
    transparent 100%
  );
}
.scroll-fade-right {
  right: 0;
  width: 40px;
  background: linear-gradient(
    to left,
    var(--fade) 0%,
    color-mix(in srgb, var(--fade) 80%, transparent) 50%,
    transparent 100%
  );
}
.scroll-arrow {
  width: 16px;
  height: 16px;
  color: rgba(255, 255, 255, 0.4);
}
.scroll-arrow svg {
  width: 100%;
  height: 100%;
}
.arrow-left {
  position: absolute;
  left: 4px;
}
.arrow-right {
  position: absolute;
  right: 4px;
}
</style>
