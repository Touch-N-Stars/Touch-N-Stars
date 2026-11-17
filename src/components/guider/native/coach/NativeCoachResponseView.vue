<template>
  <section class="flex flex-col gap-3 min-w-0">
    <h4 class="text-sm font-semibold text-content">{{ k('response.title') }}</h4>

    <p v-if="!hasData" class="text-xs text-content-muted">{{ k('response.noData') }}</p>

    <!-- Dec backlash -->
    <div v-if="hasData" class="flex flex-col gap-1.5">
      <div class="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span class="font-semibold text-content">{{ k('response.backlash') }}</span>
        <span class="tabular-nums text-content-muted">
          <span class="font-semibold text-content">{{ backlashValue }}</span>
          <template v-if="backlashState"> · {{ backlashState }}</template>
        </span>
      </div>
      <NativeCoachPlot
        v-if="backlashData"
        :data="backlashData"
        :series="backlashSeries"
        :height="compact ? 130 : 160"
        :x-label="k('response.backlashAxisX')"
        :y-label="k('response.backlashAxisY')"
        :label="`${k('response.backlash')}: ${backlashValue}`"
      />
    </div>

    <!-- Pulse response per direction -->
    <div v-if="directions.length" class="flex flex-col gap-1.5">
      <span class="text-xs font-semibold text-content">{{ k('response.pulses') }}</span>
      <div class="flex flex-col gap-1.5">
        <div
          v-for="dir in directions"
          :key="dir.direction"
          class="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2"
        >
          <span class="text-xs text-content-muted truncate">{{
            directionLabel(dir.direction)
          }}</span>
          <div class="flex gap-1">
            <div
              v-for="d in dir.durations"
              :key="d.ms"
              class="flex min-w-0 flex-1 flex-col gap-0.5"
              :title="`${d.ms} ms: ${fmt(d.moved, 2)}″ / ${fmt(d.expected, 2)}″`"
            >
              <div class="relative h-7 overflow-hidden rounded-sm bg-surface-3">
                <div
                  class="absolute inset-y-0 left-0 rounded-sm"
                  :class="ratioClass(d)"
                  :style="{ width: `${barWidth(d.ratio)}%` }"
                ></div>
                <!-- 50 % (min effective) and 100 % (calibrated) marks on a 0..150 % scale -->
                <div
                  class="absolute inset-y-0 border-l border-dashed border-content-faint/60"
                  style="left: 33.33%"
                ></div>
                <div
                  class="absolute inset-y-0 border-l border-content-muted/70"
                  style="left: 66.67%"
                ></div>
                <span
                  class="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-content"
                >
                  {{ Math.round(d.ratio * 100) }}%
                </span>
              </div>
              <span class="text-center text-[10px] text-content-faint tabular-nums">{{
                d.ms
              }}</span>
            </div>
          </div>
        </div>
      </div>
      <p class="text-[11px] text-content-faint">{{ k('response.pulsesHint') }}</p>
      <p v-if="hasInconclusive" class="text-[11px] text-content-faint">
        {{ k('response.pulsesNoiseHint') }}
      </p>
    </div>

    <div v-if="hasData" class="grid grid-cols-3 gap-1.5">
      <div class="tns-stat-tile">
        <span class="tns-stat-label whitespace-normal! leading-tight">{{
          k('response.minPulse')
        }}</span>
        <span class="tns-stat-value text-[13px]!">{{
          pairMs(response?.minEffectivePulseRaMs, response?.minEffectivePulseDecMs)
        }}</span>
        <span class="text-[10px] text-content-faint">RA / Dec</span>
      </div>
      <div class="tns-stat-tile">
        <span class="tns-stat-label whitespace-normal! leading-tight">{{
          k('response.asymmetry')
        }}</span>
        <span class="tns-stat-value text-[13px]!">{{
          pairRatio(response?.asymmetryRa, response?.asymmetryDec)
        }}</span>
        <span class="text-[10px] text-content-faint">RA / Dec</span>
      </div>
      <div class="tns-stat-tile">
        <span class="tns-stat-label whitespace-normal! leading-tight">{{
          k('response.rateRatio')
        }}</span>
        <span class="tns-stat-value text-[13px]!">{{
          pairRatio(response?.rateRatioRa, response?.rateRatioDec)
        }}</span>
        <span class="text-[10px] text-content-faint">RA / Dec</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { fmt } from '@/utils/nativeGuider';
