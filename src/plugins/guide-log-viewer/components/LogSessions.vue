<template>
  <section
    class="tns-card flex flex-col gap-2 min-w-0 lg:h-[34rem]"
    data-testid="guide-log-sessions"
  >
    <h3 class="text-sm font-semibold text-content">
      {{ t('plugins.guideLogViewer.sessions.title') }}
    </h3>
    <ul class="flex max-h-[28rem] min-h-0 flex-1 lg:max-h-none flex-col gap-1 overflow-y-auto pr-1">
      <li
        v-for="row in rows"
        :key="row.key"
        class="rounded-card border border-line"
        :class="{ 'border-accent/50 bg-accent/5': row.inView }"
      >
        <div
          role="button"
          tabindex="0"
          class="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs tabular-nums hover:bg-surface-2"
          @click="row.summary ? emit('select', row.summary) : toggle(row.key)"
          @keydown.enter.prevent="row.summary ? emit('select', row.summary) : toggle(row.key)"
        >
          <div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span class="font-semibold text-content">
              {{ formatWall(row.start, false)
              }}<template v-if="row.end - row.start >= 60"
                >–{{ formatWall(row.end, false) }}</template
              >
            </span>
            <span v-if="row.end - row.start >= 1" class="text-content-muted">
              {{ formatDuration(row.end - row.start) }}
            </span>
            <template v-if="row.kind === 'calibration'">
              <span :style="{ color: CAL_TEXT }">
                {{ t('plugins.guideLogViewer.sessions.calibration') }}
              </span>
              <span v-if="row.failed" class="text-status-danger">
                {{ t('plugins.guideLogViewer.sessions.failed') }}
              </span>
            </template>
            <template v-else>
              <span v-if="row.pierSide" class="text-content-muted">
                {{ pierText(row.pierSide) }}
              </span>
              <span v-if="row.target" class="text-content-muted">{{ row.target }}</span>
              <span class="ml-auto font-semibold" :style="{ color: GRADE_COLORS[row.grade] }">
                {{ row.rms }}
              </span>
              <span v-if="row.drops" :style="{ color: DROP_COLOR }">
                {{ t('plugins.guideLogViewer.sessions.drops', { count: row.drops }, row.drops) }}
              </span>
            </template>
          </div>
          <button
            type="button"
            class="flex min-h-touch min-w-touch shrink-0 items-center justify-center text-content-faint hover:text-content"
            :aria-expanded="open.has(row.key)"
            :aria-label="t('plugins.guideLogViewer.sessions.details')"
            @click.stop="toggle(row.key)"
          >
            <ChevronDownIcon
              class="h-4 w-4 transition-transform"
              :class="{ 'rotate-180': open.has(row.key) }"
            />
          </button>
        </div>

        <div v-if="open.has(row.key)" class="border-t border-line px-2 py-2 text-[11px]">
          <div v-if="row.kind === 'calibration'" class="flex flex-wrap gap-3">
            <canvas
              :ref="(el) => drawCalibration(el, row.section)"
              class="h-40 w-40 rounded-card bg-surface-2"
            ></canvas>
            <dl class="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <template v-for="d in calibrationFacts(row.section)" :key="d.label">
                <dt class="text-content-muted">{{ d.label }}</dt>
                <dd class="text-content">{{ d.value }}</dd>
              </template>
            </dl>
          </div>
          <dl v-else class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <template v-for="d in sectionFacts(row.section, row.summary)" :key="d.label">
              <dt class="text-content-muted">{{ d.label }}</dt>
              <dd class="min-w-0 break-words text-content">{{ d.value }}</dd>
            </template>
          </dl>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import { AXIS_COLOR, DEC_COLOR, GRID_COLOR, RA_COLOR } from '@/components/guider/native/uplotTheme';
import {
  DROP_COLOR,
  GRADE_COLORS,
  formatDistance,
  formatDuration,
  formatWall,
  gradeOf,
} from '../utils/logView';

const props = defineProps({
  model: { type: Object, required: true },
  view: { type: Object, required: true },
  unit: { type: String, default: 'arcsec' },
});
const emit = defineEmits(['select']);
const { t, te } = useI18n();

