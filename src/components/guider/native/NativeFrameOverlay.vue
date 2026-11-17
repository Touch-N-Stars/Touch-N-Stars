<template>
  <!-- Star overlay of a guide frame: viewBox in frame pixels, letterboxed ("meet") exactly like an
       object-contain image of the same frame underneath it. -->
  <svg
    class="absolute inset-0 w-full h-full pointer-events-none"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="xMidYMid meet"
  >
    <!-- Search region around the lock position -->
    <rect
      v-if="searchRegion"
      :x="searchRegion.x"
      :y="searchRegion.y"
      :width="searchRegion.size"
      :height="searchRegion.size"
      fill="none"
      stroke="#fbbf24"
      stroke-opacity="0.55"
      stroke-dasharray="5 4"
      stroke-width="1.2"
      vector-effect="non-scaling-stroke"
    />
    <!-- Rejected / unused stars -->
    <g v-for="(star, i) in rejectedStars" :key="`r${i}`">
      <circle
        :cx="star.x"
        :cy="star.y"
        :r="sizes.star"
        fill="none"
        stroke="#94a3b8"
        stroke-opacity="0.8"
        stroke-dasharray="3 3"
        vector-effect="non-scaling-stroke"
        stroke-width="1.2"
      />
    </g>
    <!-- Secondary stars, coloured by weight -->
    <g v-for="(star, i) in secondaryStars" :key="`s${i}`">
      <circle
        :cx="star.x"
        :cy="star.y"
        :r="sizes.star"
        fill="none"
        stroke="#22d3ee"
        :stroke-opacity="weightOpacity(star)"
        vector-effect="non-scaling-stroke"
        stroke-width="1.6"
      />
      <text
        v-if="showLabels"
        :x="star.x + sizes.star * 1.15"
        :y="star.y - sizes.star * 0.6"
        :font-size="sizes.font"
        fill="#a5f3fc"
        fill-opacity="0.9"
      >
        {{ fmt(star.snr, 0) }}
      </text>
    </g>
    <!-- Primary star: ticks and corner brackets outside the star, nothing on top of it -->
    <g v-if="primaryStar" stroke="#34d399" fill="none">
      <line
        v-for="(seg, i) in reticleSegments(primaryStar, primaryGap, primaryGap + sizes.tick)"
        :key="`pt-${i}`"
        :x1="seg[0]"
        :y1="seg[1]"
        :x2="seg[2]"
        :y2="seg[3]"
        stroke-width="1.6"
        vector-effect="non-scaling-stroke"
      />
      <path
        :d="cornerBrackets(primaryStar, primaryGap * 0.9, sizes.tick * 0.55)"
        stroke-width="1.4"
        vector-effect="non-scaling-stroke"
      />
      <text
        v-if="showLabels"
        :x="primaryStar.x + primaryGap + sizes.tick * 0.5"
        :y="primaryStar.y - primaryGap - sizes.tick * 0.2"
        :font-size="sizes.font * 1.1"
        fill="#6ee7b7"
        stroke="none"
        font-weight="bold"
      >
        {{ fmt(primaryStar.snr, 0) }}
      </text>
    </g>
    <!-- Lock position: a "+" with an open centre, drawn after the primary star; while the star sits on it (the usual
         case when guiding) its arms start outside the primary star's marker, so both stay visible -->
    <g v-if="lockReticle" stroke="#fbbf24" stroke-width="1.5">
      <line
        v-for="(seg, i) in reticleSegments(lock, lockReticle.inner, lockReticle.outer)"
        :key="`lock-${i}`"
        :x1="seg[0]"
        :y1="seg[1]"
        :x2="seg[2]"
        :y2="seg[3]"
        vector-effect="non-scaling-stroke"
      />
    </g>
    <!-- Selected star highlight -->
    <circle
      v-if="selected"
      :cx="selected.x"
      :cy="selected.y"
      :r="sizes.star * 1.6"
      fill="none"
      stroke="#f8fafc"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
    />
    <!-- Tapped point without a marked star: where a new guide star would be searched -->
    <g v-if="pick" stroke="#f8fafc" stroke-width="1.2" fill="none">
      <circle
        :cx="pick.x"
        :cy="pick.y"
        :r="sizes.star * 1.6"
        stroke-dasharray="4 3"
        vector-effect="non-scaling-stroke"
      />
      <line
        v-for="(seg, i) in reticleSegments(pick, sizes.gap, sizes.lock)"
        :key="`pick-${i}`"
        :x1="seg[0]"
        :y1="seg[1]"
        :x2="seg[2]"
        :y2="seg[3]"
        vector-effect="non-scaling-stroke"
      />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue';
