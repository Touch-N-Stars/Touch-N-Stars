<template>
  <div>
    <div class="p-4 md:p-6 space-y-4">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 class="text-xl font-semibold text-content">{{ tp('title') }}</h2>
          <p class="text-sm text-content-muted">
            {{ tp('subtitle') }}
          </p>
        </div>

        <button
          class="tns-btn-secondary w-auto! px-3 shrink-0"
          @click="refreshAll"
          :disabled="busy"
          :title="tp('tooltips.refreshFavorites')"
        >
          {{ tp('buttons.refresh') }}
        </button>
      </div>

      <!-- Location + global settings -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div class="tns-card">
          <div class="tns-stat-label mb-1">{{ tp('location.title') }}</div>

          <div v-if="hasSite" class="text-sm text-content">
            {{ fmtCoord(siteLat) }}, {{ fmtCoord(siteLon) }}
            <span v-if="siteAlt != null" class="text-content-muted">· {{ fmtAlt(siteAlt) }} m</span>
          </div>

          <div v-else class="text-sm text-content-muted">{{ tp('location.notAvailable') }}</div>
        </div>

        <div class="tns-card">
          <div class="tns-stat-label mb-2">{{ tp('filters.timeWindow') }}</div>

          <div class="grid grid-cols-2 gap-2">
            <label class="text-xs text-content-muted">
              {{ tp('filters.startLocal') }}
              <input class="tns-input mt-1" type="datetime-local" v-model="windowStartLocal" />
            </label>
            <label class="text-xs text-content-muted">
              {{ tp('filters.endLocal') }}
              <input class="tns-input mt-1" type="datetime-local" v-model="windowEndLocal" />
            </label>
          </div>

          <div class="mt-2 flex items-center justify-between gap-2">
            <label class="text-xs text-content-muted flex items-center gap-2">
              {{ tp('chart.sampleMin') }}
              <input
                class="tns-input w-20!"
                type="number"
                min="2"
                max="60"
                step="1"
                v-model.number="sampleMinutes"
              />
            </label>

            <div class="text-xs text-content-faint">
              {{ tp('chart.pointsFmt', { n: sampleCount }) }}
            </div>
          </div>
        </div>

        <div class="tns-card">
          <div class="tns-stat-label mb-2">{{ tp('performance.title') }}</div>

          <div class="flex items-center justify-between gap-2">
            <label class="text-xs text-content-muted">
              {{ tp('filters.limit') }}
              <input
                class="tns-input w-24!"
                type="number"
                min="5"
                max="200"
                step="1"
                v-model.number="limit"
              />
            </label>

            <label class="text-xs text-content-muted flex items-center gap-2">
              <span>{{ tp('cache.useNinaCache') }}</span>
              <toggleButton
                :status-value="useNinaCache"
                @click="useNinaCache = !useNinaCache"
                :title="tp('tooltips.useCacheHint')"
              />
            </label>
          </div>

          <div class="mt-3 flex items-center justify-between gap-2">
            <label class="text-xs text-content-muted flex items-center gap-2">
              <span>{{ tp('performance.lazyPreviews') }}</span>
              <toggleButton
                :status-value="lazyPreviews"
                @click="lazyPreviews = !lazyPreviews"
                :title="tp('tooltips.lazyVisibleOnly')"
              />
            </label>

            <label class="text-xs text-content-muted flex items-center gap-2">
              <span>{{ tp('filters.onlyAboveHorizon') }}</span>
              <toggleButton
                :status-value="onlyAboveHorizon"
                @click="onlyAboveHorizon = !onlyAboveHorizon"
                :title="tp('tooltips.filterNoBelowHorizon')"
              />
            </label>
          </div>

          <div class="mt-3 pt-3 border-t border-line">
            <div class="tns-stat-label mb-1">{{ tp('filters.moon') }}</div>
            <div class="text-sm text-content">
              <span v-if="moonIllumPct != null">{{
                tp('filters.moonIlluminatedFmt', { pct: moonIllumPct })
              }}</span>
              <span v-else class="text-content-faint">—</span>
              <span class="text-content-muted"> · </span>
              <span v-if="currentMoonData?.separationDeg != null">{{
                tp('chart.separationFmt', { deg: fmtNum(currentMoonData.separationDeg, 0) })
              }}</span>
              <span v-else class="text-content-faint">{{ tp('chart.separation') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="tns-card space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium text-content">{{ tp('filters.title') }}</div>
          <div class="flex items-center gap-3">
            <div class="text-xs text-content-muted">
              {{
                tp('filters.countFmt', {
                  filtered: filteredTargets.length,
                  total: targets.length,
                  shown: displayedTargets.length,
                })
              }}
            </div>
            <button
              class="tns-btn-secondary w-auto! px-3 shrink-0"
              @click="planerStore.resetFilters()"
            >
              {{ tp('common.reset') }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label class="text-xs text-content-muted">
            {{ tp('filters.search') }}
            <input
              class="tns-input mt-1"
              v-model="q"
              :placeholder="tp('filters.search_placeholder')"
            />
          </label>

          <label class="text-xs text-content-muted">
            {{ tp('filters.objectType') }}
            <select class="tns-select mt-1" v-model="typeFilter">
              <option value="">{{ tp('common.all') }}</option>
              <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
            </select>
          </label>

          <label class="text-xs text-content-muted">
            {{ tp('filters.azSector') }}
            <select
              class="tns-select mt-1"
              v-model="sectorFilter"
              :title="tp('tooltips.filterAzSector')"
            >
              <option value="">{{ tp('common.all') }}</option>
              <option v-for="s in sectorOptions" :key="s.value" :value="s.value">
                {{ s.label }}
              </option>
            </select>
          </label>

          <label class="text-xs text-content-muted">
            {{ tp('sort.title') }}
            <select class="tns-select mt-1" v-model="sortMode">
              <option value="maxAltDesc">{{ tp('sort.maxAltDesc') }}</option>
              <option value="bestTimeAsc">{{ tp('sort.bestTimeAsc') }}</option>
              <option value="nameAsc">{{ tp('sort.nameAZ') }}</option>
            </select>
          </label>
        </div>

        <div v-if="!hasSite" class="text-xs text-status-warn">
          {{ tp('location.hintNoLocation') }}
        </div>
      </div>

      <!-- {{ tp('sections.tonightPicks') }} (top 10 by Tonight-Score) -->
      <div v-if="tonightPicks.length" class="tns-card">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="tns-stat-label">{{ tp('sections.tonightPicks') }}</div>
            <div class="mt-0.5 text-sm text-content">{{ tp('sections.topForWindow') }}</div>
          </div>
          <div class="shrink-0 text-xs text-content-faint">
            {{ tp('sections.topFmt', { n: tonightPicks.length }) }}
          </div>
        </div>

        <div class="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          <button
            v-for="p in tonightPicks"
            :key="p._id"
            class="min-w-0 text-left px-3 py-2 rounded-control bg-surface-2 hover:bg-surface-3 border border-line text-content"
            @click="openInFramingAssistant(p)"
            :title="
              tp('tooltips.openFramingFmt', {
                ra: fmtRa(p.raDeg),
                dec: fmtDec(p.decDeg),
                maxAlt: fmtNum(p.maxAltDeg, 1),
              })
            "
          >
            <div class="flex items-center justify-between gap-2 min-w-0">
              <div class="min-w-0 flex-1 truncate font-semibold">{{ p.name }}</div>
              <div class="shrink-0 text-[11px] text-content-muted">
                {{ tonightLabel(p.tonightScore) }}
              </div>
            </div>
            <div class="mt-1 truncate text-[11px] text-content-muted">
              {{ tp('sort.maxAltWindow') }} {{ fmtNum(p.maxAltDeg, 1) }}° ·
              {{ tp('chart.visibleHoursFmt', { h: fmtNum(p.visibleHours, 1) }) }}
            </div>
          </button>
        </div>
      </div>

      <!-- Cards list -->
      <div class="space-y-3">
        <div
          v-for="t in displayedTargets"
          :key="t._id"
          :class="['tns-card space-y-3', isSelected(t) ? 'outline-2 outline-accent' : '']"
        >
          <!-- Band 1: header, full card width. min-w-0 on the row AND the title is
               what keeps a long name from pushing the row past its grid track. -->
          <div class="min-w-0">
            <div class="flex items-center gap-2 min-w-0">
              <span
                v-if="(t.tonightScore ?? 0) > 0"
                :class="[
                  'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  tonightChipClass(t.tonightScore),
                ]"
                :title="
                  tp('tooltips.tonightScoreFmt', {
                    score: fmtNum(t.tonightScore, 2),
                    maxAlt: fmtNum(t.maxAltDeg, 1),
                    hours: fmtNum(t.visibleHours, 1),
                  })
                "
              >
                {{ tonightLabel(t.tonightScore) }}
              </span>
              <span v-if="t.source === 'favorite'" class="shrink-0" :title="tp('tooltips.favorite')"
                >❤️</span
              >
              <h3 class="min-w-0 flex-1 truncate text-base font-semibold text-content">
                {{ t.name || tp('common.unnamedTarget') }}
              </h3>
            </div>

            <div class="mt-0.5 truncate text-xs text-content-muted">
              <span v-if="t.type">{{ t.type }}</span>
              <span v-if="t.type && (t.raDeg != null || t.decDeg != null)"> · </span>
              <span v-if="t.raDeg != null && t.decDeg != null"
                >RA {{ fmtRa(t.raDeg) }} · DEC {{ fmtDec(t.decDeg) }}</span
              >
            </div>
          </div>

          <!-- Band 2: preview in a fixed track, stats + chart take the rest -->
          <div class="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-3">
            <div
              class="relative w-full max-w-[280px] md:max-w-none mx-auto md:mx-0 aspect-square rounded-card overflow-hidden border border-line bg-surface-2"
            >
              <img
                v-if="t.previewUrl"
                :src="t.previewUrl"
                class="w-full h-full object-cover"
                @error="onPreviewError(t)"
              />

              <div
                v-if="!t.previewUrl && !t.previewError"
                class="absolute inset-0 flex items-center justify-center"
              >
                <div
                  class="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"
                />
              </div>

              <div
                v-else-if="t.previewError"
                class="absolute inset-0 flex items-center justify-center text-xs text-content-muted"
              >
                <div class="text-center px-4">
                  <div class="font-medium">{{ tp('preview.unavailable') }}</div>
                  <div class="text-content-faint mt-1">{{ t.previewError }}</div>
                </div>
              </div>

              <!-- w-12!/px-0! turn the tns-btn base (w-full px-4) into a round icon
                   button; the 48px height comes from its own min-h-touch. -->
              <button
                class="tns-btn-ghost absolute top-2 right-2 w-12! px-0! rounded-full"
                @click="reloadPreview(t)"
                :disabled="busyPreview[t._id]"
                :title="tp('preview.reload')"
                :aria-label="tp('preview.reload')"
              >
                <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': busyPreview[t._id] }" />
              </button>

              <button
                class="tns-btn-ghost absolute bottom-2 right-2 w-12! px-0! rounded-full"
                :title="tp('preview.info')"
                :aria-label="tp('preview.info')"
                @click="t._showHint = !t._showHint"
              >
                ?
              </button>
            </div>

            <div class="min-w-0 space-y-2">
              <div class="grid grid-cols-2 xl:grid-cols-4 gap-2">
                <div class="tns-stat-tile">
                  <div class="tns-stat-label">{{ tp('sort.maxAltWindow') }}</div>
                  <div class="tns-stat-value">
                    <span v-if="t.maxAltDeg != null">{{ fmtNum(t.maxAltDeg, 1) }}°</span>
                    <span v-else class="text-content-faint">—</span>
                  </div>
                </div>

                <div class="tns-stat-tile">
                  <div class="tns-stat-label">{{ tp('sort.bestTime') }}</div>
                  <div class="tns-stat-value">
                    <span v-if="t.bestTime">{{ fmtTime(t.bestTime) }}</span>
                    <span v-else class="text-content-faint">—</span>
                  </div>
                </div>

                <div class="tns-stat-tile">
                  <div class="tns-stat-label">{{ tp('chart.directionAz') }}</div>
                  <div class="tns-stat-value">
                    <span v-if="t.bestAzDeg != null" class="truncate"
                      >{{ fmtNum(t.bestAzDeg, 0) }}° ({{ azToCardinal(t.bestAzDeg) }})</span
                    >
                    <span v-else class="text-content-faint">—</span>
                  </div>
                </div>

                <div class="tns-stat-tile">
                  <div class="tns-stat-label">{{ tp('sort.visible') }}</div>
                  <div class="tns-stat-value">
                    <span v-if="t.maxAltDeg != null">
                      <span v-if="t.maxAltDeg > 0" class="text-status-ok">{{
                        tp('common.yes')
                      }}</span>
                      <span v-else class="text-status-danger">{{ tp('common.no') }}</span>
                    </span>
                    <span v-else class="text-content-faint">—</span>
                  </div>
                </div>
              </div>

              <div>
                <div class="tns-stat-label mb-1">{{ tp('chart.altitudeVsTime') }}</div>

                <SkyChart
                  v-if="hasSite && t.raDeg != null && t.decDeg != null"
                  :target="{ RA: t.raDeg, Dec: t.decDeg }"
                  :coordinates="{ latitude: siteLat, longitude: siteLon }"
                />
                <div
                  v-else
                  class="rounded-card border border-line bg-surface-2 p-2 h-40 flex items-center justify-center text-xs text-content-faint"
                >
                  {{ tp('location.notAvailable') }}
                </div>
              </div>
            </div>
          </div>

          <!-- Outside the preview frame: inside it the hint was clipped by overflow-hidden -->
          <div
            v-if="t._showHint"
            class="rounded-chip bg-surface-2 border border-line p-2 text-[11px] text-content-muted"
          >
            {{ tp('cache.hint') }}
          </div>

          <div v-if="t._error" class="text-xs text-status-danger break-words">
            {{ t._error }}
          </div>

          <!-- Band 3: actions, full card width. Only the icon carries the color code -
               four saturated fills per card compete with the content. -->
          <div class="grid grid-cols-2 xs:grid-cols-4 gap-2">
            <button
              class="tns-btn-secondary"
              @click="slewOnly(t)"
              :disabled="!canSlewWithMountSync(t) || isSelected(t)"
              :title="tp('buttons.slewNoCenter')"
              :aria-label="tp('buttons.slewNoCenter')"
            >
              <ArrowUpRightIcon class="w-5 h-5 shrink-0 text-accent" />
              <span>{{ tp('buttons.slew') }}</span>
            </button>

            <button
              class="tns-btn-secondary"
              @click="slewAndCenter(t)"
              :disabled="!canSlewWithMountSync(t) || isSelected(t)"
              :title="tp('buttons.slewCenterPlatesolve')"
              :aria-label="tp('buttons.slewCenterPlatesolve')"
            >
              <ViewfinderCircleIcon class="w-5 h-5 shrink-0 text-status-ok" />
              <span>{{ tp('buttons.center') }}</span>
            </button>

            <button
              class="tns-btn-secondary"
              @click="openInFramingAssistant(t)"
              :disabled="!canOpenFraming(t)"
              :title="tp('buttons.openFraming')"
              :aria-label="tp('buttons.openFraming')"
            >
              <RectangleGroupIcon class="w-5 h-5 shrink-0 text-content-muted" />
              <span>{{ tp('sections.framing') }}</span>
            </button>

            <button
              class="tns-btn-secondary"
              @click="sendToSequencer(t)"
              :disabled="
                !(
                  Array.isArray(sequenceStore.sequenceInfo) && sequenceStore.sequenceInfo.length > 0
                )
              "
              :title="tp('buttons.sendToSequencer')"
              :aria-label="tp('buttons.sendToSequencer')"
            >
              <QueueListIcon class="w-5 h-5 shrink-0 text-accent" />
              <span>{{ tp('buttons.seqShort') }}</span>
            </button>
          </div>

          <div v-if="mountMsg[t._id]" class="text-xs text-content-muted break-words">
            {{ mountMsg[t._id] }}
          </div>
          <div v-if="mountErr[t._id]" class="text-xs text-status-danger break-words">
            {{ mountErr[t._id] }}
          </div>
        </div>

        <div v-if="!targets.length && !busy" class="text-sm text-content-muted">
          {{ tp('empty.noFavorites') }}
        </div>

        <div v-if="busy" class="text-sm text-content-muted">{{ tp('common.loading') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiService from '../../../services/apiService';
import seedTargets from '../components/astro_targets_seed.json';
import SkyChart from '@/components/framing/SkyChart.vue';
import toggleButton from '@/components/helpers/toggleButton.vue';
import { useFramingStore } from '@/store/framingStore';
import { useSequenceStore } from '@/store/sequenceStore';
import { apiStore } from '@/store/store';
import { useObservationPlanerStore } from '../store/observationPlanerStore';
import { getMoonDataForTarget } from '@/utils/astronomy';
import { buildTrack, calculateTonightScore, parseDecDeg, parseRaHours } from '@/utils/tonightPicks';
import {
  ArrowPathIcon,
  ArrowUpRightIcon,
  ViewfinderCircleIcon,
  RectangleGroupIcon,
  QueueListIcon,
} from '@heroicons/vue/24/outline';
import { useLocationStore, ninaCoords } from '../../../utils/location';

// --------------------------
// Basic helpers
// --------------------------

const { t: tr } = useI18n();
const tp = (key, params) => tr(`observationPlaner.${key}`, params);
const router = useRouter();

// --------------------------
// State
// --------------------------

const framingStore = useFramingStore();
const locationStore = useLocationStore?.() ?? null;
const sequenceStore = useSequenceStore();
const store = apiStore();
const planerStore = useObservationPlanerStore();
const busy = ref(false);

const targets = ref([]); // merged list (favorites + seed)
const apiFavorites = ref([]); // raw favorites from API

// Persisted settings (survive navigation)
const {
  q,
  typeFilter,
  sectorFilter,
  sortMode,
  limit,
  sampleMinutes,
  onlyAboveHorizon,
  useNinaCache,
  lazyPreviews,
} = storeToRefs(planerStore);

// Window defaults: today evening -> tomorrow morning
const windowStart = ref(defaultStart());
const windowEnd = ref(defaultEnd());

// Global moon data for the current planning window.
// - illumination: evaluated at the window midpoint
// - separationDeg: shown for the selected target when available,
//   otherwise for the best "tonight pick", otherwise null
const currentMoonData = computed(() => {
  const midpoint = new Date((windowStart.value.getTime() + windowEnd.value.getTime()) / 2);
  const moonNow = getMoonDataForTarget(
    selectedMoonTarget.value?.raDeg ?? null,
    selectedMoonTarget.value?.decDeg ?? null,
    midpoint
  );
  return moonNow;
});

// Derived moon values (used in template to avoid unused-var warnings)
const moonIllumPct = computed(() => {
  const v = Number(currentMoonData.value?.illumination);
  return Number.isFinite(v) ? Math.round(v * 100) : null;
});

// datetime-local binding helpers
const windowStartLocal = computed({
  get: () => toLocalInputValue(windowStart.value),
  set: (v) => (windowStart.value = fromLocalInputValue(v) ?? windowStart.value),
});
const windowEndLocal = computed({
  get: () => toLocalInputValue(windowEnd.value),
  set: (v) => (windowEnd.value = fromLocalInputValue(v) ?? windowEnd.value),
});

const busyPreview = reactive({});
const mountMsg = reactive({});
const mountErr = reactive({});

// last target we acted on (avoid double-slew clicks + highlight)
const lastSelectedTarget = ref(null);
function selectTarget(t) {
  if (!t) return;
  lastSelectedTarget.value = {
    _id: t._id,
    name: t.name,
    raDeg: t.raDeg,
    decDeg: t.decDeg,
  };
}
const isSelected = (t) => isSameTarget(t, lastSelectedTarget.value);

// --------------------------
// Location (computed from your utils/store)
// --------------------------
const siteLat = computed(() => {
  const v = ninaCoords.value?.latitude;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
});
const siteLon = computed(() => {
  const v = ninaCoords.value?.longitude;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
});
const siteAlt = computed(() => {
  const v = ninaCoords.value?.elevation;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
});
const hasSite = computed(() => Number.isFinite(siteLat.value) && Number.isFinite(siteLon.value));

function toNumMaybe(v) {
  const n = typeof v === 'number' ? v : (v?.value ?? null);
  return Number.isFinite(n) ? n : null;
}

function fmtCoord(v, digits = 5) {
  const n = toNumMaybe(v);
  return n == null ? '—' : n.toFixed(digits);
}

function fmtAlt(v) {
  const n = toNumMaybe(v);
  return n == null ? '—' : n.toFixed(0);
}

function fmtNum(v, digits = 1) {
  const n = toNumMaybe(v);
  return n == null ? '—' : n.toFixed(digits);
}
// --------------------------
// Options
// --------------------------
const typeOptions = computed(() => {
  const set = new Set();
  for (const t of targets.value) if (t.type) set.add(t.type);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
});

const sectorOptions = [
  { value: 'N-NE', label: 'North → Northeast (315°–45°)' },
  { value: 'NE-E', label: 'Northeast → East (45°–90°)' },
  { value: 'E-SE', label: 'East → Southeast (90°–135°)' },
  { value: 'SE-S', label: 'Southeast → South (135°–180°)' },
  { value: 'S-SW', label: 'South → Southwest (180°–225°)' },
  { value: 'SW-W', label: 'Southwest → West (225°–270°)' },
  { value: 'W-NW', label: 'West → Northwest (270°–315°)' },
  { value: 'NW-N', label: 'Northwest → North (315°–360°)' },
];

const sampleCount = computed(() => {
  const ms = Math.max(1, sampleMinutes.value) * 60 * 1000;
  const n = Math.floor((windowEnd.value.getTime() - windowStart.value.getTime()) / ms) + 1;
  return Math.max(0, n);
});

// --------------------------
// Filtering + sorting
// --------------------------
const filteredTargets = computed(() => {
  const query = (q.value || '').trim().toLowerCase();
  const tf = typeFilter.value;
  const sf = sectorFilter.value;

  let arr = targets.value;

  if (query) {
    arr = arr.filter((t) => (t.name || '').toLowerCase().includes(query));
  }
  if (tf) {
    arr = arr.filter((t) => t.type === tf);
  }
  if (sf) {
    arr = arr.filter((t) => {
      if (t.bestAzDeg == null) return false;
      return azInSector(t.bestAzDeg, sf);
    });
  }
  if (onlyAboveHorizon.value) {
    arr = arr.filter((t) => t.maxAltDeg == null || t.maxAltDeg > 0);
  }

  // sort
  arr = [...arr];
  if (sortMode.value === 'maxAltDesc') {
    arr.sort((a, b) => (b.maxAltDeg ?? -999) - (a.maxAltDeg ?? -999));
  } else if (sortMode.value === 'bestTimeAsc') {
    arr.sort((a, b) => {
      const ta = a.bestTime ? new Date(a.bestTime).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.bestTime ? new Date(b.bestTime).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  } else if (sortMode.value === 'nameAsc') {
    arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
  return arr;
});

const displayedTargets = computed(() => {
  const lim = Math.max(1, limit.value || 20);
  return (filteredTargets.value || []).filter(Boolean).slice(0, lim);
});

const selectedMoonTarget = computed(() => {
  const selected = targets.value.find((t) => isSelected(t));
  if (selected?.raDeg != null && selected?.decDeg != null) return selected;

  const bestPick = tonightPicks.value?.[0];
  if (bestPick?.raDeg != null && bestPick?.decDeg != null) return bestPick;

  const firstDisplayed = displayedTargets.value?.find((t) => t?.raDeg != null && t?.decDeg != null);
  return firstDisplayed ?? null;
});

// --------------------------
// Lifecycle
// --------------------------
onMounted(async () => {
  // Load data first (API), then location, then compute tracks
  await loadFavorites();
  if (locationStore && store.isBackendReachable) {
    await locationStore.loadFromAstrometrySettings();
  }
  await recomputeAll();
});

// Preview blob URLs are owned by planerStore.previewCache and survive navigation;
// they are released only via reloadPreview / onPreviewError / store.clearAllPreviews.

// Recompute when location/time changes
watch([siteLat, siteLon, windowStart, windowEnd, sampleMinutes], async () => {
  await recomputeAll();
});

// Lazy-load previews whenever the relevant list changes (filters / limit / lazy toggle)
watch(
  () => {
    const source = lazyPreviews.value ? displayedTargets.value : filteredTargets.value;
    return (source || [])
      .filter(Boolean)
      .map((x) => x._id)
      .join('|');
  },
  async () => {
    await nextTick();
    const source = lazyPreviews.value ? displayedTargets.value : filteredTargets.value;
    for (const t of source) ensurePreview(t);
  }
);

// Toggle cache: reload visible previews (so you see immediate effect)
watch(
  () => useNinaCache.value,
  async () => {
    for (const t of displayedTargets.value) {
      await reloadPreview(t);
    }
  }
);

// --------------------------
// Actions
// --------------------------
async function refreshAll() {
  await loadFavorites();
  await recomputeAll();
}

async function loadFavorites() {
  busy.value = true;
  try {
    const res = await apiService.getAllFavorites();

    //console.log('[Planner] getAllFavorites raw:', res);

    const list = Array.isArray(res)
      ? res
      : (res?.Response ?? res?.data?.Response ?? res?.data ?? []);

    //console.log('[Planner] extracted list:', list);

    apiFavorites.value = list;

    // Keep targets as merged list for existing computed/template
    targets.value = mergedTargets.value;

    //console.log('[Planner] normalized targets:', targets.value);
  } catch (e) {
    console.error('[Planner] getAllFavorites failed', e);
    targets.value = [];
  } finally {
    busy.value = false;
  }
}

async function recomputeAll() {
  // Always base calculations on merged list
  targets.value = mergedTargets.value;

  // Recompute via immutable updates to keep Vue's VDOM stable
  if (!targets.value?.length) {
    return;
  }

  const hasLocation =
    hasSite.value && Number.isFinite(siteLat.value) && Number.isFinite(siteLon.value);

  targets.value = (targets.value || [])
    .filter((x) => x && typeof x === 'object' && x._id)
    .map((t) => {
      const nt = { ...t };

      nt._error = '';
      nt.track = null;
      nt.maxAltDeg = null;
      nt.bestTime = null;
      nt.bestAzDeg = null;
      nt.visibleHours = null;
      nt.tonightScore = 0;

      if (!hasLocation) return nt;
      if (nt.raDeg == null || nt.decDeg == null) return nt;

      try {
        const tr = buildTrack(
          nt.raDeg,
          nt.decDeg,
          windowStart.value,
          windowEnd.value,
          sampleMinutes.value,
          siteLat.value,
          siteLon.value
        );

        const samples = Array.isArray(tr?.samples)
          ? tr.samples
          : Array.isArray(tr?.points)
            ? tr.points
            : [];

        const smRaw = tr?.sampleMinutes ?? sampleMinutes.value ?? 5;
        const sm = Number.isFinite(smRaw) ? smRaw : Number(smRaw) || 5;

        nt.track = { ...tr, samples, sampleMinutes: sm };

        nt.maxAltDeg = tr.best?.altDeg ?? null;
        nt.bestTime = tr.best?.time ? tr.best.time.toISOString() : null;
        nt.bestAzDeg = tr.best?.azDeg ?? null;

        const MIN_ALT = 20;
        const visibleSamples = samples.filter((s) => (s?.altDeg ?? -999) >= MIN_ALT).length;
        nt.visibleHours = (visibleSamples * sm) / 60;

        nt.moonData = getMoonDataForTarget(nt.raDeg, nt.decDeg, tr.best?.time ?? windowStart.value);
        nt.tonightScore = calculateTonightScore(nt, nt.moonData);
      } catch (e) {
        nt._error = 'Track-calculation failed';
        console.warn('buildTrack failed:', e);
      }
      return nt;
    });
}

// Check if mount is connected before allowing slew/center actions

function canSlew(t) {
  return t?.raDeg != null && t?.decDeg != null;
}

function isMountConnectedSync() {
  return store.mountInfo?.Connected === true;
}

function canOpenFraming(t) {
  return canSlew(t);
}

function canSlewWithMountSync(t) {
  if (!canSlew(t)) return false;
  return isMountConnectedSync();
}

async function slewOnly(t) {
  selectTarget(t);
  mountErr[t._id] = '';
  mountMsg[t._id] = 'Slewing…';
  try {
    const resp = await apiService.slewAndCenter(t.raDeg, t.decDeg, false);
    mountMsg[t._id] = resp?.Response ?? 'Slew command sent';
  } catch (e) {
    mountMsg[t._id] = '';
    mountErr[t._id] = extractErr(e, 'Slew failed');
  }
}

async function slewAndCenter(t) {
  selectTarget(t);
  mountErr[t._id] = '';
  mountMsg[t._id] = 'Slew+Center…';
  try {
    const resp = await apiService.slewAndCenter(t.raDeg, t.decDeg, true);
    mountMsg[t._id] = resp?.Response ?? 'Slew+Center completed';
  } catch (e) {
    mountMsg[t._id] = '';
    mountErr[t._id] = extractErr(e, 'Slew+Center failed');
  }
}

async function openInFramingAssistant(t) {
  selectTarget(t);
  mountErr[t._id] = '';
  mountMsg[t._id] = 'Öffne Framing Assistant…';

  // Guard: valid coordinates required
  if (!t || !Number.isFinite(t.raDeg) || !Number.isFinite(t.decDeg)) {
    mountMsg[t?._id] = '';
    mountErr[t?._id] = 'invalid Coordinates (RA/DEC missing)';
    return;
  }

  try {
    // 1) Übergabe an Framing Assistant (lokal via Store)
    framingStore.RAangle = t.raDeg; // degrees
    framingStore.DECangle = t.decDeg; // degrees
    try {
      framingStore.targetName = t.name || '';
    } catch {}
    try {
      framingStore.rotation = t.rotation ?? 0;
    } catch {}

    // Optional: Backend synchronisieren
    try {
      await apiService.setFramingCoordinates(t.raDeg, t.decDeg);
    } catch {}

    // 2) open View
    router.push('/framing');

    mountMsg[t._id] = 'Framing Assistant is open';
  } catch (e) {
    mountMsg[t._id] = '';
    mountErr[t._id] = extractErr(e, 'Open framing failed');
  }
}

// --------------------------
// Sequencer integration
// --------------------------
function hasLoadedSequence(info) {
  return Array.isArray(info) && info.length > 0;
}

async function sendToSequencer(t) {
  mountErr[t._id] = '';
  mountMsg[t._id] = tp('status.sendingToSequencer');

  try {
    await sequenceStore.getSequenceInfo();

    if (!hasLoadedSequence(sequenceStore.sequenceInfo)) {
      mountMsg[t._id] = '';
      mountErr[t._id] = tp('errors.noSequenceAvailable'); // "No sequence available"
      return;
    }

    const rotation = t.rotation ?? 0;

    const r = await apiService.sequnceTargetSet(t.name || 'Target', t.raDeg, t.decDeg, rotation, 0);

    if (r?.apiSuccess === false) throw new Error(r.message || 'Sequencer failed');

    mountErr[t._id] = '';
    mountMsg[t._id] = tp('status.sequencerTargetSet');
  } catch (e) {
    mountMsg[t._id] = '';
    mountErr[t._id] = extractErr(e, tp('errors.sequencerFailed'));
  }
}

// --------------------------
// Preview loading (targetpic) — sequential queue so heavy NINA loads don't run in parallel
// --------------------------
const previewQueue = [];
let previewQueueRunning = false;

function ensurePreview(t) {
  if (!t || t.previewUrl || t.previewError) return;
  if (t.raDeg == null || t.decDeg == null) {
    t.previewError = 'no Coordinates';
    return;
  }
  // Seed from store cache so SPA navigation back skips the roundtrip
  const cached = planerStore.previewCache[t._id];
  if (cached) {
    t.previewUrl = cached;
    return;
  }
  if (previewQueue.includes(t)) return;
  previewQueue.push(t);
  runPreviewQueue();
}

async function runPreviewQueue() {
  if (previewQueueRunning) return;
  previewQueueRunning = true;
  try {
    while (previewQueue.length) {
      const t = previewQueue.shift();
      if (!t || t.previewUrl || t.previewError) continue;
      await loadPreview(t);
    }
  } finally {
    previewQueueRunning = false;
  }
}

async function reloadPreview(t) {
  if (!t) return;
  planerStore.clearPreview(t._id);
  t.previewUrl = '';
  t.previewError = '';
  await loadPreview(t);
}

async function loadPreview(t) {
  busyPreview[t._id] = true;
  t.previewError = '';
  try {
    // Dimensionen: so wie bei deinem Screenshot “square card”
    const width = 512;
    const height = 512;

    // FOV: ohne konkrete Optik nehmen wir einen sinnvollen Default (Grad)
    // (Wenn du später FOV aus Profile/Settings ziehen willst, einfach ersetzen.)
    const fov = 2.0;

    const url = await apiService.searchTargetPic(
      width,
      height,
      fov,
      t.raDeg,
      t.decDeg,
      useNinaCache.value
    );
    t.previewUrl = url;
    planerStore.setPreview(t._id, url);
  } catch (e) {
    t.previewUrl = '';
    t.previewError = extractErr(e, 'Preview load failed');
  } finally {
    busyPreview[t._id] = false;
  }
}

function onPreviewError(t) {
  t.previewError = 'could not load Image';
  planerStore.clearPreview(t._id);
  t.previewUrl = '';
}

// --------------------------
// Data normalization
// --------------------------
function normalizeFavorites(list) {
  const arr = Array.isArray(list) ? list : [];

  return arr.filter(Boolean).map((raw, idx) => {
    const name = raw?.name ?? raw?.Name ?? raw?.title ?? raw?.Title ?? raw?.TargetName ?? '';

    const type =
      raw?.type ?? raw?.Type ?? raw?.objectType ?? raw?.ObjectType ?? raw?.category ?? 'unknown';

    const raRaw =
      raw?.raDeg ??
      raw?.RADegrees ??
      raw?.RaDeg ??
      raw?.ra ??
      raw?.RA ??
      raw?.Ra ??
      raw?.RightAscensionDeg ??
      raw?.RightAscension ??
      raw?.RaString ??
      null;

    const decRaw =
      raw?.decDeg ??
      raw?.DecDeg ??
      raw?.dec ??
      raw?.DEC ??
      raw?.Dec ??
      raw?.DeclinationDeg ??
      raw?.Declination ??
      raw?.DecString ??
      null;

    // RA: numbers assumed degrees; strings assumed HMS (hours)
    let raDeg =
      typeof raRaw === 'number' ? (Number.isFinite(raRaw) ? raRaw : null) : parseRaHours(raRaw);

    // Dec: numbers assumed degrees; strings assumed DMS
    let decDeg =
      typeof decRaw === 'number' ? (Number.isFinite(decRaw) ? decRaw : null) : parseDecDeg(decRaw);

    // heuristic: if RA looks like hours (0..24) and no explicit deg field provided
    if (
      raDeg != null &&
      raDeg >= 0 &&
      raDeg <= 24 &&
      raw?.RADegrees == null &&
      raw?.raDeg == null &&
      raw?.RaDeg == null
    ) {
      raDeg = raDeg * 15.0;
    }

    const stableId =
      raw?.id ??
      raw?.Id ??
      raw?._id ??
      `fav-${idx}-${String(name).slice(0, 24)}-${raDeg ?? 'na'}-${decDeg ?? 'na'}`;

    return {
      _id: String(stableId),
      _raw: raw,

      name,
      type,

      raDeg,
      decDeg,

      previewUrl: '',
      previewError: '',
      _showHint: false,

      track: null,
      maxAltDeg: null,
      bestTime: null,
      bestAzDeg: null,
      visibleHours: null,
      tonightScore: 0,
      moonData: null,

      _error: '',
    };
  });
}

function makeStableFavoriteId(name, raDeg, decDeg) {
  const base = JSON.stringify({
    n: name ?? '',
    ra: raDeg ?? null,
    dec: decDeg ?? null,
  });
  return 'fav-' + hashString(base);
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// --------------------------
// Time helpers
// --------------------------
function defaultStart() {
  const now = new Date();
  const d = new Date(now);
  d.setHours(18, 0, 0, 0);
  // if already past 18:00, keep today; else today 18:00
  return d;
}
function defaultEnd() {
  const now = new Date();
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(6, 0, 0, 0);
  return d;
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function fromLocalInputValue(v) {
  if (!v) return null;
  const dt = new Date(v);
  return isNaN(dt.getTime()) ? null : dt;
}

function fmtTime(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtRa(raDeg) {
  // deg -> hh:mm
  const hours = (raDeg / 15 + 24) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function fmtDec(decDeg) {
  const sign = decDeg >= 0 ? '+' : '-';
  const a = Math.abs(decDeg);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  return `${sign}${String(d).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// --------------------------
// Seed + Favorites merge
// --------------------------
const seedData =
  seedTargets && seedTargets.targets ? seedTargets : (seedTargets?.default ?? seedTargets);

const seedTargetsNormalized = computed(() => {
  const arr = Array.isArray(seedData?.targets) ? seedData.targets : [];
  return arr.filter(Boolean).map((t, idx) => {
    const name = t?.name ?? t?.Name ?? t?.title ?? `Seed ${idx + 1}`;
    const type = t?.type ?? t?.Type ?? 'unknown';

    const raH = parseRaHours(t?.ra ?? t?.Ra ?? t?.RA ?? t?.RaString ?? null);
    const raDeg = raH == null ? null : raH * 15.0;
    const decDeg = parseDecDeg(t?.dec ?? t?.Dec ?? t?.DEC ?? t?.DecString ?? null);

    const stableId = t?.id ?? t?.Id ?? t?._id ?? makeStableFavoriteId(name, raDeg, decDeg);

    return {
      _id: String(stableId),
      _raw: t,
      name,
      type,
      raDeg,
      decDeg,
      source: 'seed',
      previewUrl: '',
      previewError: '',
      _showHint: false,
      track: null,
      maxAltDeg: null,
      bestTime: null,
      bestAzDeg: null,
      visibleHours: null,
      tonightScore: 0,
      moonData: null,
      _error: '',
    };
  });
});

const favoriteTargetsComputed = computed(() => normalizeFavorites(apiFavorites.value));

// --------------------------
// Merge (Favorites win)
// --------------------------
function mergeSeedAndFavorites(seedArr, favArr) {
  const out = Array.isArray(favArr) ? [...favArr] : [];
  const seeds = Array.isArray(seedArr) ? seedArr : [];

  for (const s of seeds) {
    if (!s || s.raDeg == null || s.decDeg == null) continue;

    const exists = out.some(
      (f) =>
        f &&
        f.raDeg != null &&
        f.decDeg != null &&
        Math.abs(f.raDeg - s.raDeg) < 0.05 &&
        Math.abs(f.decDeg - s.decDeg) < 0.05
    );

    if (!exists) out.push(s);
  }
  return out;
}

const mergedTargets = computed(() =>
  mergeSeedAndFavorites(seedTargetsNormalized.value, favoriteTargetsComputed.value)
);

// --------------------------
// Azimuth helpers
// --------------------------
function azInSector(azDeg, sector) {
  const az = ((azDeg % 360) + 360) % 360;

  const inRange = (a, from, to) => {
    // handles wrap-around
    if (from <= to) return a >= from && a < to;
    return a >= from || a < to;
  };

  switch (sector) {
    case 'N-NE':
      return inRange(az, 315, 360) || inRange(az, 0, 45);
    case 'NE-E':
      return inRange(az, 45, 90);
    case 'E-SE':
      return inRange(az, 90, 135);
    case 'SE-S':
      return inRange(az, 135, 180);
    case 'S-SW':
      return inRange(az, 180, 225);
    case 'SW-W':
      return inRange(az, 225, 270);
    case 'W-NW':
      return inRange(az, 270, 315);
    case 'NW-N':
      return inRange(az, 315, 360) || inRange(az, 0, 0.0001); // tiny wrap
    default:
      return true;
  }
}

function azToCardinal(azDeg) {
  const az = ((azDeg % 360) + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(az / 45) % 8;
  return dirs[idx];
}

const tonightPicks = computed(() =>
  targets.value
    .filter((t) => t.tonightScore > 0)
    .sort((a, b) => b.tonightScore - a.tonightScore)
    .slice(0, 10)
);
// --------------------------
// Error helper
// --------------------------
function extractErr(e, fallback) {
  const msg =
    e?.response?.data?.Error ||
    e?.response?.data?.message ||
    e?.response?.data?.Response ||
    e?.message ||
    '';
  return msg ? String(msg) : fallback;
}

function tonightKey(score) {
  if (score >= 3.0) return 'excellent';
  if (score >= 2.0) return 'veryGood';
  if (score >= 1.0) return 'good';
  if (score >= 0.5) return 'difficult';
  return 'skip';
}

function tonightLabel(score) {
  return tp(`score.${tonightKey(score)}`);
}

// Chip tint per score bucket, so the badge reads at a glance without four
// saturated fills competing in every card.
function tonightChipClass(score) {
  switch (tonightKey(score)) {
    case 'excellent':
    case 'veryGood':
      return 'bg-status-ok/15 text-status-ok';
    case 'good':
      return 'bg-accent/15 text-accent';
    case 'difficult':
      return 'bg-status-warn/15 text-status-warn';
    default:
      return 'bg-surface-3 text-content-faint';
  }
}
function isSameTarget(a, b, tolDeg = 0.05) {
  if (a?.raDeg == null || a?.decDeg == null) return false;
  if (b?.raDeg == null || b?.decDeg == null) return false;

  return Math.abs(a.raDeg - b.raDeg) <= tolDeg && Math.abs(a.decDeg - b.decDeg) <= tolDeg;
}
</script>
