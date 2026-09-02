<template>
  <div>
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      class="block w-full rounded-chip bg-surface-2"
      :style="{ height: `${height}px` }"
    >
      <!-- Light reference grid -- purely a proportion/position aid, not a coordinate readout. -->
      <line
        v-for="gx in gridX"
        :key="'gx' + gx"
        :x1="gx"
        :y1="padding"
        :x2="gx"
        :y2="height - padding"
        stroke="#334155"
        stroke-width="1"
        opacity="0.4"
      />
      <line
        v-for="gy in gridY"
        :key="'gy' + gy"
        :x1="padding"
        :y1="gy"
        :x2="width - padding"
        :y2="gy"
        stroke="#334155"
        stroke-width="1"
        opacity="0.4"
      />

      <path
        :d="pathD"
        fill="none"
        stroke="#a78bfa"
        stroke-width="1.8"
        stroke-linecap="round"
        opacity="0.85"
      />
      <circle v-for="(p, i) in plotted" :key="i" :cx="p.x" :cy="p.y" r="1.6" fill="#a78bfa" />
      <circle
        v-if="plotted.length"
        :cx="plotted[0].x"
        :cy="plotted[0].y"
        r="5"
        fill="none"
        stroke="#22d3ee"
        stroke-width="1.5"
        opacity="0.6"
      />
      <circle v-if="plotted.length" :cx="plotted[0].x" :cy="plotted[0].y" r="3" fill="#22d3ee" />
      <text
        v-if="plotted.length"
        :x="plotted[0].x + labelDx(plotted[0].x)"
        :y="height - 6"
        font-size="8"
        fill="#64748b"
        :text-anchor="labelAnchor(plotted[0].x)"
      >
        {{ points[0]?.date }}
      </text>
      <text
        v-if="plotted.length"
        :x="plotted[plotted.length - 1].x + labelDx(plotted[plotted.length - 1].x)"
        :y="12"
        font-size="8"
        fill="#64748b"
        :text-anchor="labelAnchor(plotted[plotted.length - 1].x)"
      >
        {{ points[points.length - 1]?.date }}
      </text>

      <!--
        Scale bar: a real angular reference for the line's own length, not a coordinate grid.
        Pinned inside the plot rectangle's own bottom-left corner (not the outer padding margin,
        where the date labels live) so it can't collide with either date label regardless of
        which end of the path happens to land near which edge.
      -->
      <g v-if="scaleBar">
        <line
          :x1="padding"
          :y1="height - padding - 6"
          :x2="padding + scaleBar.px"
          :y2="height - padding - 6"
          stroke="#94a3b8"
          stroke-width="1.5"
        />
        <line
          :x1="padding"
          :y1="height - padding - 9"
          :x2="padding"
          :y2="height - padding - 3"
          stroke="#94a3b8"
          stroke-width="1.5"
        />
        <line
          :x1="padding + scaleBar.px"
          :y1="height - padding - 9"
          :x2="padding + scaleBar.px"
          :y2="height - padding - 3"
          stroke="#94a3b8"
          stroke-width="1.5"
        />
        <text
          :x="padding"
          :y="height - padding - 11"
          font-size="8"
          fill="#94a3b8"
          text-anchor="start"
        >
          {{ scaleBar.label }}
        </text>
      </g>
    </svg>
    <p v-if="driftSummary" class="mt-1 text-[11px] text-content-faint">{{ driftSummary }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  points: { type: Array, required: true }, // [{ date, raHours, decDeg }]
});

const width = 320;
const height = 150;
const padding = 24;