import { fmt } from '@/utils/nativeGuider';

const props = defineProps({
  /** Frame size in its own pixels (the coordinate system of stars and lock). */
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  /** AdvancedGuideStar[] ({ x, y, snr, isPrimary, used, weight }). */
  stars: { type: Array, default: () => [] },
  /** Lock position { x, y } or null. */
  lock: { type: Object, default: null },
  /** Screen pixels per frame pixel (fit scale × zoom): marks keep a constant on-screen size. */
  scale: { type: Number, default: 0.5 },
  showLabels: { type: Boolean, default: true },
  /** Highlighted star (tap details) or null. */
  selected: { type: Object, default: null },
  /** Tapped point { x, y } away from the marked stars (choosing a guide star there), or null. */
  pick: { type: Object, default: null },
  /** Search-region box { x, y, size } in frame pixels, or null. */
  searchRegion: { type: Object, default: null },
});

/** Overlay sizes in frame pixels for a constant on-screen size. */
const sizes = computed(() => {
  const f = 1 / (props.scale || 1);
  // gap: free space kept around a star by reticles (screen px converted to image px)
  return { star: 11 * f, box: 10 * f, lock: 16 * f, gap: 6 * f, tick: 9 * f, font: 11 * f };
});

const primaryStar = computed(() => props.stars.find((s) => s.isPrimary) || null);
const secondaryStars = computed(() => props.stars.filter((s) => !s.isPrimary && s.used));
const rejectedStars = computed(() => props.stars.filter((s) => !s.isPrimary && !s.used));
const maxWeight = computed(() =>
  Math.max(0.0001, ...secondaryStars.value.map((s) => Number(s.weight) || 0))
);

// Clear radius around the primary star: at least 8 screen px, more when zoomed in on a big star.
const primaryGap = computed(() => {
  const f = 1 / (props.scale || 1);
  const hfd = Number(primaryStar.value?.hfd);
  return Math.max(8 * f, Number.isFinite(hfd) ? hfd * 1.3 : 0);
});

// Lock "+": the usual small gap, but when the primary star sits on the lock position its arms start outside the star's
// ticks, otherwise the primary marker (drawn at the same place) would cover them.
const lockReticle = computed(() => {
  if (!props.lock) return null;
  const f = 1 / (props.scale || 1);
  const p = primaryStar.value;
  const reach = primaryGap.value + sizes.value.tick;
  const covered = p && Math.hypot(p.x - props.lock.x, p.y - props.lock.y) < reach;
  const inner = covered ? reach + 3 * f : sizes.value.gap;
  return { inner, outer: inner + (sizes.value.lock - sizes.value.gap) };
});

function weightOpacity(star) {
  const w = Math.max(0, Number(star.weight) || 0) / maxWeight.value;
  return 0.35 + 0.65 * Math.min(1, w);
}

/** Four line segments of a "+" around p that leave a hole of radius `inner`. */
function reticleSegments(p, inner, outer) {
  return [
    [p.x - outer, p.y, p.x - inner, p.y],
    [p.x + inner, p.y, p.x + outer, p.y],
    [p.x, p.y - outer, p.x, p.y - inner],
    [p.x, p.y + inner, p.x, p.y + outer],
  ];
}

/** SVG path of four corner brackets of a square with half-size `r` around p. */
function cornerBrackets(p, r, len) {
  const c = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  return c
    .map(([sx, sy]) => {
      const x = p.x + sx * r;
      const y = p.y + sy * r;
      return `M ${x - sx * len} ${y} L ${x} ${y} L ${x} ${y - sy * len}`;
    })
    .join(' ');
}
</script>
