<template>
  <section class="tns-card flex flex-col gap-2 min-w-0" data-testid="history-chart">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h3 class="text-sm font-semibold text-content">
          {{ t('plugins.guideLogViewer.chart.title') }}
        </h3>
        <!-- RMS of what is shown, as the live guide graph does -->
        <span
          v-if="stats && !stats.empty"
          class="text-xs tabular-nums font-semibold text-content"
          data-testid="chart-rms"
        >
          {{ t('plugins.guideLogViewer.chart.rms') }} {{ v(stats.rmsTotal) }}
          <span class="font-normal text-content-muted">
            (<span :style="{ color: RA_COLOR }">{{ v(stats.rmsRa) }}</span> ·
            <span :style="{ color: DEC_COLOR }">{{ v(stats.rmsDec) }}</span
            >)
          </span>
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-1">
        <button
          type="button"
          class="toggle"
          :class="{ 'toggle-on': showPulses }"
          :aria-pressed="showPulses"
          @click="toggle('pulses')"
        >
          {{ t('plugins.guideLogViewer.chart.pulses') }}
        </button>
        <button
          type="button"
          class="toggle"
          :class="{ 'toggle-on': showFree }"
          :aria-pressed="showFree"
          :title="t('plugins.guideLogViewer.chart.freeHint')"
          @click="toggle('free')"
        >
          {{ t('plugins.guideLogViewer.chart.free') }}
        </button>
        <span class="mx-1 h-6 w-px bg-line"></span>
        <button
          v-for="b in navButtons"
          :key="b.key"
          type="button"
          class="nav-btn"
          :title="b.label"
          :aria-label="b.label"
          @click="b.action"
        >
          <component :is="b.icon" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Readout of the hovered step -->
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] tabular-nums min-h-4">
      <template v-if="readout">
        <span class="text-content-faint">{{ readout.time }} · #{{ readout.frame }}</span>
        <span v-if="readout.drop" class="font-semibold" :style="{ color: DROP_COLOR }">
          {{ t('plugins.guideLogViewer.chart.dropped') }}
        </span>
        <template v-else>
          <span :style="{ color: RA_COLOR }">
            {{ t('components.guider.native.graph.ra') }} {{ readout.ra }}
          </span>
          <span :style="{ color: DEC_COLOR }">
            {{ t('components.guider.native.graph.dec') }} {{ readout.dec }}
          </span>
          <span class="text-content-muted">
            {{ t('components.guider.native.graph.pulses') }} {{ readout.raMs }} /
            {{ readout.decMs }}
            {{ t('components.guider.native.graph.ms') }}
          </span>
        </template>
        <span class="text-content-muted">
          {{ t('components.guider.native.graph.snr') }} {{ readout.snr }}
        </span>
        <span v-if="readout.rms" :style="{ color: RMS_COLOR }">
          {{ t('plugins.guideLogViewer.chart.rmsLine') }} {{ readout.rms }}
        </span>
        <span v-if="readout.settling" class="text-status-warn">
          {{ t('components.guider.native.graph.settling') }}
        </span>
      </template>
      <span v-else class="text-content-faint">{{ hintText }}</span>
    </div>
    <!-- What the markers under the cursor are -->
    <div
      class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] -mt-1 min-h-4"
      data-testid="chart-under-cursor"
    >
      <span v-for="(m, i) in under" :key="i" class="inline-flex items-center gap-1">
        <svg
          v-if="m.glyph === 'triangle'"
          width="10"
          height="8"
          viewBox="0 0 10 8"
          aria-hidden="true"
        >
          <path d="M0 0H10L5 8Z" :fill="m.color" />
        </svg>
        <span
          v-else-if="m.glyph === 'dither'"
          class="legend-marker"
          :style="{ borderColor: DITHER_COLOR }"
        ></span>
        <span v-else class="legend-strip" :style="{ background: m.color }"></span>
        <span class="text-content">{{ m.text }}</span>
      </span>
    </div>

    <div ref="containerEl" class="relative w-full min-w-0">
      <div
        ref="mainEl"
        class="w-full touch-pan-y"
        role="img"
        :aria-label="t('plugins.guideLogViewer.chart.title')"
      ></div>
    </div>
    <div class="text-[10px] font-bold uppercase tracking-wider text-content-faint">
      {{ t('components.guider.native.graph.snrTitle') }}
    </div>
    <div
      ref="subEl"
      class="w-full touch-pan-y"
      role="img"
      :aria-label="t('components.guider.native.graph.snrTitle')"
    ></div>

    <!-- Legend: the glyphs as drawn -->
    <div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-content-muted">
      <span class="legend-item"
        ><span class="legend-line" :style="{ background: RA_COLOR }"></span
        >{{ t('components.guider.native.graph.ra') }}</span
      >
      <span class="legend-item"
        ><span class="legend-line" :style="{ background: DEC_COLOR }"></span
        >{{ t('components.guider.native.graph.dec') }}</span
      >
      <span class="legend-item"
        ><span class="legend-dash" :style="{ borderColor: RMS_COLOR }"></span
        >{{ t('plugins.guideLogViewer.chart.rmsLine') }}</span
      >
      <span v-if="showFree" class="legend-item"
        ><span class="legend-dash" :style="{ borderColor: FREE_RA_COLOR }"></span
        >{{ t('plugins.guideLogViewer.chart.free') }}</span
      >
      <span v-if="showPulses" class="legend-item"
        ><span class="legend-bar" :style="{ background: RA_BAR_COLOR }"></span
        >{{ t('components.guider.native.graph.raPulse') }}</span
      >
      <span v-if="showPulses" class="legend-item"
        ><span class="legend-bar" :style="{ background: DEC_BAR_COLOR }"></span
        >{{ t('components.guider.native.graph.decPulse') }}</span
      >
      <span class="legend-item"
        ><svg width="10" height="8" viewBox="0 0 10 8" aria-hidden="true">
          <path d="M0 0H10L5 8Z" :fill="SEVERITY_COLORS.bad" /></svg
        ><svg width="10" height="8" viewBox="0 0 10 8" aria-hidden="true">
          <path d="M0 0H10L5 8Z" :fill="SEVERITY_COLORS.warn" /></svg
        >{{ t('plugins.guideLogViewer.chart.legendFindings') }}</span
      >
      <span class="legend-item"
        ><span class="legend-marker" :style="{ borderColor: DITHER_COLOR }"></span
        >{{ t('plugins.guideLogViewer.chart.dither') }}</span
      >
      <span class="legend-item"
        ><span class="legend-bar" :style="{ background: SETTLE_LEGEND_COLOR }"></span
        >{{ t('components.guider.native.graph.settling') }}</span
      >
      <span class="legend-item"
        ><span class="legend-tick" :style="{ background: DROP_COLOR }"></span
        >{{ t('plugins.guideLogViewer.chart.starLost') }}</span
      >
      <span v-if="exposures.length" class="legend-item"
        ><span class="legend-strip" :style="{ background: GRADE_COLORS.good }"></span
        >{{ t('plugins.guideLogViewer.chart.exposures') }}</span
      >
      <span class="legend-item"
        ><span class="legend-line" :style="{ background: SNR_COLOR }"></span
        >{{ t('components.guider.native.graph.snr') }}</span
      >
      <span class="legend-item"
        ><span class="legend-line" :style="{ background: MASS_COLOR }"></span
        >{{ t('components.guider.native.graph.mass') }}</span
      >
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowsPointingOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from '@heroicons/vue/24/outline';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { lowerBound } from '../utils/analyzeGuideLog';
import { readStored, writeStored } from '@/utils/safeStorage';
import {
  AXIS_COLOR,
  DEC_BAR_COLOR,
  DEC_COLOR,
  FONT,
  GRID_COLOR,
  MASS_COLOR,
  RA_BAR_COLOR,
  RA_COLOR,
  SETTLE_LEGEND_COLOR,
  SETTLE_SHADE,
  SNR_COLOR,
  ZERO_COLOR,
  formatTick,
} from '@/components/guider/native/uplotTheme';
import {
  DITHER_COLOR,
  DROP_COLOR,
  FREE_DEC_COLOR,
  FREE_RA_COLOR,
  GRADE_COLORS,
  HIGHLIGHT_COLOR,
  SEVERITY_COLORS,
  chartData,
  chartEvents,
  markerFindings,
  markersAt,
  dropTimes,
  errorRange,
  formatWall,
  pulseRange,
  settleSpans,
  starData,
  zoomView,
} from '../utils/logView';
import { useFindingText } from './useFindingText';

