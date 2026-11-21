<template>
  <!-- While the plan takes pictures. The newest picture fills the stage; a problem stands on
       it, so a glance tells "act now". In the panel one verdict and a traffic light per
       quality (guiding, focus, cooling); the numbers behind them (RMS, HFR, guide graph,
       histogram, trend) and the ways to other pages wait under "Details". -->
  <SimpleLivePanel hero :details="detailsOpen">
    <template v-if="alerts.length" #top>
      <ul class="flex flex-col gap-2">
        <li
          v-for="alert in alerts"
          :key="alert.key"
          class="flex items-start gap-2 rounded-control border px-3 py-2 text-sm shadow-lg"
          :class="
            alert.level === 'danger'
              ? 'border-status-danger bg-surface-1'
              : 'border-status-warn bg-surface-1'
          "
        >
          <ExclamationTriangleIcon
            class="w-5 h-5 shrink-0"
            :class="alert.level === 'danger' ? 'text-status-danger' : 'text-status-warn'"
          />
          <span class="flex-1 min-w-0 text-content">{{ alert.text }}</span>
          <router-link
            v-if="alert.to"
            :to="alert.to"
            class="text-xs text-accent underline shrink-0"
          >
            {{ $t('components.simpleMode.cockpit.check') }}
          </router-link>
        </li>
      </ul>
    </template>

    <template #overlay-top="{ caption, ago }">
      <div class="min-w-0">
        <span class="flex items-center gap-1.5 text-base font-bold leading-tight">
          <span
            class="tns-dot bg-status-ok animate-pulse"
            :aria-label="$t('components.simpleMode.cockpit.title')"
          ></span>
          <span class="truncate">
            {{ targetName || $t('components.simpleMode.cockpit.noTargetName') }}
          </span>
        </span>
        <span v-if="caption || ago" class="block text-xs text-white/70 truncate">
          {{ [caption, ago].filter(Boolean).join(' · ') }}
        </span>
      </div>
      <div v-if="doneAt" class="shrink-0 text-right leading-tight">
        <span class="block text-xs text-white/70">
          {{ $t('components.simpleMode.cockpit.doneAt') }}
        </span>
        <span class="text-base font-semibold tabular-nums">{{ doneAt }}</span>
      </div>
    </template>

    <template #overlay-bottom>
      <Spinner v-if="activity !== 'exposing'" size="sm" class="text-accent" />
      <CameraIcon v-else class="w-4 h-4 text-accent shrink-0" />
      <span class="flex-1 min-w-0 truncate text-xs">{{ activityText }}</span>
      <span v-if="remaining" class="shrink-0 text-xs text-white/70">
        {{ $t('components.simpleMode.cockpit.remaining', { time: remaining }) }}
      </span>
    </template>

    <!-- The verdict: does anybody need to act? -->
    <p class="flex items-center gap-2 font-semibold text-content">
      <span class="tns-dot w-3! h-3!" :class="VERDICT_DOT[verdict]"></span>
      {{ $t(`components.simpleMode.cockpit.verdict.${verdict}`) }}
    </p>

    <!-- Traffic lights: what decides whether the pictures are usable. Each draws its scale
         (green, yellow, red zone) with a mark where it stands now, so "how far from bad" needs
         no number; a tap explains what it measures and where its limits are. -->
    <div class="flex flex-col gap-2">
      <div class="grid gap-2" :class="lights.length === 3 ? 'grid-cols-3' : 'grid-cols-2'">
        <button
          v-for="light in lights"
          :key="light.key"
          type="button"
          class="flex flex-col gap-0.5 rounded-control bg-surface-2 px-2.5 py-2 min-w-0 text-left border"
          :class="openLight === light.key ? 'border-accent' : 'border-transparent'"
          :aria-expanded="openLight === light.key"
          :aria-controls="`simple-light-${light.key}`"
          data-haptic="none"
          @click="openLight = openLight === light.key ? null : light.key"
        >
          <span class="flex items-center gap-1.5 text-sm font-medium text-content min-w-0">
            <span
              class="tns-dot shrink-0"
              :class="LEVEL_DOT[light.level] ?? 'bg-content-faint'"
            ></span>
            <span class="truncate">{{ light.label }}</span>
          </span>
          <span class="text-xs text-content-muted truncate">{{ light.word }}</span>
          <span class="relative block mt-1.5 h-3" aria-hidden="true">
            <span class="absolute inset-x-0 top-1 h-1 flex rounded-full overflow-hidden">
              <span class="bg-status-ok/60" :style="{ width: `${light.zones.good}%` }"></span>
              <span class="bg-status-warn/60" :style="{ width: `${light.zones.ok}%` }"></span>
              <span class="flex-1 bg-status-danger/60"></span>
            </span>
            <span
              v-if="light.percent !== null"
              class="absolute top-0 h-3 w-1 -ml-0.5 rounded-full bg-content ring-2 ring-surface-2"
              :style="{ left: `${light.percent}%` }"
            ></span>
          </span>
        </button>
      </div>

      <!-- An icon in the light would cost the label its room on a phone -->
      <p v-if="!openInfo" class="text-xs text-content-faint">
        {{ $t('components.simpleMode.cockpit.lightsHint') }}
      </p>
      <div
        v-else
        :id="`simple-light-${openInfo.key}`"
        class="flex flex-col gap-1.5 rounded-control border border-line px-3 py-2.5 text-sm"
      >
        <p class="font-semibold text-content">{{ openInfo.title }}</p>
        <p class="text-content-muted">{{ openInfo.what }}</p>
        <p class="text-content">{{ openInfo.now }}</p>
        <p class="text-content-muted">{{ openInfo.limits }}</p>
        <p class="text-content-muted">{{ openInfo.fix }}</p>
      </div>
    </div>

    <button
      type="button"
      class="flex items-center justify-between gap-2 min-h-touch -my-1 text-sm text-content-muted"
      :aria-expanded="detailsOpen"
      data-haptic="none"
      @click="detailsOpen = !detailsOpen"
    >
      {{
        $t(
          detailsOpen
            ? 'components.simpleMode.cockpit.hideDetails'
            : 'components.simpleMode.cockpit.showDetails'
        )
      }}
      <ChevronDownIcon
        class="w-4 h-4 shrink-0 transition-transform"
        :class="detailsOpen ? 'rotate-180' : ''"
      />
    </button>

    <template v-if="detailsOpen">
      <div class="grid grid-cols-3 gap-2">
        <div
          v-for="tile in tiles"
          :key="tile.key"
          class="tns-stat-tile min-w-0"
          :class="tile.level === 'poor' ? 'tns-stat-tile-warn' : ''"
        >
          <span class="tns-stat-label">{{ tile.label }}</span>
          <span class="tns-stat-value text-lg!">
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
    </template>

    <template #actions>
      <template v-if="detailsOpen">
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
        <!-- The start page shows only this view while the plan runs -->
        <h3 class="tns-section-title">{{ $t('components.simpleMode.more.title') }}</h3>
        <div class="grid grid-cols-2 gap-2">
          <router-link
            v-for="link in moreLinks"
            :key="link.to"
            :to="link.to"
            class="tns-btn-secondary"
          >
            {{ $t(link.labelKey) }}
          </router-link>
        </div>
      </template>
      <button type="button" class="tns-btn-danger" :disabled="stopping" @click="$emit('stop')">
        {{ $t('components.simpleMode.steps.capture.stop') }}
      </button>
    </template>
  </SimpleLivePanel>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CameraIcon, ChevronDownIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useImagetStore } from '@/store/imageStore';
