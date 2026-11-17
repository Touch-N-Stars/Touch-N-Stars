<template>
  <!-- Where the time of a guide cycle goes, live: medians of the recent cycles and the last one -->
  <div
    class="flex flex-col gap-2 border-t border-line pt-3 text-xs"
    data-testid="native-guider-timing"
  >
    <div class="flex items-baseline justify-between gap-2">
      <span class="text-content-muted">{{ t(`${base}.fps`) }}</span>
      <span
        class="text-sm font-semibold tabular-nums text-accent"
        data-testid="native-guider-timing-fps"
        >{{ formatFps(timing.fps) }} fps</span
      >
    </div>

    <div class="timing-grid">
      <div></div>
      <div class="col-head">{{ t(`${base}.median`) }}</div>
      <div class="col-head">{{ t(`${base}.last`) }}</div>

      <template v-for="row in ROWS" :key="row.key">
        <div
          class="row-label"
          :class="{ 'font-semibold text-content': row.emphasis || row.total, 'pl-3': row.part }"
        >
          {{ t(`${base}.rows.${row.key}`) }}
        </div>
        <div class="row-value" :class="valueClass(row)">
          {{ formatMs(timing.median[row.field]) }}
        </div>
        <div class="row-value" :class="valueClass(row)">
          {{ formatMs(timing.last[row.field]) }}
        </div>
      </template>
    </div>

    <p class="text-[11px] leading-snug text-content-faint">
      {{ t(`${base}.note`, { count: timing.cycles }) }}
    </p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { formatFps, formatMs } from '@/utils/nativeGuider';

defineProps({
  /** guideTiming(status): `{ fps, cycles, median, last }`. */
  timing: { type: Object, required: true },
});

const { t } = useI18n();
const base = 'components.guider.native.strip.timing';

// Frame → first pulse first: it spans the processing, so it is not one more part of the cycle.
// The parts follow the whole cycle in the order they happen.
const ROWS = [
  { key: 'frameToPulse', field: 'frameToPulseMs', emphasis: true },
  { key: 'cycle', field: 'cycleMs', total: true },
  { key: 'exposure', field: 'exposureMs', part: true },
  { key: 'camera', field: 'cameraMs', part: true },
  { key: 'processing', field: 'processingMs', part: true },
  { key: 'pulse', field: 'pulseMs', part: true },
  { key: 'rest', field: 'otherMs', part: true },
];

function valueClass(row) {
  if (row.emphasis) return 'font-semibold text-accent';
  return row.total ? 'font-semibold' : '';
}
</script>

<style scoped>
@reference '../../../assets/tailwind.css';

.timing-grid {
  @apply grid items-baseline gap-x-3 gap-y-1;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr);
}

.col-head {
  @apply text-right text-[10px] font-bold uppercase tracking-wider text-content-faint truncate;
}

.row-label {
  @apply text-content-muted truncate;
}

.row-value {
  @apply text-right tabular-nums text-content;
}
</style>
