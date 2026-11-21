<template>
  <!-- While the plan takes pictures: what an imager watches - which target and frame, what
       the rig is busy with, and whether the pictures are good (guiding, sharpness, star
       count). Problems are listed on top, so a glance tells "all fine" or "act now". -->
  <section class="tns-card border-accent/40! flex flex-col gap-3">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <span class="tns-label flex items-center gap-1.5">
          <span class="tns-dot bg-status-ok animate-pulse"></span>
          {{ $t('components.simpleMode.cockpit.title') }}
        </span>
        <h2 class="text-xl font-bold text-content leading-tight truncate">
          {{ targetName || $t('components.simpleMode.cockpit.noTargetName') }}
        </h2>
      </div>
      <div v-if="doneAt" class="text-right shrink-0">
        <span class="tns-label block">{{ $t('components.simpleMode.cockpit.doneAt') }}</span>
        <span class="text-lg font-semibold text-content tabular-nums">{{ doneAt }}</span>
      </div>
    </div>

    <!-- What happens right now -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center gap-2 text-sm text-content">
        <Spinner v-if="activity !== 'exposing'" size="sm" class="text-accent" />
        <CameraIcon v-else class="w-4 h-4 text-accent shrink-0" />
        <span class="min-w-0">{{ activityText }}</span>
      </div>
      <div v-if="activity === 'exposing'" class="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          class="h-full bg-accent transition-[width] duration-500"
          :style="{ width: `${exposurePercent}%` }"
        ></div>
      </div>
      <p v-if="remaining" class="text-xs text-content-muted">
        {{ $t('components.simpleMode.cockpit.remaining', { time: remaining }) }}
      </p>
    </div>

    <!-- Problems first -->
    <ul v-if="alerts.length" class="flex flex-col gap-2">
      <li
        v-for="alert in alerts"
        :key="alert.key"
        class="flex items-start gap-2 rounded-control border px-3 py-2 text-sm"
        :class="
          alert.level === 'danger'
            ? 'border-status-danger/50 bg-status-danger/10'
            : 'border-status-warn/50 bg-status-warn/10'
        "
      >
        <ExclamationTriangleIcon
          class="w-5 h-5 shrink-0"
          :class="alert.level === 'danger' ? 'text-status-danger' : 'text-status-warn'"
        />
        <span class="flex-1 min-w-0 text-content">{{ alert.text }}</span>
        <router-link v-if="alert.to" :to="alert.to" class="text-xs text-accent underline shrink-0">
          {{ $t('components.simpleMode.cockpit.check') }}
        </router-link>
      </li>
    </ul>

    <!-- What decides whether the pictures are usable: guiding, sharpness, stars -->
    <div class="grid grid-cols-3 gap-2">
      <div
        v-for="tile in tiles"
        :key="tile.key"
        class="tns-stat-tile min-w-0"
        :class="tile.level === 'poor' ? 'tns-stat-tile-warn' : ''"
      >
        <span class="tns-stat-label">{{ tile.label }}</span>
        <span class="tns-stat-value text-lg!">
          <span v-if="tile.level" class="tns-dot" :class="LEVEL_DOT[tile.level]"></span>
          <span class="truncate">{{ tile.value }}</span>
        </span>
        <span class="text-[11px] leading-tight text-content-muted">{{ tile.note }}</span>
      </div>
    </div>

    <!-- Guide errors of the last steps (built-in guider only: it streams every step) -->
    <div v-if="graph" class="flex flex-col gap-1">
      <div class="flex items-baseline justify-between gap-2 text-xs">
        <span class="flex items-center gap-3">
          <span class="flex items-center gap-1">
            <span class="w-3 h-0.5" :style="{ background: RA_COLOR }"></span>RA
          </span>
          <span class="flex items-center gap-1">
            <span class="w-3 h-0.5" :style="{ background: DEC_COLOR }"></span>Dec
          </span>
        </span>
        <span class="text-content-faint tabular-nums">±{{ graph.range }}″</span>
      </div>
      <svg
        :viewBox="`0 0 ${GRAPH_W} ${GRAPH_H}`"
        preserveAspectRatio="none"
        class="w-full h-16 rounded-chip bg-surface-2"
        role="img"
        :aria-label="$t('components.simpleMode.cockpit.guideGraph')"
      >
        <line
          x1="0"
          :x2="GRAPH_W"
          :y1="GRAPH_H / 2"
          :y2="GRAPH_H / 2"
          stroke="currentColor"
          class="text-line"
          vector-effect="non-scaling-stroke"
        />
        <polyline
          :points="graph.ra"
          fill="none"
          :stroke="RA_COLOR"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
        />
        <polyline
          :points="graph.dec"
          fill="none"
          :stroke="DEC_COLOR"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
        />
      </svg>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <router-link to="/seq-mon" class="tns-btn-secondary">
        {{ $t('components.simpleMode.steps.capture.watch') }}
      </router-link>
      <router-link
        :to="activity === 'autofocus' ? '/autofocus' : '/guider'"
        class="tns-btn-secondary"
      >
        {{
          activity === 'autofocus'
            ? $t('components.simpleMode.steps.focus.watch')
            : $t('components.simpleMode.steps.guide.details')
        }}
      </router-link>
    </div>
    <button type="button" class="tns-btn-danger" :disabled="stopping" @click="$emit('stop')">
      {{ $t('components.simpleMode.steps.capture.stop') }}
    </button>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CameraIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useCameraStore } from '@/store/cameraStore';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useImagetStore } from '@/store/imageStore';
