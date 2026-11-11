<template>
  <div class="flex flex-col gap-3" data-testid="guide-log-viewer">
    <!-- Night picker -->
    <section class="tns-card flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="mr-auto text-lg font-semibold text-content">
          {{ t('plugins.guideLogViewer.title') }}
        </h1>
        <!-- on phones the picker gets a row of its own under the title -->
        <div class="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto">
          <select
            v-model="selectedName"
            class="tns-select w-auto! min-w-0 flex-1 sm:flex-none sm:min-w-64"
            :aria-label="t('plugins.guideLogViewer.night')"
            :disabled="listLoading || (!logs.length && !localName)"
          >
            <option v-if="!logs.length && !localName" value="">
              {{
                listLoading
                  ? t('plugins.guideLogViewer.loadingList')
                  : t('plugins.guideLogViewer.noLogs')
              }}
            </option>
            <option v-for="f in logs" :key="f.name" :value="f.name">
              {{ logLabel(f) }}
            </option>
            <option v-if="localName" :value="LOCAL">{{ localName }}</option>
          </select>
          <SegToggle
            :model-value="unit"
            :options="unitOptions"
            :label="t('components.guider.native.graph.unit')"
            @update:model-value="setUnit"
          />
        </div>
        <button
          type="button"
          class="icon-btn"
          :title="t('plugins.guideLogViewer.reload')"
          :aria-label="t('plugins.guideLogViewer.reload')"
          :disabled="listLoading || loading"
          @click="reload"
        >
          <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': listLoading || loading }" />
        </button>
        <button
          type="button"
          class="icon-btn"
          :title="t('plugins.guideLogViewer.openFile')"
          :aria-label="t('plugins.guideLogViewer.openFile')"
          @click="fileInput?.click()"
        >
          <FolderOpenIcon class="w-5 h-5" />
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".txt,.log,text/plain"
          class="hidden"
          @change="openLocalFile"
        />
      </div>

      <p v-if="listError" class="text-xs text-content-muted">{{ listError }}</p>
      <p v-if="loadError" class="text-xs text-status-danger">{{ loadError }}</p>

      <div v-if="loading" class="flex items-center gap-2 text-xs text-content-muted">
        <Spinner size="sm" />
        <span>{{ loadingText }}</span>
      </div>

      <!-- Night at a glance; every tile explains itself on tap -->
      <div
        v-if="model && !loading"
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2"
        data-testid="history-kpis"
      >
        <NativeHelpTip
          class="w-full"
          :class="KPI_CLASS"
          :title="t('plugins.guideLogViewer.kpi.guided')"
          :text="t('plugins.guideLogViewer.kpi.hints.guided')"
        >
          <span class="kpi-label">{{ t('plugins.guideLogViewer.kpi.guided') }}</span>
          <span class="kpi-value">{{ formatDuration(model.guidedSeconds) }}</span>
          <span class="kpi-sub">
            {{ t('plugins.guideLogViewer.kpi.sessions', { count: model.summaries.length }) }}
          </span>
        </NativeHelpTip>
        <NativeHelpTip
          class="w-full"
          :class="KPI_CLASS"
          :title="t('plugins.guideLogViewer.kpi.rms')"
          :text="t('plugins.guideLogViewer.kpi.rmsHint')"
        >
          <span class="kpi-label">{{ t('plugins.guideLogViewer.kpi.rms') }}</span>
          <span class="kpi-value">{{ fmtUnit(model.typicalRms) }}</span>
          <span class="kpi-sub">
            <span :style="{ color: RA_COLOR }">{{ fmtUnit(model.typicalRa) }}</span> ·
            <span :style="{ color: DEC_COLOR }">{{ fmtUnit(model.typicalDec) }}</span>
          </span>
          <span class="kpi-sub">
            {{
              t('plugins.guideLogViewer.kpi.rmsOverall', {
                value: fmtUnit(model.nightStats.rmsTotal),
              })
            }}
          </span>
        </NativeHelpTip>
        <NativeHelpTip
          class="w-full"
          :class="KPI_CLASS"
          :title="t('plugins.guideLogViewer.kpi.dithers')"
          :text="t('plugins.guideLogViewer.kpi.hints.dithers')"
        >
          <span class="kpi-label">{{ t('plugins.guideLogViewer.kpi.dithers') }}</span>
          <span class="kpi-value">{{ model.dithers }}</span>
          <span class="kpi-sub">
            {{
              t('plugins.guideLogViewer.kpi.settleMedian', {
                time: formatDuration(model.settleMedian),
              })
            }}
          </span>
        </NativeHelpTip>
        <NativeHelpTip
          class="w-full"
          :class="KPI_CLASS"
          :title="t('plugins.guideLogViewer.kpi.starLost')"
          :text="t('plugins.guideLogViewer.kpi.hints.starLost')"
        >
          <span class="kpi-label">{{ t('plugins.guideLogViewer.kpi.starLost') }}</span>
          <span class="kpi-value" :class="{ 'text-status-warn': model.nightStats.drops }">
            {{ model.nightStats.drops ?? 0 }}
          </span>
          <span class="kpi-sub">{{ t('plugins.guideLogViewer.kpi.frames') }}</span>
        </NativeHelpTip>
        <NativeHelpTip
          class="col-span-2 w-full sm:col-span-1"
          :class="KPI_CLASS"
          :title="t('plugins.guideLogViewer.kpi.findings')"
          :text="t('plugins.guideLogViewer.kpi.hints.findings')"
        >
          <span class="kpi-label">{{ t('plugins.guideLogViewer.kpi.findings') }}</span>
          <span class="kpi-value">
            <span :class="problemCounts.bad ? 'text-status-danger' : ''">{{
              problemCounts.bad
            }}</span>
            <span class="text-content-faint"> / </span>
            <span :class="problemCounts.warn ? 'text-status-warn' : ''">{{
              problemCounts.warn
            }}</span>
          </span>
          <span class="kpi-sub">{{ t('plugins.guideLogViewer.kpi.findingsSub') }}</span>
        </NativeHelpTip>
      </div>
    </section>

    <template v-if="model && !loading">
      <!-- 1. Where in the night: overview, what is worth a look and the sessions -->
      <LogOverview
        :model="model"
        :view="view"
        :findings="allFindings"
        :exposures="exposures.rows"
        :unit="unit"
        @update:view="setView"
      />

      <div class="grid grid-cols-12 gap-3">
        <div class="col-span-12 lg:col-span-6 min-w-0">
          <LogFindings
            :findings="allFindings"
            :view="view"
            :selected="highlight"
            @select="selectFinding"
            @replay="store.openReplay($event)"
          />
        </div>
        <div class="col-span-12 lg:col-span-6 min-w-0">
          <LogSessions :model="model" :view="view" :unit="unit" @select="selectSection" />
        </div>

        <!-- 2. What happened in the selected range -->
        <div class="col-span-12 min-w-0">
          <LogChart
            :model="model"
            :view="view"
            :unit="unit"
            :findings="allFindings"
            :exposures="exposures.rows"
            :stats="viewStats"
            :highlight="highlight"
            @update:view="setView"
            @reset="resetView"
          />
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4 min-w-0">
          <LogStats
            :stats="viewStats"
            :unit="unit"
            :view="view"
            :exclude-settling="excludeSettling"
            @update:exclude-settling="setExcludeSettling"
          />
        </div>
        <div class="col-span-12 md:col-span-6 xl:col-span-4 min-w-0">
          <LogScatter
            :model="model"
            :range="viewRange"
            :stats="viewStats"
            :unit="unit"
            :exclude-settling="excludeSettling"
          />
        </div>
        <div class="col-span-12 xl:col-span-4 min-w-0">
          <LogSpectrum :model="model" :range="viewRange" :unit="unit" />
        </div>

        <!-- 3. The light frames of the night -->
        <div v-if="exposures.rows.length" class="col-span-12 min-w-0">
          <LogExposures
            :exposures="exposures"
            :unit="unit"
            :model="model"
            :selected="highlight"
            @select="selectExposure"
          />
        </div>
      </div>
    </template>

    <div
      v-else-if="!loading && !listLoading && !model"
      class="tns-card text-sm text-content-muted text-center py-8"
    >
      {{ emptyText }}
    </div>
  </div>