import { pulseResponse } from '@/utils/nativeGuiderCoach';
import NativeCoachPlot from './NativeCoachPlot.vue';
import { useCoachText } from './useCoachText';

const props = defineProps({
  /** AdvancedCoachResponse. */
  response: { type: Object, default: null },
  /** AdvancedCoachDrift of the same session: its seeing tells which pulse durations are within the noise. */
  drift: { type: Object, default: null },
  compact: { type: Boolean, default: false },
});

const { k, te } = useCoachText();

const backlashSeries = [
  { label: 'Dec', stroke: '#f87171', width: 1.5, points: { show: true, size: 4, fill: '#f87171' } },
];

const directions = computed(() =>
  pulseResponse(props.response?.pulses, {
    ra: props.drift?.seeingRaArcsec,
    dec: props.drift?.seeingDecArcsec,
  })
);

const hasInconclusive = computed(() =>
  directions.value.some((dir) => dir.durations.some((d) => d.conclusive === false))
);

const hasData = computed(() => {
  const r = props.response;
  if (!r) return false;
  return (
    Number.isFinite(r.backlashMs) ||
    Boolean(r.backlashState) ||
    (r.backlashPoints || []).length > 0 ||
    (r.pulses || []).length > 0
  );
});

const backlashData = computed(() => {
  const points = (props.response?.backlashPoints || [])
    .filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
    .sort((a, b) => a.x - b.x);
  if (points.length < 2) return null;
  return [points.map((p) => p.x), points.map((p) => p.y)];
});

const backlashValue = computed(() => {
  const r = props.response;
  if (!r) return '–';
  const ms = Number.isFinite(r.backlashMs) ? `${Math.round(r.backlashMs)} ms` : null;
  const arcsec = Number.isFinite(r.backlashArcsec) ? `${fmt(r.backlashArcsec, 1)}″` : null;
  if (ms && arcsec) return `${ms} (${arcsec})`;
  return ms || arcsec || '–';
});

const backlashState = computed(() => {
  const state = props.response?.backlashState;
  const key = `components.guider.native.coach.response.backlashStates.${state}`;
  return state && te(key) ? k(`response.backlashStates.${state}`) : state || '';
});

function directionLabel(direction) {
  const key = `components.guider.native.coach.response.directions.${direction}`;
  return te(key) ? k(`response.directions.${direction}`) : direction;
}

function barWidth(ratio) {
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(100, Math.max(0, (ratio / 1.5) * 100));
}

function ratioClass(d) {
  // expected move within the seeing noise: the percentage says nothing, so no verdict colour
  if (d.conclusive === false) return 'bg-content-faint/40';
  const ratio = d.ratio;
  if (!Number.isFinite(ratio) || ratio < 0.5) return 'bg-status-danger/60';
  if (ratio < 0.8 || ratio > 1.25) return 'bg-status-warn/60';
  return 'bg-status-ok/60';
}

function pairMs(ra, dec) {
  const f = (v) => (Number.isFinite(v) ? String(Math.round(v)) : '–');
  if (!Number.isFinite(ra) && !Number.isFinite(dec)) return '–';
  return `${f(ra)} / ${f(dec)} ms`;
}

function pairRatio(ra, dec) {
  const f = (v) => (Number.isFinite(v) ? fmt(v, 2) : '–');
  if (!Number.isFinite(ra) && !Number.isFinite(dec)) return '–';
  return `${f(ra)} / ${f(dec)}`;
}
</script>
