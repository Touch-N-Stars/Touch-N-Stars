<template>
  <div class="flex flex-col gap-2">
    <!-- Bar: imaging, pause (tracking off) and flip window around the meridian -->
    <div class="relative h-8 rounded-control bg-surface-2 overflow-hidden" aria-hidden="true">
      <div
        class="absolute inset-y-0 bg-accent/25"
        :style="segment(-span.before, pause > 0 ? -pause : max)"
      ></div>
      <div
        v-if="pause > 0"
        class="absolute inset-y-0 bg-status-warn/30 pause-stripes"
        :style="segment(-pause, min)"
      ></div>
      <div class="absolute inset-y-0 bg-status-ok/50" :style="windowStyle"></div>
      <div class="absolute inset-y-0 bg-accent/25" :style="segment(max, span.after)"></div>
      <div class="absolute inset-y-0 w-0.5 bg-content" :style="{ left: `${pos(0)}%` }"></div>
    </div>

    <!-- Labels under the bar -->
    <div class="relative h-10 text-xs text-content-muted">
      <span
        v-if="pause > 0"
        class="absolute top-5 -translate-x-full pr-1 text-status-warn"
        :style="{ left: `${pos(-pause)}%` }"
      >
        {{ $t('components.mount.settings.meridian_flip.timeline.pauseMinutes', { pause }) }}
      </span>
      <span
        class="absolute -translate-x-1/2 font-semibold text-content"
        :style="{ left: `${pos(0)}%` }"
      >
        {{ $t('components.mount.settings.meridian_flip.timeline.meridian') }}
      </span>
      <span
        class="absolute top-5 -translate-x-1/2 text-status-ok"
        :style="{ left: `${pos((min + max) / 2)}%` }"
      >
        {{ windowLabel }}
      </span>
    </div>

    <!-- Legend -->
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-muted">
      <span class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-sm bg-accent/25"></span>
        {{ $t('components.mount.settings.meridian_flip.timeline.imaging') }}
      </span>
      <span v-if="pause > 0" class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-sm bg-status-warn/30 pause-stripes"></span>
        {{ $t('components.mount.settings.meridian_flip.timeline.trackingOff') }}
      </span>
      <span class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-sm bg-status-ok/50"></span>
        {{ $t('components.mount.settings.meridian_flip.timeline.flip') }}
      </span>
    </div>

    <p class="text-sm text-content">{{ explanation }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  pause: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 0 },
});

const { t } = useI18n();

const pause = computed(() => Math.max(0, props.pause));
const min = computed(() => Math.max(0, props.min));
// NINA treats a max below min like min = max, so the bar does the same.
const max = computed(() => Math.max(min.value, props.max));

// Minutes shown on each side of the meridian, with some imaging before and after.
const span = computed(() => ({
  before: Math.max(10, pause.value * 2),
  after: Math.max(10, max.value * 1.3, min.value + 10),
}));

function pos(minutes) {
  const total = span.value.before + span.value.after;
  return ((minutes + span.value.before) / total) * 100;
}

function segment(from, to) {
  const left = pos(from);
  return { left: `${left}%`, width: `${Math.max(0, pos(to) - left)}%` };
}

// A min = max window still needs a visible sliver.
const windowStyle = computed(() => {
  const style = segment(min.value, max.value);
  return min.value === max.value ? { ...style, width: '4px' } : style;
});

const windowLabel = computed(() =>
  min.value === max.value
    ? t('components.mount.settings.meridian_flip.timeline.atMinutes', { min: min.value })
    : t('components.mount.settings.meridian_flip.timeline.windowMinutes', {
        min: min.value,
        max: max.value,
      })
);

const explanation = computed(() => {
  const base = 'components.mount.settings.meridian_flip.timeline';
  if (pause.value > 0) {
    return t(`${base}.explainPause`, { pause: pause.value, min: min.value });
  }
  if (min.value === max.value) {
    return t(`${base}.explainFixed`, { min: min.value });
  }
  return t(`${base}.explainWindow`, { min: min.value, max: max.value });
});
</script>

<style scoped>
.pause-stripes {
  background-image: repeating-linear-gradient(
    45deg,
    transparent 0 4px,
    rgba(0, 0, 0, 0.25) 4px 8px
  );
}
</style>