</template>

<script setup>
import { computed, markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowPathIcon, FolderOpenIcon } from '@heroicons/vue/24/outline';
import Spinner from '@/components/helpers/Spinner.vue';
import NativeHelpTip from '@/components/guider/native/NativeHelpTip.vue';
import apiService from '@/services/apiService';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { apiStore } from '@/store/store';
import { readStored, writeStored } from '@/utils/safeStorage';
import { wallFromUtcMs } from '../utils/parseGuideLog';
import { exposureGuiding, indexRange, lightExposures, rangeStats } from '../utils/analyzeGuideLog';
import { analyzeNight } from '../utils/nightModel';
import { RA_COLOR, DEC_COLOR } from '@/components/guider/native/uplotTheme';
import {
  clampView,
  formatDistance,
  formatDuration,
  formatSize,
  historyCache,
  viewAround,
} from '../utils/logView';
import SegToggle from './SegToggle.vue';
import LogOverview from './LogOverview.vue';
import LogChart from './LogChart.vue';
import LogStats from './LogStats.vue';
import LogScatter from './LogScatter.vue';
import LogFindings from './LogFindings.vue';
import LogSpectrum from './LogSpectrum.vue';
import LogSessions from './LogSessions.vue';
import LogExposures from './LogExposures.vue';

