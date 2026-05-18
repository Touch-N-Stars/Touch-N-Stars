<template>
  <div class="px-4 py-6 lg:px-8">
    <div class="mx-auto flex max-w-6xl flex-col gap-6">

      <!-- Header -->
      <header class="rounded-2xl border border-gray-700/70 bg-gray-900/80 p-6 shadow-lg backdrop-blur">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 class="text-3xl font-semibold text-white">{{ t('plugins.orbitals.title') }}</h1>
            <p class="mt-1 text-sm text-gray-400">{{ t('plugins.orbitals.subtitle') }}</p>
          </div>
          <button @click="refreshAll" :disabled="refreshing"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800/50 px-3 py-2 text-sm text-gray-300 transition hover:bg-gray-700/60 disabled:opacity-50">
            <svg class="h-4 w-4" :class="{ 'animate-spin': refreshing }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            {{ t('plugins.orbitals.refresh') }}
          </button>
        </div>
      </header>

      <!-- Main tab bar -->
      <div class="flex rounded-xl border border-gray-700 bg-gray-900/80 p-1 gap-1">
        <button v-for="tab in mainTabs" :key="tab.id" @click="store.setActiveTab(tab.id)"
          :class="['flex-1 rounded-lg px-3 py-2 text-sm font-medium transition',
                   store.activeTab === tab.id ? 'bg-cyan-700 text-white' : 'text-gray-400 hover:text-white']">
          {{ tab.label }}
        </button>
      </div>

      <!-- ── SOLAR SYSTEM tab ─────────────────────────────────────────── -->
      <div v-show="store.activeTab === 'solarSystem'" class="contents">
        <div class="rounded-2xl border border-gray-700/70 bg-gray-900/80 shadow-lg backdrop-blur overflow-hidden">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-700/70 bg-gray-800/60">
              <tr>
                <th class="px-4 py-3 text-left font-semibold text-gray-300">{{ t('plugins.orbitals.colName') }}</th>
                <th class="px-3 py-3 text-right font-semibold text-gray-300">{{ t('plugins.orbitals.colRA') }}</th>
                <th class="px-3 py-3 text-right font-semibold text-gray-300">{{ t('plugins.orbitals.colDec') }}</th>
                <th class="px-3 py-3 text-right font-semibold text-gray-300">{{ t('plugins.orbitals.colDist') }}</th>
                <th class="px-4 py-3 text-right font-semibold text-gray-300">{{ t('plugins.orbitals.colActions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
              <tr v-for="body in solarSystemRows" :key="body.name"
                class="transition hover:bg-gray-800/50">
                <td class="px-4 py-3 font-medium text-white">{{ body.name }}</td>
                <td class="px-3 py-3 text-right font-mono text-xs text-gray-300">{{ body.pos ? formatRA(body.pos.ra) : '—' }}</td>
                <td class="px-3 py-3 text-right font-mono text-xs text-gray-300">{{ body.pos ? formatDec(body.pos.dec) : '—' }}</td>
                <td class="px-3 py-3 text-right text-xs text-gray-400">
                  {{ body.pos?.dist ? body.pos.dist.toFixed(3) + ' AU' : '—' }}
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button v-if="body.pos" @click="slewToPos(body.name, body.pos)" :disabled="slewing === body.name"
                      class="rounded-lg border border-indigo-700 bg-indigo-900/40 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-800/50 transition disabled:opacity-50">
                      {{ slewing === body.name ? '…' : t('plugins.orbitals.slew') }}
                    </button>
                    <button v-if="body.pos" @click="setTargetPos(body.name, body.pos)"
                      class="rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600/60 transition">
                      {{ t('plugins.orbitals.setTarget') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── JWST tab ────────────────────────────────────────────────── -->
      <div v-show="store.activeTab === 'jwst'" class="contents">
        <div class="rounded-2xl border border-gray-700/70 bg-gray-900/80 p-6 shadow-lg backdrop-blur flex flex-col gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex-1">
              <p class="text-sm font-medium text-white">James Webb Space Telescope</p>
              <p class="text-xs text-gray-400">
                {{ store.jwst
                    ? t('plugins.orbitals.jwstFetched', { d: fmtDate(store.jwst.fetchedAt) })
                    : t('plugins.orbitals.jwstNoData') }}
                <span v-if="store.jwst && !store.jwstValid" class="text-amber-400"> · {{ t('plugins.orbitals.jwstExpired') }}</span>
              </p>
            </div>
            <button @click="fetchJWST" :disabled="loadingJWST"
              class="rounded-lg border border-cyan-700 bg-cyan-900/40 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-800/50 transition disabled:opacity-50">
              {{ loadingJWST ? t('plugins.orbitals.fetching') : t('plugins.orbitals.jwstFetch') }}
            </button>
          </div>

          <p v-if="jwstError" class="rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-xs text-red-300">{{ jwstError }}</p>

          <div v-if="store.jwst" class="rounded-xl border border-gray-700 bg-gray-800/60 overflow-hidden">
            <table class="w-full text-sm">
              <thead class="border-b border-gray-700/70 bg-gray-800/80">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-300">{{ t('plugins.orbitals.colName') }}</th>
                  <th class="px-3 py-3 text-right font-semibold text-gray-300">{{ t('plugins.orbitals.colRA') }}</th>
                  <th class="px-3 py-3 text-right font-semibold text-gray-300">{{ t('plugins.orbitals.colDec') }}</th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-300">{{ t('plugins.orbitals.colActions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr class="transition hover:bg-gray-800/50">
                  <td class="px-4 py-3 font-medium text-white">JWST</td>
                  <td class="px-3 py-3 text-right font-mono text-xs text-gray-300">{{ formatRA(store.jwst.ra) }}</td>
                  <td class="px-3 py-3 text-right font-mono text-xs text-gray-300">{{ formatDec(store.jwst.dec) }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button @click="slewToPos('JWST', store.jwst)" :disabled="slewing === 'JWST'"
                        class="rounded-lg border border-indigo-700 bg-indigo-900/40 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-800/50 transition disabled:opacity-50">
                        {{ slewing === 'JWST' ? '…' : t('plugins.orbitals.slew') }}
                      </button>
                      <button @click="setTargetPos('JWST', store.jwst)"
                        class="rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600/60 transition">
                        {{ t('plugins.orbitals.setTarget') }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="text-xs text-gray-500">{{ t('plugins.orbitals.jwstNote') }}</p>
        </div>
      </div>

      <!-- ── ORBITAL OBJECTS tab ─────────────────────────────────────── -->
      <div v-show="store.activeTab === 'orbital'" class="contents">

        <!-- Background restore indicator (non-blocking) -->
        <div v-if="restoringAsteroids" class="flex items-center gap-3 rounded-xl border border-cyan-700/50 bg-cyan-900/20 px-4 py-3 text-sm text-cyan-300">
          <svg class="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          {{ t('plugins.orbitals.restoring') }}
        </div>

        <!-- Data sources -->
        <section class="rounded-2xl border border-gray-700/70 bg-gray-900/80 p-6 shadow-lg backdrop-blur">
          <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">{{ t('plugins.orbitals.dataSources') }}</h2>
          <div class="flex flex-col gap-3">

            <!-- MPC Comets -->
            <div class="flex flex-wrap items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-white">{{ t('plugins.orbitals.mpcComets') }}</p>
                <p class="text-xs text-gray-400">
                  {{ store.lastUpdated.mpcComets ? t('plugins.orbitals.lastUpdated', { d: fmtDate(store.lastUpdated.mpcComets) }) : t('plugins.orbitals.noData') }}
                  <span v-if="mpcCount"> · {{ mpcCount }} {{ t('plugins.orbitals.objects') }}</span>
                </p>
              </div>
              <label class="cursor-pointer rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600/60 transition">
                {{ t('plugins.orbitals.loadFile') }}
                <input type="file" accept=".txt" class="sr-only" @change="(e) => loadFile(e, 'MPC')" />
              </label>
              <button @click="fetchSource('MPC')" :disabled="loading.mpc"
                class="rounded-lg border border-cyan-700 bg-cyan-900/40 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-800/50 transition disabled:opacity-50">
                {{ loading.mpc ? fetchProgress('MPC') : t('plugins.orbitals.fetchOnline') }}
              </button>
            </div>

            <!-- JPL Comets -->
            <div class="flex flex-wrap items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-white">{{ t('plugins.orbitals.jplComets') }}</p>
                <p class="text-xs text-gray-400">
                  {{ store.lastUpdated.jplComets ? t('plugins.orbitals.lastUpdated', { d: fmtDate(store.lastUpdated.jplComets) }) : t('plugins.orbitals.noData') }}
                  <span v-if="jplCometCount"> · {{ jplCometCount }} {{ t('plugins.orbitals.objects') }}</span>
                </p>
              </div>
              <label class="cursor-pointer rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600/60 transition">
                {{ t('plugins.orbitals.loadFile') }}
                <input type="file" accept=".txt" class="sr-only" @change="(e) => loadFile(e, 'JPL')" />
              </label>
              <button @click="fetchSource('JPL')" :disabled="loading.jpl"
                class="rounded-lg border border-cyan-700 bg-cyan-900/40 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-800/50 transition disabled:opacity-50">
                {{ loading.jpl ? fetchProgress('JPL') : t('plugins.orbitals.fetchOnline') }}
              </button>
            </div>

            <!-- JPL Numbered Asteroids -->
            <div class="flex flex-wrap items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-white">{{ t('plugins.orbitals.jplNumAsteroids') }}</p>
                <p class="text-xs text-gray-400">
                  {{ asteroidsNum.length
                      ? `${asteroidsNum.length.toLocaleString()} ${t('plugins.orbitals.objects')} — ${t('plugins.orbitals.sessionOnly')}`
                      : t('plugins.orbitals.noData') }}
                </p>
              </div>
              <label class="cursor-pointer rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600/60 transition">
                {{ t('plugins.orbitals.loadFile') }} (.gz)
                <input type="file" accept=".gz" class="sr-only" @change="(e) => loadFile(e, 'JPL-num')" />
              </label>
              <button @click="fetchSource('JPL-num')" :disabled="loading.jplNum"
                class="rounded-lg border border-cyan-700 bg-cyan-900/40 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-800/50 transition disabled:opacity-50">
                {{ loading.jplNum ? fetchProgress('JPL-num') : t('plugins.orbitals.fetchOnline') }}
              </button>
            </div>

            <!-- JPL Unnumbered Asteroids -->
            <div class="flex flex-wrap items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-white">{{ t('plugins.orbitals.jplUnnumAsteroids') }}</p>
                <p class="text-xs text-gray-400">
                  {{ asteroidsUnnum.length
                      ? `${asteroidsUnnum.length.toLocaleString()} ${t('plugins.orbitals.objects')} — ${t('plugins.orbitals.sessionOnly')}`
                      : t('plugins.orbitals.noData') }}
                </p>
              </div>
              <label class="cursor-pointer rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600/60 transition">
                {{ t('plugins.orbitals.loadFile') }} (.gz)
                <input type="file" accept=".gz" class="sr-only" @change="(e) => loadFile(e, 'JPL-unnum')" />
              </label>
              <button @click="fetchSource('JPL-unnum')" :disabled="loading.jplUnnum"
                class="rounded-lg border border-cyan-700 bg-cyan-900/40 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-800/50 transition disabled:opacity-50">
                {{ loading.jplUnnum ? fetchProgress('JPL-unnum') : t('plugins.orbitals.fetchOnline') }}
              </button>
            </div>
          </div>

          <p v-if="parseError" class="mt-3 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-xs text-red-300">{{ parseError }}</p>
          <p v-if="fetchHint" class="mt-2 text-xs text-amber-400">{{ fetchHint }}</p>
        </section>

        <!-- Search box + dropdown -->
        <div class="relative">
          <div class="relative">
            <input
              v-model="searchQuery"
              @input="onSearchInput"
              @focus="onSearchFocus"
              @blur="onSearchBlur"
              type="search"
              :placeholder="hasCatalogData ? t('plugins.orbitals.searchPlaceholder') : t('plugins.orbitals.searchNoData')"
              :disabled="!hasCatalogData"
              class="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 pr-36 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
            />
            <span v-if="hasCatalogData" class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-600">
              {{ totalCatalogCount.toLocaleString() }} {{ t('plugins.orbitals.objects') }}
            </span>
          </div>

          <!-- Results dropdown -->
          <div v-if="showDropdown && searchQuery.length >= 2"
               class="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
            <div v-if="searchResults.length === 0" class="px-4 py-3 text-sm text-gray-500">
              {{ t('plugins.orbitals.noResults') }}
            </div>
            <button
              v-for="obj in searchResults" :key="obj.name + obj.source"
              @mousedown.prevent="selectObject(obj)"
              class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-gray-800"
            >
              <span class="min-w-0 flex-1 truncate text-white">{{ obj.name }}</span>
              <span :class="typeClass(obj)" class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">{{ typeLabel(obj) }}</span>
            </button>
          </div>
        </div>

        <!-- Selected object card -->
        <div v-if="selectedObject" class="rounded-2xl border border-cyan-700/40 bg-gray-900/80 p-6 shadow-lg backdrop-blur">
          <div class="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-semibold text-white">{{ selectedObject.name }}</h2>
              <span :class="typeClass(selectedObject)" class="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium">
                {{ typeFullName(selectedObject) }}
              </span>
            </div>
            <button @click="clearSelection" class="text-gray-500 transition hover:text-gray-300">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div v-if="selectedPos" class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div class="rounded-lg bg-gray-800/60 px-3 py-2">
              <p class="mb-0.5 text-xs text-gray-500">{{ t('plugins.orbitals.colRA') }}</p>
              <p class="font-mono text-sm text-gray-200">{{ formatRA(selectedPos.ra) }}</p>
            </div>
            <div class="rounded-lg bg-gray-800/60 px-3 py-2">
              <p class="mb-0.5 text-xs text-gray-500">{{ t('plugins.orbitals.colDec') }}</p>
              <p class="font-mono text-sm text-gray-200">{{ formatDec(selectedPos.dec) }}</p>
            </div>
            <div class="rounded-lg bg-gray-800/60 px-3 py-2">
              <p class="mb-0.5 text-xs text-gray-500">{{ t('plugins.orbitals.colDist') }}</p>
              <p class="font-mono text-sm text-gray-200">{{ selectedPos.dist.toFixed(4) }} AU</p>
            </div>
            <div v-if="selectedRates" class="rounded-lg bg-gray-800/60 px-3 py-2">
              <p class="mb-0.5 text-xs text-gray-500">{{ t('plugins.orbitals.raRate') }}</p>
              <p class="font-mono text-sm text-gray-200">{{ fmtRate(selectedRates.raRate) }}</p>
            </div>
            <div v-if="selectedRates" class="rounded-lg bg-gray-800/60 px-3 py-2">
              <p class="mb-0.5 text-xs text-gray-500">{{ t('plugins.orbitals.decRate') }}</p>
              <p class="font-mono text-sm text-gray-200">{{ fmtRate(selectedRates.decRate) }}</p>
            </div>
          </div>
          <div v-else class="mb-5 rounded-lg bg-gray-800/40 px-4 py-3 text-sm text-gray-500">
            {{ t('plugins.orbitals.calcError') }}
          </div>

          <div class="flex flex-wrap gap-3">
            <button @click="slewToSelected" :disabled="!!slewing"
              class="rounded-lg border border-indigo-700 bg-indigo-900/40 px-4 py-2 text-sm text-indigo-300 transition hover:bg-indigo-800/50 disabled:opacity-50">
              {{ slewing ? '…' : t('plugins.orbitals.slew') }}
            </button>
            <button @click="setTargetSelected"
              class="rounded-lg border border-gray-600 bg-gray-700/60 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-600/60">
              {{ t('plugins.orbitals.setTarget') }}
            </button>
          </div>
        </div>

      </div>

      <!-- Toast -->
      <Transition enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0 translate-y-2"
        enter-active-class="transition duration-200" leave-active-class="transition duration-200">
        <div v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur"
          :class="toast.ok ? 'border-green-700/50 bg-green-900/80 text-green-200' : 'border-red-700/50 bg-red-900/80 text-red-200'">
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
import { calcRaDec, calcShiftRates, formatRA, formatDec } from '../utils/orbital-mechanics.js';
import { calcSolarSystemRaDec, fetchJWSTPosition, SOLAR_SYSTEM_BODIES } from '../utils/solar-system.js';
import { saveAsteroidRaw, loadAsteroidRaw } from '../utils/idb-cache.js';
import { asteroidsNum, asteroidsUnnum } from '../utils/asteroid-index.js';
import axios from 'axios';
import apiService from '@/services/apiService';

const { t } = useI18n();
const store = useOrbitalsStore();

const SOURCE_URLS = {
  MPC:         'https://www.minorplanetcenter.net/iau/MPCORB/CometEls.txt',
  JPL:         'https://ssd.jpl.nasa.gov/dat/ELEMENTS.COMET',
  'JPL-num':   'https://ssd.jpl.nasa.gov/dat/ELEMENTS.NUMBR.gz',
  'JPL-unnum': 'https://ssd.jpl.nasa.gov/dat/ELEMENTS.UNNUM.gz',
};

// ── State ──────────────────────────────────────────────────────────────────
const loading            = ref({ mpc: false, jpl: false, jplNum: false, jplUnnum: false });
const loadingJWST        = ref(false);
const restoringAsteroids = ref(false);
const parseError         = ref('');
const fetchHint          = ref('');
const jwstError          = ref('');
const refreshing         = ref(false);
const slewing            = ref('');
const solarSystemPos     = ref({});
const downloadProgress   = ref({});
const toast              = ref(null);

// Search + selection
const searchQuery   = ref('');
const searchResults = ref([]);
const showDropdown  = ref(false);
const selectedObject = ref(null);
const selectedPos    = ref(null);
const selectedRates  = ref(null);

let posTimer    = null;
let toastTimer  = null;
let searchTimer = null;

// ── Computed ───────────────────────────────────────────────────────────────
const mainTabs = computed(() => [
  { id: 'orbital',     label: t('plugins.orbitals.tabOrbital') },
  { id: 'solarSystem', label: t('plugins.orbitals.tabSolarSystem') },
  { id: 'jwst',        label: 'JWST' },
]);

const hasCatalogData    = computed(() => store.comets.length > 0 || asteroidsNum.value.length > 0 || asteroidsUnnum.value.length > 0);
const totalCatalogCount = computed(() => store.comets.length + asteroidsNum.value.length + asteroidsUnnum.value.length);
const mpcCount          = computed(() => store.comets.filter(c => c.source === 'MPC').length);
const jplCometCount     = computed(() => store.comets.filter(c => c.source === 'JPL').length);
const solarSystemRows   = computed(() =>
  SOLAR_SYSTEM_BODIES.map(name => ({ name, pos: solarSystemPos.value[name] ?? null }))
);

// ── Helpers ────────────────────────────────────────────────────────────────
function showToast(msg, ok = true) {
  clearTimeout(toastTimer);
  toast.value = { msg, ok };
  toastTimer = setTimeout(() => { toast.value = null; }, 3500);
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString() : '';
}

function typeLabel(row) {
  if (row.type === 'asteroid') return 'A';
  const map = { P: 'P/', C: 'C/', D: 'D/', A: 'A/', X: 'X/', I: 'I/', J: 'JPL' };
  return map[row.orbitType] ?? row.orbitType ?? '?';
}

function typeFullName(row) {
  if (row.type === 'asteroid') return 'Asteroid';
  const map = { P: 'Periodic Comet', C: 'Non-periodic Comet', D: 'Defunct Comet', I: 'Interstellar Object' };
  return map[row.orbitType] ?? 'Comet';
}

function typeClass(row) {
  if (row.type === 'asteroid') return 'bg-amber-900/50 text-amber-300';
  const map = { P: 'bg-cyan-900/50 text-cyan-300', C: 'bg-blue-900/50 text-blue-300' };
  return map[row.orbitType] ?? 'bg-gray-700/50 text-gray-300';
}

// Rates in arcsec/min with sign
function fmtRate(r) {
  if (r == null) return '—';
  const sign = r >= 0 ? '+' : '';
  if (Math.abs(r) < 0.0001) return `${sign}${r.toExponential(2)}"/min`;
  return `${sign}${r.toFixed(4)}"/min`;
}

// ── Positions ──────────────────────────────────────────────────────────────
function calcSolarSystemPositions() {
  const now = new Date();
  const next = {};
  for (const name of SOLAR_SYSTEM_BODIES) {
    const p = calcSolarSystemRaDec(name, now);
    if (p) next[name] = p;
  }
  solarSystemPos.value = next;
}

function updateSelectedPos() {
  if (!selectedObject.value) { selectedPos.value = null; selectedRates.value = null; return; }
  const now = new Date();
  selectedPos.value  = calcRaDec(selectedObject.value, now);
  selectedRates.value = calcShiftRates(selectedObject.value, now);
}

async function refreshAll() {
  refreshing.value = true;
  await new Promise(r => setTimeout(r, 0));
  calcSolarSystemPositions();
  updateSelectedPos();
  refreshing.value = false;
}

// ── Search ─────────────────────────────────────────────────────────────────
function onSearchInput() {
  clearTimeout(searchTimer);
  showDropdown.value = true;
  searchTimer = setTimeout(runSearch, 300);
}

function onSearchFocus() {
  if (searchQuery.value.length >= 2) showDropdown.value = true;
}

function onSearchBlur() {
  setTimeout(() => { showDropdown.value = false; }, 150);
}

function runSearch() {
  const q = searchQuery.value.trim().toLowerCase();
  if (q.length < 2) { searchResults.value = []; return; }
  const results = [];
  for (const arr of [store.comets, asteroidsNum.value, asteroidsUnnum.value]) {
    for (const o of arr) {
      if (o.name.toLowerCase().includes(q)) { results.push(o); if (results.length >= 20) break; }
    }
    if (results.length >= 20) break;
  }
  searchResults.value = results;
}

function selectObject(obj) {
  selectedObject.value = obj;
  searchQuery.value    = obj.name;
  showDropdown.value   = false;
  searchResults.value  = [];
  updateSelectedPos();
}

function clearSelection() {
  selectedObject.value = null;
  selectedPos.value    = null;
  selectedRates.value  = null;
  searchQuery.value    = '';
}

// ── Worker ─────────────────────────────────────────────────────────────────
function parseInWorker(source, buf) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../utils/asteroid-worker.js', import.meta.url));
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.ok) resolve(data.parsed);
      else reject(new Error(data.error));
    };
    worker.onerror = (e) => { worker.terminate(); reject(e); };
    worker.postMessage({ source, buf }, [buf]);
  });
}

// ── File loading ───────────────────────────────────────────────────────────
async function loadFile(event, source) {
  parseError.value = '';
  fetchHint.value  = '';
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = '';
  try {
    const buf = await file.arrayBuffer();
    if (source === 'JPL-num' || source === 'JPL-unnum') {
      await saveAsteroidRaw(source, buf.slice(0));
    }
    const parsed = await parseInWorker(source, buf);
    storeAndRefresh(parsed, source);
  } catch (err) {
    parseError.value = `${t('plugins.orbitals.parseError')}: ${err.message}`;
  }
}

function storeAndRefresh(parsed, source) {
  if (!parsed.length) { parseError.value = t('plugins.orbitals.parseEmpty'); return; }
  if (source === 'MPC' || source === 'JPL') store.mergeComets(parsed, source);
  else if (source === 'JPL-num') { asteroidsNum.value = parsed; }
  else { asteroidsUnnum.value = parsed; }
  showToast(t('plugins.orbitals.loaded', { n: parsed.length.toLocaleString(), src: source }));
}

// ── Online fetch ───────────────────────────────────────────────────────────
const LOADING_KEY = { MPC: 'mpc', JPL: 'jpl', 'JPL-num': 'jplNum', 'JPL-unnum': 'jplUnnum' };

function fetchProgress(source) {
  return downloadProgress.value[source] || t('plugins.orbitals.fetching');
}

function setProgress(source, loaded, total) {
  const mb = (loaded / 1048576).toFixed(1);
  const val = total > 0 ? `${mb} MB — ${Math.round((loaded / total) * 100)}%` : `${mb} MB`;
  downloadProgress.value = { ...downloadProgress.value, [source]: val };
}

function clearProgress(source) {
  const prog = { ...downloadProgress.value };
  delete prog[source];
  downloadProgress.value = prog;
}

function getProxyUrl(remoteUrl) {
  const { API_URL } = apiService._getUrls ? apiService._getUrls() : (() => {
    const { protocol, hostname, port } = window.location;
    return { API_URL: `${protocol}//${hostname}:${port || 80}/api/` };
  })();
  return `${API_URL}proxy?url=${encodeURIComponent(remoteUrl)}`;
}

async function fetchSource(source) {
  const key = LOADING_KEY[source];
  if (loading.value[key]) return;
  loading.value[key] = true;
  parseError.value   = '';
  fetchHint.value    = '';
  setProgress(source, 0, 0);
  const remoteUrl = SOURCE_URLS[source];
  const proxyUrl  = getProxyUrl(remoteUrl);
  try {
    const response = await axios.get(proxyUrl, {
      responseType: 'arraybuffer',
      onDownloadProgress(evt) { setProgress(source, evt.loaded, evt.total ?? 0); },
    });
    const buf = response.data;
    if (source === 'JPL-num' || source === 'JPL-unnum') {
      await saveAsteroidRaw(source, buf.slice(0));
    }
    const parsed = await parseInWorker(source, buf);
    storeAndRefresh(parsed, source);
  } catch {
    parseError.value = t('plugins.orbitals.fetchError', { src: source });
    fetchHint.value  = t('plugins.orbitals.fetchHint', { url: remoteUrl });
  } finally {
    clearProgress(source);
    loading.value[key] = false;
  }
}

// ── JWST ───────────────────────────────────────────────────────────────────
async function fetchJWST() {
  if (loadingJWST.value) return;
  loadingJWST.value = true;
  jwstError.value   = '';
  try {
    const pos = await fetchJWSTPosition();
    store.setJWST(pos);
    showToast(t('plugins.orbitals.jwstOk'));
  } catch (err) {
    jwstError.value = t('plugins.orbitals.jwstError', { msg: err.message });
  } finally {
    loadingJWST.value = false;
  }
}

// ── NINA actions ───────────────────────────────────────────────────────────
async function slewToSelected() {
  if (!selectedObject.value || slewing.value) return;
  const pos = calcRaDec(selectedObject.value, new Date());
  if (pos) await slewToPos(selectedObject.value.name, pos);
}

async function setTargetSelected() {
  if (!selectedObject.value) return;
  const pos = calcRaDec(selectedObject.value, new Date());
  if (pos) await setTargetPos(selectedObject.value.name, pos);
}

async function slewToPos(name, pos) {
  if (!pos || slewing.value) return;
  slewing.value = name;
  try {
    await apiService.slewAndCenter(pos.ra, pos.dec, false, false, 0);
    showToast(t('plugins.orbitals.slewOk', { name }));
  } catch (err) {
    showToast(t('plugins.orbitals.slewError', { msg: err.message }), false);
  } finally {
    slewing.value = '';
  }
}

async function setTargetPos(name, pos) {
  if (!pos) return;
  try {
    await apiService.sequnceTargetSet(name, pos.ra, pos.dec, 0, 0);
    showToast(t('plugins.orbitals.setTargetOk', { name }));
  } catch (err) {
    showToast(t('plugins.orbitals.setTargetError', { msg: err.message }), false);
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(() => {
  calcSolarSystemPositions();
  posTimer = setInterval(() => {
    calcSolarSystemPositions();
    updateSelectedPos();
  }, 60_000);

  // Restore asteroid indexes from IDB — non-blocking; both sources are independent
  let restoreCount = 0;
  for (const source of ['JPL-num', 'JPL-unnum']) {
    const alreadyLoaded = source === 'JPL-num' ? asteroidsNum.value.length > 0 : asteroidsUnnum.value.length > 0;
    if (alreadyLoaded) continue;
    restoreCount++;
    restoringAsteroids.value = true;
    loadAsteroidRaw(source).then(async (cached) => {
      if (!cached) return;
      try {
        const parsed = await parseInWorker(cached.source, cached.buf);
        storeAndRefresh(parsed, cached.source);
      } catch {
        // corrupt cache — silently discard
      }
    }).catch(() => {}).finally(() => {
      restoreCount--;
      if (restoreCount === 0) restoringAsteroids.value = false;
    });
  }
});

onUnmounted(() => {
  clearInterval(posTimer);
  clearTimeout(toastTimer);
  clearTimeout(searchTimer);
});
</script>
