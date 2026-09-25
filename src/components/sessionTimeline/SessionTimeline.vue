<template>
  <div class="flex flex-col w-full gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2 px-1">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 class="text-sm font-medium text-gray-300">
          {{ $t('components.sequence.timeline.title') }}
        </h3>
        <span v-if="hasData" class="text-xs text-gray-400">{{ viewLabel }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="tns-btn-secondary w-auto! px-3! text-sm!"
          :disabled="!latest && !zoom"
          :title="$t('components.sequence.timeline.fullNightHint')"
          @click="showFullNight"
        >
          {{ $t('components.sequence.timeline.fullNight') }}
        </button>
        <button
          type="button"
          class="tns-btn-secondary w-auto! px-3! text-sm!"
          :class="latest ? 'border-cyan-500! text-cyan-300!' : ''"
          :aria-pressed="latest"
          :title="$t('components.sequence.timeline.latestHint')"
          @click="toggleLatest"
        >
          {{ $t('components.sequence.timeline.latest') }}
        </button>
      </div>
    </div>

    <div v-if="!hasData" :class="CARD">
      <p class="p-2 text-gray-300">{{ $t('components.sequence.timeline.noData') }}</p>
    </div>

    <template v-else>
      <div :class="[CARD, 'overflow-hidden']">
        <TimelineRows
          :rows="rows"
          :view="view"
          :bounds="session"
          :selected="selected"
          :label-width="LABEL_WIDTH"
          :pad-right="PAD_RIGHT"
          @select="toggleSelected"
          @update:view="setView"
          @reset="showFullNight"
        />
        <p class="px-2 pt-1 text-xs text-gray-400">
          {{ $t('components.sequence.timeline.zoomHint') }}
        </p>

        <div v-if="filterLegend.length" class="flex flex-wrap items-center gap-2 px-2 pt-2">
          <span class="text-xs text-gray-400"
            >{{ $t('components.sequence.timeline.filters') }}:</span
          >
          <span
            v-for="entry in filterLegend"
            :key="entry.name"
            class="inline-flex items-center gap-1 text-xs text-gray-300"
          >
            <span class="inline-block w-3 h-3 rounded-sm" :style="{ background: entry.color }" />
            {{ entry.name || $t('components.sequence.timeline.noFilter') }}
          </span>
        </div>

        <div
          v-if="selectedBar"
          class="mt-2 mx-2 p-3 bg-gray-900/70 border border-gray-700 rounded-lg text-sm text-gray-200"
        >
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span class="font-medium">
              {{ $t(`components.sequence.timeline.rows.${selected.row}`) }}
              ·
              <span :style="{ color: selectedBar.color || BAR_COLORS[selectedBar.state] }">
                {{ $t(`components.sequence.timeline.states.${selectedBar.state}`) }}
                <template v-if="selectedBar.label"> · {{ selectedBar.label }}</template>
              </span>
            </span>
            <span>
              {{ $t('components.sequence.timeline.start') }}: {{ formatClock(selectedBar.start) }}
            </span>
            <template v-if="!selectedBar.marker">
              <span>
                {{ $t('components.sequence.timeline.end') }}:
                {{
                  selectedBar.open
                    ? $t('components.sequence.timeline.ongoing')
                    : formatClock(selectedBar.end)
                }}
              </span>
              <span>
                {{ $t('components.sequence.timeline.duration') }}:
                {{ formatElapsed(selectedBar.end - selectedBar.start) }}
              </span>
            </template>
            <button
              v-if="selectedBar.imageIndex !== undefined"
              type="button"
              class="tns-btn-primary w-auto! px-3! text-sm!"
              @click="openImage(selectedBar.imageIndex)"
            >
              {{ $t('components.sequence.timeline.openImage') }}
            </button>
          </div>
        </div>
      </div>

      <div :class="CARD">
        <h3 class="text-sm font-medium text-gray-300 px-2 pb-1">
          {{ $t('components.sequence.timeline.statistics') }}
        </h3>
        <div
          v-for="group in seriesGroups"
          :key="group.key"
          class="flex flex-wrap items-center gap-2 px-2 pb-2"
        >
          <span class="text-xs text-gray-400 w-16 shrink-0">{{ group.label }}</span>
          <button
            v-for="s in group.series"
            :key="s.key"
            type="button"
            class="inline-flex items-center gap-1.5 px-3 min-h-10 rounded-full text-xs font-medium border transition"
            :class="chipClass(s)"
            :style="isActive(s) ? { borderColor: s.color } : {}"
            :disabled="!s.available"
            :title="s.available ? '' : $t('components.sequence.timeline.notSupported')"
            :aria-pressed="isActive(s)"
            @click="toggleSeries(s.key)"
          >
            <span
              class="w-2 h-2 rounded-full"
              :style="{ background: s.available ? s.color : '#6b7280' }"
            />
            {{ s.label }}
          </button>
        </div>
        <p v-if="timeline.guideHistorySupported === false" class="px-2 pb-2 text-xs text-amber-300">
          {{ $t('components.sequence.timeline.guideHistoryUnsupported') }}
        </p>
        <SessionStatsGraph
          :series="activeSeries"
          :view="view"
          :bounds="session"
          :label-width="LABEL_WIDTH"
          :pad-right="PAD_RIGHT"
          @select-image="openImage"
          @update:view="setView"
          @reset="showFullNight"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useImagetStore } from '@/store/imageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSequenceStore } from '@/store/sequenceStore';
