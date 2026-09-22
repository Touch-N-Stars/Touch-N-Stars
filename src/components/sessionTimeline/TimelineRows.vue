<template>
  <div ref="container" class="w-full select-none">
    <svg
      ref="svg"
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      class="block touch-pan-y"
      :aria-label="$t('components.sequence.timeline.title')"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click="onClick"
    >
      <g v-for="(row, rowIndex) in rows" :key="row.key">
        <rect
          :y="rowIndex * ROW_HEIGHT"
          :width="width"
          :height="ROW_HEIGHT"
          :fill="rowIndex % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'"
        />
        <text
          :x="labelWidth - 8"
          :y="rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2"
          text-anchor="end"
          dominant-baseline="middle"
          class="fill-gray-300"
          font-size="11"
        >
          {{ $t(`components.sequence.timeline.rows.${row.key}`) }}
        </text>
        <line
          :x1="labelWidth"
          :x2="plotRight"
          :y1="rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2"
          :y2="rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2"
          stroke="rgba(255,255,255,0.12)"
        />
      </g>

      <g v-for="tick in ticks" :key="tick">
        <line :x1="xOf(tick)" :x2="xOf(tick)" :y2="rowsHeight" stroke="rgba(255,255,255,0.08)" />
        <text
          :x="xOf(tick)"
          :y="rowsHeight + 16"
          text-anchor="middle"
          class="fill-gray-400"
          font-size="11"
        >
          {{ formatClock(tick, { seconds: tickSeconds }) }}
        </text>
      </g>

      <g v-for="(row, rowIndex) in visibleRows" :key="`bars-${row.key}`">
        <rect
          v-for="(item, index) in row.items"
          :key="index"
          :x="item.x"
          :y="rowIndex * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2"
          :width="item.w"
          :height="BAR_HEIGHT"
          :fill="item.color"
          :fill-opacity="item.bar.open ? 0.55 : 0.9"
          :stroke="isSelected(row.key, item.bar) ? '#ffffff' : 'none'"
          stroke-width="2"
          rx="2"
        />
      </g>

      <!-- Overview: the whole session, the shown view highlighted, captures as marks -->
      <g pointer-events="none">
        <rect
          :x="labelWidth"
          :y="stripY"
          :width="plotWidth"
          :height="STRIP_HEIGHT"
          rx="3"
          fill="rgba(255,255,255,0.06)"
        />
        <rect
          v-for="(mark, index) in stripMarks"
          :key="index"
          :x="mark.x"
          :y="stripY + 4"
          :width="mark.w"
          :height="STRIP_HEIGHT - 8"
          :fill="mark.color"
          fill-opacity="0.6"
        />
        <rect
          :x="highlight.x1"
          :y="stripY"
          :width="Math.max(2, highlight.x2 - highlight.x1)"
          :height="STRIP_HEIGHT"
          rx="3"
          fill="rgba(34,211,238,0.28)"
          stroke="#22d3ee"
          stroke-width="1.5"
        />
        <rect
          v-for="x in [highlight.x1, highlight.x2]"
          :key="x"
          :x="x - 4"
          :y="stripY - 3"
          width="8"
          :height="STRIP_HEIGHT + 6"
          rx="3"
          fill="#22d3ee"
        />
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { BAR_COLORS, formatClock } from '@/utils/sessionTimelineUtils';
import { brushMode, brushView, tickCount, timeTicks } from '@/utils/timeWindow';
import {
  DRAG_THRESHOLD_PX,
  localPoint,
  useTimeWindowGestures,
} from '@/composables/useTimeWindowGestures';

const props = defineProps({
  rows: { type: Array, required: true },
  view: { type: Object, required: true }, // { start, end } in ms: what the rows show
  bounds: { type: Object, required: true }, // the whole session, shown by the overview strip
  selected: { type: Object, default: null }, // { row, start } of the selected bar
  // Shared with the statistics graph so both plot areas line up
  labelWidth: { type: Number, required: true },
  padRight: { type: Number, required: true },
});

const emit = defineEmits(['select', 'update:view', 'reset']);

const ROW_HEIGHT = 48; // min-h-touch
const BAR_HEIGHT = 22;
const AXIS_HEIGHT = 24;
const STRIP_HEIGHT = 20;
const STRIP_MARGIN = 8; // above and below the strip, part of its touch target
const HANDLE_GRAB_PX = 14;
const TAP_SLOP_PX = 10;

const container = ref(null);
const svg = ref(null);
const width = ref(360);
let observer = null;

const rowsHeight = computed(() => props.rows.length * ROW_HEIGHT);
const stripY = computed(() => rowsHeight.value + AXIS_HEIGHT + STRIP_MARGIN);
const height = computed(() => stripY.value + STRIP_HEIGHT + STRIP_MARGIN);
const plotWidth = computed(() => Math.max(1, width.value - props.labelWidth - props.padRight));
const plotRight = computed(() => props.labelWidth + plotWidth.value);

