<template>
  <section class="flex flex-col gap-2 min-w-0">
    <div class="flex items-baseline justify-between gap-2">
      <h4 class="text-sm font-semibold text-content">{{ k('drift.title') }}</h4>
      <span v-if="progressText" class="text-xs text-content-muted tabular-nums">
        {{ progressText }}
      </span>
    </div>

    <template v-if="plotData">
      <div class="flex flex-wrap gap-x-3 text-[11px]">
        <span class="legend"
          ><i class="line" :style="{ background: RA_COLOR }"></i>{{ k('drift.ra') }}</span
        >
        <span class="legend"
          ><i class="line" :style="{ background: DEC_COLOR }"></i>{{ k('drift.dec') }}</span
        >
        <span v-if="hasFit" class="legend">
          <i class="line dashed" :style="{ borderColor: FIT_COLOR }"></i>{{ k('drift.peFit') }}
        </span>
      </div>
      <NativeCoachPlot
        :data="plotData"
        :series="series"
        :height="compact ? 150 : 190"
        :x-label="k('drift.time')"
        y-label="″"
        :label="plotLabel"
      />
    </template>
    <p v-else-if="live" class="py-4 text-center text-xs text-content-muted">
      {{ k('drift.noSamples') }}
    </p>

    <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      <div class="tns-stat-tile">
        <span class="tns-stat-label">{{ k('drift.seeing') }}</span>
        <span class="tns-stat-value">{{ arcsec(drift?.seeingTotalArcsec) }}</span>
        <span class="text-[10px] text-content-faint tabular-nums truncate">
          {{
            k('drift.seeingSub', {
              ra: arcsec(drift?.seeingRaArcsec),
              dec: arcsec(drift?.seeingDecArcsec),
            })
          }}
        </span>
      </div>
      <div class="tns-stat-tile">
        <span class="tns-stat-label">{{ k('drift.periodicError') }}</span>
        <span class="tns-stat-value">{{ peValue }}</span>
        <span class="text-[10px] text-content-faint tabular-nums truncate">{{ peSub }}</span>
      </div>
      <div class="tns-stat-tile" :class="paTileClass">
        <span class="tns-stat-label">{{ k('drift.polarAlignment') }}</span>
        <span class="tns-stat-value" :class="TONE_TEXT[paTone]">{{ paValue }}</span>
        <span class="text-[10px] text-content-faint tabular-nums truncate">
          {{ drift?.declinationAssumed ? k('drift.decAssumed') : decDriftText }}
        </span>
      </div>
      <div class="tns-stat-tile">
        <span class="tns-stat-label">{{ k('drift.exposureLimit') }}</span>
        <span class="tns-stat-value">{{ exposureLimit }}</span>
        <span class="text-[10px] text-content-faint truncate">{{
          k('drift.exposureLimitSub')
        }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { TONE_TEXT, fmt } from '@/utils/nativeGuider';
import { formatParameter, periodicErrorOverlay } from '@/utils/nativeGuiderCoach';
import NativeCoachPlot from './NativeCoachPlot.vue';
import { useCoachText } from './useCoachText';

const props = defineProps({
  /** AdvancedCoachDrift. */
  drift: { type: Object, default: null },
  /** Measurement in progress (shows elapsed/target and the waiting text). */
  live: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
});

const { k, duration } = useCoachText();

const RA_COLOR = '#60a5fa';
const DEC_COLOR = '#f87171';
const FIT_COLOR = '#fbbf24';

function arcsec(value) {
  return Number.isFinite(value) ? `${fmt(value, 2)}″` : '–';
}

const samples = computed(() =>
  (props.drift?.samples || []).filter((s) => Number.isFinite(s?.t)).sort((a, b) => a.t - b.t)
);

const fit = computed(() => {
  if (!samples.value.length) return null;
  return periodicErrorOverlay({ ...props.drift, samples: samples.value });
});
const hasFit = computed(() => Array.isArray(fit.value));

const plotData = computed(() => {
  if (samples.value.length < 2) return null;
  const xs = samples.value.map((s) => s.t);
  const ra = samples.value.map((s) => (Number.isFinite(s.ra) ? s.ra : null));
  const dec = samples.value.map((s) => (Number.isFinite(s.dec) ? s.dec : null));
  return hasFit.value ? [xs, ra, dec, fit.value] : [xs, ra, dec];
});

const series = computed(() => {
  const list = [
    { label: 'RA', stroke: RA_COLOR, width: 1.25 },
    { label: 'Dec', stroke: DEC_COLOR, width: 1.25 },
  ];
  if (hasFit.value) list.push({ label: 'PE', stroke: FIT_COLOR, width: 1.5, dash: [6, 4] });
  return list;
});

// the seeing RMS (the high-frequency part of the drift) summarises the plot
const plotLabel = computed(() => {
  const seeing = arcsec(props.drift?.seeingTotalArcsec);
  const axes = k('drift.seeingSub', {
    ra: arcsec(props.drift?.seeingRaArcsec),
    dec: arcsec(props.drift?.seeingDecArcsec),
  });
  return `${k('drift.title')}: ${k('drift.seeing')} ${seeing} (${axes})`;
});

const progressText = computed(() => {
  if (!props.live || !props.drift) return '';
  const { elapsedSeconds, targetSeconds } = props.drift;
  if (!Number.isFinite(elapsedSeconds) || !(targetSeconds > 0)) return '';
  return k('drift.progress', {
    elapsed: duration(elapsedSeconds),
    target: duration(targetSeconds),
  });
});

const peValue = computed(() => {
  const amplitude = props.drift?.periodicErrorAmplitudeArcsec;
  if (Number.isFinite(amplitude)) return `±${fmt(amplitude, 2)}″`;
  const p2p = props.drift?.raPeakToPeakArcsec;
  return Number.isFinite(p2p) ? `${fmt(p2p, 2)}″ p-p` : '–';
});

const peSub = computed(() => {
  const period = props.drift?.periodicErrorPeriodSeconds;
  if (Number.isFinite(period)) return k('drift.period', { value: duration(period) });
  const rate = props.drift?.raMaxRateArcsecPerSec;
  if (Number.isFinite(rate)) return formatParameter('maxRateArcsecPerSec', rate);
  return props.drift ? k('drift.periodUnknown') : '';
});

const pa = computed(() => props.drift?.polarAlignmentErrorArcmin);
const paValue = computed(() => (Number.isFinite(pa.value) ? `${fmt(pa.value, 1)}′` : '–'));
const paTone = computed(() => {
  const v = pa.value;
  if (!Number.isFinite(v)) return 'idle';
  if (v < 3) return 'ok';
  if (v < 5) return 'info';
  if (v < 10) return 'warn';
  return 'danger';
});
const paTileClass = computed(() =>
  paTone.value === 'danger'
    ? 'tns-stat-tile-danger'
    : paTone.value === 'warn'
      ? 'tns-stat-tile-warn'
      : ''
);

const decDriftText = computed(() => {
  const drift = props.drift?.decDriftArcsecPerMin;
  return Number.isFinite(drift) ? formatParameter('driftArcsecPerMin', drift) : '';
});

const exposureLimit = computed(() => {
  const s = props.drift?.driftLimitingExposureSeconds;
  return Number.isFinite(s) ? formatParameter('seconds', s) : '–';
});
</script>

<style scoped>
@reference '../../../../assets/tailwind.css';

.legend {
  @apply inline-flex items-center gap-1 text-content-muted;
}
.line {
  @apply inline-block h-0.5 w-3.5 rounded-full;
}
.line.dashed {
  @apply h-0 border-t-2 border-dashed bg-transparent;
}
</style>
