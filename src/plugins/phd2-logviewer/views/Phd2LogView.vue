<template>
  <div ref="rootEl" class="px-4 py-6 lg:px-8">
    <div class="mx-auto flex max-w-6xl flex-col gap-6">
      <!-- Header -->
      <header
        class="rounded-2xl border border-gray-700/70 bg-gray-900/80 p-6 shadow-lg backdrop-blur"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 class="text-3xl font-semibold text-white">
              {{ t('plugins.phd2logviewer.title') }}
            </h1>
            <p class="mt-1 text-sm text-gray-400">{{ t('plugins.phd2logviewer.subtitle') }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <select
              v-model="selectedLogPath"
              :disabled="loadingList || loadingFile"
              class="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              @change="loadSelectedLog"
            >
              <option value="">
                {{
                  loadingList
                    ? t('plugins.phd2logviewer.loading')
                    : logFiles.length
                      ? t('plugins.phd2logviewer.selectLog')
                      : t('plugins.phd2logviewer.noLogs')
                }}
              </option>
              <option v-for="f in logFiles" :key="f.path" :value="f.path">
                {{ logLabel(f.name) }}
              </option>
            </select>
            <button
              type="button"
              :disabled="loadingList"
              class="inline-flex items-center justify-center rounded-lg border border-gray-600 bg-gray-800/50 p-2 text-gray-300 transition hover:bg-gray-700/60 disabled:opacity-50"
              :title="t('plugins.phd2logviewer.refresh')"
              @click="fetchLogList"
            >
              <svg
                class="h-4 w-4"
                :class="{ 'animate-spin': loadingList }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>
            <!-- Settings toggle -->
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-lg border p-2 text-gray-300 transition hover:bg-gray-700/60"
              :class="
                showSettings
                  ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                  : 'border-gray-600 bg-gray-800/50'
              "
              :title="t('plugins.phd2logviewer.settings.title')"
              @click="showSettings = !showSettings"
            >
              <svg
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
            </button>
            <span v-if="loadingFile" class="text-xs text-gray-400">{{
              t('plugins.phd2logviewer.loading')
            }}</span>
            <span v-if="listError" class="text-xs text-red-400">{{ listError }}</span>
            <button
              v-if="sessions.length || calibrations.length"
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700/60"
              @click="clearLog"
            >
              {{ t('plugins.phd2logviewer.clear') }}
            </button>
          </div>
        </div>

        <!-- Settings row -->
        <div
          v-if="showSettings"
          class="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-700/50 pt-4"
        >
          <span class="text-xs text-gray-400 shrink-0">{{
            t('plugins.phd2logviewer.settings.title')
          }}</span>
          <div class="flex-1 min-w-0">
            <Phd2LogPathSetting @path-changed="onLogPathChanged" />
          </div>
        </div>

        <!-- Controls row (after file loaded) -->
        <div
          v-if="fileName"
          class="mt-4 flex flex-wrap items-center gap-4 border-t border-gray-700/50 pt-4"
        >
          <span class="font-mono text-xs text-gray-300">{{ fileName }}</span>
          <div v-if="sessions.length > 1" class="flex items-center gap-2">
            <label class="text-xs text-gray-400">{{ t('plugins.phd2logviewer.session') }}</label>
            <select
              v-model="activeSessionIdx"
              class="rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option v-for="(s, i) in sessions" :key="i" :value="i">
                {{ i + 1 }} — {{ s.startTime }}
              </option>
            </select>
          </div>
          <label
            v-if="activeSession"
            class="flex cursor-pointer select-none items-center gap-1.5 text-xs text-gray-400"
          >
            <input
              type="checkbox"
              v-model="excludeDither"
              class="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            {{ t('plugins.phd2logviewer.excludeDither') }}
            <span class="text-gray-500">{{
              t('plugins.phd2logviewer.ditherFrames', { count: activeSession.ditherFrames.size })
            }}</span>
          </label>
          <label
            v-if="activeSession"
            class="flex cursor-pointer select-none items-center gap-1.5 text-xs text-gray-400"
          >
            <input
              type="checkbox"
              v-model="showRawRA"
              class="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            {{ t('plugins.phd2logviewer.rawRa') }}
          </label>
        </div>
      </header>

      <!-- Empty state -->
      <div
        v-if="!sessions.length && !calibrations.length"
        class="rounded-2xl border border-dashed border-gray-700 bg-gray-900/40 p-16 text-center"
      >
        <svg
          class="mx-auto mb-4 h-12 w-12 text-gray-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="3" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="21" />
          <line x1="3" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="21" y2="12" />
        </svg>
        <p class="text-gray-400">{{ t('plugins.phd2logviewer.emptyState') }}</p>
        <p class="mt-1 font-mono text-xs text-gray-600 select-text">
          ~/Documents/PHD2/PHD2_GuideLog_*.txt
        </p>
      </div>

      <!-- Content (session or calibration loaded) -->
      <template v-if="activeSession || calibrations.length">
        <!-- Session info -->
        <section
          v-if="activeSession"
          class="rounded-2xl border border-gray-700/70 bg-gray-900/70 p-5 shadow-inner"
        >
          <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
            <div v-for="item in sessionInfoItems" :key="item.label" class="flex flex-col gap-0.5">
              <span class="text-xs text-gray-500">{{ item.label }}</span>
              <span class="truncate font-medium text-gray-200" :title="item.value">{{
                item.value
              }}</span>
            </div>
          </div>
        </section>

        <!-- Guide Graph / Calibration (tabbed) -->
        <section class="rounded-2xl border border-gray-700/70 bg-gray-900/80 p-5 shadow-inner">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <!-- Tab buttons -->
            <div class="flex">
              <button
                v-if="sessions.length"
                type="button"
                class="rounded-l-md border border-gray-600 px-4 py-1.5 text-sm font-medium transition"
                :class="
                  activeTab === 'guide'
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200'
                    : 'bg-transparent text-gray-500 hover:bg-gray-700/40 hover:text-gray-300'
                "
                @click="setTab('guide')"
              >
                {{ t('plugins.phd2logviewer.tabs.guide') }}
              </button>
              <button
                v-if="calibrations.length"
                type="button"
                class="border border-gray-600 px-4 py-1.5 text-sm font-medium transition"
                :class="[
                  activeTab === 'cal'
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200'
                    : 'bg-transparent text-gray-500 hover:bg-gray-700/40 hover:text-gray-300',
                  sessions.length ? '-ml-px rounded-r-md' : 'rounded-md',
                ]"
                @click="setTab('cal')"
              >
                {{ t('plugins.phd2logviewer.tabs.calibration') }}
              </button>
            </div>

            <!-- Guide tab controls -->
            <template v-if="activeTab === 'guide' && activeSession">
              <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-gray-500">X</span>
                  <div class="flex gap-1">
                    <button class="zoom-btn" :disabled="xZoomSpan < 0.04" @click="xZoomIn">
                      +
                    </button>
                    <button
                      class="zoom-btn"
                      :disabled="xZoomStart <= 0 && xZoomEnd >= 1"
                      @click="xZoomOut"
                    >
                      −
                    </button>
                    <button
                      class="zoom-btn text-xs"
                      :disabled="xZoomStart <= 0 && xZoomEnd >= 1 && yZoom <= 1"
                      @click="resetZoom"
                    >
                      ⟳
                    </button>
                  </div>
                  <div class="h-4 w-px bg-gray-700"></div>
                  <span class="text-xs text-gray-500">Y</span>
                  <div class="flex gap-1">
                    <button class="zoom-btn" :disabled="yZoom >= 16" @click="yZoomIn">+</button>
                    <button class="zoom-btn" :disabled="yZoom <= 1" @click="yZoomOut">−</button>
                  </div>
                </div>
                <div class="flex items-center gap-3 text-xs">
                  <span class="flex items-center gap-1.5">
                    <span class="inline-block h-2 w-6 rounded bg-cyan-400"></span>
                    <span class="text-gray-400">{{
                      showRawRA
                        ? t('plugins.phd2logviewer.legend.raRaw')
                        : t('plugins.phd2logviewer.legend.ra')
                    }}</span>
                  </span>
                  <span class="flex items-center gap-1.5">
                    <span class="inline-block h-2 w-6 rounded bg-orange-400"></span>
                    <span class="text-gray-400">{{ t('plugins.phd2logviewer.legend.dec') }}</span>
                  </span>
                  <span
                    v-if="excludeDither && activeSession.ditherFrames.size"
                    class="flex items-center gap-1.5"
                  >
                    <span
                      class="inline-block h-2 w-4 rounded"
                      style="background: rgba(234, 179, 8, 0.4)"
                    ></span>
                    <span class="text-gray-400">{{
                      t('plugins.phd2logviewer.legend.dither')
                    }}</span>
                  </span>
                </div>
              </div>
            </template>

            <!-- Cal tab time label -->
            <span v-if="activeTab === 'cal' && activeCalibration" class="text-xs text-gray-400">
              {{ activeCalibration.startTime }}
            </span>
          </div>

          <!-- Guide tab -->
          <div v-show="activeTab === 'guide'">
            <div
              class="relative w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-950"
              style="height: 220px"
            >
              <canvas ref="guideCanvas" class="absolute inset-0 h-full w-full" />
            </div>
            <p class="mt-2 text-right text-xs text-gray-500">{{ guideLabel }}</p>
          </div>

          <!-- Calibration tab -->
          <div v-show="activeTab === 'cal'">
            <template v-if="activeCalibration">
              <div
                class="relative w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-950"
                style="height: 300px"
              >
                <canvas ref="calCanvas" class="absolute inset-0 h-full w-full" />
              </div>
              <div class="mt-2 flex flex-wrap gap-3 text-xs">
                <span v-for="dir in calDirs" :key="dir" class="flex items-center gap-1.5">
                  <span
                    class="inline-block h-px w-5"
                    :style="{ background: CAL_COLORS[dir]?.stroke || '#cbd5e1' }"
                  ></span>
                  <span class="text-gray-400">{{ dir }}</span>
                </span>
              </div>
              <div
                v-if="calMetaItems.length"
                class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400"
              >
                <span v-for="m in calMetaItems" :key="m.label">
                  {{ m.label }}: <span :class="m.color || 'text-gray-200'">{{ m.value }}</span>
                </span>
              </div>
              <div v-if="activeCalibration.results.length" class="mt-4 overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-gray-700">
                      <th class="pb-2 text-left text-xs font-medium text-gray-500">
                        {{ t('plugins.phd2logviewer.cal.axis') }}
                      </th>
                      <th class="pb-2 text-right text-xs font-medium text-gray-500">
                        {{ t('plugins.phd2logviewer.cal.angle') }}
                      </th>
                      <th class="pb-2 text-right text-xs font-medium text-gray-500">
                        {{ t('plugins.phd2logviewer.cal.rate') }}
                      </th>
                      <th class="pb-2 text-right text-xs font-medium text-gray-500">
                        {{ t('plugins.phd2logviewer.cal.parity') }}
                      </th>
                      <th class="pb-2 text-right text-xs font-medium text-gray-500">
                        {{ t('plugins.phd2logviewer.cal.steps') }}
                      </th>
                      <th class="pb-2 text-right text-xs font-medium text-gray-500">
                        {{ t('plugins.phd2logviewer.cal.dist') }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(r, i) in activeCalibration.results"
                      :key="i"
                      class="border-b border-gray-800/60 last:border-0"
                    >
                      <td
                        class="py-2 font-medium"
                        :class="
                          /west|east/i.test(r.direction) ? 'text-cyan-400' : 'text-orange-400'
                        "
                      >
                        {{ r.direction }}
                      </td>
                      <td class="py-2 text-right font-mono text-gray-300">
                        {{ r.angle.toFixed(1) }}
                      </td>
                      <td class="py-2 text-right font-mono text-gray-300">
                        {{ r.rate.toFixed(3) }}
                      </td>
                      <td class="py-2 text-right font-mono text-gray-300">{{ r.parity }}</td>
                      <td class="py-2 text-right font-mono text-gray-400">
                        {{ calStepInfo[r.direction]?.count ?? '—' }}
                      </td>
                      <td class="py-2 text-right font-mono text-gray-400">
                        {{ calStepInfo[r.direction]?.lastDist.toFixed(1) ?? '—' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p v-if="calBacklash" class="mt-2 text-xs text-gray-400">
                  {{ t('plugins.phd2logviewer.cal.backlash') }}:
                  <span class="text-gray-200">{{ calBacklash.lastDist.toFixed(1) }} px</span>
                  {{ t('plugins.phd2logviewer.cal.over') }}
                  <span class="text-gray-200">{{ calBacklash.count }}</span>
                  {{ t('plugins.phd2logviewer.cal.steps') }}
                </p>
              </div>
              <p v-else class="mt-4 text-xs text-gray-500">
                {{ t('plugins.phd2logviewer.cal.noSummary') }}
              </p>
            </template>
            <p v-else class="text-sm text-gray-500">{{ t('plugins.phd2logviewer.cal.noData') }}</p>
          </div>
        </section>

        <!-- Statistics -->
        <section
          v-if="activeSession"
          class="rounded-2xl border border-gray-700/70 bg-gray-900/80 p-5 shadow-inner"
        >
          <h2 class="mb-4 text-lg font-semibold text-white">
            {{ t('plugins.phd2logviewer.statistics') }}
          </h2>
          <div v-if="stats" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div
              v-for="card in statCards"
              :key="card.label"
              class="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4 text-center"
            >
              <div class="text-2xl font-mono font-semibold" :class="card.color">
                {{ card.value }}
              </div>
              <div class="mt-1 text-xs text-gray-400">{{ card.label }}</div>
              <div v-if="card.sub" class="mt-0.5 text-[10px] text-gray-500">{{ card.sub }}</div>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span>{{
              t('plugins.phd2logviewer.summary.framesUsed', {
                used: stats?.frameCount,
                total: stats?.totalFrames,
              })
            }}</span>
            <span v-if="stats?.excludedCount"
              >·
              {{
                t('plugins.phd2logviewer.summary.excluded', { count: stats.excludedCount })
              }}</span
            >
            <span v-if="activeSession.info.pixelScale"
              >·
              {{
                t('plugins.phd2logviewer.summary.pixelScale', {
                  scale: activeSession.info.pixelScale,
                })
              }}</span
            >
          </div>
        </section>

        <!-- FFT -->
        <section
          v-if="activeSession"
          class="rounded-2xl border border-gray-700/70 bg-gray-900/80 p-5 shadow-inner"
        >
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-lg font-semibold text-white">
                {{ t('plugins.phd2logviewer.fft.title') }}
              </h2>
              <p class="mt-0.5 text-xs text-gray-500">
                {{ t('plugins.phd2logviewer.fft.subtitle') }}
              </p>
            </div>
            <div
              v-if="fftPeak"
              class="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-1.5 text-right"
            >
              <div class="text-xs text-gray-400">
                {{ t('plugins.phd2logviewer.fft.dominantPeriod') }}
              </div>
              <div class="text-base font-mono font-semibold text-cyan-300">{{ fftPeak }}</div>
            </div>
          </div>
          <div
            class="relative w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-950"
            style="height: 180px"
          >
            <canvas ref="fftCanvas" class="absolute inset-0 h-full w-full" />
          </div>
          <p class="mt-2 text-xs text-gray-600">
            X axis shows period in minutes. Peaks indicate periodic error sources.
          </p>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { parsePhd2Log, calcStats } from '../utils/phd2Parser.js';
import { computeFFT } from '../utils/fft.js';
import { useSettingsStore } from '@/store/settingsStore';
import { useI18n } from 'vue-i18n';
import apiService from '@/services/apiService';
import Phd2LogPathSetting from '../components/Phd2LogPathSetting.vue';

// ── Refs ──────────────────────────────────────────────────────────────────
const { t } = useI18n();
const settingsStore = useSettingsStore();

const rootEl = ref(null);
const guideCanvas = ref(null);
const calCanvas = ref(null);
const fftCanvas = ref(null);

const fileName = ref('');
const logFiles = ref([]); // [{ name, path, size, lastModified }]
const selectedLogPath = ref('');
const loadingList = ref(false);
const loadingFile = ref(false);
const listError = ref('');
const sessions = ref([]);
const calibrations = ref([]);
const activeSessionIdx = ref(0);
const excludeDither = ref(true);
const showRawRA = ref(false);
const activeTab = ref('guide');
const fftPeak = ref('');
const guideLabel = ref('');

const showSettings = ref(false);

const xZoomStart = ref(0);
const xZoomEnd = ref(1);
const yZoom = ref(1.0);

// ── Computed ──────────────────────────────────────────────────────────────
const activeSession = computed(() => sessions.value[activeSessionIdx.value] ?? null);

const excludedFrames = computed(() => {
  if (!activeSession.value) return new Set();
  return excludeDither.value ? activeSession.value.ditherFrames : new Set();
});

const stats = computed(() => {
  if (!activeSession.value) return null;
  return calcStats(
    activeSession.value.frames,
    activeSession.value.info.pixelScale,
    excludedFrames.value
  );
});

const activeCalibration = computed(() => {
  if (!calibrations.value.length) return null;
  const idx = activeSession.value?.calibrationIdx ?? null;
  return idx != null ? calibrations.value[idx] : null;
});

const xZoomSpan = computed(() => xZoomEnd.value - xZoomStart.value);

const pluginServerUrl = computed(() => {
  const protocol = settingsStore.backendProtocol || 'http';
  const host = settingsStore.connection?.ip || window.location.hostname;
  const port = settingsStore.connection?.port || 5000;
  return `${protocol}://${host}:${port}`;
});

const CAL_COLORS = {
  West: { stroke: '#22d3ee', dash: [] },
  East: { stroke: '#67e8f9', dash: [5, 3] },
  North: { stroke: '#fb923c', dash: [] },
  South: { stroke: '#fdba74', dash: [5, 3] },
  Backlash: { stroke: '#c084fc', dash: [3, 3] },
};

const calDirs = computed(() =>
  activeCalibration.value ? [...new Set(activeCalibration.value.steps.map((s) => s.direction))] : []
);

const calStepInfo = computed(() => {
  if (!activeCalibration.value) return {};
  const info = {};
  for (const s of activeCalibration.value.steps) {
    if (!info[s.direction]) info[s.direction] = { count: 0, lastDist: 0 };
    if (s.step + 1 > info[s.direction].count) info[s.direction].count = s.step + 1;
    info[s.direction].lastDist = s.dist;
  }
  return info;
});

const calBacklash = computed(() => calStepInfo.value['Backlash'] ?? null);

const calMetaItems = computed(() => {
  const cal = activeCalibration.value;
  const session = activeSession.value;
  if (!cal) return [];
  const items = [];
  if (cal.stepSize != null)
    items.push({ label: t('plugins.phd2logviewer.cal.stepSize'), value: `${cal.stepSize} ms` });
  if (cal.calDistance != null)
    items.push({
      label: t('plugins.phd2logviewer.cal.calDistance'),
      value: `${cal.calDistance} px`,
    });
  if (session?.normRaRate != null)
    items.push({
      label: t('plugins.phd2logviewer.cal.raRate'),
      value: `${session.normRaRate.toFixed(1)}"/s`,
      color: 'text-cyan-400',
    });
  if (session?.normDecRate != null)
    items.push({
      label: t('plugins.phd2logviewer.cal.decRate'),
      value: `${session.normDecRate.toFixed(1)}"/s`,
      color: 'text-orange-400',
    });
  return items;
});

const sessionInfoItems = computed(() => {
  if (!activeSession.value) return [];
  const s = activeSession.value;
  const frames = s.frames;
  const durSec = frames.length ? frames[frames.length - 1].time - frames[0].time : 0;
  const dm = Math.floor(durSec / 60),
    ds = Math.round(durSec % 60);
  const items = [{ label: t('plugins.phd2logviewer.info.started'), value: s.startTime || '—' }];
  if (s.endTime) items.push({ label: t('plugins.phd2logviewer.info.ended'), value: s.endTime });
  items.push({ label: t('plugins.phd2logviewer.info.duration'), value: `${dm}m ${ds}s` });
  if (s.info.focalLength)
    items.push({
      label: t('plugins.phd2logviewer.info.focalLength'),
      value: `${s.info.focalLength} mm`,
    });
  if (s.info.pixelScale)
    items.push({
      label: t('plugins.phd2logviewer.info.pixelScale'),
      value: `${s.info.pixelScale}" /px`,
    });
  return items;
});

const statCards = computed(() => {
  if (!stats.value) return [];
  const u = stats.value.unit;
  return [
    {
      label: t('plugins.phd2logviewer.stats.totalRms'),
      value: `${stats.value.rmsTotal}${u}`,
      color: 'text-white',
      sub: t('plugins.phd2logviewer.stats.combined'),
    },
    {
      label: t('plugins.phd2logviewer.stats.raRms'),
      value: `${stats.value.rmsRa}${u}`,
      color: 'text-cyan-400',
      sub: t('plugins.phd2logviewer.stats.rightAscension'),
    },
    {
      label: t('plugins.phd2logviewer.stats.decRms'),
      value: `${stats.value.rmsDec}${u}`,
      color: 'text-orange-400',
      sub: t('plugins.phd2logviewer.stats.declination'),
    },
    {
      label: t('plugins.phd2logviewer.stats.peakRa'),
      value: `${stats.value.peakRa}${u}`,
      color: 'text-cyan-600',
      sub: t('plugins.phd2logviewer.stats.maxError'),
    },
    {
      label: t('plugins.phd2logviewer.stats.peakDec'),
      value: `${stats.value.peakDec}${u}`,
      color: 'text-orange-600',
      sub: t('plugins.phd2logviewer.stats.maxError'),
    },
    {
      label: t('plugins.phd2logviewer.stats.frames'),
      value: stats.value.frameCount.toString(),
      color: 'text-gray-300',
      sub: t('plugins.phd2logviewer.stats.of', { total: stats.value.totalFrames }),
    },
  ];
});

function logLabel(name) {
  const m = name.match(/PHD2_GuideLog_(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return name;
  return `${m[1]} ${m[2]}:${m[3]}:${m[4]}`;
}

// ── File handling ─────────────────────────────────────────────────────────
function loadLogText(text, name) {
  const result = parsePhd2Log(text);
  fileName.value = name;
  sessions.value = result.sessions;
  calibrations.value = result.calibrations;
  activeSessionIdx.value = 0;
  activeTab.value = result.sessions.length ? 'guide' : 'cal';
  fftPeak.value = '';
  guideLabel.value = '';
  resetZoom();
}

async function resolveLogDir(base) {
  // 1. Try saved setting
  try {
    const settingRes = await apiService.getSetting('phd2_logviewer_path');
    const saved = settingRes?.Response?.Value || '';
    if (saved) return saved;
  } catch {
    // not yet saved
  }

  // 2. Fallback: auto-detect via filesystem/browse
  const docsRes = await fetch(`${base}/api/filesystem/browse`);
  const docsData = await docsRes.json();
  if (!docsData.success) throw new Error(docsData.error || 'Failed to browse filesystem');

  const sep = docsData.currentPath.includes('\\') ? '\\' : '/';
  const normalize = (p) => p.replace(/[\\/]/g, sep);
  const basePath = docsData.currentPath.replace(/[\\/]$/, '');
  const parentPath = basePath.substring(0, basePath.lastIndexOf(sep));

  for (const candidate of [
    normalize(basePath + sep + 'PHD2'),
    normalize(basePath + sep + 'Documents' + sep + 'PHD2'),
    normalize(parentPath + sep + 'Documents' + sep + 'PHD2'),
  ]) {
    const res = await fetch(`${base}/api/filesystem/browse?path=${encodeURIComponent(candidate)}`);
    const data = await res.json();
    if (data.success) return candidate;
  }

  throw new Error('PHD2 log directory not found');
}

async function fetchLogList() {
  loadingList.value = true;
  listError.value = '';
  try {
    const base = pluginServerUrl.value;
    const logDir = await resolveLogDir(base);

    const browseRes = await fetch(
      `${base}/api/filesystem/browse?path=${encodeURIComponent(logDir)}`
    );
    const browseData = await browseRes.json();
    if (!browseData.success) throw new Error(t('plugins.phd2logviewer.settings.notConfigured'));

    logFiles.value = browseData.files
      .filter((f) => f.name.startsWith('PHD2_GuideLog_') && f.name.endsWith('.txt'))
      .sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  } catch (e) {
    listError.value = e.message;
  } finally {
    loadingList.value = false;
  }
}

function onLogPathChanged() {
  showSettings.value = false;
  fetchLogList();
}

async function loadSelectedLog() {
  if (!selectedLogPath.value) return;
  loadingFile.value = true;
  listError.value = '';
  try {
    const buffer = await apiService.fetchFilesystemFileBuffer(selectedLogPath.value);
    const text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
    const name = selectedLogPath.value.split(/[\\/]/).pop();
    loadLogText(text, name);
  } catch (e) {
    listError.value = e.message;
  } finally {
    loadingFile.value = false;
  }
}

function clearLog() {
  sessions.value = [];
  calibrations.value = [];
  fileName.value = '';
  selectedLogPath.value = '';
  activeSessionIdx.value = 0;
  activeTab.value = 'guide';
  fftPeak.value = '';
  guideLabel.value = '';
  resetZoom();
}

// ── Tab ───────────────────────────────────────────────────────────────────
function setTab(tab) {
  activeTab.value = tab;
  nextTick(() => {
    if (tab === 'guide') drawGuideChart();
    if (tab === 'cal') drawCalibration();
  });
}

// ── Zoom ──────────────────────────────────────────────────────────────────
function resetZoom() {
  xZoomStart.value = 0;
  xZoomEnd.value = 1;
  yZoom.value = 1.0;
}

function xZoomIn() {
  const c = (xZoomStart.value + xZoomEnd.value) / 2,
    h = xZoomSpan.value / 4;
  xZoomStart.value = Math.max(0, c - h);
  xZoomEnd.value = Math.min(1, c + h);
  drawGuideChart();
}

function xZoomOut() {
  const c = (xZoomStart.value + xZoomEnd.value) / 2,
    h = xZoomSpan.value;
  xZoomStart.value = Math.max(0, c - h);
  xZoomEnd.value = Math.min(1, c + h);
  drawGuideChart();
}

function yZoomIn() {
  yZoom.value = Math.min(16, yZoom.value * 2);
  drawGuideChart();
}
function yZoomOut() {
  yZoom.value = Math.max(1, yZoom.value / 2);
  drawGuideChart();
}

// ── Canvas: guide chart ───────────────────────────────────────────────────
function drawGuideChart() {
  const canvas = guideCanvas.value;
  if (!canvas || !activeSession.value) return;

  const session = activeSession.value;
  const allFrames = session.frames;
  if (!allFrames.length) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width,
    H = rect.height;
  const PAD = { top: 14, right: 14, bottom: 36, left: 52 };
  const PW = W - PAD.left - PAD.right;
  const PH = H - PAD.top - PAD.bottom;

  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, W, H);

  const ps = session.info.pixelScale || 1;
  const fullMinT = allFrames[0].time;
  const fullMaxT = allFrames[allFrames.length - 1].time;
  const fullSpan = fullMaxT - fullMinT || 1;

  const viewMinT = fullMinT + xZoomStart.value * fullSpan;
  const viewMaxT = fullMinT + xZoomEnd.value * fullSpan;
  const viewSpan = viewMaxT - viewMinT || 1;

  // Reconstruct raw (unguided) RA by accumulating guide corrections
  let cumGuide = 0;
  const rawRAValues = allFrames.map((f) => {
    cumGuide += f.raGuide;
    return (f.raRaw + cumGuide) * ps;
  });

  const maxErr = Math.max(
    ...allFrames.flatMap((f) => [Math.abs(f.raRaw * ps), Math.abs(f.decRaw * ps)]),
    ...(showRawRA.value ? rawRAValues.map(Math.abs) : []),
    0.5
  );
  const yRange = Math.ceil(maxErr * 1.3 * 10) / 10 / yZoom.value;

  const xOf = (t) => PAD.left + ((t - viewMinT) / viewSpan) * PW;
  const yOf = (v) => PAD.top + PH / 2 - (v / yRange) * (PH / 2);

  // Grid lines
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (PH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + PW, y);
    ctx.stroke();
  }

  // Dither regions
  if (excludeDither.value && session.ditherFrames.size) {
    ctx.fillStyle = 'rgba(234,179,8,0.08)';
    const vis = allFrames.filter((f) => f.time >= viewMinT && f.time <= viewMaxT);
    let inD = false,
      dx0 = 0;
    for (const f of vis) {
      const is = session.ditherFrames.has(f.frame);
      if (is && !inD) {
        dx0 = xOf(f.time);
        inD = true;
      } else if (!is && inD) {
        ctx.fillRect(dx0, PAD.top, xOf(f.time) - dx0, PH);
        inD = false;
      }
    }
    if (inD) ctx.fillRect(dx0, PAD.top, xOf(viewMaxT) - dx0, PH);
  }

  // Zero line
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(PAD.left, yOf(0));
  ctx.lineTo(PAD.left + PW, yOf(0));
  ctx.stroke();
  ctx.setLineDash([]);

  // Data lines (clipped to plot area)
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.left, PAD.top, PW, PH);
  ctx.clip();
  const rawMap = new Map(allFrames.map((f, i) => [f, rawRAValues[i]]));
  const drawLine = (color, getV) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let started = false;
    for (const f of allFrames) {
      const x = xOf(f.time),
        y = yOf(getV(f));
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  };
  drawLine('#22d3ee', (f) => (showRawRA.value ? rawMap.get(f) : f.raRaw * ps));
  drawLine('#fb923c', (f) => f.decRaw * ps);
  ctx.restore();

  // Y axis labels
  const unit = session.info.pixelScale ? '"' : 'px';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  for (let i = -2; i <= 2; i++) {
    const v = (i / 2) * yRange;
    ctx.fillText(v.toFixed(1) + unit, PAD.left - 4, yOf(v) + 3);
  }

  // Direction labels on right edge
  const rx = PAD.left + PW + 3;
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(251,146,60,0.55)';
  ctx.fillText('N', rx, PAD.top + 9);
  ctx.fillText('S', rx, PAD.top + PH - 3);
  ctx.fillStyle = 'rgba(34,211,238,0.55)';
  ctx.fillText('E', rx, PAD.top + 20);
  ctx.fillText('W', rx, PAD.top + PH - 14);

  // X axis — tick labels anchored to full data range, scroll with pan
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '11px monospace';
  const niceIntervals = [5, 10, 15, 20, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3600];
  const targetTicks = Math.max(3, Math.floor(PW / 75));
  const interval =
    niceIntervals.find((iv) => fullSpan / iv <= targetTicks * 1.5) ||
    niceIntervals[niceIntervals.length - 1];
  for (let t = Math.ceil(fullMinT / interval) * interval; t <= fullMaxT; t += interval) {
    if (t < viewMinT - interval || t > viewMaxT + interval) continue;
    const x = xOf(t);
    if (x < PAD.left - 1 || x > PAD.left + PW + 1) continue;
    const rel = t - fullMinT;
    ctx.fillText(
      rel < 120 ? `${rel.toFixed(0)}s` : `${(rel / 60).toFixed(rel < 600 ? 1 : 0)}m`,
      x,
      H - 6
    );
  }

  // Border
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD.left, PAD.top, PW, PH);

  // Update label
  const visCount = allFrames.filter((f) => f.time >= viewMinT && f.time <= viewMaxT).length;
  const vd = viewMaxT - viewMinT;
  const vm = Math.floor(vd / 60),
    vs = Math.round(vd % 60);
  const zoomSuffix =
    xZoomStart.value === 0 && xZoomEnd.value === 1
      ? ''
      : `  ·  ${t('plugins.phd2logviewer.graph.zoomView', { percent: ((xZoomEnd.value - xZoomStart.value) * 100) | 0 })}`;
  const unitLabel =
    unit === '"'
      ? t('plugins.phd2logviewer.graph.arcsec', { scale: session.info.pixelScale })
      : t('plugins.phd2logviewer.graph.pixels');
  guideLabel.value = `${unitLabel}  ·  ${t('plugins.phd2logviewer.graph.frames', { count: visCount })}  ·  ${vm}m ${vs}s${zoomSuffix}`;
}

// ── Canvas: calibration chart ─────────────────────────────────────────────
function drawCalibration() {
  const canvas = calCanvas.value;
  const cal = activeCalibration.value;
  if (!canvas || !cal?.steps.length) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width,
    H = rect.height;
  const PAD = { top: 14, right: 14, bottom: 14, left: 14 };
  const PW = W - PAD.left - PAD.right;
  const PH = H - PAD.top - PAD.bottom;

  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, W, H);

  const origin = cal.steps[0];
  const maxDist = Math.max(
    ...cal.steps.map((s) => Math.sqrt((s.x - origin.x) ** 2 + (s.y - origin.y) ** 2)),
    1
  );
  const range = maxDist * 1.18;
  const cx = PAD.left + PW / 2,
    cy = PAD.top + PH / 2;
  const sc = Math.min(PW, PH) / 2 / range;
  const px = (x) => cx + (x - origin.x) * sc;
  const py = (y) => cy + (y - origin.y) * sc;

  // Range circles + crosshair
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 0.5;
  [0.25, 0.5, 0.75, 1.0].forEach((f) => {
    ctx.beginPath();
    ctx.arc(cx, cy, f * range * sc, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(PAD.left, cy);
  ctx.lineTo(PAD.left + PW, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, PAD.top);
  ctx.lineTo(cx, PAD.top + PH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Step paths grouped by direction
  const groups = {};
  for (const s of cal.steps) (groups[s.direction] ??= []).push(s);
  for (const [dir, steps] of Object.entries(groups)) {
    const { stroke, dash } = CAL_COLORS[dir] || { stroke: '#cbd5e1', dash: [] };
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash);
    ctx.beginPath();
    steps.forEach((s, i) => {
      i === 0 ? ctx.moveTo(px(s.x), py(s.y)) : ctx.lineTo(px(s.x), py(s.y));
    });
    ctx.stroke();
    ctx.setLineDash([]);
    const last = steps[steps.length - 1];
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(px(last.x), py(last.y), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Origin ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(px(cal.steps[0].x), py(cal.steps[0].y), 5, 0, Math.PI * 2);
  ctx.stroke();

  // Annotations
  ctx.fillStyle = '#4b5563';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`±${range.toFixed(1)} px`, cx + 4, cy - range * sc - 4);
  ctx.fillStyle = '#374151';
  ctx.textAlign = 'center';
  ctx.fillText('x →', PAD.left + PW - 8, cy - 4);
  ctx.textAlign = 'right';
  ctx.fillText('y ↓', cx - 4, PAD.top + 12);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD.left, PAD.top, PW, PH);
}

// ── Canvas: FFT chart ─────────────────────────────────────────────────────
function drawFftChart() {
  const canvas = fftCanvas.value;
  if (!canvas || !activeSession.value) return;

  const frames = activeSession.value.frames.filter((f) => !excludedFrames.value.has(f.frame));
  if (frames.length < 16) return;

  const ps = activeSession.value.info.pixelScale || 1;
  const signal = frames.map((f) => f.raRaw * ps);
  const times = frames.map((f) => f.time);
  const meanDt = (times[times.length - 1] - times[0]) / (times.length - 1) || 2;

  const result = computeFFT(signal, meanDt);
  if (!result) return;

  const filtered = result.periods
    .map((p, i) => ({ p, m: result.magnitudes[i] }))
    .filter(({ p }) => p >= 10 && p <= 1800);
  if (!filtered.length) return;

  const peak = filtered.reduce((a, b) => (b.m > a.m ? b : a));
  fftPeak.value = `${(peak.p / 60).toFixed(1)} min`;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width,
    H = rect.height;
  const PAD = { top: 10, right: 14, bottom: 36, left: 52 };
  const PW = W - PAD.left - PAD.right;
  const PH = H - PAD.top - PAD.bottom;

  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, W, H);

  const maxMag = Math.max(...filtered.map((d) => d.m), 0.01);
  const pMin = filtered[0].p,
    pMax = filtered[filtered.length - 1].p;
  const pSpan = pMax - pMin || 1;
  const barW = Math.max(1, PW / filtered.length);

  filtered.forEach(({ p, m }) => {
    const x = PAD.left + ((p - pMin) / pSpan) * PW;
    const bh = (m / maxMag) * PH;
    ctx.fillStyle = p === peak.p ? 'rgba(34,211,238,0.85)' : 'rgba(34,211,238,0.3)';
    ctx.fillRect(x, PAD.top + PH - bh, Math.max(1, barW - 0.5), bh);
  });

  const unit = activeSession.value.info.pixelScale ? '"' : 'px';
  const numTicks = Math.min(8, Math.max(3, Math.floor(PW / 80)));
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cbd5e1';
  for (let i = 0; i <= numTicks; i++) {
    const p = pMin + (i / numTicks) * pSpan;
    const x = PAD.left + (i / numTicks) * PW;
    ctx.fillText(
      p >= 60 ? `${(p / 60).toFixed(p >= 120 ? 0 : 1)}m` : `${Math.round(p)}s`,
      x,
      H - 6
    );
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, PAD.top);
    ctx.lineTo(x, PAD.top + PH);
    ctx.stroke();
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '11px monospace';
  for (let i = 0; i <= 3; i++) {
    const v = (i / 3) * maxMag,
      y = PAD.top + PH - (i / 3) * PH;
    ctx.fillText(v.toFixed(2) + unit, PAD.left - 4, y + 3);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + PW, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD.left, PAD.top, PW, PH);
}

function redrawAll() {
  nextTick(() => {
    if (activeTab.value === 'guide') drawGuideChart();
    if (activeTab.value === 'cal') drawCalibration();
    drawFftChart();
  });
}

// ── Watchers ──────────────────────────────────────────────────────────────
watch([activeSession, excludeDither, showRawRA], () => {
  nextTick(() => {
    drawGuideChart();
    drawFftChart();
  });
});
watch(activeTab, (tab) => {
  nextTick(() => {
    if (tab === 'guide') drawGuideChart();
    if (tab === 'cal') drawCalibration();
  });
});

// ── Drag-to-pan ───────────────────────────────────────────────────────────
let dragState = null;

watch(guideCanvas, (canvas) => {
  if (!canvas) return;
  function dragStart(clientX) {
    if (xZoomEnd.value - xZoomStart.value >= 1) return;
    dragState = { startX: clientX, z0: xZoomStart.value, z1: xZoomEnd.value };
    canvas.style.cursor = 'grabbing';
  }
  function dragMove(clientX) {
    if (!dragState) return;
    const span = dragState.z1 - dragState.z0;
    const delta = ((dragState.startX - clientX) / canvas.clientWidth) * span;
    xZoomStart.value = Math.max(0, Math.min(1 - span, dragState.z0 + delta));
    xZoomEnd.value = xZoomStart.value + span;
    drawGuideChart();
  }
  function dragEnd() {
    dragState = null;
    canvas.style.cursor = xZoomStart.value <= 0 && xZoomEnd.value >= 1 ? '' : 'grab';
  }
  canvas.addEventListener('mousedown', (e) => dragStart(e.clientX));
  window.addEventListener('mousemove', (e) => dragMove(e.clientX));
  window.addEventListener('mouseup', () => dragEnd());
  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      dragStart(e.touches[0].clientX);
    },
    { passive: false }
  );
  window.addEventListener(
    'touchmove',
    (e) => {
      if (dragState) {
        e.preventDefault();
        dragMove(e.touches[0].clientX);
      }
    },
    { passive: false }
  );
  window.addEventListener('touchend', () => dragEnd());
  canvas.addEventListener('mouseenter', () => {
    if (xZoomEnd.value - xZoomStart.value < 1) canvas.style.cursor = 'grab';
  });
  canvas.addEventListener('mouseleave', () => {
    if (!dragState) canvas.style.cursor = '';
  });
});

// ── Resize handling ───────────────────────────────────────────────────────
let resizeObserver = null;

onMounted(() => {
  resizeObserver = new ResizeObserver(redrawAll);
  if (rootEl.value) resizeObserver.observe(rootEl.value);
  fetchLogList();
});

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<style scoped>
@reference '../../../assets/tailwind.css';
.zoom-btn {
  @apply flex h-7 w-7 items-center justify-center rounded-md border border-gray-600 bg-gray-800/50 text-sm font-semibold text-gray-300 transition hover:bg-gray-700/60 disabled:cursor-default disabled:opacity-30;
}
</style>