const props = defineProps({
  model: { type: Object, required: true },
  view: { type: Object, required: true },
  unit: { type: String, default: 'arcsec' },
  exposures: { type: Array, default: () => [] },
  /** "Worth a look" entries; the marked ones are drawn as triangles. */
  findings: { type: Array, default: () => [] },
  /** Statistics of the view (rangeStats + unitScale) for the RMS in the header. */
  stats: { type: Object, default: null },
  highlight: { type: Object, default: null },
});
const emit = defineEmits(['update:view', 'reset']);
const { t } = useI18n();
const { title: findingTitle } = useFindingText();

// The rolling RMS line, as on the live guide graph
const RMS_COLOR = 'rgba(226, 232, 240, 0.85)';

function v(arcsec) {
  if (!Number.isFinite(arcsec)) return '–';
  const scale = props.stats?.unitScale ?? 1;
  return `${(arcsec * scale).toFixed(2)}${props.unit === 'px' ? ' px' : '″'}`;
}

const PULSES_KEY = 'guideLogViewer.pulses';
const FREE_KEY = 'guideLogViewer.free';
const showPulses = ref(readStored(PULSES_KEY, 'true') !== 'false');
const showFree = ref(readStored(FREE_KEY, 'false') === 'true');

function toggle(which) {
  if (which === 'pulses') {
    showPulses.value = !showPulses.value;
    writeStored(PULSES_KEY, String(showPulses.value));
  } else {
    showFree.value = !showFree.value;
    writeStored(FREE_KEY, String(showFree.value));
  }
  applySeriesVisibility();
}