import { useSettingsStore } from '@/store/settingsStore';
import Spinner from '@/components/helpers/Spinner.vue';
import { RA_COLOR, DEC_COLOR } from '@/components/guider/native/uplotTheme';
import { lastSteps } from '@/components/guider/native/graphData';
import { windowRms } from '@/utils/nativeGuider';
import { arcsecPerPixel } from '@/utils/imageScale';
import { historyEntryKey, isHistoryEntryDeleted } from '@/utils/imageHistoryUtils';
import { dsoContainerName } from '@/utils/sequenceTargets';
import {
  addGuidingTime,
  hfrHealth,
  imagingActivity,
  nightKey,
  rateGuiding,
  runningPlanPosition,
} from '@/utils/simpleMode';

const props = defineProps({
  /** summarizeTargets() of the loaded plan */
  planSummary: { type: Object, required: true },
  remaining: { type: String, default: '' },
  doneAt: { type: String, default: '' },
  /** The guider state the home page reads (the built-in guider knows more states) */
  guiderState: { type: String, default: '' },
  usesNativeGuider: { type: Boolean, default: false },
  /** Devices of the profile that are not connected (any lost one stops the plan sooner or later) */
  missingDevices: { type: Number, default: 0 },
  /** The camera's cooling target, null when the camera cannot cool */
  coolingTarget: { type: Number, default: null },
  stopping: { type: Boolean, default: false },
});
defineEmits(['stop']);

const { t } = useI18n();
const store = apiStore();
const cameraStore = useCameraStore();
const nativeGuiderStore = useNativeGuiderStore();
const imageStore = useImagetStore();

const LEVEL_DOT = { good: 'bg-status-ok', ok: 'bg-status-warn', poor: 'bg-status-danger' };

// --- Where the plan stands -------------------------------------------------------------------
const position = computed(() => runningPlanPosition(props.planSummary));
const targetName = computed(() => dsoContainerName(position.value?.container));

const guiding = computed(() => ['Guiding', 'Settling'].includes(props.guiderState));

// The built-in guider's steps only while its socket delivers them: after a drop (app in the
// background, network gap) they stand still and would show an old RMS as the current one.
const liveSteps = computed(() => props.usesNativeGuider && nativeGuiderStore.wsConnected);

const activity = computed(() =>
  imagingActivity({
    afRunning: Boolean(store.focuserAfInfo?.autofocus_running),
    slewing: store.mountIsSlewing,
    guiderState: props.guiderState,
    // The built-in guider's settle flag comes from its feed; without it the flag is stale.
    settling: liveSteps.value && nativeGuiderStore.isSettling,
    exposing: Boolean(store.cameraInfo.IsExposing),
  })
);

