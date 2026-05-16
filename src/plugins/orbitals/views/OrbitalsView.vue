<template>
  <div class="px-4 py-6 lg:px-8">
    <div class="mx-auto flex max-w-6xl flex-col gap-6">
      <!-- Header -->
      <header
        class="rounded-2xl border border-gray-700/70 bg-gray-900/80 p-6 shadow-lg backdrop-blur"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 class="text-3xl font-semibold text-white">{{ t('plugins.orbitals.title') }}</h1>
            <p class="mt-1 text-sm text-gray-400">{{ t('plugins.orbitals.subtitle') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="positionRefreshing" class="text-xs text-cyan-400 animate-pulse">{{
              t('plugins.orbitals.updating')
            }}</span>
            <button
              @click="refreshPositions"
              :disabled="positionRefreshing"
              class="inline-flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800/50 px-3 py-2 text-sm text-gray-300 transition hover:bg-gray-700/60 disabled:opacity-50"
            >
              <svg
                class="h-4 w-4"
                :class="{ 'animate-spin': positionRefreshing }"
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
              {{ t('plugins.orbitals.refresh') }}
            </button>
          </div>
        </div>
      </header>

      <!-- Data sources -->
      <section
        class="rounded-2xl border border-gray-700/70 bg-gray-900/80 p-6 shadow-lg backdrop-blur"
      >
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          {{ t('plugins.orbitals.dataSources') }}
        </h2>
        <div class="flex flex-col gap-3">
          <!-- MPC Comets -->
          <div
            class="flex flex-wrap items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-white">{{ t('plugins.orbitals.mpcComets') }}</p>
              <p class="text-xs text-gray-400">
                {{
                  store.lastUpdated.mpcComets
                    ? t('plugins.orbitals.lastUpdated', { d: fmtDate(store.lastUpdated.mpcComets) })
                    : t('plugins.orbitals.noData')
                }}
                <span v-if="mpcCount"> · {{ mpcCount }} {{ t('plugins.orbitals.objects') }}</span>
              </p>
            </div>
            <label
              class="cursor-pointer rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600/60 transition"
            >
              {{ t('plugins.orbitals.loadFile') }}
              <input
                type="file"
                accept=".txt"
                class="sr-only"
                @change="(e) => loadFile(e, 'MPC')"
              />
            </label>
            <button
              @click="fetchMPC"
              :disabled="loading.mpc"
              class="rounded-lg border border-cyan-700 bg-cyan-900/40 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-800/50 transition disabled:opacity-50"
            >
              {{ loading.mpc ? t('plugins.orbitals.fetching') : t('plugins.orbitals.fetchOnline') }}
            </button>
          </div>

          <!-- JPL Comets -->
          <div
            class="flex flex-wrap items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-white">{{ t('plugins.orbitals.jplComets') }}</p>
              <p class="text-xs text-gray-400">
                {{
                  store.lastUpdated.jplComets
                    ? t('plugins.orbitals.lastUpdated', { d: fmtDate(store.lastUpdated.jplComets) })
                    : t('plugins.orbitals.noData')
                }}
                <span v-if="jplCometCount">
                  · {{ jplCometCount }} {{ t('plugins.orbitals.objects') }}</span
                >
              </p>
            </div>
            <label
              class="cursor-pointer rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600/60 transition"
            >
              {{ t('plugins.orbitals.loadFile') }}
              <input
                type="file"
                accept=".txt"
                class="sr-only"
                @change="(e) => loadFile(e, 'JPL')"
              />
            </label>
            <button
              @click="fetchJPL"
              :disabled="loading.jpl"
              class="rounded-lg border border-cyan-700 bg-cyan-900/40 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-800/50 transition disabled:opacity-50"
            >
              {{ loading.jpl ? t('plugins.orbitals.fetching') : t('plugins.orbitals.fetchOnline') }}
            </button>
          </div>

          <!-- JPL Asteroids (session only) -->
          <div
            class="flex flex-wrap items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-white">{{ t('plugins.orbitals.jplAsteroids') }}</p>
              <p class="text-xs text-gray-400">
                {{
                  store.asteroidCount
                    ? `${store.asteroidCount} ${t('plugins.orbitals.objects')} (${store.asteroidsSource}) — ${t('plugins.orbitals.sessionOnly')}`
                    : t('plugins.orbitals.noData')
                }}
              </p>
            </div>
            <label
              class="cursor-pointer rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600/60 transition"
            >
              {{ t('plugins.orbitals.loadFile') }} (.gz)
              <input
                type="file"
                accept=".gz"
                class="sr-only"
                @change="(e) => loadFile(e, 'JPL-num')"
              />
            </label>
            <label
              class="cursor-pointer rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600/60 transition"
            >
              {{ t('plugins.orbitals.loadFileUnnum') }}
              <input
                type="file"
                accept=".gz"
                class="sr-only"
                @change="(e) => loadFile(e, 'JPL-unnum')"
              />
            </label>
          </div>
        </div>
        <p
          v-if="parseError"
          class="mt-3 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-xs text-red-300"
        >
          {{ parseError }}
        </p>
      </section>

      <!-- Filter + search -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex rounded-lg border border-gray-700 bg-gray-900/80 p-1">
          <button
            v-for="tab in objectTabs"
            :key="tab.value"
            @click="store.setFilter({ objectType: tab.value })"
            :class="[
              'rounded-md px-3 py-1 text-sm transition',
              store.filter.objectType === tab.value
                ? 'bg-cyan-700 text-white'
                : 'text-gray-400 hover:text-white',
            ]"
          >
            {{ tab.label }}
          </button>
        </div>
        <input
          v-model="searchInput"
          @input="onSearch"
          type="search"
          :placeholder="t('plugins.orbitals.searchPlaceholder')"
          class="min-w-[200px] flex-1 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <span class="text-xs text-gray-500"
          >{{ visibleRows.length }} / {{ store.filteredObjects.length }}</span
        >
      </div>

      <!-- Object table -->
      <div
        class="rounded-2xl border border-gray-700/70 bg-gray-900/80 shadow-lg backdrop-blur overflow-hidden"
      >
        <div
          v-if="store.filteredObjects.length === 0"
          class="py-16 text-center text-gray-500 text-sm"
        >
          {{ t('plugins.orbitals.emptyState') }}
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-700/70 bg-gray-800/60">
              <tr>
                <th class="px-4 py-3 text-left font-semibold text-gray-300">
                  {{ t('plugins.orbitals.colName') }}
                </th>
                <th class="px-3 py-3 text-center font-semibold text-gray-300">
                  {{ t('plugins.orbitals.colType') }}
                </th>
                <th class="px-3 py-3 text-right font-semibold text-gray-300">
                  {{ t('plugins.orbitals.colRA') }}
                </th>
                <th class="px-3 py-3 text-right font-semibold text-gray-300">
                  {{ t('plugins.orbitals.colDec') }}
                </th>
                <th class="px-3 py-3 text-right font-semibold text-gray-300">
                  {{ t('plugins.orbitals.colDist') }}
                </th>
                <th class="px-3 py-3 text-right font-semibold text-gray-300 hidden sm:table-cell">
                  {{ t('plugins.orbitals.colH') }}
                </th>
                <th class="px-4 py-3 text-right font-semibold text-gray-300">
                  {{ t('plugins.orbitals.colActions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
              <tr
                v-for="(row, idx) in visibleRows"
                :key="row.name + idx"
                class="transition hover:bg-gray-800/50"
                :class="{ 'bg-cyan-900/10': selectedName === row.name }"
              >
                <td class="max-w-[200px] truncate px-4 py-3 text-white" :title="row.name">
                  {{ row.name }}
                </td>
                <td class="px-3 py-3 text-center">
                  <span
                    :class="typeClass(row)"
                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                  >
                    {{ typeLabel(row) }}
                  </span>
                </td>
                <td class="px-3 py-3 text-right font-mono text-xs text-gray-300">
                  {{ row._pos ? formatRA(row._pos.ra) : '—' }}
                </td>
                <td class="px-3 py-3 text-right font-mono text-xs text-gray-300">
                  {{ row._pos ? formatDec(row._pos.dec) : '—' }}
                </td>
                <td class="px-3 py-3 text-right text-xs text-gray-400">
                  {{ row._pos ? row._pos.dist.toFixed(3) + ' AU' : '—' }}
                </td>
                <td class="px-3 py-3 text-right text-xs text-gray-500 hidden sm:table-cell">
                  {{ row.H != null ? row.H.toFixed(1) : '—' }}
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      v-if="row._pos"
                      @click="slewTo(row)"
                      :disabled="slewing === row.name"
                      class="rounded-lg border border-indigo-700 bg-indigo-900/40 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-800/50 transition disabled:opacity-50"
                    >
                      {{ slewing === row.name ? '…' : t('plugins.orbitals.slew') }}
                    </button>
                    <button
                      v-if="row._pos"
                      @click="setTarget(row)"
                      class="rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600/60 transition"
                    >
                      {{ t('plugins.orbitals.setTarget') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-if="store.filteredObjects.length > PAGE_SIZE"
          class="flex items-center justify-between border-t border-gray-700/70 px-4 py-3"
        >
          <button
            @click="page > 0 && page--"
            :disabled="page === 0"
            class="rounded-lg border border-gray-600 bg-gray-800/50 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700/60 disabled:opacity-30 transition"
          >
            ← {{ t('plugins.orbitals.prev') }}
          </button>
          <span class="text-xs text-gray-500">{{
            t('plugins.orbitals.page', { n: page + 1, total: totalPages })
          }}</span>
          <button
            @click="page < totalPages - 1 && page++"
            :disabled="page >= totalPages - 1"
            class="rounded-lg border border-gray-600 bg-gray-800/50 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700/60 disabled:opacity-30 transition"
          >
            {{ t('plugins.orbitals.next') }} →
          </button>
        </div>
      </div>

      <!-- Toast -->
      <Transition
        enter-from-class="opacity-0 translate-y-2"
        leave-to-class="opacity-0 translate-y-2"
        enter-active-class="transition duration-200"
        leave-active-class="transition duration-200"
      >
        <div
          v-if="toast"
          class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur"
          :class="
            toast.ok
              ? 'border-green-700/50 bg-green-900/80 text-green-200'
              : 'border-red-700/50 bg-red-900/80 text-red-200'
          "
        >
          {{ toast.msg }}
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useOrbitalsStore } from '../store/orbitalsStore.js';
import { calcRaDec, formatRA, formatDec } from '../utils/orbital-mechanics.js';
import {
  parseMPCComets,
  parseJPLComets,
  parseJPLNumberedAsteroids,
  parseJPLUnnumberedAsteroids,
  decompressGzip,
} from '../utils/parsers.js';
import apiService from '@/services/apiService';

const { t } = useI18n();
const store = useOrbitalsStore();

const PAGE_SIZE = 100;

const MPC_URL = 'https://www.minorplanetcenter.net/iau/MPCORB/CometEls.txt';
const JPL_URL = 'https://ssd.jpl.nasa.gov/dat/ELEMENTS.COMET';

// ── Reactive state ─────────────────────────────────────────────────────────

const loading = ref({ mpc: false, jpl: false });
const parseError = ref('');
const positionRefreshing = ref(false);
const slewing = ref('');
const selectedName = ref('');
const searchInput = ref(store.filter.search);
const page = ref(0);
const toast = ref(null);
let toastTimer = null;
let positionTimer = null;

// Positions are computed and cached per-object (indexed by name)
const positions = ref({});

// ── Computed ───────────────────────────────────────────────────────────────

const objectTabs = computed(() => [
  { value: 'all', label: t('plugins.orbitals.tabAll') },
  { value: 'comets', label: t('plugins.orbitals.tabComets') },
  { value: 'asteroids', label: t('plugins.orbitals.tabAsteroids') },
]);

const mpcCount = computed(() => store.comets.filter((c) => c.source === 'MPC').length);
const jplCometCount = computed(() => store.comets.filter((c) => c.source === 'JPL').length);

const enrichedObjects = computed(() => {
  return store.filteredObjects.map((o) => ({
    ...o,
    _pos: positions.value[o.name] ?? null,
  }));
});

const totalPages = computed(() => Math.ceil(enrichedObjects.value.length / PAGE_SIZE));
const visibleRows = computed(() => {
  const start = page.value * PAGE_SIZE;
  return enrichedObjects.value.slice(start, start + PAGE_SIZE);
});

// ── Helpers ────────────────────────────────────────────────────────────────

function showToast(msg, ok = true) {
  clearTimeout(toastTimer);
  toast.value = { msg, ok };
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 3000);
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString();
}

function typeLabel(row) {
  if (row.type === 'asteroid') return 'A';
  const map = { P: 'P/', C: 'C/', D: 'D/', A: 'A/', X: 'X/', I: 'I/', J: 'JPL' };
  return map[row.orbitType] ?? row.orbitType ?? '?';
}

function typeClass(row) {
  if (row.type === 'asteroid') return 'bg-amber-900/50 text-amber-300';
  const map = { P: 'bg-cyan-900/50 text-cyan-300', C: 'bg-blue-900/50 text-blue-300' };
  return map[row.orbitType] ?? 'bg-gray-700/50 text-gray-300';
}

// ── Position calculation ───────────────────────────────────────────────────

function calcAllPositions() {
  const now = new Date();
  const next = {};
  // Only calculate for the visible page + a few pages ahead to avoid blocking
  const slice = store.filteredObjects.slice(page.value * PAGE_SIZE, (page.value + 3) * PAGE_SIZE);
  for (const o of slice) {
    const p = calcRaDec(o, now);
    if (p) next[o.name] = p;
  }
  Object.assign(positions.value, next);
}

async function refreshPositions() {
  positionRefreshing.value = true;
  await new Promise((r) => setTimeout(r, 0)); // yield to render
  calcAllPositions();
  positionRefreshing.value = false;
}

// ── Data loading ───────────────────────────────────────────────────────────

async function loadFile(event, source) {
  parseError.value = '';
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = '';

  try {
    let text;
    if (file.name.endsWith('.gz')) {
      const buf = await file.arrayBuffer();
      text = await decompressGzip(buf);
    } else {
      text = await file.text();
    }
    await parseAndStore(text, source);
  } catch (err) {
    parseError.value = `${t('plugins.orbitals.parseError')}: ${err.message}`;
  }
}

async function parseAndStore(text, source) {
  let parsed = [];
  if (source === 'MPC') parsed = parseMPCComets(text);
  else if (source === 'JPL') parsed = parseJPLComets(text);
  else if (source === 'JPL-num') parsed = parseJPLNumberedAsteroids(text);
  else if (source === 'JPL-unnum') parsed = parseJPLUnnumberedAsteroids(text);

  if (parsed.length === 0) {
    parseError.value = t('plugins.orbitals.parseEmpty');
    return;
  }

  if (source === 'MPC' || source === 'JPL') {
    store.mergeComets(parsed, source);
    showToast(t('plugins.orbitals.loaded', { n: parsed.length, src: source }));
  } else {
    store.setAsteroids(parsed, source);
    showToast(t('plugins.orbitals.loaded', { n: parsed.length, src: source }));
  }

  page.value = 0;
  await refreshPositions();
}

async function fetchWithProxy(url) {
  // Try direct fetch first; fall back with an informative error.
  const resp = await fetch(url, { mode: 'cors', cache: 'no-cache' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

async function fetchMPC() {
  if (loading.value.mpc) return;
  loading.value.mpc = true;
  parseError.value = '';
  try {
    const text = await fetchWithProxy(MPC_URL);
    await parseAndStore(text, 'MPC');
  } catch (err) {
    parseError.value = t('plugins.orbitals.fetchError', { url: 'MPC' });
  } finally {
    loading.value.mpc = false;
  }
}

async function fetchJPL() {
  if (loading.value.jpl) return;
  loading.value.jpl = true;
  parseError.value = '';
  try {
    const text = await fetchWithProxy(JPL_URL);
    await parseAndStore(text, 'JPL');
  } catch (err) {
    parseError.value = t('plugins.orbitals.fetchError', { url: 'JPL' });
  } finally {
    loading.value.jpl = false;
  }
}

// ── Search / filter ────────────────────────────────────────────────────────

function onSearch() {
  store.setFilter({ search: searchInput.value });
  page.value = 0;
  calcAllPositions();
}

// ── NINA actions ───────────────────────────────────────────────────────────

async function slewTo(row) {
  if (!row._pos || slewing.value) return;
  slewing.value = row.name;
  selectedName.value = row.name;
  try {
    await apiService.slewAndCenter(row._pos.ra, row._pos.dec, false, false, 0);
    showToast(t('plugins.orbitals.slewOk', { name: row.name }));
  } catch (err) {
    showToast(t('plugins.orbitals.slewError', { msg: err.message }), false);
  } finally {
    slewing.value = '';
  }
}

async function setTarget(row) {
  if (!row._pos) return;
  try {
    await apiService.sequnceTargetSet(row.name, row._pos.ra, row._pos.dec, 0, 0);
    showToast(t('plugins.orbitals.setTargetOk', { name: row.name }));
  } catch (err) {
    showToast(t('plugins.orbitals.setTargetError', { msg: err.message }), false);
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(async () => {
  await refreshPositions();
  // Recalculate every 60 seconds
  positionTimer = setInterval(refreshPositions, 60_000);
});

onUnmounted(() => {
  clearInterval(positionTimer);
  clearTimeout(toastTimer);
});
</script>