const navButtons = computed(() => [
  {
    key: 'left',
    icon: ChevronLeftIcon,
    label: t('plugins.guideLogViewer.chart.earlier'),
    action: () => pan(-0.5),
  },
  {
    key: 'out',
    icon: MagnifyingGlassMinusIcon,
    label: t('plugins.guideLogViewer.chart.zoomOut'),
    action: () => zoom(2),
  },
  {
    key: 'in',
    icon: MagnifyingGlassPlusIcon,
    label: t('plugins.guideLogViewer.chart.zoomIn'),
    action: () => zoom(0.5),
  },
  {
    key: 'right',
    icon: ChevronRightIcon,
    label: t('plugins.guideLogViewer.chart.later'),
    action: () => pan(0.5),
  },
  {
    key: 'all',
    icon: ArrowsPointingOutIcon,
    label: t('plugins.guideLogViewer.chart.whole'),
    action: () => emit('reset'),
  },
]);

const hintText = computed(() => t('plugins.guideLogViewer.chart.hint'));

function zoom(factor, center) {
  emit('update:view', zoomView(props.view, factor, center));
}

function pan(fraction) {
  const w = props.view.t1 - props.view.t0;
  emit('update:view', { t0: props.view.t0 + w * fraction, t1: props.view.t1 + w * fraction });
}

// --- Data and overlays (read by the uPlot hooks) ---------------------------------

const containerEl = ref(null);
const mainEl = ref(null);
const subEl = ref(null);
const hoverIdx = ref(null);
// time under the cursor and seconds per CSS pixel, for the markers under it
const hoverAt = ref(null);
let mainPlot = null;
let subPlot = null;
let resizeObserver = null;
let data = [[], [], [], [], [], [], [], []];
let stars = [[], [], []];
let yRange = [-1, 1];
let msRange = [-100, 100];
let snrRange = [0, 10];
let overlay = { settles: [], drops: [], events: [] };
const syncKey = `history-graph-${Math.random().toString(36).slice(2)}`;

function rebuild() {
  const { series, log } = props.model;
  data = chartData(series, props.unit, props.model.rolling);
  stars = starData(series);
  overlay = { settles: settleSpans(series), drops: dropTimes(series), events: chartEvents(log) };
}

function updateRanges() {
  const { t0, t1 } = props.view;
  yRange = errorRange(data, t0, t1);
  msRange = pulseRange(data, t0, t1);
  const from = lowerBound(stars[0], t0);
  const to = lowerBound(stars[0], t1);
  let max = 0;
  for (let i = from; i < to; i++) if (stars[1][i] > max) max = stars[1][i];
  snrRange = [0, Math.max(10, Math.ceil((max * 1.1) / 10) * 10)];
}