const activityText = computed(() => {
  if (activity.value !== 'exposing') {
    return t(`components.simpleMode.cockpit.activity.${activity.value}`);
  }
  const row = position.value?.row;
  const parts = [];
  if (row?.exposureTime) {
    parts.push(t('components.simpleMode.cockpit.exposing', { seconds: row.exposureTime }));
  } else {
    parts.push(t('components.simpleMode.cockpit.activity.exposing'));
  }
  if (row?.filterName) parts.push(row.filterName);
  if (row?.iterations) {
    parts.push(
      t('components.simpleMode.cockpit.frame', {
        frame: Math.min(row.completed + 1, row.iterations),
        frames: row.iterations,
      })
    );
  }
  return parts.join(' · ');
});

const exposurePercent = computed(() =>
  Math.min(100, Math.max(0, Number(cameraStore.exposureProgress) || 0))
);

// --- Quality ------------------------------------------------------------------------------
const imageScale = computed(() =>
  arcsecPerPixel(
    store.cameraInfo.PixelSize,
    store.profileInfo?.TelescopeSettings?.FocalLength,
    store.cameraInfo.BinX
  )
);

// Enough steps for a calm RMS, few enough to follow a change within a minute or two.
const RMS_STEPS = 50;
const recentSteps = computed(() =>
  liveSteps.value ? lastSteps(nativeGuiderStore.steps, RMS_STEPS) : []
);

