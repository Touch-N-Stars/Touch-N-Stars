<template>
  <!-- One rated quality explained for someone who does not know the numbers. Sits on top of the
       status bar's docked panel in simple mode, above content that needs the room (the guide
       graph), so it starts small: the rating with its scale (green, yellow, red zone) and the
       current value. A tap on the header adds the limits, what it measures and what to do. -->
  <section class="flex flex-col gap-1 text-sm max-w-2xl">
    <button
      type="button"
      class="flex items-center gap-2 min-h-touch -my-2 text-left"
      :aria-expanded="open"
      data-haptic="none"
      @click="open = !open"
    >
      <span class="tns-dot shrink-0" :class="LEVEL_DOT[quality.level] ?? 'bg-content-faint'"></span>
      <span class="shrink-0 font-semibold text-content">{{ $t(`${base}.title`) }}</span>
      <span v-if="quality.word" class="shrink-0 text-content-muted">· {{ quality.word }}</span>

      <span class="relative flex-1 min-w-12 h-4 ml-1" aria-hidden="true">
        <span class="absolute inset-x-0 top-1 h-2 flex rounded-full overflow-hidden">
          <span class="bg-status-ok/60" :style="{ width: `${quality.zones.good}%` }"></span>
          <span class="bg-status-warn/60" :style="{ width: `${quality.zones.ok}%` }"></span>
          <span class="flex-1 bg-status-danger/60"></span>
        </span>
        <span
          v-if="quality.percent !== null"
          class="absolute top-0 h-4 w-1.5 -ml-0.75 rounded-full bg-content ring-2 ring-surface-1"
          :style="{ left: `${quality.percent}%` }"
        ></span>
      </span>

      <ChevronDownIcon
        class="w-4 h-4 shrink-0 text-content-muted transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <p v-if="quality.now" class="text-content">{{ quality.now }}</p>
    <template v-if="open">
      <p class="text-content-muted">{{ quality.limits }}</p>
      <p class="text-content-muted">{{ $t(`${base}.what`) }}</p>
      <p class="text-content-muted">{{ $t(`${base}.fix`) }}</p>
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  /** One of the qualities of useImagingQuality() */
  quality: { type: Object, required: true },
});

const LEVEL_DOT = { good: 'bg-status-ok', ok: 'bg-status-warn', poor: 'bg-status-danger' };

const open = ref(false);

const base = computed(() => `components.simpleMode.cockpit.explain.${props.quality.key}`);
</script>