const readout = computed(() => {
  const i = hoverIdx.value;
  if (i === null || i === undefined || !data[0].length) return null;
  const x = data[0][i];
  const { series } = props.model;
  const k = lowerBound(series.t, x - 1e-6);
  if (k >= series.n || Math.abs(series.t[k] - x) > 1e-3) return null;
  const u = props.unit === 'px' ? ' px' : '″';
  const v = (a) => (Number.isFinite(a) ? `${a.toFixed(2)}${u}` : '–');
  return {
    time: formatWall(x),
    frame: series.frame[k],
    drop: !!series.drop[k],
    ra: v(props.unit === 'px' ? series.ra[k] : series.raAs[k]),
    dec: v(props.unit === 'px' ? series.dec[k] : series.decAs[k]),
    raMs: Math.round(series.raMs[k]),
    decMs: Math.round(series.decMs[k]),
    snr: Number.isFinite(series.snr[k]) ? series.snr[k].toFixed(1) : '–',
    settling: !!series.settling[k],
    rms: data[7][i] === null || data[7][i] === undefined ? null : `${data[7][i].toFixed(2)}${u}`,
  };
});

/** The markers under the cursor, named: triangles (findings), dithers, the light frame. */
const under = computed(() => {
  const h = hoverAt.value;
  if (!h) return [];
  const found = markersAt(h.t, 6 * h.perPx, {
    findings: props.findings,
    dithers: overlay.events.filter((e) => e.type === 'dither'),
    exposures: props.exposures,
  });
  const out = found.findings.map((f) => ({
    glyph: 'triangle',
    color: SEVERITY_COLORS[f.severity],
    text: findingTitle(f),
  }));
  for (const d of found.dithers) {
    out.push({
      glyph: 'dither',
      text: t('plugins.guideLogViewer.chart.ditherBy', {
        dx: d.dx.toFixed(1),
        dy: d.dy.toFixed(1),
      }),
    });
  }
  if (found.exposure) {
    const e = found.exposure;
    out.push({
      glyph: 'strip',
      color: GRADE_COLORS[e.grade],
      text: t('plugins.guideLogViewer.chart.exposureAt', {
        seconds: e.seconds,
        filter: e.filter || '–',
        rms: v(e.stats.rmsTotal),
      }),
    });
  }
  return out;
});

function spanPx(u, a, b, minWidth) {
  let left = u.valToPos(a, 'x', true);
  let right = u.valToPos(b, 'x', true);
  if (right - left < minWidth) {
    const mid = (left + right) / 2;
    left = mid - minWidth / 2;
    right = mid + minWidth / 2;
  }
  return [Math.max(left, u.bbox.left), Math.min(right, u.bbox.left + u.bbox.width)];
}

