<template>
  <section class="tns-card p-3! flex flex-col gap-2 min-w-0" :aria-label="k('replay.telemetry')">
    <h3 class="text-sm font-semibold text-content">{{ k('replay.telemetry') }}</h3>
    <div v-if="frame" class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
      <!-- Time, relative to the first trigger -->
      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="tns-stat-label">{{ k('tele.time') }}</span>
        <span class="tns-stat-value">{{ clock(frame.timestamp) }}</span>
        <span class="text-[10px] text-content-faint tabular-nums truncate">
          {{ offsetText }}<template v-if="exposure"> · {{ exposure }}</template>
        </span>
      </div>

      <!-- Guider state and flags -->
      <div class="tns-stat-tile min-h-12! px-2!" :class="stateTileClass">
        <span class="tns-stat-label">{{ k('tele.state') }}</span>
        <span class="tns-stat-value" :class="TONE_TEXT[stateTone(frame.state)]">
          {{ stateText(frame.state) }}
        </span>
        <span class="text-[10px] truncate" :class="flagsClass">{{ flags || ' ' }}</span>
      </div>

      <!-- SNR and mass -->
      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="tns-stat-label">{{ k('tele.snr') }}</span>
        <span class="tns-stat-value" :class="TONE_TEXT[snrTone(frame.snr)]">
          {{ fmt(frame.snr, 1) }}
        </span>
        <span class="text-[10px] text-content-faint tabular-nums truncate">
          {{ k('tele.mass') }} {{ fmt(frame.starMass, 0) }}
        </span>
      </div>

      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="tns-stat-label">{{ k('tele.hfd') }}</span>
        <span class="tns-stat-value">{{ fmt(frame.hfd, 2) }}</span>
        <span class="text-[10px] text-content-faint">px</span>
      </div>

      <!-- Guide error -->
      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="tns-stat-label">{{ k('tele.error') }}</span>
        <span class="tns-stat-value">{{ fmtArcsec(frame.totalArcsec) }}</span>
        <span class="text-[10px] tabular-nums truncate">
          <span class="text-ra">RA {{ fmtArcsec(frame.raArcsec) }}</span>
          ·
          <span class="text-dec">Dec {{ fmtArcsec(frame.decArcsec) }}</span>
        </span>
      </div>

      <!-- Pulses sent -->
      <div class="tns-stat-tile min-h-12! px-2!" :class="limited ? 'tns-stat-tile-warn' : ''">
        <span class="tns-stat-label">{{ k('tele.pulses') }}</span>
        <span class="text-xs font-semibold tabular-nums text-content leading-tight">
          <span class="text-ra">RA {{ pulse(frame.raDuration, frame.raDirection) }}</span>
          <span v-if="frame.raLimited" class="text-status-warn"> ({{ k('tele.limited') }})</span>
        </span>
        <span class="text-xs font-semibold tabular-nums text-content leading-tight">
          <span class="text-dec">Dec {{ pulse(frame.decDuration, frame.decDirection) }}</span>
          <span v-if="frame.decLimited" class="text-status-warn"> ({{ k('tele.limited') }})</span>
        </span>
      </div>

      <!-- Mount snapshot -->
      <div class="tns-stat-tile min-h-12! px-2!" :class="mountProblem ? 'tns-stat-tile-warn' : ''">
        <span class="tns-stat-label">{{ k('tele.mount') }}</span>
        <span class="text-xs font-semibold text-content leading-tight">{{ mountText }}</span>
        <span class="text-[10px] text-content-faint tabular-nums truncate">
          {{ k('tele.pierSide') }}: {{ pierSideText }}
        </span>
      </div>

      <!-- Calibration step -->
      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="tns-stat-label">{{ k('tele.calibration') }}</span>
        <span class="text-xs font-semibold text-content leading-tight">{{ calibrationText }}</span>
      </div>

      <!-- Stars used / tracked -->
      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="tns-stat-label">{{ k('tele.stars') }}</span>
        <span class="tns-stat-value">
          {{ starsUsed }}<span class="text-content-faint">/</span>{{ stars.length }}
        </span>
        <span class="text-[10px] text-content-faint">
          {{ t('components.guider.native.strip.usedTotal') }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import {
  pierSideText as pierSideText_,
  textOr,
  TONE_TEXT,
  fmt,
  snrTone,
  stateTone,
} from '@/utils/nativeGuider';
import { useIncidentText } from './useIncidentText';

const props = defineProps({
  /** AdvancedIncidentFrame shown in the replay. */
  frame: { type: Object, default: null },
  /** Seconds of this frame relative to the first trigger (null when unknown). */
  offsetSeconds: { type: Number, default: null },
});

const { t, te, k, clock, stateText } = useIncidentText();

const stars = computed(() => (Array.isArray(props.frame?.stars) ? props.frame.stars : []));
const starsUsed = computed(() => stars.value.filter((s) => s.used || s.isPrimary).length);

const offsetText = computed(() => {
  const s = props.offsetSeconds;
  if (s === null || !Number.isFinite(s)) return '';
  const sign = s < 0 ? '−' : '+';
  return `T${sign}${Math.abs(s).toFixed(1)} s`;
});

const exposure = computed(() => {
  const ms = Number(props.frame?.exposureMs);
  return ms > 0 ? `${fmt(ms / 1000, ms < 1000 ? 2 : 1)} s` : '';
});

const flags = computed(() => {
  const f = props.frame;
  if (!f) return '';
  const parts = [];
  if (f.starFound === false) {
    parts.push(
      f.lostStatus
        ? k('replay.starLostStatus', { status: statusText(f.lostStatus) })
        : k('replay.starLost')
    );
  }
  if (f.settling) parts.push(k('tele.settling'));
  if (f.dithering) parts.push(k('tele.dithering'));
  return parts.join(' · ');
});
const flagsClass = computed(() =>
  props.frame?.starFound === false ? 'text-status-danger' : 'text-status-warn'
);
const stateTileClass = computed(() =>
  props.frame?.starFound === false ? 'tns-stat-tile-danger' : ''
);

function statusText(status) {
  const key = `components.guider.native.incidents.values.status.${status}`;
  return textOr({ t, te }, key, status);
}

function fmtArcsec(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? '–'
    : `${fmt(value, 2)}″`;
}

function pulse(duration, direction) {
  const ms = Number(duration) || 0;
  if (!ms) return '0';
  return `${Math.round(ms)} ms ${String(direction || '').charAt(0)}`.trim();
}

const limited = computed(() => props.frame?.raLimited || props.frame?.decLimited);

const mountText = computed(() => {
  const f = props.frame;
  if (!f) return '–';
  const parts = [];
  if (f.mountParked === true) parts.push(k('tele.parked'));
  if (f.mountSlewing === true) parts.push(k('tele.slewing'));
  if (f.mountTracking === true) parts.push(k('tele.tracking'));
  else if (f.mountTracking === false) parts.push(k('tele.notTracking'));
  return parts.length ? parts.join(' · ') : k('tele.unknown');
});
const mountProblem = computed(
  () =>
    props.frame?.mountParked === true ||
    props.frame?.mountSlewing === true ||
    props.frame?.mountTracking === false
);

// Same words as the calibration card (both NINA spellings, East and pierEast)
const pierSideText = computed(() =>
  pierSideText_({ t, te }, props.frame?.pierSide, k('tele.unknown'))
);

const calibrationText = computed(() => {
  const f = props.frame;
  if (!f?.calibrationDirection) return '–';
  const direction = f.calibrationDirection;
  const key = `components.guider.native.coach.values.direction.${direction}`;
  const name = textOr({ t, te }, key, direction);
  return f.calibrationStep !== null && f.calibrationStep !== undefined
    ? `${name} #${f.calibrationStep}`
    : name;
});
</script>

<style scoped>
.text-ra {
  color: #60a5fa;
}
.text-dec {
  color: #f87171;
}
</style>
