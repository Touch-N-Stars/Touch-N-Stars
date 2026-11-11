<template>
  <section class="tns-card flex flex-col gap-2 min-w-0" data-testid="history-spectrum">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-content">
        {{ t('plugins.guideLogViewer.spectrum.title') }}
      </h3>
      <SegToggle
        :model-value="source"
        :options="
          SOURCES.map((s) => ({
            value: s,
            label: t(`plugins.guideLogViewer.spectrum.sources.${s}`),
          }))
        "
        :label="t('plugins.guideLogViewer.spectrum.source')"
        @update:model-value="setSource"
      />
    </div>
    <p class="text-[11px] text-content-muted -mt-1">
      {{ t(`plugins.guideLogViewer.spectrum.hints.${source}`) }}
    </p>

    <div ref="containerEl" class="relative w-full min-w-0">
      <div
        ref="plotEl"
        class="w-full"
        role="img"
        :aria-label="t('plugins.guideLogViewer.spectrum.title')"
      ></div>
      <div
        v-if="message"
        class="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-content-muted pointer-events-none"
      >
        {{ message }}
      </div>
    </div>

    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] tabular-nums text-content-muted">
      <span v-if="peak">
        {{
          t('plugins.guideLogViewer.spectrum.peak', {
            period: periodText(peak.period),
            amplitude: ampText(peak.amplitude),
          })
        }}
      </span>
      <span v-if="worm" :style="{ color: WORM_COLOR }">
        {{ t('plugins.guideLogViewer.spectrum.worm', { period: periodText(worm) }) }}
        <template v-if="wormAmp !== null">
          ·
          {{
            t('plugins.guideLogViewer.spectrum.amplitude', {
              amplitude: ampText(wormAmp),
            })
          }}
        </template>
      </span>
      <span v-if="hover">{{ periodText(hover.period) }} · {{ ampText(hover.amplitude) }}</span>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { readStored, writeStored } from '@/utils/safeStorage';
import {
  detrendBySegment,
  periodogram,
  strongestPeriod,
  wormPeriod,
} from '../utils/analyzeGuideLog';
import {
  AXIS_COLOR,
  DEC_COLOR,
  FONT,
  GRID_COLOR,
  RA_COLOR,
} from '@/components/guider/native/uplotTheme';
import { binSeries } from '../utils/logView';
import SegToggle from './SegToggle.vue';

const props = defineProps({
  model: { type: Object, required: true },
  range: { type: Object, required: true },
  unit: { type: String, default: 'arcsec' },
});
const { t } = useI18n();

const SOURCES = ['raFree', 'ra', 'dec'];
const SOURCE_KEY = 'guideLogViewer.spectrumSource';
const WORM_COLOR = '#fbbf24';
const MIN_SECONDS = 300;
const PERIOD_TICKS = [5, 10, 30, 60, 120, 300, 600, 1200, 3600];
const source = ref(
  SOURCES.includes(readStored(SOURCE_KEY, 'raFree')) ? readStored(SOURCE_KEY, 'raFree') : 'raFree'
);

function setSource(s) {
  source.value = s;
  writeStored(SOURCE_KEY, s);
}

const containerEl = ref(null);
const plotEl = ref(null);
const result = shallowRef(null);
const message = ref('');
const hover = ref(null);
let plot = null;
let resizeObserver = null;
let timer = null;

const suffix = computed(() => (props.unit === 'px' ? ' px' : '″'));

/** Worm period of the section in the middle of the range. */
const worm = computed(() => {
  const { series, log } = props.model;
  const { from, to } = props.range;
  if (to <= from) return null;
  return wormPeriod(log.sections[series.section[(from + to) >> 1]]?.header);
});

const peak = computed(() =>
  result.value ? strongestPeriod(result.value, { minPeriod: 8 }) : null
);