function num(value) {
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

// RMS of the last streamed steps; otherwise NINA's guider info, which the 2 s poll keeps
// current for any guider (PHD2 too). Only while guiding: NINA keeps the last RMS after a stop.
const guideRms = computed(() => {
  if (!guiding.value) return null;
  if (recentSteps.value.length >= 5) {
    const rms = windowRms(recentSteps.value);
    if (rms.total !== null) return rms;
  }
  const e = store.guiderInfo?.RMSError;
  if (num(e?.Total?.Arcseconds) !== null) {
    return {
      ra: num(e.RA?.Arcseconds),
      dec: num(e.Dec?.Arcseconds),
      total: num(e.Total.Arcseconds),
    };
  }
  return null;
});

const guidingRating = computed(() => rateGuiding(guideRms.value?.total, imageScale.value));

// The night's guiding tally behind the Guiding Coach recommendation (see addGuidingTime()).
// Every new RMS adds the time since the previous one under the current rating. Kept here and
// written to the settings once a minute, not on every guide step.
const settingsStore = useSettingsStore();
const TALLY_FLUSH_MS = 60000;
let tally = null;
let lastRatedAt = null;
let lastFlushAt = Date.now();
function flushTally() {
  if (tally) settingsStore.setSimpleModeGuiding(tally);
  lastFlushAt = Date.now();
}
watch(guideRms, () => {
  const now = Date.now();
  const level = guidingRating.value.level;
  tally = addGuidingTime(tally ?? settingsStore.simpleMode?.guiding ?? null, {
    night: nightKey(new Date(now)),
    level,
    elapsedMs: lastRatedAt === null ? 0 : now - lastRatedAt,
  });
  lastRatedAt = level ? now : null;
  if (now - lastFlushAt >= TALLY_FLUSH_MS) flushTally();
});
onBeforeUnmount(flushTally);

const isDeleted = (entry, index) =>
  isHistoryEntryDeleted(entry, historyEntryKey(index, entry), imageStore.deletedHistoryKeys);
const hfr = computed(() => hfrHealth(store.imageHistoryInfo, isDeleted));

const fmt = (value, digits = 2) =>
  value === null || value === undefined ? '–' : value.toFixed(digits);

const tiles = computed(() => {
  const rms = guideRms.value;
  const h = hfr.value;
  return [
    {
      key: 'guiding',
      label: t('components.simpleMode.live.guiding'),
      value: rms ? `${fmt(rms.total)}″` : '–',
      level: guidingRating.value.level,
      note: rms
        ? t(`components.simpleMode.cockpit.guidingLevel.${guidingRating.value.level ?? 'unknown'}`)
        : t('components.simpleMode.cockpit.notGuiding'),
    },
    {
      key: 'hfr',
      label: t('components.simpleMode.cockpit.hfr'),
      value: h ? fmt(h.hfr) : '–',
      level: h?.level ?? null,
      note: !h
        ? t('components.simpleMode.cockpit.noFrame')
        : h.change === null
          ? t('components.simpleMode.cockpit.hfrNoBaseline')
          : t('components.simpleMode.cockpit.hfrChange', {
              change: `${h.change >= 0 ? '+' : '−'}${Math.round(Math.abs(h.change) * 100)}`,
            }),
    },
    {
      key: 'stars',
      label: t('components.simpleMode.live.stars'),
      value: h?.stars ?? '–',
      level: null,
      note: h?.filter || t('components.simpleMode.cockpit.lastPicture'),
    },
  ];
});

// --- Problems -----------------------------------------------------------------------------
const COOLING_ALERT_C = 2;
// The rig pauses guiding for an autofocus run or a slew; that is no problem.
const guidingPaused = computed(() =>
  ['autofocus', 'slewing', 'calibrating'].includes(activity.value)
);

const alerts = computed(() => {
  const list = [];
  if (props.missingDevices > 0) {
    list.push({
      key: 'devices',
      level: 'danger',
      text: t('components.simpleMode.cockpit.alerts.devices', { count: props.missingDevices }),
      to: '/equipment',
    });
  }
  if (props.guiderState === 'LostLock' || props.guiderState === 'Reacquiring') {
    list.push({
      key: 'lost',
      level: 'danger',
      text: t('components.simpleMode.cockpit.alerts.starLost'),
      to: '/guider',
    });
  } else if (store.guiderInfo.Connected && !guiding.value && !guidingPaused.value) {
    list.push({
      key: 'guiding',
      level: 'warn',
      text: t('components.simpleMode.cockpit.alerts.notGuiding'),
      to: '/guider',
    });
  }
  if (guidingRating.value.level === 'poor') {
    list.push({
      key: 'rms',
      level: 'warn',
      text: t('components.simpleMode.cockpit.alerts.guidingPoor', {
        rms: fmt(guideRms.value?.total),
        scale: fmt(imageScale.value),
      }),
      to: '/guider',
    });
  }
  if (hfr.value?.level === 'poor') {
    list.push({
      key: 'hfr',
      level: 'warn',
      text: t('components.simpleMode.cockpit.alerts.hfrRising', {
        change: Math.round(hfr.value.change * 100),
      }),
      to: '/autofocus',
    });
  }
  // Wider than the cooling step's tolerance: a cooler that overshoots by a degree during a
  // filter change is normal.
  const sensorTemp = num(store.cameraInfo.Temperature);
  if (
    props.coolingTarget !== null &&
    store.cameraInfo.Connected &&
    sensorTemp !== null &&
    Math.abs(sensorTemp - props.coolingTarget) > COOLING_ALERT_C
  ) {
    list.push({
      key: 'cooling',
      level: 'warn',
      text: t('components.simpleMode.cockpit.alerts.cooling', {
        temp: fmt(sensorTemp, 1),
        target: props.coolingTarget,
      }),
      to: '/camera',
    });
  }
  return list;
});

// --- Guide graph ----------------------------------------------------------------------------
const GRAPH_W = 300;
const GRAPH_H = 64;
const GRAPH_STEPS = 80;
const graph = computed(() => {
  // Without guiding the line would freeze on old steps and look like current data.
  if (!liveSteps.value || !guiding.value) return null;
  const steps = lastSteps(nativeGuiderStore.steps, GRAPH_STEPS);
  if (steps.length < 2) return null;
  const values = steps
    .flatMap((s) => [num(s.raArcsec), num(s.decArcsec)])
    .filter((v) => v !== null);
  const peak = values.length ? Math.max(...values.map(Math.abs)) : 0;
  // At least one image pixel (or 1″) tall, in half-arcsecond steps, so calm guiding draws a
  // calm line instead of being stretched to the full height.
  const range = Math.ceil(Math.max(peak, imageScale.value ?? 1, 0.5) * 2) / 2;
  const line = (key) =>
    steps
      .map((s, i) => {
        const v = Math.max(-range, Math.min(range, num(s[key]) ?? 0));
        const x = (i / (steps.length - 1)) * GRAPH_W;
        const y = GRAPH_H / 2 - (v / range) * (GRAPH_H / 2 - 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  return { ra: line('raArcsec'), dec: line('decArcsec'), range };
});
</script>