const { t } = useI18n();
const store = useNativeGuiderStore();
const mainStore = apiStore();

const LOCAL = '__local__';
const UNITS = ['arcsec', 'px'];
// NativeHelpTip has several root nodes, so a scoped class would not reach it
const KPI_CLASS =
  'flex flex-col gap-0.5 rounded-card border border-line bg-surface-2 px-3 py-2 min-w-0 hover:border-line-strong';
const UNIT_KEY = 'guideLogViewer.unit';
const SETTLE_KEY = 'guideLogViewer.excludeSettling';

// Parsed logs of past nights stay for the app session (they do not change any more).
const cache = historyCache;

const logs = ref([]);
const listLoading = ref(false);
const listError = ref('');
const selectedName = ref('');
const localName = ref('');
const loading = ref(false);
const loadedBytes = ref(0);
const loadPhase = ref('download');
const loadError = ref('');
const fileInput = ref(null);
const model = shallowRef(null);
// the opened local file, so the picker can come back to it
let localModel = null;
const view = ref({ t0: 0, t1: 1 });
const highlight = ref(null);
const unit = ref(readStored(UNIT_KEY, 'arcsec') === 'px' ? 'px' : 'arcsec');
const excludeSettling = ref(readStored(SETTLE_KEY, 'true') !== 'false');
let loadToken = 0;
let download = null; // AbortController of the log being downloaded

const unitOptions = computed(() =>
  UNITS.map((u) => ({
    value: u,
    label:
      u === 'px'
        ? t('components.guider.native.graph.px')
        : t('components.guider.native.graph.arcsec'),
  }))
);

function setUnit(u) {
  unit.value = u;
  writeStored(UNIT_KEY, u);
}

function setExcludeSettling(value) {
  excludeSettling.value = value;
  writeStored(SETTLE_KEY, String(value));
}

function logLabel(f) {
  const night = f.night || f.name;
  const parts = [night, formatSize(f.sizeBytes)];
  if (f.active) parts.push(t('plugins.guideLogViewer.live'));
  return parts.join(' · ');
}

const loadingText = computed(() =>
  loadPhase.value === 'analyze'
    ? t('plugins.guideLogViewer.analyzing')
    : t('plugins.guideLogViewer.downloading', { size: formatSize(loadedBytes.value) })
);

const emptyText = computed(() =>
  logs.value.length || localName.value
    ? t('plugins.guideLogViewer.pickNight')
    : t('plugins.guideLogViewer.emptyHint')
);

