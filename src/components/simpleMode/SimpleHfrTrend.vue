<template>
  <!-- The sharpness of the last pictures as a line: lower HFR = sharper = higher up, so a
       line that sinks during the night asks for focusing again. -->
  <div v-if="series.length >= 2" class="flex flex-col gap-1">
    <div class="flex items-baseline justify-between gap-2">
      <span class="tns-label">
        {{ $t('components.simpleMode.live.trendTitle', { count: series.length }) }}
      </span>
      <span class="text-xs text-content-faint tabular-nums">
        {{ trendRange }}
      </span>
    </div>
    <svg
      :viewBox="`0 0 ${TREND_W} ${TREND_H}`"
      preserveAspectRatio="none"
      class="w-full h-12 rounded-chip bg-surface-2"
      role="img"
      :aria-label="$t('components.simpleMode.live.trendTitle', { count: series.length })"
    >
      <polyline
        :points="trendPoints"
        fill="none"
        stroke="var(--color-accent)"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
        stroke-linejoin="round"
      />
    </svg>
    <p class="text-xs text-content-faint">{{ $t('components.simpleMode.live.trendHint') }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { apiStore } from '@/store/store';
import { useImagetStore } from '@/store/imageStore';
import { hfrSeries } from '@/utils/simpleMode';
import { historyEntryKey, isHistoryEntryDeleted } from '@/utils/imageHistoryUtils';

const store = apiStore();
const imageStore = useImagetStore();

const isDeleted = (entry, index) =>
  isHistoryEntryDeleted(entry, historyEntryKey(index, entry), imageStore.deletedHistoryKeys);

const TREND_W = 300;
const TREND_H = 48;
const series = computed(() => hfrSeries(store.imageHistoryInfo, 30, isDeleted));
// The vertical scale spans at least this much HFR. Scaled to the data alone, 1.392 and 1.388
// filled the whole height and read as a steep change while the label said "1.39 - 1.39".
const TREND_MIN_SPAN = 0.5;
const trendBounds = computed(() => {
  const values = series.value.map((p) => p.hfr);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, TREND_MIN_SPAN);
  // Centre a widened scale on the data, so a steady series draws a flat line in the middle
  const bottom = (min + max) / 2 - span / 2;
  return { min, max, bottom, span };
});
const trendPoints = computed(() => {
  const points = series.value;
  const { bottom: min, span } = trendBounds.value;
  const pad = 4;
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * TREND_W;
      // Lower HFR = sharper = higher up, so "going down" reads as getting worse
      const y = pad + ((p.hfr - min) / span) * (TREND_H - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
});
const trendRange = computed(() => {
  const { min, max } = trendBounds.value;
  return `HFR ${min.toFixed(2)} – ${max.toFixed(2)}`;
});
</script>
