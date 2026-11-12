<template>
  <section class="tns-card flex flex-col gap-2 min-w-0" data-testid="guide-log-overview">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="text-sm font-semibold text-content">
        {{ t('plugins.guideLogViewer.overview.title') }}
      </h3>
      <span class="text-[11px] tabular-nums text-content-muted">
        {{ formatWall(view.t0) }} – {{ formatWall(view.t1) }} ·
        {{ formatDuration(view.t1 - view.t0) }}
      </span>
    </div>
    <div ref="wrapEl" class="relative w-full select-none touch-none">
      <canvas
        ref="canvasEl"
        class="block w-full cursor-crosshair"
        :style="{ height: `${HEIGHT}px` }"
        role="img"
        :aria-label="t('plugins.guideLogViewer.overview.aria')"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onCancel"
        @dblclick="emit('update:view', { ...model.span })"
      ></canvas>
      <div
        v-if="hover"
        class="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-chip border border-line bg-surface-1 px-2 py-1 text-[11px] tabular-nums text-content shadow"
        :style="{ left: `${hover.x}px` }"
      >
        <div>{{ hover.text }}</div>
        <div v-for="(l, i) in hover.lines" :key="i" class="flex items-center gap-1">
          <svg width="10" height="8" viewBox="0 0 10 8" aria-hidden="true">
            <path d="M0 0H10L5 8Z" :fill="l.color" />
          </svg>
          {{ l.text }}
        </div>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-content-muted">
      <span>{{ t('plugins.guideLogViewer.overview.hint') }}</span>
      <span class="ml-auto inline-flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="inline-flex items-center gap-1">
          <svg width="10" height="8" viewBox="0 0 10 8" aria-hidden="true">
            <path d="M0 0H10L5 8Z" :fill="SEVERITY_COLORS.bad" />
          </svg>
          <svg width="10" height="8" viewBox="0 0 10 8" aria-hidden="true">
            <path d="M0 0H10L5 8Z" :fill="SEVERITY_COLORS.warn" />
          </svg>
          {{ t('plugins.guideLogViewer.chart.legendFindings') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="inline-block h-2.5 w-0.5" :style="{ background: DROP_COLOR }"></span>
          {{ t('plugins.guideLogViewer.chart.starLost') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <span
            class="inline-block h-2.5 w-2.5 rounded-sm"
            :style="{ background: CALIBRATION_COLOR }"
          ></span>
          {{ t('plugins.guideLogViewer.sessions.calibration') }}
        </span>
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="text-content-faint">{{ t('plugins.guideLogViewer.overview.barsAre') }}</span>
        <span
          v-for="g in ['good', 'fair', 'poor', 'bad']"
          :key="g"
          class="inline-flex items-center gap-1"
        >
          <span
            class="inline-block h-2.5 w-2.5 rounded-sm"
            :style="{ background: GRADE_COLORS[g] }"
          ></span>
          {{ t(`plugins.guideLogViewer.grade.${g}`) }}
        </span>
      </span>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { lowerBound } from '../utils/analyzeGuideLog';
import { AXIS_COLOR, FONT, GRID_COLOR } from '@/components/guider/native/uplotTheme';
import {
  CALIBRATION_COLOR,
  DROP_COLOR,
  GRADE_COLORS,
  SEVERITY_COLORS,
  formatDistance,
  formatDuration,
  formatWall,
  gradeOf,
  markersAt,
  markerFindings,
} from '../utils/logView';
import { useFindingText } from './useFindingText';

const props = defineProps({
  model: { type: Object, required: true },
  view: { type: Object, required: true },
  findings: { type: Array, default: () => [] },
  exposures: { type: Array, default: () => [] },
  unit: { type: String, default: 'arcsec' },
});
const emit = defineEmits(['update:view']);
const { t } = useI18n();
const { title: findingTitle } = useFindingText();

const HEIGHT = 96;
// layout of the strip (CSS px)
const MARK_H = 10; // finding marks on top
const BAR_TOP = MARK_H + 2;
const BAR_H = 52; // rolling RMS bars
const EXP_TOP = BAR_TOP + BAR_H + 3; // exposures
const AXIS_TOP = EXP_TOP + 8;
const EDGE_PX = 14; // grab zone of the window edges

const wrapEl = ref(null);
const canvasEl = ref(null);
const hover = ref(null);
let width = 0;
let resizeObserver = null;
let drag = null;
let raf = null;

const span = computed(() => props.model.span);

function xOf(t) {
  const s = span.value;
  return ((t - s.t0) / (s.t1 - s.t0)) * width;
}

function tOf(x) {
  const s = span.value;
  return s.t0 + (Math.min(Math.max(x, 0), width) / width) * (s.t1 - s.t0);
}

/** Worst rolling RMS ratio per pixel column (NaN where nothing was guided). */
function columns() {
  const { series, rolling, typicalRms } = props.model;
  const cols = new Float64Array(Math.max(1, Math.ceil(width))).fill(NaN);
  const lost = new Uint8Array(cols.length);
  const typical = typicalRms > 0 ? typicalRms : 1;
  for (let i = 0; i < series.n; i++) {
    const c = Math.min(cols.length - 1, Math.max(0, Math.floor(xOf(series.t[i]))));
    if (series.drop[i]) {
      lost[c] = 1;
      continue;
    }
    const r = rolling[i] / typical;
    if (Number.isFinite(r) && !(cols[c] >= r)) cols[c] = r;
    else if (!Number.isFinite(cols[c])) cols[c] = 0;
  }
  return { cols, lost };
}

function draw() {
  raf = null;
  const canvas = canvasEl.value;
  // a log with no sessions yet has no span: nothing to draw
  if (!canvas || !width || !span.value) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(HEIGHT * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, HEIGHT);

  const { log } = props.model;
  // calibrations
  ctx.fillStyle = CALIBRATION_COLOR;
  for (const s of log.sections) {
    if (s.kind !== 'calibration') continue;
    const x0 = xOf(s.start);
    ctx.fillRect(x0, BAR_TOP, Math.max(3, xOf(s.end ?? s.start) - x0), BAR_H);
  }
  // guided sections: faint band
  ctx.fillStyle = GRID_COLOR;
  for (const s of log.sections) {
    if (s.kind !== 'guiding') continue;
    const x0 = xOf(s.start);
    ctx.fillRect(x0, BAR_TOP + BAR_H - 2, Math.max(1, xOf(s.end ?? s.start) - x0), 2);
  }
  // rolling RMS as bars, height up to 3 × typical
  const { cols, lost } = columns();
  for (let c = 0; c < cols.length; c++) {
    const r = cols[c];
    if (lost[c]) {
      ctx.fillStyle = DROP_COLOR;
      ctx.fillRect(c, BAR_TOP, 1, BAR_H);
      continue;
    }
    if (!Number.isFinite(r)) continue;
    const h = Math.max(2, (Math.min(r, 3) / 3) * BAR_H);
    ctx.fillStyle = GRADE_COLORS[gradeOf(r)];
    ctx.fillRect(c, BAR_TOP + BAR_H - h, 1, h);
  }
  // exposures
  for (const e of props.exposures) {
    const x0 = xOf(e.start);
    ctx.fillStyle = GRADE_COLORS[e.grade] || AXIS_COLOR;
    ctx.fillRect(x0 + 0.5, EXP_TOP, Math.max(1, xOf(e.end) - x0 - 1), 4);
  }
  // findings: little triangles on top, worst last
  const order = { info: 0, warn: 1, bad: 2 };
  const marks = markerFindings(props.findings).sort(
    (a, b) => order[a.severity] - order[b.severity]
  );
  for (const f of marks) {
    const x = xOf(f.t0);
    ctx.fillStyle = SEVERITY_COLORS[f.severity];
    ctx.beginPath();
    ctx.moveTo(x - 4, 0);
    ctx.lineTo(x + 4, 0);
    ctx.lineTo(x, MARK_H - 2);
    ctx.closePath();
    ctx.fill();
  }
  // hour ticks
  ctx.font = FONT;
  ctx.fillStyle = AXIS_COLOR;
  ctx.strokeStyle = GRID_COLOR;
  const s = span.value;
  const spanH = (s.t1 - s.t0) / 3600;
  const step = spanH > 8 ? 7200 : spanH > 2 ? 3600 : spanH > 0.75 ? 900 : 300;
  const minLabelGap = 44;
  let lastLabel = -Infinity;
  for (let tick = Math.ceil(s.t0 / step) * step; tick <= s.t1; tick += step) {
    const x = xOf(tick);
    ctx.beginPath();
    ctx.moveTo(x + 0.5, BAR_TOP);
    ctx.lineTo(x + 0.5, AXIS_TOP);
    ctx.stroke();
    if (x - lastLabel >= minLabelGap && x > 14 && x < width - 14) {
      ctx.textAlign = 'center';
      ctx.fillText(formatWall(tick, false), x, AXIS_TOP + 10);
      lastLabel = x;
    }
  }
  // the view: dim what is outside, frame what is inside
  const v0 = xOf(props.view.t0);
  const v1 = xOf(props.view.t1);
  const full = v0 <= 0.5 && v1 >= width - 0.5;
  if (!full) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
    ctx.fillRect(0, 0, Math.max(0, v0), AXIS_TOP);
    ctx.fillRect(v1, 0, Math.max(0, width - v1), AXIS_TOP);
  }
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    Math.max(0.75, v0),
    0.75,
    Math.max(2, Math.min(width - 0.75, v1) - Math.max(0.75, v0)),
    AXIS_TOP - 1.5
  );
  // edge handles
  ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
  for (const x of [v0, v1]) ctx.fillRect(x - 2, BAR_TOP + BAR_H / 2 - 9, 4, 18);
}

function schedule() {
  if (raf === null) raf = requestAnimationFrame(draw);
}

// --- Pointer: drag = select, drag inside the window = pan, edges = resize, tap = session ---

function localX(e) {
  const rect = canvasEl.value.getBoundingClientRect();
  return e.clientX - rect.left;
}

function onDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (!span.value) return;
  const x = localX(e);
  const v0 = xOf(props.view.t0);
  const v1 = xOf(props.view.t1);
  const zoomed = v1 - v0 < width - 2;
  // a window narrower than both grab zones is moved from inside, resized from just outside
  const narrow = v1 - v0 < 2 * EDGE_PX;
  const inside = x > v0 && x < v1;
  let mode = 'select';
  if (zoomed && narrow && inside) mode = 'pan';
  else if (Math.abs(x - v0) <= EDGE_PX && (!narrow || x <= v0)) mode = 'left';
  else if (Math.abs(x - v1) <= EDGE_PX && (!narrow || x >= v1)) mode = 'right';
  else if (zoomed && inside) mode = 'pan';
  drag = { mode, x0: x, view: { ...props.view }, moved: false, id: e.pointerId };
  canvasEl.value.setPointerCapture?.(e.pointerId);
}

function onMove(e) {
  const x = localX(e);
  updateHover(x);
  if (!drag || drag.id !== e.pointerId) return;
  if (Math.abs(x - drag.x0) > 4) drag.moved = true;
  if (!drag.moved) return;
  const dt = tOf(x) - tOf(drag.x0);
  if (drag.mode === 'pan') {
    emit('update:view', { t0: drag.view.t0 + dt, t1: drag.view.t1 + dt });
  } else if (drag.mode === 'left') {
    emit('update:view', { t0: Math.min(tOf(x), drag.view.t1 - 20), t1: drag.view.t1 });
  } else if (drag.mode === 'right') {
    emit('update:view', { t0: drag.view.t0, t1: Math.max(tOf(x), drag.view.t0 + 20) });
  } else {
    const a = tOf(drag.x0);
    const b = tOf(x);
    emit('update:view', { t0: Math.min(a, b), t1: Math.max(a, b) });
  }
}

function onUp(e) {
  if (!drag || drag.id !== e.pointerId) return;
  if (!drag.moved) tapAt(drag.x0);
  drag = null;
}

function onCancel() {
  drag = null;
  hover.value = null;
}

/** A tap selects the guiding session under it (the whole night when it is already shown). */
function tapAt(x) {
  const time = tOf(x);
  const s = props.model.log.sections.find(
    (sec) => sec.start <= time && (sec.end ?? sec.start) >= time
  );
  if (!s) {
    emit('update:view', { ...props.model.span });
    return;
  }
  const end = s.end ?? s.start + 60;
  const same = Math.abs(props.view.t0 - s.start) < 1 && Math.abs(props.view.t1 - end) < 1;
  emit('update:view', same ? { ...props.model.span } : { t0: s.start, t1: end });
}

function updateHover(x) {
  if (!width || !span.value) return;
  const time = tOf(x);
  const { series, rolling } = props.model;
  const i = Math.min(series.n - 1, lowerBound(series.t, time));
  let text = formatWall(time, false);
  if (i >= 0 && Math.abs(series.t[i] - time) < ((span.value.t1 - span.value.t0) / width) * 3) {
    const rms = rolling[i];
    if (Number.isFinite(rms)) {
      text += ` · ${t('plugins.guideLogViewer.overview.rolling')} ${formatDistance(
        rms,
        props.unit,
        series.scale[i]
      )}`;
    }
  }
  // the triangles and light frame under the pointer, named
  const perPx = (span.value.t1 - span.value.t0) / width;
  const found = markersAt(time, 6 * perPx, {
    findings: props.findings,
    exposures: props.exposures,
  });
  const lines = found.findings.map((f) => ({
    color: SEVERITY_COLORS[f.severity],
    text: findingTitle(f),
  }));
  if (found.exposure) {
    lines.push({
      color: GRADE_COLORS[found.exposure.grade],
      text: t('plugins.guideLogViewer.overview.lightFrame', { seconds: found.exposure.seconds }),
    });
  }
  hover.value = { x: Math.min(Math.max(x, 90), width - 90), text, lines };
}

function onLeave() {
  if (!drag) hover.value = null;
}

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    width = entries[0].contentRect.width;
    schedule();
  });
  resizeObserver.observe(wrapEl.value);
  canvasEl.value.addEventListener('pointerleave', onLeave);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  canvasEl.value?.removeEventListener('pointerleave', onLeave);
  if (raf !== null) cancelAnimationFrame(raf);
});

watch(() => [props.model, props.view, props.findings, props.exposures], schedule, {
  deep: false,
});
</script>
