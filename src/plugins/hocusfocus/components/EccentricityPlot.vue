<template>
  <div class="flex flex-col gap-3">
    <!-- One cell per grid region, in image orientation. Each line runs along the stars' elongation. -->
    <svg
      :viewBox="`${-PAD} ${-PAD} ${data.Columns + 2 * PAD} ${data.Rows + 2 * PAD}`"
      class="w-full rounded-lg bg-gray-900/60"
      :style="{ aspectRatio: `${data.Columns + 2 * PAD} / ${data.Rows + 2 * PAD}` }"
      role="img"
      :aria-label="L('title')"
    >
      <rect
        v-for="cell in gridCells"
        :key="`bg-${cell.col}-${cell.row}`"
        :x="cell.col"
        :y="cell.row"
        width="1"
        height="1"
        :fill="isSelected(cell) ? 'rgba(34, 211, 238, 0.15)' : 'transparent'"
        stroke="rgba(107, 114, 128, 0.25)"
        stroke-width="0.01"
        class="cursor-pointer"
        @click="select(cell)"
      />
      <line
        v-for="v in vectors"
        :key="`v-${v.col}-${v.row}`"
        :x1="v.x1"
        :y1="v.y1"
        :x2="v.x2"
        :y2="v.y2"
        :stroke="v.color"
        stroke-width="0.07"
        stroke-linecap="round"
        pointer-events="none"
      />
    </svg>

    <!-- Tap a cell for its values; the plot's hover readout, made touch-friendly -->
    <div class="min-h-[1.5rem] text-sm">
      <p v-if="selectedCell" class="text-gray-300">
        <span class="text-gray-400">{{ L('eccentricity') }}</span>
        <span class="ml-1 text-gray-100 tabular-nums">{{
          selectedCell.Eccentricity.toFixed(2)
        }}</span>
        <span class="ml-4 text-gray-400">{{ L('angle') }}</span>
        <span class="ml-1 text-gray-100 tabular-nums">
          {{ selectedCell.AngleDegrees.toFixed(0) }}°
        </span>
        <span class="ml-4 text-gray-400">{{ L('stars') }}</span>
        <span class="ml-1 text-gray-100 tabular-nums">{{ selectedCell.StarCount }}</span>
      </p>
      <p v-else-if="selected" class="text-gray-400">{{ L('noStarsInCell') }}</p>
      <p v-else class="text-gray-400">{{ L('tapHint') }}</p>
    </div>

    <!-- Colour scale, only when HocusFocus' colour map option is on -->
    <div v-if="data.ColorMapEnabled" class="flex items-center gap-2 text-xs text-gray-400">
      <span class="tabular-nums">≤ {{ COLOR_MIN_E }}</span>
      <div
        class="h-2 flex-1 rounded"
        :style="{ background: `linear-gradient(to right, ${rampCss})` }"
      ></div>
      <span class="tabular-nums">≥ {{ COLOR_MAX_E }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  // Response of GET /hocusfocus/eccentricity with Available === true
  data: { type: Object, required: true },
});

const { t } = useI18n();
const L = (key) => t(`plugins.hocusfocus.eccentricity.${key}`);

// Rendering constants from HocusFocus' own vector plot (InspectorVM.AnalyzeStarDetectionResult +
// HFVectorField). A line is 2.5·e² scaled by 1.5, in cells, and centred on its cell. The length is
// absolute, not normalised to the frame: a frame of e=0.2 stars draws short lines, and from e≈0.52 a
// line outgrows its cell, which is why the plot keeps a margin. The colour map runs green ->
// green-yellow -> red for eccentricity 0.3 -> 0.6.
const LENGTH_PER_E_SQUARED = 2.5 * 1.5;
const PAD = 0.5;
const COLOR_MIN_E = 0.3;
const COLOR_MAX_E = 0.6;
const RAMP = [
  [0, 128, 0], // Green
  [173, 255, 47], // GreenYellow
  [255, 0, 0], // Red
];
const DEFAULT_COLOR = 'rgb(229, 231, 235)';

const rampCss = RAMP.map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`).join(', ');

function rampColor(eccentricity) {
  // HocusFocus interpolates on e², not e.
  const min = COLOR_MIN_E ** 2;
  const max = COLOR_MAX_E ** 2;
  const t01 = Math.min(1, Math.max(0, (eccentricity ** 2 - min) / (max - min)));
  const scaled = t01 * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const [r, g, b] = RAMP[i].map((c, k) => Math.round(c + (RAMP[i + 1][k] - c) * f));
  return `rgb(${r}, ${g}, ${b})`;
}

const cells = computed(() => props.data?.Cells || []);

const gridCells = computed(() => {
  const out = [];
  for (let row = 0; row < props.data.Rows; row++) {
    for (let col = 0; col < props.data.Columns; col++) out.push({ col, row });
  }
  return out;
});

const vectors = computed(() =>
  cells.value.map((c) => {
    const half = (LENGTH_PER_E_SQUARED * c.Eccentricity ** 2) / 2;
    const rad = (c.AngleDegrees * Math.PI) / 180;
    // Angle is in image coordinates (y down), which is also SVG's orientation.
    const dx = Math.cos(rad) * half;
    const dy = Math.sin(rad) * half;
    const cx = c.Col + 0.5;
    const cy = c.Row + 0.5;
    return {
      col: c.Col,
      row: c.Row,
      x1: cx - dx,
      y1: cy - dy,
      x2: cx + dx,
      y2: cy + dy,
      color: props.data.ColorMapEnabled ? rampColor(c.Eccentricity) : DEFAULT_COLOR,
    };
  })
);

const selected = ref(null);
const isSelected = (cell) => selected.value?.col === cell.col && selected.value?.row === cell.row;
const select = (cell) => (selected.value = isSelected(cell) ? null : cell);
const selectedCell = computed(() =>
  selected.value
    ? cells.value.find((c) => c.Col === selected.value.col && c.Row === selected.value.row)
    : null
);

// A new run can change the grid size; drop a selection that may no longer exist.
watch(
  () => [props.data?.Columns, props.data?.Rows],
  () => (selected.value = null)
);
</script>
