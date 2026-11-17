<script setup>
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { histogramBinAt, histogramView } from '../utils/histogramView';
const props = defineProps({ histogram: { type: Object, default: null } });
const { t, n } = useI18n();
const text = (key) => t(`luckycapture.${key}`);
const id = useId();
const fullRange = ref(false);
const logarithmic = ref(false);
const selected = ref(null);
const view = computed(() =>
  histogramView(props.histogram?.bins, {
    fullRange: fullRange.value,
    logarithmic: logarithmic.value,
  })
);
const percent = (value) => `${n(value, { maximumFractionDigits: 1 })}%`;
const ticks = computed(() =>
  Array.from({ length: 5 }, (_, index) =>
    percent(
      ((view.value.start + ((view.value.end + 1 - view.value.start) * index) / 4) / 256) * 100
    )
  )
);
const bin = computed(() =>
  selected.value == null
    ? null
    : Math.max(view.value.start, Math.min(view.value.end, selected.value))
);
const guide = computed(() =>
  bin.value == null
    ? null
    : ((bin.value - view.value.start + 0.5) / (view.value.end - view.value.start + 1)) * 512
);
const inspection = computed(() =>
  bin.value == null
    ? ''
    : `${percent((bin.value / 256) * 100)} - ${percent(((bin.value + 1) / 256) * 100)} / ${n(view.value.counts[bin.value])} ${text('histSamples')}`
);
function inspect(event) {
  const box = event.currentTarget.getBoundingClientRect();
  selected.value = histogramBinAt((event.clientX - box.left) / box.width, view.value);
}
function key(event) {
  let value = bin.value ?? view.value.start;
  if (event.key === 'ArrowLeft') value--;
  else if (event.key === 'ArrowRight') value++;
  else if (event.key === 'Home') value = view.value.start;
  else if (event.key === 'End') value = view.value.end;
  else return;
  event.preventDefault();
  selected.value = Math.max(view.value.start, Math.min(view.value.end, value));
}
</script>
<template>
  <section class="intensity-card" :aria-labelledby="`${id}-title`">
    <header class="hist-header">
      <h2 :id="`${id}-title`">{{ text('histTitle') }}</h2>
      <div class="hist-options">
        <button
          :aria-pressed="fullRange"
          :aria-label="`${text('histFull')}: ${text('histFullHelp')}`"
          @click="
            fullRange = !fullRange;
            selected = null;
          "
        >
          {{ text('histFull') }}
        </button>
        <button
          :aria-pressed="logarithmic"
          :aria-label="`${text('histLog')}: ${text('histLogHelp')}`"
          @click="logarithmic = !logarithmic"
        >
          {{ text('histLog') }}
        </button>
      </div>
    </header>
    <div
      v-if="!view.empty"
      class="hist-plot"
      tabindex="0"
      role="slider"
      :aria-label="text('histInspect')"
      :aria-valuemin="view.start"
      :aria-valuemax="view.end"
      :aria-valuenow="bin ?? view.start"
      :aria-valuetext="inspection || text('histInspectHelp')"
      @pointermove="inspect"
      @pointerleave="if ($event.pointerType === 'mouse') selected = null;"
      @pointerdown="inspect"
      @keydown="key"
      @focus="selected ??= view.start"
    >
      <svg viewBox="0 0 512 104" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient :id="`${id}-fill`" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#67d3ad" stop-opacity="0.6" />
            <stop offset="1" stop-color="#67d3ad" stop-opacity="0.1" />
          </linearGradient>
        </defs>
        <path class="grid" d="M0 25H512 M0 50H512 M0 75H512 M128 0V100 M256 0V100 M384 0V100" />
        <path
          :d="view.area"
          :fill="`url(#${id}-fill)`"
          stroke="#67d3ad"
          stroke-width="1.2"
          vector-effect="non-scaling-stroke"
        />
        <path
          v-if="guide !== null"
          :d="`M${guide} 0V100`"
          stroke="#fbbf24"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <span class="peak">{{ text('histPeak') }} {{ n(view.peak) }}</span>
    </div>
    <div v-else class="hist-empty">{{ text('histEmpty') }}</div>
    <div class="hist-axis" aria-hidden="true">
      <span v-for="(tick, index) in ticks" :key="index">{{ tick }}</span>
    </div>
    <p class="hist-caption">
      {{ inspection || text(fullRange ? 'histFullCaption' : 'histSignalCaption')
      }}<span v-if="logarithmic"> / {{ text('histLogCaption') }}</span>
    </p>
    <dl v-if="histogram" class="hist-values">
      <div v-for="metric in ['min', 'max', 'mean', 'median', 'p95']" :key="metric">
        <dt :aria-label="text(metric)">{{ metric === 'p95' ? 'P95' : text(metric) }}</dt>
        <dd>
          {{
            n(histogram[metric], {
              maximumFractionDigits: metric === 'mean' || metric === 'median' ? 1 : 0,
            })
          }}
        </dd>
      </div>
    </dl>
  </section>
</template>
<style scoped>
.intensity-card {
  container-type: inline-size;
  min-width: 0;
  border: 1px solid var(--lc-border, #69758a);
  border-radius: var(--radius-card, 14px);
  padding: 0.65rem 0.75rem;
  margin-bottom: 0.65rem;
}
.hist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.3rem 0.5rem;
  margin-bottom: 0.3rem;
}
h2 {
  font-weight: 600;
  font-size: 1rem;
}
.hist-options {
  display: flex;
  gap: 0.35rem;
}
button {
  min-height: 48px;
  min-width: 48px;
  border: 1px solid var(--lc-border, #69758a);
  padding: 0.35rem 0.6rem;
  border-radius: 10px;
  color: inherit;
  background: var(--color-surface-1, #111827);
  font: inherit;
  cursor: pointer;
}
button[aria-pressed='true'] {
  color: #22d3ee;
  border-color: #22d3ee;
  background: #123047;
}
button:focus-visible,
.hist-plot:focus-visible {
  outline: 3px solid #22d3ee;
  outline-offset: 3px;
}
.hist-plot,
.hist-empty {
  position: relative;
  height: 76px;
  background: #080b10;
  border-radius: 5px;
  overflow: hidden;
}
.hist-plot {
  touch-action: pan-y pinch-zoom;
}
svg {
  display: block;
  width: 100%;
  height: 100%;
}
.grid {
  stroke: #b8c5d833;
  stroke-dasharray: 2 3;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  fill: none;
}
.peak {
  position: absolute;
  right: 0.35rem;
  top: 0.15rem;
  padding: 0 0.2rem;
  color: #b8c5d8;
  background: #080b10cc;
  font-size: 0.75rem;
  pointer-events: none;
}
.hist-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: #b8c5d8;
  padding: 0.5rem;
  text-align: center;
}
.hist-axis {
  display: flex;
  justify-content: space-between;
  gap: 0.25rem;
  color: #b8c5d8;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  margin-top: 0.2rem;
}
.hist-caption {
  color: #b8c5d8;
  font-size: 0.75rem;
  line-height: 1.4;
  min-height: 1.4em;
  margin: 0.2rem 0 0.4rem;
  overflow-wrap: anywhere;
}
.hist-values {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem 0.6rem;
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.hist-values div {
  min-width: 0;
}
dt {
  color: #b8c5d8;
  font-size: 0.75rem;
  line-height: 1.4;
}
dd {
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.3;
  margin: 0;
}
@container (min-width: 340px) {
  .hist-values {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
</style>
