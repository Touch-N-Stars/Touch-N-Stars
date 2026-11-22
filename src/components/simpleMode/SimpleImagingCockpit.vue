<template>
  <!-- While the plan takes pictures. The newest picture fills the stage; a problem stands on
       it, so a glance tells "act now". The floating panel is one line: the verdict and the stop;
       guiding, focus and cooling are rated in the status bar below (one segment each, a tap
       explains it), so they are not shown twice. The picture's numbers (HFR, stars, histogram)
       and the ways to other pages wait until the verdict is tapped. -->
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
        <span v-if="caption || ago" class="block text-xs text-content-muted truncate">
          {{ [caption, ago].filter(Boolean).join(' · ') }}
        </span>
      </div>
      <div v-if="doneAt" class="shrink-0 text-right leading-tight">
        <span class="block text-xs text-content-muted">
          {{ $t('components.simpleMode.cockpit.doneAt') }}
        </span>
        <span class="text-base font-semibold tabular-nums">{{ doneAt }}</span>
      </div>
    </template>

    <template #overlay-bottom>
      <Spinner v-if="shownActivity !== 'exposing'" size="sm" class="text-accent" />
      <CameraIcon v-else class="w-4 h-4 text-accent shrink-0" />
      <span class="flex-1 min-w-0 truncate text-xs">{{ activityText }}</span>
      <span v-if="remaining" class="shrink-0 text-xs text-content-muted">
        {{ $t('components.simpleMode.cockpit.remaining', { time: remaining }) }}
      </span>
    </template>

    <!-- One line while folded, so the picture keeps the stage on a phone: the verdict (does
         anybody need to act?), the stop, and the verdict itself opens the details. -->
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="flex flex-1 min-w-0 items-center gap-2 min-h-touch text-left text-sm font-semibold text-content"
        :aria-expanded="detailsOpen"
        :title="
          $t(
            detailsOpen
              ? 'components.simpleMode.cockpit.hideDetails'
              : 'components.simpleMode.cockpit.showDetails'
          )
        "
        data-haptic="none"
        @click="detailsOpen = !detailsOpen"
      >
        <span class="tns-dot w-3! h-3! shrink-0" :class="VERDICT_DOT[verdict]"></span>
        <span class="truncate">{{ $t(`components.simpleMode.cockpit.verdict.${verdict}`) }}</span>
        <ChevronUpIcon
          class="w-4 h-4 shrink-0 ml-auto text-content-muted transition-transform"
          :class="detailsOpen ? 'rotate-180' : ''"
        />
      </button>
      <button
        type="button"
        class="tns-btn-danger w-auto! shrink-0 px-3!"
        :disabled="stopping"
        :aria-label="$t('components.simpleMode.steps.capture.stop')"
        @click="$emit('stop')"
      >
        {{ $t('components.simpleMode.cockpit.stop') }}
      </button>
    </div>

    <p v-if="detailsOpen" class="text-xs text-content-faint">
      {{ $t('components.simpleMode.cockpit.statusBarHint') }}
    </p>

    <div v-if="detailsOpen" class="grid grid-cols-2 gap-2">
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

    <template v-if="detailsOpen" #actions>
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
  </SimpleLivePanel>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CameraIcon, ChevronUpIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import Spinner from '@/components/helpers/Spinner.vue';
import SimpleLivePanel from '@/components/simpleMode/SimpleLivePanel.vue';
import { fmt, useImagingQuality } from '@/composables/useImagingQuality';
import { dsoContainerName } from '@/utils/sequenceTargets';
import { addGuidingTime, imagingVerdict, nightKey, runningPlanPosition } from '@/utils/simpleMode';
import { MERIDIAN_FLIP_TRIGGER_TYPE, findByType } from '@/utils/sequenceSimple';
import { useSequenceV2Store } from '@/store/sequenceV2Store';

const props = defineProps({
  /** summarizeTargets() of the loaded plan */
  planSummary: { type: Object, required: true },
  remaining: { type: String, default: '' },
  doneAt: { type: String, default: '' },
  /** Devices of the profile that are not connected (any lost one stops the plan sooner or later) */
  missingDevices: { type: Number, default: 0 },
  stopping: { type: Boolean, default: false },
  /** Other pages, as the start page lists them: { to, labelKey } */
  moreLinks: { type: Array, default: () => [] },
});
defineEmits(['stop']);

const { t } = useI18n();
const store = apiStore();
const {
  activity,
  coolingQuality,
  coolingTarget,
  focusQuality,
  guideRms,
  guiderState,
  guiding,
  guidingPaused,
  guidingQuality,
  guidingRating,
  hfr,
  imageScale,
  sensorTemp,
} = useImagingQuality();

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

// NINA's flip trigger stays RUNNING from the flip slew through settling and recentering, so it
// names the whole flip, including the plate solves and the guiding pause after it.
const sequenceV2Store = useSequenceV2Store();
const flipping = computed(
  () => findByType(sequenceV2Store.globalTriggers, MERIDIAN_FLIP_TRIGGER_TYPE)?.Status === 'RUNNING'
);
const shownActivity = computed(() => (flipping.value ? 'flipping' : activity.value));

const activityText = computed(() => {
  if (shownActivity.value !== 'exposing') {
    return t(`components.simpleMode.cockpit.activity.${shownActivity.value}`);
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

// --- Guiding tally ----------------------------------------------------------------------------
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

// --- The picture's numbers (details) ----------------------------------------------------------
const tiles = computed(() => {
  const h = hfr.value;
  return [
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
  if (guiderState.value === 'LostLock' || guiderState.value === 'Reacquiring') {
    list.push({
      key: 'lost',
      level: 'danger',
      text: t('components.simpleMode.cockpit.alerts.starLost'),
      to: '/guider',
    });
  } else if (
    store.guiderInfo.Connected &&
    !guiding.value &&
    !guidingPaused.value &&
    !flipping.value
  ) {
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
  if (coolingQuality.value.level === 'poor') {
    list.push({
      key: 'cooling',
      level: 'warn',
      text: t('components.simpleMode.cockpit.alerts.cooling', {
        temp: fmt(sensorTemp.value, 1),
        target: coolingTarget.value,
      }),
      to: '/camera',
    });
  }
  return list;
});

const verdict = computed(() =>
  imagingVerdict({
    alerts: alerts.value,
    levels: [guidingQuality.value.level, focusQuality.value.level, coolingQuality.value.level],
  })
);
</script>