import { useSessionTimelineStore } from '@/store/sessionTimelineStore';
import { useBackgroundAwarePolling } from '@/utils/appLifecycle';
import { applyImageFilter } from '@/composables/useImageFilter';
import { historyEntryKey, isHistoryEntryDeleted } from '@/utils/imageHistoryUtils';
import {
  BAR_COLORS,
  DEFAULT_SERIES,
  STAT_SERIES,
  buildTimelineRows,
  displayWindow,
  filterColors,
  formatClock,
  formatElapsed,
  guideSeries,
  imageSeries,
  sessionStart,
} from '@/utils/sessionTimelineUtils';
import { clampView, isFullView } from '@/utils/timeWindow';
import TimelineRows from './TimelineRows.vue';
import SessionStatsGraph from './SessionStatsGraph.vue';

// Matches the neighbouring cards of the Stats tab
const CARD =
  'w-full border border-cyan-700 bg-gray-800 shadow-lg shadow-cyan-700/40 rounded-xl p-2';
// Both plots share these so their time axes line up
const LABEL_WIDTH = 72;
const PAD_RIGHT = 8;

const { t } = useI18n();
const store = apiStore();
const imageStore = useImagetStore();
const settingsStore = useSettingsStore();
const sequenceStore = useSequenceStore();
const timeline = useSessionTimelineStore();
const monitor = settingsStore.monitorViewSetting;

useBackgroundAwarePolling(() => timeline.poll(), 5000, ref(true), { immediate: true });

// The monitor's image filter applies to everything derived from frames
const frames = computed(() => {
  const all = store.imageHistoryInfo || [];
  const indexOf = new Map(all.map((image, index) => [image, index]));
  return applyImageFilter(all, monitor.imageFilter)
    .map((image) => ({ image, index: indexOf.get(image) }))
    .filter(
      ({ image, index }) =>
        !isHistoryEntryDeleted(image, historyEntryKey(index, image), imageStore.deletedHistoryKeys)
    );
});

const hasData = computed(
  () => timeline.events.length > 0 || frames.value.length > 0 || timeline.guideSteps.length > 0
);
const rows = computed(() => buildTimelineRows(timeline.events, frames.value, timeline.nowMs));
const filterLegend = computed(() =>
  [...filterColors(frames.value)].map(([name, color]) => ({ name, color }))
);