const scale = (range) => {
  const span = Math.max(1, range.end - range.start);
  const clamp = (x) => Math.min(plotRight.value, Math.max(props.labelWidth, x));
  return {
    x: (t) => clamp(props.labelWidth + ((t - range.start) / span) * plotWidth.value),
    t: (x) => range.start + ((clamp(x) - props.labelWidth) / plotWidth.value) * span,
  };
};
const viewScale = computed(() => scale(props.view));
const boundsScale = computed(() => scale(props.bounds));
const xOf = (t) => viewScale.value.x(t);

const ticks = computed(() =>
  timeTicks(props.view.start, props.view.end, tickCount(plotWidth.value))
);
const tickSeconds = computed(() => props.view.end - props.view.start < 5 * 60e3);

const visibleRows = computed(() =>
  props.rows.map((row) => ({
    key: row.key,
    items: row.bars
      .filter((bar) => bar.end >= props.view.start && bar.start <= props.view.end)
      .map((bar) => {
        const x = xOf(bar.start);
        const minWidth = bar.marker ? 3 : 2;
        return {
          bar,
          x: bar.marker ? x - minWidth / 2 : x,
          w: Math.max(minWidth, xOf(bar.end) - x),
          color: bar.color || BAR_COLORS[bar.state] || '#9ca3af',
        };
      }),
  }))
);

const highlight = computed(() => ({
  x1: boundsScale.value.x(props.view.start),
  x2: boundsScale.value.x(props.view.end),
}));

const stripMarks = computed(() => {
  const capture = props.rows.find((row) => row.key === 'capture');
  return (capture?.bars ?? []).map((bar) => {
    const x = boundsScale.value.x(bar.start);
    return { x, w: Math.max(1, boundsScale.value.x(bar.end) - x), color: bar.color };
  });
});

const isSelected = (rowKey, bar) =>
  props.selected?.row === rowKey && props.selected.start === bar.start;

// Rows: pan, pinch and wheel like the statistics graph. Overview strip: a range brush.
const gestures = useTimeWindowGestures({
  element: () => svg.value,
  getView: () => props.view,
  getBounds: () => props.bounds,
  getPlot: () => ({ left: props.labelWidth, width: plotWidth.value }),
  onChange: (view) => emit('update:view', view),
  onReset: () => emit('reset'),
});

let brush = null; // { pointerId, mode, x, anchorT, view, dragging }

function onPointerDown(event) {
  const { x, y } = localPoint(svg.value, event);
  if (x < props.labelWidth || brush) return;
  if (y < stripY.value - STRIP_MARGIN) return gestures.onPointerDown(event);
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
  const { x1, x2 } = highlight.value;
  const full = x1 <= props.labelWidth + 1 && x2 >= plotRight.value - 1;
  brush = {
    pointerId: event.pointerId,
    mode: brushMode({ x, x1, x2, grab: HANDLE_GRAB_PX, full }),
    x,
    anchorT: boundsScale.value.t(x),
    view: { ...props.view },
    dragging: false,
  };
}

function onPointerMove(event) {
  if (!brush) return gestures.onPointerMove(event);
  if (event.pointerId !== brush.pointerId) return;
  if (event.pointerType === 'mouse' && event.buttons === 0) return onPointerUp(event);
  const { x } = localPoint(svg.value, event);
  if (!brush.dragging) {
    if (Math.abs(x - brush.x) < DRAG_THRESHOLD_PX) return;
    brush.dragging = true;
    svg.value.setPointerCapture?.(event.pointerId);
  }
  const t = boundsScale.value.t(x);
  emit('update:view', brushView(brush.mode, brush.anchorT, t, brush.view, props.bounds));
}

function onPointerUp(event) {
  if (!brush) return gestures.onPointerUp(event);
  if (event.pointerId !== brush.pointerId) return;
  if (brush.dragging) gestures.markDragEnd(event);
  if (svg.value.hasPointerCapture?.(event.pointerId)) {
    svg.value.releasePointerCapture(event.pointerId);
  }
  brush = null;
}

// A tap selects the nearest bar of its row: markers are only a few pixels wide
function onClick(event) {
  if (gestures.isClickAfterDrag(event)) return;
  const { x, y } = localPoint(svg.value, event);
  const row = visibleRows.value[Math.floor(y / ROW_HEIGHT)];
  if (!row || x < props.labelWidth) return;
  let best = null;
  for (const item of row.items) {
    const distance = Math.max(item.x - x, x - (item.x + item.w), 0);
    if (distance <= TAP_SLOP_PX && (!best || distance < best.distance)) best = { item, distance };
  }
  if (best) emit('select', { row: row.key, bar: best.item.bar });
}

onMounted(() => {
  observer = new ResizeObserver((entries) => {
    const w = Math.floor(entries[0]?.contentRect?.width || 0);
    if (w > 0) width.value = w;
  });
  observer.observe(container.value);
  svg.value.addEventListener('wheel', gestures.onWheel, { passive: false });
});

onBeforeUnmount(() => {
  observer?.disconnect();
  svg.value?.removeEventListener('wheel', gestures.onWheel);
});
</script>