// --- Loading ----------------------------------------------------------------------

async function loadList() {
  listLoading.value = true;
  listError.value = '';
  try {
    const list = await apiService.getNativeGuiderLogs();
    logs.value = Array.isArray(list) ? list : [];
    if (!selectedName.value && logs.value.length) selectedName.value = logs.value[0].name;
  } catch (error) {
    logs.value = [];
    listError.value =
      error?.status === 404 || error?.status === 501
        ? t('plugins.guideLogViewer.notSupported')
        : error?.message || String(error);
  } finally {
    listLoading.value = false;
  }
}

function zoneOf(file) {
  return file ? { timeZone: file.timeZone, utcOffsetMinutes: file.utcOffsetMinutes } : {};
}

/** Parses and analyses a log text (markRaw: large typed arrays). */
function analyze(text, meta) {
  return markRaw(analyzeNight(text, meta));
}

/** Starts a new load: cancels the download of the previous one and clears its state. */
function beginLoad() {
  download?.abort();
  download = null;
  loadError.value = '';
  loading.value = false;
  return ++loadToken;
}

async function loadSelected() {
  const name = selectedName.value;
  if (!name || name === LOCAL) return;
  const file = logs.value.find((f) => f.name === name);
  const key = file ? `${file.name}|${file.sizeBytes}|${file.modifiedUtc}` : name;
  const token = beginLoad();
  highlight.value = null;
  if (cache.has(key)) {
    show(cache.get(key));
    return;
  }
  loading.value = true;
  loadPhase.value = 'download';
  loadedBytes.value = 0;
  download = new AbortController();
  try {
    const text = await apiService.getNativeGuiderLog(name, {
      signal: download.signal,
      onProgress: (bytes) => {
        if (token === loadToken) loadedBytes.value = bytes;
      },
    });
    if (token !== loadToken) return;
    loadPhase.value = 'analyze';
    // let the spinner paint before the parse blocks the thread for a moment
    await new Promise((resolve) => setTimeout(resolve, 20));
    const m = analyze(text, { name, zone: zoneOf(file), live: !!file?.active });
    if (token !== loadToken) return;
    if (!file?.active) cache.set(key, m);
    show(m);
  } catch (error) {
    if (token === loadToken && !error?.cancelled) loadError.value = error?.message || String(error);
  } finally {
    if (token === loadToken) {
      loading.value = false;
      download = null;
    }
  }
}

function show(m) {
  model.value = m;
  if (m.span) view.value = { t0: m.span.t0, t1: m.span.t1 };
  if (!m.local) store.loadIncidents?.();
}