import { useSettingsStore } from '@/store/settingsStore';
import Spinner from '@/components/helpers/Spinner.vue';
import SimpleLivePanel from '@/components/simpleMode/SimpleLivePanel.vue';
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
  imagingVerdict,
  nightKey,
  QUALITY_SCALES,
  rateCooling,
  rateGuiding,
  scalePercent,
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
  /** Other pages, as the start page lists them: { to, labelKey } */
  moreLinks: { type: Array, default: () => [] },
});
defineEmits(['stop']);

const { t } = useI18n();
const store = apiStore();
const nativeGuiderStore = useNativeGuiderStore();
const imageStore = useImagetStore();

const LEVEL_DOT = { good: 'bg-status-ok', ok: 'bg-status-warn', poor: 'bg-status-danger' };
const VERDICT_DOT = {
  good: 'bg-status-ok',
  warn: 'bg-status-warn',
  danger: 'bg-status-danger',
  waiting: 'bg-content-faint',
};

const detailsOpen = ref(false);

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
const sensorTemp = computed(() => num(store.cameraInfo.Temperature));
// level null while the camera has no cooling target to hold (no light shown then)
const cooling = computed(() =>
  props.coolingTarget === null || !store.cameraInfo.Connected
    ? { level: null, offset: null }
    : rateCooling(sensorTemp.value, props.coolingTarget)
);
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
  if (cooling.value.level === 'poor') {
    list.push({
      key: 'cooling',
      level: 'warn',
      text: t('components.simpleMode.cockpit.alerts.cooling', {
        temp: fmt(sensorTemp.value, 1),
        target: props.coolingTarget,
      }),
      to: '/camera',
    });
  }
  return list;
});

