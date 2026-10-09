<template>
  <!-- Profile plot zoomed to the star (a few HFD), not the whole crop; its size comes from the parent -->
  <div class="relative min-h-24 min-w-0 rounded-control bg-surface-2 border border-line">
    <div v-if="profiles" class="absolute inset-1.5">
      <svg :viewBox="`0 0 ${W} ${H}`" class="w-full h-full block" preserveAspectRatio="none">
        <line :x1="0" :y1="H - 1" :x2="W" :y2="H - 1" stroke="rgba(148,163,184,0.25)" />
        <polyline
          :points="radialPoints"
          fill="none"
          stroke="#22d3ee"
          stroke-width="1.5"
          stroke-opacity="0.35"
          vector-effect="non-scaling-stroke"
        />
        <polyline
          :points="horizontalPoints"
          fill="none"
          stroke="#60a5fa"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
        />
        <polyline
          :points="verticalPoints"
          fill="none"
          stroke="#f87171"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
        />
        <!-- Half maximum -->
        <line
          :x1="0"
          :y1="halfMaxY"
          :x2="W"
          :y2="halfMaxY"
          stroke="rgba(251,191,36,0.5)"
          stroke-dasharray="4 3"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>
    <p
      v-else
      class="absolute inset-0 flex items-center justify-center text-center text-xs text-content-faint"
    >
      {{ t('components.guider.native.profile.noStar') }}
    </p>
    <div
      v-if="profiles"
      class="absolute top-1 right-2 flex gap-2 text-[10px] text-content-faint pointer-events-none"
    >
      <span class="text-[#60a5fa]">{{ t('components.guider.native.profile.horizontal') }}</span>
      <span class="text-[#f87171]">{{ t('components.guider.native.profile.vertical') }}</span>
      <span class="text-accent/70">{{ t('components.guider.native.profile.radial') }}</span>
    </div>
    <span
      v-if="profiles"
      class="absolute top-1 left-2 text-[10px] text-content-faint tabular-nums pointer-events-none"
    >
      ±{{ halfWindow }} px ·
      <span :class="{ 'text-status-danger': saturated }"
        >{{ t('components.guider.native.profile.peak') }} {{ Math.round(profiles.max) }}</span
      >
    </span>
    <p
      v-if="saturated"
      class="absolute bottom-0 inset-x-0 px-2 py-0.5 bg-surface-1/85 text-[10px] leading-tight text-status-danger"
    >
      {{ t('components.guider.native.profile.saturated') }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { saturationLevel, starProfiles } from '@/utils/nativeGuider';

const props = defineProps({
  /** Raw crop { x0, y0, width, height, pixels } around the primary star. */
  crop: { type: Object, default: null },
  /** Primary star { x, y, hfd }. */
  star: { type: Object, default: null },
  bitDepth: { type: Number, default: 16 },
});

const { t } = useI18n();
const W = 160;
const H = 120;

const profiles = computed(() =>
  props.crop && props.star ? starProfiles(props.crop, props.star.x, props.star.y) : null
);

// Half-width (px) of the plotted window: ±2.5 HFD around the centre, at least ±5 px,
// never more than the crop - the flat background beyond that only wastes space.
const half = computed(() => {
  const p = profiles.value;
  return p ? Math.max(1, Math.floor((p.horizontal.length - 1) / 2)) : 1;
});
const halfWindow = computed(() => {
  const hfd = Number(props.star?.hfd);
  const wanted = Number.isFinite(hfd) && hfd > 0 ? Math.ceil(2.5 * hfd) : half.value;
  return Math.min(half.value, Math.max(5, wanted));
});

function windowed(values) {
  if (!values?.length) return [];
  const centre = Math.floor((values.length - 1) / 2);
  return values.slice(Math.max(0, centre - halfWindow.value), centre + halfWindow.value + 1);
}

function scaleY(value) {
  const p = profiles.value;
  const range = Math.max(1, p.max - p.min);
  return H - 2 - ((value - p.min) / range) * (H - 6);
}

function toPoints(values) {
  if (!values?.length) return '';
  const step = values.length > 1 ? W / (values.length - 1) : W;
  return values.map((v, i) => `${(i * step).toFixed(1)},${scaleY(v).toFixed(1)}`).join(' ');
}

const horizontalPoints = computed(() =>
  profiles.value ? toPoints(windowed(profiles.value.horizontal)) : ''
);
const verticalPoints = computed(() =>
  profiles.value ? toPoints(windowed(profiles.value.vertical)) : ''
);

// Radial profile mirrored around the centre so it overlays the cuts at the same scale.
const radialPoints = computed(() => {
  const p = profiles.value;
  if (!p) return '';
  const pxPerUnit = W / (2 * halfWindow.value);
  const inside = p.radial.filter((e) => e.r <= halfWindow.value);
  const left = [...inside]
    .reverse()
    .map((e) => `${(W / 2 - e.r * pxPerUnit).toFixed(1)},${scaleY(e.value).toFixed(1)}`);
  const right = inside.map(
    (e) => `${(W / 2 + e.r * pxPerUnit).toFixed(1)},${scaleY(e.value).toFixed(1)}`
  );
  return [...left, ...right].join(' ');
});

const halfMaxY = computed(() => {
  const p = profiles.value;
  if (!p) return H;
  return scaleY(p.min + (p.max - p.min) / 2);
});

const saturated = computed(() => {
  const p = profiles.value;
  return p ? p.max >= saturationLevel(props.bitDepth) : false;
});
</script>