/** Amplitude at the worm period (the nearest computed period). */
const wormAmp = computed(() => {
  const r = result.value;
  const w = worm.value;
  if (!r || !w || !r.periods.length) return null;
  let best = -1;
  let bestD = Infinity;
  for (let k = 0; k < r.periods.length; k++) {
    const d = Math.abs(Math.log(r.periods[k] / w));
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return bestD < 0.05 ? r.amplitudes[best] : null;
});

function periodText(seconds) {
  if (!Number.isFinite(seconds)) return '–';
  return seconds >= 120 ? `${(seconds / 60).toFixed(1)} min` : `${seconds.toFixed(0)} s`;
}

function ampText(a) {
  return Number.isFinite(a) ? `±${a.toFixed(2)}${suffix.value}` : '–';
}

function compute() {
  timer = null;
  const { series } = props.model;
  const { from, to } = props.range;
  const duration = to > from ? series.t[to - 1] - series.t[from] : 0;
  if (duration < MIN_SECONDS) {
    result.value = null;
    message.value = t('plugins.guideLogViewer.spectrum.tooShort', {
      minutes: MIN_SECONDS / 60,
    });
    update();
    return;
  }
  const tt = [];
  const yy = [];
  const groups = [];
  for (let i = from; i < to; i++) {
    if (series.drop[i] || series.settling[i]) continue;
    const scale = props.unit === 'px' ? 1 : series.scale[i];
    const v =
      source.value === 'raFree'
        ? series.raFree[i]
        : source.value === 'ra'
          ? series.ra[i]
          : series.dec[i];
    if (!Number.isFinite(v) || !Number.isFinite(scale)) continue;
    tt.push(series.t[i]);
    yy.push(v * scale);
    groups.push(series.seg[i]);
  }
  // drift and dither offsets out, then bin so long ranges stay quick
  const detrended = detrendBySegment(tt, yy, groups);
  const binned = binSeries(tt, detrended, 4000);
  const cadence = tt.length > 1 ? duration / tt.length : 2;
  const r = periodogram(binned.t, binned.y, {
    minPeriod: Math.max(2 * cadence, 4),
    maxPeriod: Math.min(duration / 2, 3600),
    count: 320,
  });
  if (!r.periods.length) {
    result.value = null;
    message.value = t('plugins.guideLogViewer.spectrum.tooShort', {
      minutes: MIN_SECONDS / 60,
    });
  } else {
    result.value = r;
    message.value = '';
  }
  update();
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(compute, 250);
}

function drawWorm(u) {
  const w = worm.value;
  if (!w) return;
  const { ctx, bbox } = u;
  const ratio = uPlot.pxRatio;
  ctx.save();
  ctx.strokeStyle = WORM_COLOR;
  ctx.lineWidth = ratio;
  ctx.setLineDash([4 * ratio, 3 * ratio]);
  for (const [k, alpha] of [
    [1, 1],
    [2, 0.5],
    [3, 0.35],
  ]) {
    const x = u.valToPos(w / k, 'x', true);
    if (!Number.isFinite(x) || x < bbox.left || x > bbox.left + bbox.width) continue;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(x, bbox.top);
    ctx.lineTo(x, bbox.top + bbox.height);
    ctx.stroke();
  }
  ctx.restore();
}

function options(width) {
  const color = source.value === 'dec' ? DEC_COLOR : RA_COLOR;
  const axis = {
    stroke: AXIS_COLOR,
    font: FONT,
    grid: { stroke: GRID_COLOR, width: 1 },
    ticks: { stroke: GRID_COLOR, width: 1, size: 4 },
  };
  return {
    width,
    height: 200,
    legend: { show: false },
    cursor: { drag: { x: false, y: false }, points: { size: 5 } },
    scales: {
      x: { time: false, distr: 3 },
      y: { range: (u, min, max) => [0, Math.max(0.05, max * 1.1)] },
    },
    axes: [
      {
        ...axis,
        size: 26,
        // log scale: label a few round periods only
        splits: (u, i, min, max) => PERIOD_TICKS.filter((p) => p >= min && p <= max),
        values: (u, splits) =>
          splits.map((v) => (v === null || v === undefined ? '' : periodText(v))),
      },
      { ...axis, size: 44, values: (u, splits) => splits.map((v) => v.toFixed(2)) },
    ],
    series: [{}, { stroke: color, width: 1.5, fill: `${color}22`, points: { show: false } }],
    hooks: {
      draw: [drawWorm],
      setCursor: [
        (u) => {
          const i = u.cursor.idx;
          hover.value =
            i === null || i === undefined || !result.value
              ? null
              : { period: result.value.periods[i], amplitude: result.value.amplitudes[i] };
        },
      ],
    },
  };
}

function update() {
  const r = result.value;
  const data = r
    ? [Array.from(r.periods), Array.from(r.amplitudes)]
    : [
        [1, 2],
        [null, null],
      ];
  plot?.destroy();
  const width = Math.max(200, containerEl.value?.clientWidth ?? 400);
  if (plotEl.value) plot = new uPlot(options(width), data, plotEl.value);
}

onMounted(() => {
  compute();
  resizeObserver = new ResizeObserver((entries) => {
    const w = Math.round(entries[0].contentRect.width);
    if (plot && w > 0 && Math.abs(w - plot.width) > 1) plot.setSize({ width: w, height: 200 });
  });
  resizeObserver.observe(containerEl.value);
});

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
  resizeObserver?.disconnect();
  plot?.destroy();
});

watch(() => [props.model, props.range.from, props.range.to, props.unit, source.value], schedule);
</script>
