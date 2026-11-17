<template>
  <div class="tns-card flex flex-col gap-2 min-w-0">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-content">
        {{ t('components.guider.native.target.title') }}
      </h3>
      <div class="flex items-center gap-2">
        <span class="text-[11px] text-content-faint tabular-nums">
          {{ t('components.guider.native.target.lastSteps', { count: points.length }) }}
        </span>
        <button
          type="button"
          class="tns-btn-secondary w-auto! px-2!"
          :class="starView ? 'text-accent!' : ''"
          :title="t('components.guider.native.target.starView')"
          :aria-label="t('components.guider.native.target.starView')"
          :aria-pressed="starView"
          data-testid="target-star-view-toggle"
          @click="toggleStarView"
        >
          <StarIconSolid v-if="starView" class="w-5 h-5" />
          <StarIcon v-else class="w-5 h-5" />
        </button>
      </div>
    </div>

    <div class="relative mx-auto w-full max-w-[320px]">
      <!-- Star view: the guide star at the plot's scale, the lock position in the centre -->
      <canvas
        v-if="starImage"
        ref="starCanvas"
        class="star-canvas absolute rounded-full bg-black"
        :class="starFrame?.lost ? 'opacity-40' : ''"
        data-testid="target-star-image"
      ></canvas>
      <svg
        viewBox="0 0 200 200"
        class="relative block w-full h-auto"
        :class="starView ? 'on-star' : ''"
        role="img"
        :aria-label="t('components.guider.native.target.title')"
      >
        <!-- Sky behind the star view, also while there is no star to show -->
        <circle v-if="starView && !starImage" :cx="C" :cy="C" :r="PLOT_R" fill="#000" />

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
        <template v-if="!starView">
          <text :x="C + PLOT_R + 2" :y="C - 3" text-anchor="end" class="axis-label">
            {{ t('components.guider.native.target.ra') }}
          </text>
          <text :x="C + 3" :y="C - PLOT_R + 7" class="axis-label">
            {{ t('components.guider.native.target.dec') }}
          </text>
        </template>
        <!-- Star view: camera axes; where RA and Dec point, from the calibration -->
        <g v-for="arrow in arrows" :key="arrow.id" :data-testid="`target-arrow-${arrow.id}`">
          <line
            :x1="arrow.x1"
            :y1="arrow.y1"
            :x2="arrow.x2"
            :y2="arrow.y2"
            :stroke="arrow.color"
            stroke-width="1.4"
          />
          <polygon :points="arrow.head" :fill="arrow.color" />
          <text
            :x="arrow.labelX"
            :y="arrow.labelY"
            text-anchor="middle"
            dominant-baseline="central"
            class="axis-label"
            :style="{ fill: arrow.color }"
          >
            {{ arrow.label }}
          </text>
        </g>

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
          v-bind="pointStyle(p)"
        />
        <circle
          v-if="newest"
          :cx="newest.cx"
          :cy="newest.cy"
          r="3.2"
          :fill="ACCENT"
          :stroke="starView ? OUTLINE_COLOR : '#ffffff'"
          stroke-width="0.8"
        />
      </svg>
      <div
        v-if="starView && starFrame?.lost"
        class="absolute top-[9%] inset-x-0 flex justify-center pointer-events-none"
      >
        <span
          class="rounded-control bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-status-warn"
        >
          {{ t('components.guider.native.target.starLost') }}
        </span>
      </div>
      <div
        v-if="points.length === 0"
        class="absolute inset-0 flex justify-center px-6 text-center text-xs text-content-muted pointer-events-none"
        :class="starImage ? 'items-end pb-[11%]' : 'items-center'"
      >
        <span :class="starImage ? 'rounded-control bg-black/70 px-1.5 py-0.5' : ''">
          {{ t('components.guider.native.target.empty') }}
        </span>
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
      <span
        v-if="starImage?.saturated && !starFrame?.lost"
        class="font-semibold text-status-danger"
        :title="t('components.guider.native.profile.saturated')"
        data-testid="target-star-saturated"
      >
        {{ t('components.guider.native.target.saturated') }}
      </span>
      <span class="text-content-faint">
        {{ t('components.guider.native.target.scale', { value: withUnit(radius) }) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { StarIcon } from '@heroicons/vue/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/vue/24/solid';
import apiService from '@/services/apiService';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { fmt, starViewImage, windowRms } from '@/utils/nativeGuider';
import { readStored, writeStored } from '@/utils/safeStorage';
import {
  medianHfd,
  starViewArrows,
  starViewCropSize,
  starViewFrame,
  starViewPoints,
  starViewRadius,
  stepsUpToFrame,
  targetPoints,
  targetRadius,
} from './graphData';

const props = defineProps({
  /** Number of most recent steps plotted. */
  window: { type: Number, default: 100 },
  /** 'arcsec' | 'px' */
  unit: { type: String, default: 'arcsec' },
  /** Only an active (visible) plot fetches the star of the star view. */
  active: { type: Boolean, default: true },
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
// Star view: points in a colour a grey star doesn't have, with a dark outline.
const STAR_POINT_COLOR = '#a3e635';
const OUTLINE_COLOR = 'rgba(2, 6, 23, 0.85)';
// Same colours as the calibration diagram
const RA_COLOR = '#60a5fa';
const DEC_COLOR = '#f87171';

const STAR_VIEW_STORAGE_KEY = 'nativeGuider.target.starView';
const starView = ref(readStored(STAR_VIEW_STORAGE_KEY, 'false') === 'true');
/** Star shown by the star view (starViewFrame), null when none. */
const starFrame = ref(null);
const starCanvas = ref(null);

function toggleStarView() {
  starView.value = !starView.value;
  writeStored(STAR_VIEW_STORAGE_KEY, starView.value);
}

// The star view shows the steps up to the frame of the star, so the newest point is on that star.
const shownFrameNumber = computed(() =>
  starView.value && starFrame.value?.crop && !starFrame.value.lost
    ? starFrame.value.frameNumber
    : null
);

const windowSteps = computed(() => {
  const steps = toRaw(store.steps) || [];
  return stepsUpToFrame(steps, shownFrameNumber.value).slice(-Math.max(1, props.window));
});

// Camera px in the plot's unit
const pxToUnit = computed(() => (props.unit === 'px' ? 1 : store.pixelScale || 1));

const points = computed(() =>
  starView.value
    ? starViewPoints(windowSteps.value, { window: props.window, pxToUnit: pxToUnit.value })
    : targetPoints(windowSteps.value, { window: props.window, unit: props.unit })
);

const rms = computed(() => windowRms(windowSteps.value, props.unit));

const radius = computed(() => {
  if (!starView.value) return targetRadius(points.value, rms.value.total, 1);
  const hfd = medianHfd(windowSteps.value);
  return starViewRadius(points.value, rms.value.total, hfd === null ? null : hfd * pxToUnit.value);
});

const radiusPx = computed(() => radius.value / pxToUnit.value);

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
  // The star view keeps the camera's y axis (down, as on the guide frame); Dec points up.
  return { cx: C + dx, cy: starView.value ? C + dy : C - dy };
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

function pointStyle(p) {
  if (!starView.value) {
    return { fill: p.settling ? SETTLE_COLOR : POINT_COLOR, 'fill-opacity': p.opacity };
  }
  return {
    fill: p.settling ? SETTLE_COLOR : STAR_POINT_COLOR,
    stroke: OUTLINE_COLOR,
    'stroke-width': 0.6,
    opacity: p.opacity,
  };
}

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

// --- Star view ------------------------------------------------------------------------------------

const arrows = computed(() => {
  if (!starView.value) return [];
  return starViewArrows(store.calibration, store.isCalibrated).map(({ id, angle }) => {
    const a = (angle * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const at = (r) => ({ x: C + r * cos, y: C + r * sin });
    const tail = at(PLOT_R - 18);
    const tip = at(PLOT_R - 2);
    const base = at(PLOT_R - 7);
    const label = at(PLOT_R - 25);
    // Arrow head corners perpendicular to the arrow
    const px = -3 * sin;
    const py = 3 * cos;
    return {
      id,
      color: id === 'ra' ? RA_COLOR : DEC_COLOR,
      label: t(`components.guider.native.target.${id}`),
      x1: tail.x,
      y1: tail.y,
      x2: base.x,
      y2: base.y,
      head: `${tip.x},${tip.y} ${base.x + px},${base.y + py} ${base.x - px},${base.y - py}`,
      labelX: label.x,
      labelY: label.y,
    };
  });
});

const starImage = computed(() => {
  const frame = starFrame.value;
  if (!starView.value || !frame?.crop) return null;
  return starViewImage(frame.crop, {
    lockX: frame.lockX,
    lockY: frame.lockY,
    radiusPx: radiusPx.value,
    bitDepth: frame.bitDepth,
  });
});

watch(
  [starImage, starCanvas],
  ([image, canvas]) => {
    if (!image || !canvas) return;
    canvas.width = image.size;
    canvas.height = image.size;
    canvas.getContext('2d')?.putImageData(new ImageData(image.rgba, image.size), 0, 0);
  },
  { flush: 'post' }
);

let fetching = false;
let queued = false;

/** Loads the latest frame's star; a refresh asked for while one is loading follows it. */
async function refreshStar() {
  if (!starView.value || !props.active || !store.isAvailable) return;
  if (fetching) {
    queued = true;
    return;
  }
  fetching = true;
  try {
    const info = await apiService.getNativeGuiderFrameInfo({
      cropSize: starViewCropSize(radiusPx.value),
    });
    if (starView.value) starFrame.value = starViewFrame(info, store.state, starFrame.value);
  } catch (e) {
    // No frame yet (404) or a failed request: the plot without a star
    if (!e?.cancelled) starFrame.value = null;
  } finally {
    fetching = false;
    if (queued) {
      queued = false;
      refreshStar();
    }
  }
}

watch(
  () => store.latestFrameNumber,
  () => refreshStar()
);
watch(
  () => [starView.value, props.active, store.isAvailable],
  ([on, active, available]) => {
    if (!on) starFrame.value = null;
    else if (active && available) refreshStar();
  },
  { immediate: true }
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

/* The canvas covers the outer ring: viewBox 12..188 of 200 */
.star-canvas {
  left: 6%;
  top: 6%;
  width: 88%;
  height: 88%;
}

/* Labels on the star view get a dark halo, so they stay readable on the star */
.on-star .ring-label,
.on-star .axis-label {
  paint-order: stroke;
  stroke: rgba(2, 6, 23, 0.85);
  stroke-width: 2px;
  stroke-linejoin: round;
}
</style>