const CAL_TEXT = '#c4b5fd';
const open = ref(new Set());

function toggle(key) {
  const next = new Set(open.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  open.value = next;
}

function rmsText(stats, section) {
  if (!stats || stats.empty) return '–';
  return formatDistance(stats.rmsTotal, props.unit, section.header.pixelScale);
}

// decimals as everywhere else in the viewer and on the native guider pages
const fixed = (value, digits) => value.toFixed(digits);

function target(h) {
  if (!Number.isFinite(h.raHours) || !Number.isFinite(h.decDeg)) return '';
  // whole minutes of RA, rounded before the split so 5.9999 h reads 6h00
  const total = Math.round(h.raHours * 60) % (24 * 60);
  return t('plugins.guideLogViewer.sessions.target', {
    hours: Math.floor(total / 60),
    minutes: String(total % 60).padStart(2, '0'),
    dec: fixed(h.decDeg, 1),
  });
}

function pierText(side) {
  const key = `plugins.guideLogViewer.sessions.pier.${side}`;
  return side && te(key) ? t(key) : side;
}

const rows = computed(() => {
  const { log, summaries, typicalRms } = props.model;
  const byIndex = new Map(summaries.map((s) => [s.section, s]));
  // marking the sessions in view only says something while the view is not the whole night
  const span = props.model.span;
  const zoomed = !!span && (props.view.t0 > span.t0 + 1 || props.view.t1 < span.t1 - 1);
  const out = [];
  for (const s of log.sections) {
    const end = s.end ?? s.start;
    const inView = zoomed && end >= props.view.t0 && s.start <= props.view.t1;
    if (s.kind === 'calibration') {
      out.push({
        key: `c${s.index}`,
        kind: 'calibration',
        section: s,
        start: s.start,
        end,
        failed: s.endReason === 'failed',
        inView,
      });
      continue;
    }
    const summary = byIndex.get(s.index);
    // short restarts (a few frames) are noise in this list
    if (!summary || summary.stats.frames < 5) continue;
    const ratio = typicalRms > 0 ? summary.stats.rmsTotal / typicalRms : 1;
    out.push({
      key: `g${s.index}`,
      kind: 'guiding',
      section: s,
      summary,
      start: s.start,
      end,
      pierSide: s.header.pierSide,
      target: target(s.header),
      rms: rmsText(summary.stats, s),
      grade: summary.stats.drops > summary.stats.frames * 0.2 ? 'lost' : gradeOf(ratio),
      drops: summary.stats.drops,
      inView,
    });
  }
  return out;
});

const L = 'plugins.guideLogViewer.sessions.facts';

function sectionFacts(section, summary) {
  const h = section.header;
  const st = summary?.stats ?? {};
  const facts = [
    { label: t(`${L}.profile`), value: h.profile },
    {
      label: t(`${L}.camera`),
      value: [
        h.camera,
        Number.isFinite(h.exposureMs) ? t(`${L}.exposure`, { seconds: h.exposureMs / 1000 }) : null,
        Number.isFinite(h.gain) ? t(`${L}.gain`, { gain: h.gain }) : null,
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      label: t(`${L}.scale`),
      value: Number.isFinite(h.pixelScale)
        ? `${h.pixelScale.toFixed(2)}″/px${Number.isFinite(h.focalLength) ? ` · ${h.focalLength} mm` : ''}`
        : null,
    },
    { label: t(`${L}.mount`), value: h.mount },
    { label: t(`${L}.raAlgorithm`), value: h.xAlgorithm },
    { label: t(`${L}.decAlgorithm`), value: h.yAlgorithm },
    { label: t(`${L}.decMode`), value: h.decGuideMode },
    {
      label: t(`${L}.backlash`),
      value:
        h.backlashEnabled === undefined
          ? null
          : h.backlashEnabled
            ? `${h.backlashMs} ms`
            : t(`${L}.off`),
    },
    {
      label: t(`${L}.maxPulse`),
      value: Number.isFinite(h.maxRaMs) ? `${h.maxRaMs} / ${h.maxDecMs} ms` : null,
    },
    {
      label: t(`${L}.calibration`),
      value: h.calibrationInfo
        ? `RA ${h.calibrationInfo.xAngle}° ${h.calibrationInfo.xRate} px/s · Dec ${h.calibrationInfo.yAngle}° ${h.calibrationInfo.yRate} px/s${h.parity ? ` · ${h.parity}` : ''}`
        : null,
    },
    {
      label: t(`${L}.guideSpeed`),
      value: Number.isFinite(h.raGuideSpeed) ? `${h.raGuideSpeed} / ${h.decGuideSpeed} ″/s` : null,
    },
    { label: t(`${L}.dithers`), value: summary ? String(summary.dithers) : null },
    {
      label: t(`${L}.frames`),
      value: Number.isFinite(st.frames)
        ? t(`${L}.framesValue`, { frames: st.frames, lost: st.drops })
        : null,
    },
    {
      label: t(`${L}.endReason`),
      value: section.endReason
        ? t(`plugins.guideLogViewer.sessions.end.${section.endReason}`)
        : null,
    },
  ];
  return facts.filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
}

/** Orthogonality of the calibration legs from the steps (angle between the West and North legs). */
function legAngle(steps, direction) {
  const leg = steps.filter((s) => s.direction === direction);
  if (leg.length < 2) return null;
  const a = leg[0];
  const b = leg[leg.length - 1];
  return Math.atan2(b.dy - a.dy, b.dx - a.dx);
}

function legText(angle, steps, direction) {
  const count = steps.filter((s) => s.direction === direction).length;
  return t(`${L}.legValue`, { angle: fixed((angle * 180) / Math.PI, 1), count }, count);
}

function calibrationFacts(section) {
  const steps = section.calibration?.steps ?? [];
  const facts = [];
  const h = section.header;
  if (Number.isFinite(h.calibrationStepMs))
    facts.push({
      label: t(`${L}.calStep`),
      value: `${h.calibrationStepMs} ms · ${h.calibrationDistancePx} px`,
    });
  const ra = legAngle(steps, 'West');
  const dec = legAngle(steps, 'North');
  if (ra !== null)
    facts.push({
      label: t(`${L}.raLeg`),
      value: legText(ra, steps, 'West'),
    });
  if (dec !== null)
    facts.push({
      label: t(`${L}.decLeg`),
      value: legText(dec, steps, 'North'),
    });
  if (ra !== null && dec !== null) {
    const diff = Math.abs(((dec - ra) * 180) / Math.PI) % 180;
    const ortho = Math.abs(90 - diff);
    facts.push({ label: t(`${L}.ortho`), value: `${ortho.toFixed(1)}°` });
  }
  for (const r of section.calibration?.results ?? []) {
    facts.push({ label: r.axis, value: `${r.angle}° · ${r.rate} px/s · ${r.parity}` });
  }
  if (section.calibration?.dropped)
    facts.push({ label: t(`${L}.lost`), value: String(section.calibration.dropped) });
  if (Number.isFinite(h.decDeg))
    facts.push({
      label: t(`${L}.pointing`),
      value: target(h) + (h.pierSide ? ` · ${pierText(h.pierSide)}` : ''),
    });
  return facts;
}

const LEG_COLORS = {
  West: RA_COLOR,
  East: 'rgba(96,165,250,0.5)',
  North: DEC_COLOR,
  South: 'rgba(248,113,113,0.5)',
};

/** Draws the star's path during the calibration (camera axes, y down). */
function drawCalibration(canvas, section) {
  if (!canvas) return;
  const steps = section.calibration?.steps ?? [];
  const size = 160;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = size * ratio;
  canvas.height = size * ratio;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, size, size);
  if (!steps.length) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of steps) {
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minY = Math.min(minY, s.y);
    maxY = Math.max(maxY, s.y);
  }
  const extent = Math.max(maxX - minX, maxY - minY, 1) * 1.15;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const k = size / extent;
  const px = (s) => [size / 2 + (s.x - cx) * k, size / 2 + (s.y - cy) * k];
  ctx.strokeStyle = GRID_COLOR;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  let prev = null;
  for (const s of steps) {
    const [x, y] = px(s);
    const color = LEG_COLORS[s.direction] || AXIS_COLOR;
    if (prev && prev.direction === s.direction) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(...px(prev));
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    prev = s;
  }
}
</script>