// --- view ---------------------------------------------------------------------------
// `session` is everything since the application start; `view` is what both
// plots show: the last hour following the live edge (Latest), a zoomed range,
// or the session.

const latest = computed(() => monitor.timelineLatest === true);
const zoom = ref(null);

const session = computed(() =>
  displayWindow({
    latest: false,
    nowMs: timeline.nowMs,
    startMs: sessionStart(
      timeline.events,
      frames.value,
      timeline.guideSteps,
      timeline.applicationStart
    ),
  })
);

const view = computed(() => {
  if (latest.value) return displayWindow({ latest: true, nowMs: timeline.nowMs });
  return zoom.value ? clampView(zoom.value, session.value) : session.value;
});

const viewLabel = computed(() => {
  const { start, end } = view.value;
  return `${formatClock(start)} – ${formatClock(end)} · ${formatElapsed(end - start)}`;
});

function setView(next) {
  monitor.timelineLatest = false;
  zoom.value = isFullView(next, session.value) ? null : next;
}

function showFullNight() {
  monitor.timelineLatest = false;
  zoom.value = null;
}

function toggleLatest() {
  monitor.timelineLatest = !latest.value;
  zoom.value = null;
}

// --- statistics ---------------------------------------------------------------------

const enabled = computed(() =>
  Array.isArray(monitor.timelineSeries) ? monitor.timelineSeries : DEFAULT_SERIES
);
const guide = computed(() => guideSeries(timeline.guideSteps, timeline.pixelScale));

const seriesList = computed(() =>
  STAT_SERIES.map((def) => {
    const isGuide = def.source === 'guide';
    // Frame series are only derived when shown, or to detect the field below
    const wanted = enabled.value.includes(def.key) || def.key === 'FocuserPosition';
    const data = isGuide
      ? guide.value[def.field]
      : wanted
        ? imageSeries(frames.value, def.field)
        : [];
    // Feature detection on the payload: older backends lack these fields
    let available = true;
    if (isGuide) available = timeline.guideHistorySupported !== false;
    if (def.key === 'SNR' && timeline.guideSteps.length > 0) available &&= data.length > 0;
    if (def.key === 'FocuserPosition' && frames.value.length > 0) available = data.length > 0;
    return {
      ...def,
      label: t(`components.sequence.timeline.series.${def.key}`),
      data,
      available,
      unit: isGuide && def.key !== 'SNR' ? guide.value.unit : def.key === 'Temperature' ? '°C' : '',
      dense: isGuide,
    };
  })
);

const isActive = (s) => s.available && enabled.value.includes(s.key);
const activeSeries = computed(() => seriesList.value.filter(isActive));

const seriesGroups = computed(() =>
  ['image', 'guide'].map((source) => ({
    key: source,
    label: t(`components.sequence.timeline.groups.${source === 'image' ? 'frames' : 'guiding'}`),
    series: seriesList.value.filter((s) => s.source === source),
  }))
);

function toggleSeries(key) {
  monitor.timelineSeries = enabled.value.includes(key)
    ? enabled.value.filter((k) => k !== key)
    : [...enabled.value, key];
}

function chipClass(s) {
  if (!s.available) return 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed';
  return isActive(s)
    ? 'bg-gray-700 text-gray-100'
    : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400';
}

// --- selection ----------------------------------------------------------------------
// Kept as a key: the rows are rebuilt with every poll.

const selected = ref(null); // { row, start }

const selectedBar = computed(() =>
  rows.value
    .find((row) => row.key === selected.value?.row)
    ?.bars.find((bar) => bar.start === selected.value.start)
);

function toggleSelected({ row, bar }) {
  const same = selected.value?.row === row && selected.value.start === bar.start;
  selected.value = same ? null : { row, start: bar.start };
}

// The last-image panel above shows the selected image; bring it into view
function openImage(index) {
  sequenceStore.setSelectedImageIndex(index);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
</script>
