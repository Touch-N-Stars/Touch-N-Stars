<template>
  <div class="tns-card p-3! flex flex-col gap-2">
    <!-- State badge + feed indicator + last error -->
    <div class="flex flex-wrap items-center gap-2">
      <div
        class="flex items-center gap-2 rounded-chip px-3 py-1.5 border"
        :class="[badgeClasses, { 'state-pulse': pulsing }]"
        data-testid="native-guider-state"
      >
        <span class="tns-dot w-2.5! h-2.5!" :class="TONE_BG[tone]"></span>
        <span class="text-base font-bold tracking-wide" :class="TONE_TEXT[tone]">
          {{ stateLabel }}
        </span>
        <span
          v-if="store.isSettling"
          class="text-xs font-semibold uppercase text-status-warn ml-1"
          >{{ t('components.guider.native.strip.settling') }}</span
        >
      </div>

      <span
        class="flex items-center gap-1 text-[11px] uppercase tracking-wider text-content-faint"
        :title="
          store.wsConnected
            ? t('components.guider.native.strip.liveHint')
            : t('components.guider.native.strip.pollHint')
        "
      >
        <span
          class="tns-dot w-1.5! h-1.5!"
          :class="store.wsConnected ? 'bg-status-ok' : 'bg-status-warn'"
        ></span>
        {{
          store.wsConnected
            ? t('components.guider.native.strip.live')
            : t('components.guider.native.strip.poll')
        }}
      </span>

      <!-- Predictive algorithm still learning the sky and the mount -->
      <span
        v-if="learning"
        class="flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-semibold border border-accent/40 bg-accent/10 text-accent"
        :title="t('components.guider.native.strip.learningChipHint')"
        data-testid="native-guider-learning"
      >
        <AcademicCapIcon class="w-4 h-4 shrink-0" />
        <span class="tabular-nums">{{
          t('components.guider.native.strip.learningChip', { percent: learning.percent })
        }}</span>
        <span class="w-10 h-1 rounded-full bg-surface-3 overflow-hidden" aria-hidden="true">
          <span
            class="block h-full bg-accent transition-all duration-500"
            :style="{ width: `${learning.percent}%` }"
          ></span>
        </span>
      </span>

      <!-- Predictive RA learning the worm's periodic error (after the sky and the mount) -->
      <span
        v-else-if="periodicLearning"
        class="flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-semibold border border-accent/40 bg-accent/10 text-accent"
        :title="t('components.guider.native.strip.periodicErrorChipHint')"
        data-testid="native-guider-learning-periodic-error"
      >
        <CogIcon class="w-4 h-4 shrink-0" />
        <span class="tabular-nums">{{
          t('components.guider.native.strip.periodicErrorChip', {
            percent: periodicLearning.percent,
          })
        }}</span>
        <span class="w-10 h-1 rounded-full bg-surface-3 overflow-hidden" aria-hidden="true">
          <span
            class="block h-full bg-accent transition-all duration-500"
            :style="{ width: `${periodicLearning.percent}%` }"
          ></span>
        </span>
      </span>

      <button
        v-if="lastError"
        type="button"
        class="ml-auto flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-semibold border max-w-full min-w-0"
        :class="errorChipClasses"
        @click="showError = true"
      >
        <ExclamationTriangleIcon class="w-4 h-4 shrink-0" />
        <span class="truncate">{{ lastErrorTitle }}</span>
      </button>
    </div>

    <!-- Live coaching hint (one at a time) -->
    <NativeHintChip />

    <!-- Calibration progress -->
    <div v-if="calibrationStep" class="flex flex-col gap-1">
      <div class="flex justify-between text-xs text-content-muted">
        <span class="truncate">{{ calibrationStep }}</span>
        <span v-if="calibrationPercent !== null" class="tabular-nums"
          >{{ calibrationPercent }}%</span
        >
      </div>
      <div class="h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div
          class="h-full bg-accent transition-all duration-500"
          :style="{ width: `${calibrationPercent ?? 0}%` }"
        ></div>
      </div>
    </div>

    <!-- Settle status -->
    <p v-if="settleText" class="text-xs text-status-warn truncate">{{ settleText }}</p>

    <!-- Live numbers -->
    <div class="grid grid-cols-4 gap-1.5">
      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="flex min-w-0 items-center gap-1">
          <span class="tns-stat-label">{{ t('components.guider.native.strip.rmsTotal') }}</span>
          <NativeHelpTip v-bind="help('rms')" />
        </span>
        <span class="tns-stat-value" :class="rmsTone">{{ fmt(rms.total, 2) }}″</span>
        <span class="text-[10px] text-content-faint tabular-nums"
          >{{ fmt(rms.totalPx, 2) }} px</span
        >
      </div>
      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="flex min-w-0 items-center gap-1">
          <span class="tns-stat-label">{{ t('components.guider.native.strip.rmsRa') }}</span>
          <NativeHelpTip v-bind="help('ra')" />
        </span>
        <span class="tns-stat-value text-ra">{{ fmt(rms.ra, 2) }}″</span>
        <span class="text-[10px] text-content-faint tabular-nums">{{ fmt(rms.raPx, 2) }} px</span>
      </div>
      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="flex min-w-0 items-center gap-1">
          <span class="tns-stat-label">{{ t('components.guider.native.strip.rmsDec') }}</span>
          <NativeHelpTip v-bind="help('dec')" />
        </span>
        <span class="tns-stat-value text-dec">{{ fmt(rms.dec, 2) }}″</span>
        <!-- Dec guide mode Drift: the direction next to the px, details in the tooltip -->
        <span
          class="text-[10px] text-content-faint tabular-nums truncate"
          :title="decDirectionHint || undefined"
        >
          {{ fmt(rms.decPx, 2) }} px
          <span
            v-if="decDir"
            :class="TONE_TEXT[decDir.tone]"
            data-testid="native-guider-dec-tile-direction"
            >· {{ decDirectionShort }}</span
          >
        </span>
      </div>
      <div class="tns-stat-tile min-h-12! px-2!" :class="snrTileClass">
        <span class="flex min-w-0 items-center gap-1">
          <span class="tns-stat-label">{{ t('components.guider.native.strip.snr') }}</span>
          <NativeHelpTip v-bind="help('snr')" />
        </span>
        <span class="tns-stat-value" :class="TONE_TEXT[snrToneValue]">{{
          fmt(primary?.snr, 1)
        }}</span>
        <span class="text-[10px] text-content-faint tabular-nums"
          >{{ t('components.guider.native.strip.mass') }} {{ fmt(primary?.mass, 0) }}</span
        >
      </div>
      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="flex min-w-0 items-center gap-1">
          <span class="tns-stat-label">{{ t('components.guider.native.strip.hfd') }}</span>
          <NativeHelpTip v-bind="help('hfd')" />
        </span>
        <span class="tns-stat-value">{{ fmt(primary?.hfd, 2) }}</span>
        <span class="text-[10px] text-content-faint">px</span>
      </div>
      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="flex min-w-0 items-center gap-1">
          <span class="tns-stat-label">{{ t('components.guider.native.strip.stars') }}</span>
          <NativeHelpTip v-bind="help('stars')" />
        </span>
        <span class="tns-stat-value">
          {{ status?.starsUsed ?? '–' }}<span class="text-content-faint">/</span
          >{{ status?.starCount ?? '–' }}
        </span>
        <span class="text-[10px] text-content-faint">{{
          t('components.guider.native.strip.usedTotal')
        }}</span>
      </div>
      <!-- Guiding error relative to the imaging camera's pixel scale: < 0.5 is excellent -->
      <div class="tns-stat-tile min-h-12! px-2!">
        <span class="flex min-w-0 items-center gap-1">
          <span class="tns-stat-label">{{ t('components.guider.native.strip.rmsImage') }}</span>
          <NativeHelpTip v-bind="help('rmsImage')" />
        </span>
        <span class="tns-stat-value" :class="imageRatioTone">{{
          imageRatio === null ? '–' : `${fmt(imageRatio, 2)}×`
        }}</span>
        <span class="text-[10px] text-content-faint tabular-nums truncate">{{
          imageScale
            ? t('components.guider.native.strip.imageScale', { scale: fmt(imageScale, 2) })
            : t('components.guider.native.strip.imageScaleUnknown')
        }}</span>
      </div>
      <div class="tns-stat-tile min-h-12! px-2!" :class="processingTileClass">
        <span class="flex min-w-0 items-center gap-1">
          <span class="tns-stat-label">{{ t('components.guider.native.strip.processing') }}</span>
          <NativeHelpTip v-bind="help('processing')" />
        </span>
        <span class="tns-stat-value">{{ processingMs === null ? '–' : fmt(processingMs, 0) }}</span>
        <span class="text-[10px] text-content-faint">ms</span>
      </div>
    </div>

    <!-- Error detail -->
    <Modal :show="showError" max-width="max-w-lg" @close="showError = false">
      <template #header>
        <h2 class="text-lg font-bold flex items-center gap-2" :class="errorTextClass">
          <ExclamationTriangleIcon class="w-5 h-5" />
          {{ lastErrorTitle }}
        </h2>
      </template>
      <template #body>
        <NativeAlertDetail v-if="lastError" :alert="lastError" @replay="showError = false" />
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { AcademicCapIcon, CogIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import NativeAlertDetail from './NativeAlertDetail.vue';
import NativeHelpTip from './NativeHelpTip.vue';
import NativeHintChip from './coach/NativeHintChip.vue';
import { apiStore } from '@/store/store';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import {
  TONE_BG,
  TONE_TEXT,
  alertText,
  decDirection,
  fmt,
  learningBadge,
  periodicErrorBadge,
  severityTone,
  snrTone,
  stateTone,
  windowRms,
} from '@/utils/nativeGuider';

const { t, te } = useI18n();
const store = useNativeGuiderStore();
const showError = ref(false);

const status = computed(() => store.status);

// Title and explanation behind the ⓘ of a tile (the RMS/image text doubles as its former hover hint)
function help(key) {
  const base = 'components.guider.native.strip';
  return {
    title: t(`${base}.help.${key}.title`),
    text: key === 'rmsImage' ? t(`${base}.rmsImageHint`) : t(`${base}.help.${key}.text`),
  };
}
const primary = computed(() => store.status?.primaryStar || null);
const tone = computed(() => stateTone(store.state));

const stateLabel = computed(() => {
  const key = `components.guider.native.states.${store.state}`;
  return te(key) ? t(key) : store.state;
});

const pulsing = computed(
  () => store.isSettling || ['Calibrating', 'Reacquiring'].includes(store.state)
);

const badgeClasses = computed(
  () =>
    ({
      ok: 'border-status-ok/40 bg-status-ok/10',
      info: 'border-accent/40 bg-accent/10',
      warn: 'border-status-warn/40 bg-status-warn/10',
      danger: 'border-status-danger/50 bg-status-danger/15',
      idle: 'border-line-strong bg-surface-2',
    })[tone.value]
);

// Backend window statistics first; the client-side window of the last 100 steps covers
// guiders/moments without stats (e.g. right after a reconnect).
const rms = computed(() => {
  const w = store.windowStats;
  if (w && Number.isFinite(w.rmsTotalArcsec) && w.frames > 0) {
    return {
      total: w.rmsTotalArcsec,
      ra: w.rmsRaArcsec,
      dec: w.rmsDecArcsec,
      totalPx: w.rmsTotalPx,
      raPx: w.rmsRaPx,
      decPx: w.rmsDecPx,
    };
  }
  const recent = store.steps.slice(-100);
  const arcsec = windowRms(recent, 'arcsec');
  const px = windowRms(recent, 'px');
  return {
    total: arcsec.total,
    ra: arcsec.ra,
    dec: arcsec.dec,
    totalPx: px.total,
    raPx: px.ra,
    decPx: px.dec,
  };
});

// Imaging camera scale (″/px) from the profile: main camera pixel size and telescope focal length.
const imageScale = computed(() => {
  const profile = apiStore().profileInfo;
  const pixel = Number(profile?.CameraSettings?.PixelSize);
  const focal = Number(profile?.TelescopeSettings?.FocalLength);
  if (!(pixel > 0) || !(focal > 0)) return null;
  return (206.265 * pixel) / focal;
});

const imageRatio = computed(() => {
  const total = Number(rms.value.total);
  if (!imageScale.value || !Number.isFinite(total) || total <= 0) return null;
  return total / imageScale.value;
});

const imageRatioTone = computed(() => {
  const r = imageRatio.value;
  if (r === null) return 'text-content';
  return TONE_TEXT[r < 0.5 ? 'ok' : r < 1 ? 'warn' : 'danger'];
});

const rmsTone = computed(() => {
  const v = rms.value.total;
  if (!Number.isFinite(v)) return '';
  if (v > 2) return 'text-status-danger';
  if (v > 1.2) return 'text-status-warn';
  return 'text-status-ok';
});

const snrToneValue = computed(() => snrTone(primary.value?.snr));
const snrTileClass = computed(() =>
  snrToneValue.value === 'danger'
    ? 'tns-stat-tile-danger'
    : snrToneValue.value === 'warn'
      ? 'tns-stat-tile-warn'
      : ''
);

// Processing time comes from guide steps only: while looping (or with no value yet) it would
// read "0 ms", which looks like a measurement.
const processingMs = computed(() => {
  const ms = Number(status.value?.lastProcessingMs);
  const guiding = ['Guiding', 'Paused', 'LostLock', 'Reacquiring'].includes(store.state);
  return guiding && Number.isFinite(ms) && ms > 0 ? ms : null;
});

const processingTileClass = computed(() => {
  const ms = processingMs.value;
  const exposureMs = (status.value?.exposureSeconds || 0) * 1000;
  return Number.isFinite(ms) && exposureMs > 0 && ms > exposureMs * 0.5 ? 'tns-stat-tile-warn' : '';
});

const calibrationStep = computed(() =>
  store.state === 'Calibrating' ? store.status?.calibrationStep || '' : ''
);
const calibrationPercent = computed(() => {
  const p = store.status?.calibrationProgress;
  if (!Number.isFinite(p)) return null;
  return Math.round(Math.min(100, Math.max(0, p <= 1 ? p * 100 : p)));
});

const settleText = computed(() => (store.isSettling ? store.status?.settleStatus || '' : ''));

// Only while guiding: what was learned is kept across stops, but the chip is about the running session.
const guidingNow = computed(() =>
  ['Guiding', 'Paused', 'LostLock', 'Reacquiring'].includes(store.state)
);
const learning = computed(() => (guidingNow.value ? learningBadge(store.status) : null));

// Dec guide mode Drift: the direction in the Dec tile, the drift and why both ways in its tooltip
const decDir = computed(() => (guidingNow.value ? decDirection(store.status) : null));
const decDirectionShort = computed(() => {
  const d = decDir.value;
  if (!d) return '';
  return t(`components.guider.native.strip.decDirection.${d.valveOpen ? 'Both' : d.direction}`);
});
const decDirectionHint = computed(() => {
  const d = decDir.value;
  if (!d) return '';
  const base = 'components.guider.native.stats.decDirection';
  const parts = [`${t(`${base}.label`)}: ${t(`${base}.directions.${d.direction}`)}`];
  if (d.driftArcsecPerMin !== null) {
    parts.push(t(`${base}.drift`, { drift: `${fmt(d.driftArcsecPerMin, 2)}″/min` }));
  }
  if (d.valveOpen) parts.push(t(`${base}.notes.valve`));
  else if (d.direction === 'Both') parts.push(t(`${base}.notes.unknown`));
  return parts.join(' · ');
});
const periodicLearning = computed(() =>
  guidingNow.value ? periodicErrorBadge(store.status) : null
);

const lastError = computed(() => store.status?.lastError || null);
const lastErrorTitle = computed(() =>
  lastError.value ? alertText({ t, te }, lastError.value).title : ''
);
const errorTone = computed(() => severityTone(lastError.value?.severity));
const errorChipClasses = computed(
  () =>
    ({
      danger: 'border-status-danger/50 bg-status-danger/15 text-status-danger',
      warn: 'border-status-warn/50 bg-status-warn/10 text-status-warn',
      info: 'border-accent/40 bg-accent/10 text-accent',
    })[errorTone.value]
);
const errorTextClass = computed(() => TONE_TEXT[errorTone.value]);
</script>

<style scoped>
.text-ra {
  color: #60a5fa;
}
.text-dec {
  color: #f87171;
}
.state-pulse {
  animation: state-pulse 1.4s ease-in-out infinite;
}
@keyframes state-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
</style>