function drawBackground(u) {
  const { ctx, bbox } = u;
  const ratio = uPlot.pxRatio;
  ctx.save();
  if (props.highlight) {
    const [l, r] = spanPx(u, props.highlight.t0, props.highlight.t1, 6 * ratio);
    if (r > l) {
      ctx.fillStyle = HIGHLIGHT_COLOR;
      ctx.fillRect(l, bbox.top, r - l, bbox.height);
    }
  }
  ctx.fillStyle = SETTLE_SHADE;
  // stretched to a visible width only while few are in view
  const visible = overlay.settles.filter(
    ([a, b]) => b >= props.view.t0 && a <= props.view.t1
  ).length;
  const minSettle = visible > 30 ? 0 : 3 * ratio;
  for (const [a, b] of overlay.settles) {
    const [l, r] = spanPx(u, a, b, minSettle);
    if (r > l) ctx.fillRect(l, bbox.top, r - l, bbox.height);
  }
  const y0 = u.valToPos(0, 'y', true);
  if (Number.isFinite(y0)) {
    ctx.strokeStyle = ZERO_COLOR;
    ctx.lineWidth = ratio;
    ctx.beginPath();
    ctx.moveTo(bbox.left, y0);
    ctx.lineTo(bbox.left + bbox.width, y0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMarkers(u) {
  const { ctx, bbox } = u;
  const ratio = uPlot.pxRatio;
  const inside = (x) => Number.isFinite(x) && x >= bbox.left && x <= bbox.left + bbox.width;
  ctx.save();
  // dithers: dashed lines over the whole height, fainter when there are many
  const dithers = overlay.events
    .filter((e) => e.type === 'dither')
    .map((e) => u.valToPos(e.t, 'x', true))
    .filter(inside);
  ctx.globalAlpha = dithers.length > 30 ? 0.35 : 1;
  ctx.lineWidth = ratio;
  ctx.setLineDash([4 * ratio, 3 * ratio]);
  ctx.strokeStyle = DITHER_COLOR;
  for (const x of dithers) {
    ctx.beginPath();
    ctx.moveTo(x, bbox.top);
    ctx.lineTo(x, bbox.top + bbox.height);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // dropped frames: ticks along the bottom
  ctx.fillStyle = DROP_COLOR;
  for (const tt of overlay.drops) {
    const x = u.valToPos(tt, 'x', true);
    if (inside(x))
      ctx.fillRect(x - ratio, bbox.top + bbox.height - 6 * ratio, 2 * ratio, 6 * ratio);
  }
  // light frames: a strip along the top, coloured by their guiding grade
  for (const e of props.exposures) {
    const [l, r] = spanPx(u, e.start, e.end, 2 * ratio);
    if (r <= l) continue;
    ctx.fillStyle = GRADE_COLORS[e.grade] || AXIS_COLOR;
    ctx.fillRect(l + ratio, bbox.top, Math.max(ratio, r - l - 2 * ratio), 3 * ratio);
  }
  // "Worth a look": triangles below the strip, as on the night overview, the worst on top
  const order = { info: 0, warn: 1, bad: 2 };
  const marks = markerFindings(props.findings).sort(
    (a, b) => order[a.severity] - order[b.severity]
  );
  const top = bbox.top + 5 * ratio;
  for (const f of marks) {
    const x = u.valToPos(f.t0, 'x', true);
    if (!inside(x)) continue;
    ctx.fillStyle = SEVERITY_COLORS[f.severity];
    ctx.beginPath();
    ctx.moveTo(x - 5 * ratio, top);
    ctx.lineTo(x + 5 * ratio, top);
    ctx.lineTo(x, top + 8 * ratio);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function axisBase() {
  return {
    stroke: AXIS_COLOR,
    font: FONT,
    grid: { stroke: GRID_COLOR, width: 1 },
    ticks: { stroke: GRID_COLOR, width: 1, size: 4 },
  };
}

// Times are wall seconds of the rig (see parseGuideLog.js): format them as UTC.
const tzDate = (ts) => uPlot.tzDate(new Date(ts * 1e3), 'Etc/UTC');

function cursorOptions(drag) {
  return {
    sync: { key: syncKey, setSeries: false },
    drag: drag ? { x: true, y: false, setScale: false } : { x: false, y: false },
    points: { size: 5 },
    bind: {
      dblclick: () => () => {
        emit('reset');
        return null;
      },
    },
  };
}

function mainOptions(width) {
  const bars = uPlot.paths.bars;
  return {
    width,
    height: 260,
    tzDate,
    legend: { show: false },
    cursor: cursorOptions(true),
    select: { show: true },
    scales: {
      x: { time: true, auto: false, range: () => [props.view.t0, props.view.t1] },
      y: { range: () => yRange },
      ms: { range: () => msRange },
    },
    axes: [
      {
        ...axisBase(),
        size: 26,
        space: 70,
        values: (u, splits) => {
          const span = (u.scales.x.max ?? 0) - (u.scales.x.min ?? 0);
          return splits.map((v) => formatWall(v, span < 900));
        },
      },
      {
        ...axisBase(),
        scale: 'y',
        size: 44,
        values: (u, splits) => splits.map((v) => formatTick(v)),
      },
      {
        ...axisBase(),
        scale: 'ms',
        side: 1,
        size: 44,
        grid: { show: false },
        values: (u, splits) => splits.map((v) => String(Math.round(v))),
      },
    ],
    series: [
      {},
      {
        label: 'raMs',
        scale: 'ms',
        width: 0,
        fill: RA_BAR_COLOR,
        stroke: RA_BAR_COLOR,
        paths: bars({ size: [0.45, 6], align: -1 }),
        points: { show: false },
      },
      {
        label: 'decMs',
        scale: 'ms',
        width: 0,
        fill: DEC_BAR_COLOR,
        stroke: DEC_BAR_COLOR,
        paths: bars({ size: [0.45, 6], align: 1 }),
        points: { show: false },
      },
      { label: 'ra', scale: 'y', stroke: RA_COLOR, width: 1.25, points: { show: false } },
      { label: 'dec', scale: 'y', stroke: DEC_COLOR, width: 1.25, points: { show: false } },
      {
        label: 'raFree',
        scale: 'y',
        stroke: FREE_RA_COLOR,
        width: 1,
        dash: [5, 4],
        points: { show: false },
      },
      {
        label: 'decFree',
        scale: 'y',
        stroke: FREE_DEC_COLOR,
        width: 1,
        dash: [5, 4],
        points: { show: false },
      },
      {
        label: 'rms',
        scale: 'y',
        stroke: RMS_COLOR,
        width: 1.5,
        dash: [6, 4],
        points: { show: false },
      },
    ],
    hooks: {
      drawAxes: [drawBackground],
      draw: [drawMarkers],
      setCursor: [
        (u) => {
          hoverIdx.value = u.cursor.idx ?? null;
          const left = u.cursor.left;
          hoverAt.value =
            left === undefined || left === null || left < 0
              ? null
              : {
                  t: u.posToVal(left, 'x'),
                  perPx:
                    (props.view.t1 - props.view.t0) / Math.max(1, u.bbox.width / uPlot.pxRatio),
                };
        },
      ],
      setSelect: [
        (u) => {
          if (u.select.width < 4) return;
          const a = u.posToVal(u.select.left, 'x');
          const b = u.posToVal(u.select.left + u.select.width, 'x');
          u.setSelect({ left: 0, width: 0, top: 0, height: 0 }, false);
          emit('update:view', { t0: a, t1: b });
        },
      ],
    },
  };
}

function subOptions(width) {
  return {
    width,
    height: 90,
    tzDate,
    legend: { show: false },
    cursor: cursorOptions(false),
    scales: {
      x: { time: true, auto: false, range: () => [props.view.t0, props.view.t1] },
      snr: { range: () => snrRange },
      mass: { range: () => [0, 1.6] },
    },
    axes: [
      { show: false },
      {
        ...axisBase(),
        scale: 'snr',
        size: 44,
        values: (u, splits) => splits.map((v) => String(Math.round(v))),
      },
      {
        ...axisBase(),
        scale: 'mass',
        side: 1,
        size: 44,
        grid: { show: false },
        ticks: { show: false },
        values: (u, s) => s.map(() => ''),
      },
    ],
    series: [
      {},
      { label: 'snr', scale: 'snr', stroke: SNR_COLOR, width: 1.25, points: { show: false } },
      { label: 'mass', scale: 'mass', stroke: MASS_COLOR, width: 1, points: { show: false } },
    ],
    hooks: {
      setCursor: [(u) => (hoverIdx.value = u.cursor.idx ?? null)],
    },
  };
}

function applySeriesVisibility() {
  if (!mainPlot) return;
  mainPlot.setSeries(1, { show: showPulses.value });
  mainPlot.setSeries(2, { show: showPulses.value });
  mainPlot.setSeries(5, { show: showFree.value });
  mainPlot.setSeries(6, { show: showFree.value });
}

function applyView() {
  if (!mainPlot) return;
  updateRanges();
  mainPlot.setScale('x', { min: props.view.t0, max: props.view.t1 });
  subPlot?.setScale('x', { min: props.view.t0, max: props.view.t1 });
}

function create() {
  const width = Math.max(200, containerEl.value?.clientWidth ?? 600);
  rebuild();
  updateRanges();
  mainPlot = new uPlot(mainOptions(width), data, mainEl.value);
  subPlot = new uPlot(subOptions(width), stars, subEl.value);
  applySeriesVisibility();
  mainPlot.over.addEventListener('wheel', onWheel, { passive: false });
  for (const plot of [mainPlot, subPlot]) {
    plot.over.addEventListener('pointerdown', onTouchDown);
    plot.over.addEventListener('pointermove', onTouchMove);
    plot.over.addEventListener('pointerup', onTouchUp);
    plot.over.addEventListener('pointercancel', onTouchUp);
  }
}

function destroy() {
  mainPlot?.destroy();
  subPlot?.destroy();
  mainPlot = subPlot = null;
}

// --- Wheel and touch zoom ----------------------------------------------------------

function onWheel(e) {
  if (!mainPlot) return;
  e.preventDefault();
  const rect = mainPlot.over.getBoundingClientRect();
  const center = mainPlot.posToVal(e.clientX - rect.left, 'x');
  zoom(e.deltaY > 0 ? 1.25 : 0.8, center);
}

// one finger pans, two fingers pinch (mouse keeps uPlot's drag-to-zoom)
const touches = new Map();
let gesture = null;

function onTouchDown(e) {
  if (e.pointerType !== 'touch') return;
  touches.set(e.pointerId, e.clientX);
  gesture = {
    view: { ...props.view },
    start: new Map(touches),
    width: e.currentTarget.getBoundingClientRect().width,
    left: e.currentTarget.getBoundingClientRect().left,
  };
}

function onTouchMove(e) {
  if (e.pointerType !== 'touch' || !touches.has(e.pointerId) || !gesture) return;
  touches.set(e.pointerId, e.clientX);
  const span = gesture.view.t1 - gesture.view.t0;
  const perPx = span / gesture.width;
  const ids = [...touches.keys()];
  if (ids.length === 1) {
    const dx = touches.get(ids[0]) - (gesture.start.get(ids[0]) ?? touches.get(ids[0]));
    if (Math.abs(dx) < 6) return;
    emit('update:view', { t0: gesture.view.t0 - dx * perPx, t1: gesture.view.t1 - dx * perPx });
  } else if (ids.length >= 2) {
    const [a, b] = ids;
    const d0 = Math.abs((gesture.start.get(a) ?? 0) - (gesture.start.get(b) ?? 0));
    const d1 = Math.abs(touches.get(a) - touches.get(b));
    if (d0 < 10 || d1 < 10) return;
    const mid0 =
      ((gesture.start.get(a) + gesture.start.get(b)) / 2 - gesture.left) * perPx + gesture.view.t0;
    emit('update:view', zoomView(gesture.view, d0 / d1, mid0));
  }
}

function onTouchUp(e) {
  if (e.pointerType !== 'touch') return;
  touches.delete(e.pointerId);
  gesture = touches.size
    ? {
        view: { ...props.view },
        start: new Map(touches),
        width: gesture?.width ?? 1,
        left: gesture?.left ?? 0,
      }
    : null;
}

onMounted(() => {
  create();
  resizeObserver = new ResizeObserver((entries) => {
    const w = Math.round(entries[0].contentRect.width);
    if (w > 0 && mainPlot && Math.abs(w - mainPlot.width) > 1) {
      mainPlot.setSize({ width: w, height: 260 });
      subPlot.setSize({ width: w, height: 90 });
    }
  });
  resizeObserver.observe(containerEl.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  destroy();
});

watch(
  () => [props.model, props.unit],
  () => {
    rebuild();
    updateRanges();
    mainPlot?.setData(data, false);
    subPlot?.setData(stars, false);
    applyView();
  }
);
watch(() => props.view, applyView);
watch(
  () => [props.highlight, props.exposures, props.findings],
  () => mainPlot?.redraw(false, false)
);
</script>

<style scoped>
@reference '../../../assets/tailwind.css';

.toggle {
  @apply min-h-10 rounded-chip border border-line-strong px-2.5 text-xs font-semibold text-content-muted;
}

.toggle-on {
  @apply border-accent/50 bg-accent/15 text-accent;
}

.nav-btn {
  @apply min-w-10 min-h-10 flex items-center justify-center rounded-chip text-content-muted hover:text-content hover:bg-surface-2;
}

.legend-item {
  @apply inline-flex items-center gap-1 whitespace-nowrap;
}

.legend-line {
  @apply inline-block h-0.5 w-3.5 rounded-full;
}

.legend-bar {
  @apply inline-block h-2.5 w-2.5 rounded-sm;
}

.legend-marker {
  @apply inline-block h-3 w-0 border-l-2 border-dashed;
}

.legend-dash {
  @apply inline-block h-0 w-3.5 border-t-2 border-dashed;
}

.legend-tick {
  @apply inline-block h-2 w-0.5;
}

.legend-strip {
  @apply inline-block h-1 w-3.5 rounded-full;
}

:deep(.u-cursor-x),
:deep(.u-cursor-y) {
  border-color: var(--color-content-faint);
}

:deep(.u-select) {
  background: rgba(56, 189, 248, 0.15);
}
</style>