/**
 * Normalizes the path's own RA/Dec span into the SVG's plotting box -- this is a relative
 * finder-chart plot (shape of the motion night to night), not a fixed sky-coordinate grid, so
 * scaling to fit whatever span this particular object's path covers is correct here. Because RA
 * and Dec are each independently stretched to fill the box, the plotted line's own aspect ratio
 * doesn't represent a true angular shape -- the scale bar below approximates a real angular
 * length along the line itself, not a per-axis coordinate scale.
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
  return plotted.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
});

// A few faint interior gridlines -- purely a visual proportion aid (is the line steep? does it
// cross a third of the box?), not a labeled coordinate readout.
const gridX = [1, 2, 3].map((i) => padding + (i / 4) * (width - 2 * padding));
const gridY = [1, 2, 3].map((i) => padding + (i / 4) * (height - 2 * padding));

// Date labels sit at the path's own endpoints, which are near the chart's left/right edges by
// construction -- anchoring them "middle" (centered on the point) pushes half the text past the
// SVG boundary. Anchoring away from whichever edge the point is nearest keeps the label inside
// the box regardless of which endpoint (first or last) happens to fall on which side.
function labelAnchor(x) {
  return x < width / 2 ? 'start' : 'end';
}
function labelDx(x) {
  return x < width / 2 ? 4 : -4;
}

const DEG2RAD = Math.PI / 180;

// True angular separation between the path's two endpoints -- cos(dec)-compensated (same
// convention as OrbitalTracking.cs's own tracking-rate math), unlike the chart's own plot, which
// independently stretches RA and Dec and so isn't a true angular shape.
const endpointDriftDeg = computed(() => {
  if (props.points.length < 2) return null;
  const first = props.points[0];
  const last = props.points[props.points.length - 1];
  let dRaHours = last.raHours - first.raHours;
  while (dRaHours > 12) dRaHours -= 24;
  while (dRaHours < -12) dRaHours += 24;
  const dRaDeg = dRaHours * 15;
  const dDecDeg = last.decDeg - first.decDeg;
  const avgDecRad = ((first.decDeg + last.decDeg) / 2) * DEG2RAD;
  return Math.sqrt((dRaDeg * Math.cos(avgDecRad)) ** 2 + dDecDeg ** 2);
});

function formatDeg(deg) {
  if (deg >= 1) return `${deg.toFixed(deg < 10 ? 2 : 1)}°`;
  if (deg * 60 >= 1) return `${(deg * 60).toFixed(deg * 60 < 10 ? 1 : 0)}′`;
  return `${(deg * 3600).toFixed(0)}″`;
}

const driftSummary = computed(() => {
  const totalDeg = endpointDriftDeg.value;
  if (totalDeg == null || props.points.length < 2) return '';
  const nights = props.points.length - 1;
  const perNightDeg = totalDeg / nights;
  return t('perihelion.path.driftSummary', {
    total: formatDeg(totalDeg),
    nights,
    perNight: formatDeg(perNightDeg),
  });
});

// Bar length in px for a "nice" round angular value, derived from the actual pixel distance
// between the two plotted endpoints and their real angular separation -- so it reflects the
// line's own effective scale rather than a separate, potentially inconsistent per-axis figure.
const NICE_DEG_STEPS = [
  { deg: 1 / 3600, label: '1″' },
  { deg: 2 / 3600, label: '2″' },
  { deg: 5 / 3600, label: '5″' },
  { deg: 10 / 3600, label: '10″' },
  { deg: 30 / 3600, label: '30″' },
  { deg: 1 / 60, label: '1′' },
  { deg: 2 / 60, label: '2′' },
  { deg: 5 / 60, label: '5′' },
  { deg: 10 / 60, label: '10′' },
  { deg: 30 / 60, label: '30′' },
  { deg: 1, label: '1°' },
  { deg: 2, label: '2°' },
  { deg: 5, label: '5°' },
  { deg: 10, label: '10°' },
  { deg: 20, label: '20°' },
  { deg: 30, label: '30°' },
];

const scaleBar = computed(() => {
  const totalDeg = endpointDriftDeg.value;
  if (!totalDeg || plotted.value.length < 2) return null;
  const first = plotted.value[0];
  const last = plotted.value[plotted.value.length - 1];
  const pxDistance = Math.hypot(last.x - first.x, last.y - first.y);
  if (pxDistance < 1) return null;
  const degPerPx = totalDeg / pxDistance;

  const maxBarPx = (width - 2 * padding) * 0.4;
  let chosen = NICE_DEG_STEPS[0];
  for (const step of NICE_DEG_STEPS) {
    const px = step.deg / degPerPx;
    if (px > maxBarPx) break;
    chosen = step;
  }
  const px = chosen.deg / degPerPx;
  if (!Number.isFinite(px) || px < 4) return null;
  return { px, label: chosen.label };
});
</script>
