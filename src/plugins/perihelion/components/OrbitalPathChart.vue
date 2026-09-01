<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    class="block w-full rounded-chip bg-surface-2"
    :style="{ height: `${height}px` }"
  >
    <path :d="pathD" fill="none" stroke="#a78bfa" stroke-width="1.8" stroke-linecap="round" opacity="0.85" />
    <circle
      v-for="(p, i) in plotted"
      :key="i"
      :cx="p.x"
      :cy="p.y"
      r="1.6"
      fill="#a78bfa"
    />
    <circle v-if="plotted.length" :cx="plotted[0].x" :cy="plotted[0].y" r="5" fill="none" stroke="#22d3ee" stroke-width="1.5" opacity="0.6" />
    <circle v-if="plotted.length" :cx="plotted[0].x" :cy="plotted[0].y" r="3" fill="#22d3ee" />
    <text v-if="plotted.length" :x="plotted[0].x" :y="height - 6" font-size="8" fill="#64748b" text-anchor="middle">
      {{ points[0]?.date }}
    </text>
    <text v-if="plotted.length" :x="plotted[plotted.length - 1].x" :y="12" font-size="8" fill="#64748b" text-anchor="middle">
      {{ points[points.length - 1]?.date }}
    </text>
  </svg>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  points: { type: Array, required: true }, // [{ date, raHours, decDeg }]
});

const width = 320;
const height = 150;
const padding = 14;

/**
 * Normalizes the path's own RA/Dec span into the SVG's plotting box -- this is a relative
 * finder-chart plot (shape of the motion night to night), not a fixed sky-coordinate grid, so
 * scaling to fit whatever span this particular object's path covers is correct here.
 */
const plotted = computed(() => {
  if (!props.points.length) return [];

  // RA wraps at 24h -- unwrap relative to the first point so a path crossing 24h/0h doesn't
  // plot as a spurious jump across the whole chart width.
  const raUnwrapped = [];
  let prevRa = props.points[0].raHours;
  for (const p of props.points) {
    let ra = p.raHours;
    while (ra - prevRa > 12) ra -= 24;
    while (ra - prevRa < -12) ra += 24;
    raUnwrapped.push(ra);
    prevRa = ra;
  }

  const minRa = Math.min(...raUnwrapped);
  const maxRa = Math.max(...raUnwrapped);
  const minDec = Math.min(...props.points.map((p) => p.decDeg));
  const maxDec = Math.max(...props.points.map((p) => p.decDeg));
  const raSpan = Math.max(maxRa - minRa, 0.01);
  const decSpan = Math.max(maxDec - minDec, 0.01);

  return props.points.map((p, i) => {
    // RA increases to the west visually on sky charts (east is left) -- flip so the plotted
    // direction of motion reads naturally left-to-right for whichever way this object drifts.
    const x = padding + ((raUnwrapped[i] - minRa) / raSpan) * (width - 2 * padding);
    const y = height - padding - ((p.decDeg - minDec) / decSpan) * (height - 2 * padding);
    return { x, y };
  });
});

const pathD = computed(() => {
  if (plotted.value.length < 2) return '';
  return plotted.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
});
</script>
