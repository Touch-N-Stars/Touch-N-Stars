<template>
  <div class="tns-card flex flex-col gap-2 min-w-0">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="text-sm font-semibold text-content">
        {{ t('components.guider.native.target.title') }}
      </h3>
      <span class="text-[11px] text-content-faint tabular-nums">
        {{ t('components.guider.native.target.lastSteps', { count: points.length }) }}
      </span>
    </div>

    <div class="relative mx-auto w-full max-w-[320px]">
      <svg
        viewBox="0 0 200 200"
        class="block w-full h-auto"
        role="img"
        :aria-label="t('components.guider.native.target.title')"
      >
        <!-- Reference rings and axes -->
        <circle
          v-for="(ring, i) in rings"
          :key="i"
          :cx="C"
          :cy="C"
          :r="ring.r"
          fill="none"
          :stroke="LINE_COLOR"
          stroke-width="0.6"
          stroke-dasharray="2 2"
        />
        <line :x1="C - PLOT_R" :y1="C" :x2="C + PLOT_R" :y2="C" :stroke="LINE_COLOR" />
        <line :x1="C" :y1="C - PLOT_R" :x2="C" :y2="C + PLOT_R" :stroke="LINE_COLOR" />
        <text
          v-for="(ring, i) in rings"
          :key="`label-${i}`"
          :x="C + ring.r * 0.7071 + 1.5"
          :y="C - ring.r * 0.7071 - 1.5"
          class="ring-label"
        >
          {{ ring.label }}
        </text>
        <text :x="C + PLOT_R + 2" :y="C - 3" text-anchor="end" class="axis-label">
          {{ t('components.guider.native.target.ra') }}
        </text>
        <text :x="C + 3" :y="C - PLOT_R + 7" class="axis-label">
          {{ t('components.guider.native.target.dec') }}
        </text>

        <!-- RMS circle -->
        <circle
          v-if="rmsRadius > 0"
          :cx="C"
          :cy="C"
          :r="rmsRadius"
          :fill="ACCENT_FILL"
          :stroke="ACCENT"
          stroke-width="1.2"
        />

        <!-- Points: older ones fade out; settling steps in amber, on the outer ring when beyond the scale -->
        <circle
          v-for="(p, i) in plotted"
          :key="i"
          :cx="p.cx"
          :cy="p.cy"
          r="1.8"
          :fill="p.settling ? SETTLE_COLOR : POINT_COLOR"
          :fill-opacity="p.opacity"
        />
        <circle
          v-if="newest"
          :cx="newest.cx"
          :cy="newest.cy"
          r="3.2"
          :fill="ACCENT"
          stroke="#ffffff"
          stroke-width="0.8"
        />
      </svg>
      <div
        v-if="points.length === 0"
        class="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-content-muted pointer-events-none"
      >
        {{ t('components.guider.native.target.empty') }}
      </div>
    </div>

    <div class="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
      <span class="text-content">
        {{ t('components.guider.native.target.rms') }}
        <span class="font-semibold text-accent">{{ withUnit(rms.total) }}</span>
      </span>
      <span class="text-content-muted">
        {{ t('components.guider.native.target.ra') }} {{ withUnit(rms.ra) }} ·
        {{ t('components.guider.native.target.dec') }} {{ withUnit(rms.dec) }}
      </span>
      <span class="text-content-faint">
        {{ t('components.guider.native.target.scale', { value: withUnit(radius) }) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { fmt, windowRms } from '@/utils/nativeGuider';
import { targetPoints, targetRadius } from './graphData';

const props = defineProps({
  /** Number of most recent steps plotted. */
  window: { type: Number, default: 100 },
  /** 'arcsec' | 'px' */
  unit: { type: String, default: 'arcsec' },
});

const { t } = useI18n();
const store = useNativeGuiderStore();

// SVG geometry (viewBox 0..200): centre and radius of the outer ring.
const C = 100;
const PLOT_R = 88;
const LINE_COLOR = 'rgba(148, 163, 184, 0.28)';
const POINT_COLOR = '#e2e8f0';
const SETTLE_COLOR = '#fbbf24';
const ACCENT = '#22d3ee';
const ACCENT_FILL = 'rgba(34, 211, 238, 0.10)';

const windowSteps = computed(() => {
  const steps = toRaw(store.steps) || [];
  return steps.slice(-Math.max(1, props.window));
});

const points = computed(() =>
  targetPoints(windowSteps.value, { window: props.window, unit: props.unit })
);

const rms = computed(() => windowRms(windowSteps.value, props.unit));

const radius = computed(() => targetRadius(points.value, rms.value.total, 1));

const unitSymbol = computed(() =>
  props.unit === 'px'
    ? t('components.guider.native.graph.px')
    : t('components.guider.native.graph.arcsec')
);

function withUnit(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  return `${fmt(value, 2)}${unitSymbol.value}`;
}

function toSvg(x, y) {
  const scale = PLOT_R / radius.value;
  let dx = x * scale;
  let dy = y * scale;
  // Beyond the scale (settling after a dither): on the outer ring, in the direction of the point.
  const r = Math.hypot(dx, dy);
  if (r > PLOT_R) {
    dx *= PLOT_R / r;
    dy *= PLOT_R / r;
  }
  return { cx: C + dx, cy: C - dy };
}

const plotted = computed(() => {
  const list = points.value;
  // The newest point is drawn separately on top.
  return list.slice(0, Math.max(0, list.length - 1)).map((p) => ({ ...p, ...toSvg(p.x, p.y) }));
});

const newest = computed(() => {
  const list = points.value;
  if (!list.length) return null;
  const p = list[list.length - 1];
  return toSvg(p.x, p.y);
});

const rmsRadius = computed(() => {
  const total = rms.value.total;
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(PLOT_R, (total / radius.value) * PLOT_R);
});

const rings = computed(() =>
  [1 / 3, 2 / 3, 1].map((f) => ({
    r: PLOT_R * f,
    label: `${Number((radius.value * f).toPrecision(2))}`,
  }))
);
</script>

<style scoped>
.ring-label {
  font-size: 7px;
  fill: var(--color-content-faint);
  font-variant-numeric: tabular-nums;
}

.axis-label {
  font-size: 8px;
  font-weight: 600;
  fill: var(--color-content-muted);
}
</style>
