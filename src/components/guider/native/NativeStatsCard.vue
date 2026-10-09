<template>
  <div class="tns-card flex flex-col gap-2 min-w-0">
    <h3 class="text-sm font-semibold text-content">
      {{ t('components.guider.native.stats.title') }}
    </h3>

    <div v-if="!windowStats && !sessionStats" class="py-4 text-center text-xs text-content-muted">
      {{ t('components.guider.native.stats.empty') }}
    </div>

    <div v-else class="stats-grid text-xs">
      <!-- Header row -->
      <div></div>
      <div class="col-head">
        {{ t('components.guider.native.stats.window') }}
        <span v-if="windowFrames" class="col-sub" data-testid="native-guider-stats-window-frames">{{
          t('components.guider.native.stats.windowFrames', { count: windowFrames })
        }}</span>
      </div>
      <div class="col-head">{{ t('components.guider.native.stats.session') }}</div>

      <template v-for="row in rows" :key="row.key">
        <div class="row-label" :class="{ 'font-semibold text-content': row.emphasis }">
          {{ t(`components.guider.native.stats.${row.key}`) }}
        </div>
        <div class="row-value" :class="{ 'row-inline': row.inline }">
          <span v-if="row.sub && row.inline" class="row-sub">{{ row.sub(windowStats) }}</span>
          <span :class="row.emphasis ? 'text-accent font-semibold' : 'text-content'">
            {{ row.format(windowStats) }}
          </span>
          <span v-if="row.sub && !row.inline" class="row-sub">{{ row.sub(windowStats) }}</span>
        </div>
        <div class="row-value" :class="{ 'row-inline': row.inline }">
          <span v-if="row.sub && row.inline" class="row-sub">{{ row.sub(sessionStats) }}</span>
          <span :class="row.emphasis ? 'text-accent font-semibold' : 'text-content'">
            {{ row.format(sessionStats) }}
          </span>
          <span v-if="row.sub && !row.inline" class="row-sub">{{ row.sub(sessionStats) }}</span>
        </div>
      </template>
    </div>

    <!-- Dec guide mode Drift: the direction Dec guides in and the drift it follows -->
    <div
      v-if="decDir"
      class="flex flex-col gap-0.5 border-t border-line pt-2 text-xs min-w-0"
      data-testid="native-guider-dec-direction"
    >
      <div class="flex items-baseline gap-2 min-w-0">
        <span class="shrink-0 text-content-muted">{{
          t('components.guider.native.stats.decDirection.label')
        }}</span>
        <span class="font-semibold truncate" :class="TONE_TEXT[decDir.tone]">{{
          t(`components.guider.native.stats.decDirection.directions.${decDir.direction}`)
        }}</span>
        <span
          v-if="decDir.driftArcsecPerMin !== null"
          class="ml-auto shrink-0 text-content-faint tabular-nums"
          >{{
            t('components.guider.native.stats.decDirection.drift', {
              drift: `${fmt(decDir.driftArcsecPerMin, 2)}${ARCSEC}/min`,
            })
          }}</span
        >
        <NativeHelpTip
          :class="{ 'ml-auto': decDir.driftArcsecPerMin === null }"
          :title="t('components.guider.native.stats.decDirection.helpTitle')"
          :text="t('components.guider.native.stats.decDirection.help')"
        />
      </div>
      <div v-if="decNote" class="text-[10px] text-content-faint">{{ decNote }}</div>
    </div>

    <!-- What the Predictive algorithm learned, per axis -->
    <div
      v-if="learning.length"
      class="flex flex-col gap-2 border-t border-line pt-2 text-xs"
      data-testid="native-guider-predictive-stats"
    >
      <div class="col-head text-left!">
        {{ t('components.guider.native.stats.predictive.title') }}
      </div>
      <div v-for="a in learning" :key="a.axis" class="flex flex-col gap-0.5 min-w-0">
        <div class="flex items-baseline gap-2 min-w-0">
          <span class="font-semibold" :class="a.axis === 'RA' ? 'text-ra' : 'text-dec'">{{
            a.axis
          }}</span>
          <span class="font-semibold truncate" :class="TONE_TEXT[phaseTone(a.state)]">{{
            phaseLabel(a.state)
          }}</span>
          <span
            class="ml-auto shrink-0 text-content tabular-nums"
            :title="t('components.guider.native.stats.predictive.weightHint')"
            >{{
              t('components.guider.native.stats.predictive.weight', {
                percent: fmt((Number(a.state.gain) || 0) * 100, 0),
              })
            }}</span
          >
        </div>
        <div
          v-if="a.state.phase === 'Learning'"
          class="h-1 rounded-full bg-surface-3 overflow-hidden"
          aria-hidden="true"
        >
          <div
            class="h-full bg-accent transition-all duration-500"
            :style="{ width: `${progressPercent(a.state)}%` }"
          ></div>
        </div>
        <div
          class="text-[10px] text-content-faint tabular-nums truncate"
          :title="t('components.guider.native.stats.predictive.detailsHint')"
        >
          {{ details(a.state) }}
        </div>
        <!-- RA: the worm's periodic error -->
        <template v-if="a.state.periodicError">
          <div
            class="flex items-baseline gap-2 min-w-0 text-[10px]"
            data-testid="native-guider-periodic-error"
          >
            <span class="shrink-0 text-content-muted">{{
              t('components.guider.native.stats.predictive.periodic.label')
            }}</span>
            <span class="truncate text-content-faint tabular-nums">{{
              periodicDetails(a.state.periodicError)
            }}</span>
            <span
              class="ml-auto shrink-0 font-semibold"
              :class="TONE_TEXT[periodicTone(a.state.periodicError)]"
              >{{ periodicPhase(a.state.periodicError) }}</span
            >
            <NativeHelpTip
              :title="t('components.guider.native.stats.predictive.periodic.helpTitle')"
              :text="t('components.guider.native.stats.predictive.periodic.help')"
            />
          </div>
          <div
            v-if="a.state.periodicError.phase === 'Learning'"
            class="h-1 rounded-full bg-surface-3 overflow-hidden"
            aria-hidden="true"
          >
            <div
              class="h-full bg-accent transition-all duration-500"
              :style="{ width: `${progressPercent(a.state.periodicError)}%` }"
            ></div>
          </div>
          <div
            v-else-if="a.state.periodicError.phase === 'Negligible'"
            class="text-[10px] text-content-faint"
            data-testid="native-guider-periodic-error-negligible"
          >
            {{ t('components.guider.native.stats.predictive.periodic.negligible') }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import {
  ALGORITHM_PHASE_TONE,
  PERIODIC_ERROR_PHASE_TONE,
  TONE_TEXT,
  decDirection,
  fmt,
  learningAxes,
} from '@/utils/nativeGuider';
import NativeHelpTip from './NativeHelpTip.vue';
import { formatElapsed } from './graphData';

const { t } = useI18n();
const store = useNativeGuiderStore();

const windowStats = computed(() => store.windowStats);
const sessionStats = computed(() => store.sessionStats);
// Frames the rolling window covers (up to the configured window size).
const windowFrames = computed(() => {
  const n = windowStats.value?.frames;
  return missing(n) || Number(n) <= 0 ? null : Number(n);
});
const learning = computed(() => learningAxes(store.status));

// Only while guiding: the direction belongs to the running session.
const decDir = computed(() =>
  ['Guiding', 'Paused', 'LostLock', 'Reacquiring'].includes(store.state)
    ? decDirection(store.status)
    : null
);
const decNote = computed(() => {
  const d = decDir.value;
  if (!d) return '';
  if (d.valveOpen) return t('components.guider.native.stats.decDirection.notes.valve');
  return d.direction === 'Both'
    ? t('components.guider.native.stats.decDirection.notes.unknown')
    : '';
});

const ARCSEC = '″';
const ARCMIN = '′';

function missing(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value));
}