// --- Verdict and traffic lights -----------------------------------------------------------
const pct = (value) => Math.round(value * 100);

// Widths of the green and yellow zone in percent of a scale's width
function zones(scale) {
  return {
    good: (scale.good / scale.max) * 100,
    ok: ((scale.ok - scale.good) / scale.max) * 100,
  };
}

function signedPercent(change) {
  return `${change >= 0 ? '+' : '−'}${Math.abs(pct(change))}`;
}

const lights = computed(() => {
  const rms = guideRms.value;
  const rating = guidingRating.value;
  const h = hfr.value;
  const E = 'components.simpleMode.cockpit.explain';
  const G = QUALITY_SCALES.guiding;
  const F = QUALITY_SCALES.sharpness;
  const C = QUALITY_SCALES.cooling;

  let guidingNow;
  if (rms && rating.ratio !== null) {
    guidingNow = t(`${E}.guiding.now`, {
      rms: fmt(rms.total),
      ratio: fmt(rating.ratio),
      scale: fmt(imageScale.value),
    });
  } else if (rms) {
    guidingNow = t(`${E}.guiding.nowNoScale`, { rms: fmt(rms.total) });
  } else {
    guidingNow = t(guidingPaused.value ? `${E}.guiding.nowPaused` : `${E}.guiding.nowOff`);
  }

  let focusNow;
  if (!h) focusNow = t(`${E}.focus.nowNone`);
  else if (h.change === null) focusNow = t(`${E}.focus.nowFirst`, { count: F.minPictures });
  else {
    focusNow = t(`${E}.focus.now`, {
      hfr: fmt(h.hfr),
      change: signedPercent(h.change),
      baseline: fmt(h.baseline),
    });
  }

  const list = [
    {
      key: 'guiding',
      label: t('components.simpleMode.live.guiding'),
      level: rating.level,
      word: rms
        ? t(`components.simpleMode.cockpit.guidingLevel.${rating.level ?? 'unknown'}`)
        : t(
            guidingPaused.value
              ? 'components.simpleMode.cockpit.paused'
              : 'components.simpleMode.cockpit.notGuiding'
          ),
      percent: scalePercent(rms ? rating.ratio : null, G),
      zones: zones(G),
      now: guidingNow,
      limits: t(`${E}.guiding.limits`, { good: G.good, ok: G.ok }),
    },
    {
      key: 'focus',
      label: t('components.simpleMode.cockpit.focus'),
      level: h?.level ?? null,
      word: !h
        ? t('components.simpleMode.cockpit.noFrame')
        : h.level
          ? t(`components.simpleMode.cockpit.focusLevel.${h.level}`)
          : t('components.simpleMode.cockpit.hfrNoBaseline'),
      percent: scalePercent(h?.change ?? null, F),
      zones: zones(F),
      now: focusNow,
      limits: t(`${E}.focus.limits`, { good: pct(F.good), ok: pct(F.ok) }),
    },
  ];
  if (cooling.value.level) {
    list.push({
      key: 'cooling',
      label: t('components.simpleMode.cockpit.cooling'),
      level: cooling.value.level,
      word: `${fmt(sensorTemp.value, 1)} °C`,
      percent: scalePercent(cooling.value.offset, C),
      zones: zones(C),
      now: t(`${E}.cooling.now`, { temp: fmt(sensorTemp.value, 1), target: props.coolingTarget }),
      limits: t(`${E}.cooling.limits`, { good: C.good }),
    });
  }
  return list;
});

// The explanation under the lights, for the one tapped last; closes when its light goes away
const openLight = ref(null);
const openInfo = computed(() => {
  const light = lights.value.find((l) => l.key === openLight.value);
  if (!light) return null;
  const E = `components.simpleMode.cockpit.explain.${light.key}`;
  return {
    key: light.key,
    title: t(`${E}.title`),
    what: t(`${E}.what`),
    now: light.now,
    limits: light.limits,
    fix: t(`${E}.fix`),
  };
});

const verdict = computed(() =>
  imagingVerdict({ alerts: alerts.value, levels: lights.value.map((light) => light.level) })
);

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