async function openLocalFile(event) {
  const file = event.target?.files?.[0];
  if (event.target) event.target.value = '';
  if (!file) return;
  const token = beginLoad();
  loading.value = true;
  loadPhase.value = 'analyze';
  try {
    const text = await file.text();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const m = analyze(text, { name: file.name, zone: {}, local: true });
    if (token !== loadToken) return;
    if (!m.log.sections.length) {
      loadError.value = t('plugins.guideLogViewer.notAGuideLog');
      return;
    }
    localName.value = file.name;
    localModel = m;
    selectedName.value = LOCAL;
    show(m);
  } catch (error) {
    if (token === loadToken) loadError.value = error?.message || String(error);
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

async function reload() {
  const current = selectedName.value;
  await loadList();
  if (current && current !== LOCAL) {
    for (const k of cache.keys()) if (k.startsWith(`${current}|`)) cache.delete(k);
    loadSelected();
  }
}

watch(selectedName, (name) => {
  if (name === LOCAL) {
    beginLoad();
    highlight.value = null;
    if (localModel && model.value !== localModel) show(localModel);
  } else if (name) loadSelected();
});

onMounted(loadList);
onBeforeUnmount(() => download?.abort());

// --- View -------------------------------------------------------------------------

function setView(next) {
  if (!model.value?.span) return;
  view.value = clampView(next, model.value.span);
}

function resetView() {
  if (model.value?.span) view.value = { ...model.value.span };
}

const viewRange = computed(() =>
  model.value ? indexRange(model.value.series, view.value.t0, view.value.t1) : { from: 0, to: 0 }
);

/** Section header of the view's middle, for the polar alignment estimate and pulse limits. */
const viewSection = computed(() => {
  const m = model.value;
  if (!m) return null;
  const { from, to } = viewRange.value;
  if (to <= from) return null;
  const mid = m.series.section[(from + to) >> 1];
  return m.log.sections[mid] ?? null;
});

const viewStats = computed(() => {
  const m = model.value;
  if (!m) return null;
  const { from, to } = viewRange.value;
  const h = viewSection.value?.header ?? {};
  const stats = rangeStats(m.series, from, to, {
    excludeSettling: excludeSettling.value,
    maxRaMs: h.maxRaMs,
    maxDecMs: h.maxDecMs,
    decDeg: h.decDeg,
  });
  const scale =
    unit.value === 'px' && Number.isFinite(h.pixelScale) && h.pixelScale > 0 ? 1 / h.pixelScale : 1;
  return { ...stats, unitScale: scale, pixelScale: h.pixelScale, decDeg: h.decDeg };
});

function fmtUnit(arcsec) {
  return formatDistance(arcsec, unit.value, model.value?.pixelScale);
}

function selectFinding(f) {
  highlight.value = { t0: f.t0, t1: f.t1, key: `${f.kind}-${f.t0}` };
  setView(viewAround(f.t0, f.t1));
}

function selectSection(summary) {
  highlight.value = null;
  setView({ t0: summary.start, t1: summary.end ?? summary.start + 60 });
}

function selectExposure(row) {
  highlight.value = { t0: row.start, t1: row.end, key: `exp-${row.index}` };
  setView(viewAround(row.start, row.end, row.seconds * 2));
}

// --- Exposures and incidents of the connected rig ------------------------------------

function toWall(utcMs) {
  return wallFromUtcMs(utcMs, model.value?.zone ?? {});
}

const exposures = computed(() => {
  const m = model.value;
  if (!m || m.local) return { rows: [], typical: NaN };
  const list = lightExposures(mainStore.imageHistoryInfo, toWall);
  return exposureGuiding(m.series, list);
});

const incidentMarks = computed(() => {
  const m = model.value;
  if (!m?.span || m.local) return [];
  const out = [];
  for (const inc of store.incidents ?? []) {
    const start = toWall(Date.parse(inc.start));
    const end = toWall(Date.parse(inc.end));
    if (!Number.isFinite(start) || start < m.span.t0 - 60 || start > m.span.t1 + 60) continue;
    out.push({
      id: inc.id,
      kind: inc.kind,
      cause: inc.cause,
      t0: start,
      t1: Number.isFinite(end) ? end : start,
    });
  }
  return out;
});

const allFindings = computed(() => {
  const m = model.value;
  if (!m) return [];
  const extra = incidentMarks.value.map((i) => ({
    kind: 'incident',
    severity: i.kind === 'Manual' ? 'info' : 'warn',
    t0: i.t0,
    t1: i.t1,
    count: 1,
    params: { id: i.id, incidentKind: i.kind, cause: i.cause },
  }));
  return [...m.findings, ...extra].sort((a, b) => a.t0 - b.t0);
});

const problemCounts = computed(() => {
  let bad = 0;
  let warn = 0;
  for (const f of allFindings.value) {
    if (f.severity === 'bad') bad++;
    else if (f.severity === 'warn') warn++;
  }
  return { bad, warn };
});
</script>

<style scoped>
@reference '../../../assets/tailwind.css';

.icon-btn {
  @apply min-w-12 min-h-12 flex items-center justify-center rounded-chip text-content-muted hover:text-content disabled:opacity-50;
}

.kpi-label {
  @apply text-[10px] font-bold uppercase tracking-wider text-content-faint truncate;
}

.kpi-value {
  @apply text-lg font-semibold tabular-nums text-content leading-tight;
}

.kpi-sub {
  @apply text-[11px] tabular-nums text-content-muted truncate;
}
</style>