function withSuffix(value, digits, suffix) {
  return missing(value) ? '–' : `${fmt(value, digits)}${suffix}`;
}

function pair(a, b, digits, suffix = '') {
  if (missing(a) && missing(b)) return '–';
  return `${missing(a) ? '–' : fmt(a, digits)} / ${missing(b) ? '–' : fmt(b, digits)}${suffix}`;
}

function signed(value, digits, suffix) {
  if (missing(value)) return '–';
  const v = Number(value);
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}${suffix}`;
}

function progressPercent(state) {
  return Math.floor(Math.min(1, Math.max(0, Number(state?.progress) || 0)) * 100);
}

function phaseTone(state) {
  return ALGORITHM_PHASE_TONE[state?.phase] || 'idle';
}

function phaseLabel(state) {
  const phase = state?.phase;
  if (!['Learning', 'Adapted'].includes(phase)) return phase || '–';
  return t(`components.guider.native.stats.predictive.phases.${phase}`, {
    percent: progressPercent(state),
  });
}

// Seeing, the mount's own motion and drift; in px when the guide focal length is unknown.
function details(state) {
  const arcsec = Number(store.pixelScale) > 0;
  const unit = arcsec ? ARCSEC : ' px';
  return t('components.guider.native.stats.predictive.details', {
    seeing: withSuffix(arcsec ? state.seeingArcsec : state.seeingPx, 2, unit),
    wander: withSuffix(arcsec ? state.wanderArcsec : state.wanderPx, 2, unit),
    drift: signed(arcsec ? state.driftArcsecPerMin : state.driftPxPerMin, 2, `${unit.trim()}/min`),
  });
}

function periodicTone(pe) {
  return PERIODIC_ERROR_PHASE_TONE[pe?.phase] || 'idle';
}

function periodicPhase(pe) {
  const phase = pe?.phase;
  if (!(phase in PERIODIC_ERROR_PHASE_TONE)) return phase || '–';
  return t(`components.guider.native.stats.predictive.periodic.phases.${phase}`, {
    percent: progressPercent(pe),
  });
}

// ± the worm fundamental's swing at this target, and the worm period (with its teeth when known)
function periodicDetails(pe) {
  const arcsec = Number(store.pixelScale) > 0 && !missing(pe.amplitudeArcsec);
  const amplitude = arcsec ? pe.amplitudeArcsec : pe.amplitudePx;
  const parts = [];
  if (!missing(amplitude))
    parts.push(`±${fmt(amplitude, arcsec ? 1 : 2)}${arcsec ? ARCSEC : ' px'}`);
  if (!missing(pe.periodSeconds)) parts.push(`${fmt(pe.periodSeconds, 1)} s`);
  if (!missing(pe.wormTeeth)) {
    parts.push(
      t('components.guider.native.stats.predictive.periodic.teeth', { teeth: pe.wormTeeth })
    );
  }
  return parts.join(' · ');
}

// Each row formats one AdvancedGuiderStats object (null-safe); `sub` is a faint second value,
// on its own line or, with `inline`, before the value (below it when the row has to wrap).
const rows = [
  {
    key: 'rmsTotal',
    emphasis: true,
    inline: true,
    format: (s) => withSuffix(s?.rmsTotalArcsec, 2, ARCSEC),
    sub: (s) => withSuffix(s?.rmsTotalPx, 2, ' px'),
  },
  {
    key: 'rmsRa',
    inline: true,
    format: (s) => withSuffix(s?.rmsRaArcsec, 2, ARCSEC),
    sub: (s) => withSuffix(s?.rmsRaPx, 2, ' px'),
  },
  {
    key: 'rmsDec',
    inline: true,
    format: (s) => withSuffix(s?.rmsDecArcsec, 2, ARCSEC),
    sub: (s) => withSuffix(s?.rmsDecPx, 2, ' px'),
  },
  {
    key: 'peak',
    format: (s) => pair(s?.peakRaArcsec, s?.peakDecArcsec, 2, ARCSEC),
  },
  {
    key: 'driftRa',
    format: (s) => signed(s?.driftRaArcsecPerMin, 2, `${ARCSEC}/min`),
  },
  {
    key: 'driftDec',
    format: (s) => signed(s?.driftDecArcsecPerMin, 2, `${ARCSEC}/min`),
  },
  {
    key: 'polarAlignment',
    format: (s) => withSuffix(s?.polarAlignmentErrorArcmin, 1, ARCMIN),
  },
  {
    key: 'oscillation',
    format: (s) => withSuffix(s?.oscillationIndex, 2, ''),
  },
  {
    key: 'duty',
    format: (s) => pair(s?.raDutyPercent, s?.decDutyPercent, 0, ' %'),
  },
  {
    key: 'snr',
    format: (s) => pair(s?.snrMin, s?.snrAvg, 1),
    sub: (s) =>
      missing(s?.snrLast)
        ? ''
        : t('components.guider.native.stats.snrLast', { value: fmt(s.snrLast, 1) }),
  },
  {
    key: 'stars',
    format: (s) => withSuffix(s?.avgStarCount, 1, ''),
  },
  {
    key: 'starLost',
    format: (s) => (missing(s?.starLostCount) ? '–' : String(s.starLostCount)),
  },
  {
    key: 'frames',
    format: (s) => (missing(s?.frames) ? '–' : String(s.frames)),
  },
  {
    key: 'elapsed',
    format: (s) => formatElapsed(s?.elapsedSeconds),
  },
];
</script>

<style scoped>
@reference '../../../assets/tailwind.css';

.stats-grid {
  @apply grid items-baseline gap-x-3 gap-y-1.5;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
}

.col-head {
  @apply text-right text-[10px] font-bold uppercase tracking-wider text-content-faint truncate;
}

.col-sub {
  @apply block truncate font-normal normal-case tracking-normal;
}

.row-label {
  @apply text-content-muted truncate;
}

.row-value {
  @apply flex flex-col items-end text-right tabular-nums leading-tight min-w-0;
}

.row-sub {
  @apply text-[10px] text-content-faint;
}

.row-inline {
  @apply flex-row flex-wrap-reverse justify-end gap-x-1.5;
}

.text-ra {
  color: #60a5fa;
}

.text-dec {
  color: #f87171;
}
</style>
