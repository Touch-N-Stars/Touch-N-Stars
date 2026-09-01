<template>
  <div class="flex flex-col h-full min-h-0">
    <SubNav :items="tabItems" v-model:activeItem="activeTab" />

    <div class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
      <!-- ===================== BROWSE ===================== -->
      <template v-if="activeTab === 'browse'">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search comets & asteroids…"
          class="tns-input"
        />

        <div class="flex items-center gap-2">
          <button
            v-for="f in filterOptions"
            :key="f.value"
            class="shrink-0 px-3 py-1.5 rounded-chip text-xs font-semibold cursor-pointer transition-colors"
            :class="filter === f.value
              ? 'bg-accent/10 border border-accent/40 text-accent'
              : 'bg-transparent border border-line text-content-muted hover:bg-surface-2'"
            @click="filter = f.value"
          >
            {{ f.label }}
          </button>
          <span class="flex-1"></span>
          <span class="text-[11px] text-content-faint">Sorted by brightness</span>
        </div>

        <p v-if="objectsLoading" class="text-sm text-content-muted">Loading…</p>
        <p v-else-if="objectsError" class="text-sm text-status-danger">{{ objectsError }}</p>
        <p v-else-if="filteredObjects.length === 0" class="text-sm text-content-faint italic">
          No objects match.
        </p>

        <div class="space-y-2">
          <button
            v-for="o in filteredObjects"
            :key="o.id"
            class="tns-card w-full flex items-center gap-3 text-left cursor-pointer transition-colors"
            :class="o.id === selectedId ? 'border-accent/40 bg-accent/5' : 'hover:bg-surface-2'"
            @click="selectedId = o.id"
          >
            <div
              class="w-9 h-9 rounded-chip flex items-center justify-center shrink-0"
              :class="o.objectType === 'Comet' ? 'bg-violet-400/15' : 'bg-surface-3'"
            >
              <CometIcon v-if="o.objectType === 'Comet'" />
              <AsteroidIcon v-else />
            </div>
            <div class="flex flex-col gap-0.5 min-w-0 flex-1">
              <span class="text-sm font-bold text-content truncate">{{ o.name }}</span>
              <span class="text-[11px] text-content-muted">{{ o.objectType }}</span>
            </div>
            <div class="flex flex-col items-end gap-0.5 shrink-0">
              <span class="text-[15px] font-bold tabular-nums text-content">
                {{ o.magnitude != null ? o.magnitude.toFixed(1) : '—' }}
              </span>
              <span class="text-[9px] font-bold uppercase tracking-wide text-content-faint">mag</span>
            </div>
          </button>
        </div>
      </template>

      <!-- ===================== POSITION & PATH ===================== -->
      <template v-else-if="activeTab === 'position'">
        <p v-if="!selected" class="text-sm text-content-faint italic">
          Pick an object on the Browse tab first.
        </p>
        <template v-else>
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-card flex items-center justify-center shrink-0"
              :class="selected.objectType === 'Comet' ? 'bg-violet-400/15' : 'bg-surface-3'"
            >
              <CometIcon v-if="selected.objectType === 'Comet'" :size="20" />
              <AsteroidIcon v-else :size="20" />
            </div>
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="text-base font-bold text-content truncate">{{ selected.name }}</span>
              <span class="text-[11px] text-content-muted">{{ selected.objectType }}</span>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5">
              <span class="tns-stat-label">RA</span>
              <span class="text-[15px] font-bold tabular-nums text-content">{{ formatRaHours(selected.raHours) }}</span>
            </div>
            <div class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5">
              <span class="tns-stat-label">DEC</span>
              <span class="text-[15px] font-bold tabular-nums text-content">{{ formatDecDeg(selected.decDeg) }}</span>
            </div>
            <div class="bg-surface-2 rounded-chip px-3 py-2 flex flex-col justify-center gap-0.5">
              <span class="tns-stat-label">MAG</span>
              <span class="text-[15px] font-bold tabular-nums text-content">
                {{ selected.magnitude != null ? selected.magnitude.toFixed(1) : '—' }}
              </span>
            </div>
          </div>

          <div class="tns-card">
            <div class="flex items-center gap-2 mb-2">
              <span class="tns-stat-label flex-1">Tonight's Altitude</span>
              <span v-if="altAz" class="text-xs font-bold text-accent">
                {{ altAz.altitude.toFixed(0) }}° {{ altAz.altitude >= 0 ? 'above horizon' : 'below horizon' }}
                · Az {{ altAz.azimuth.toFixed(0) }}°
              </span>
            </div>
            <p v-if="!hasLocation" class="text-xs text-content-faint">
              No observer location set in this profile's Astrometry settings.
            </p>
            <SkyChart
              v-else
              :target="{ RA: selected.raHours * 15, Dec: selected.decDeg }"
              :coordinates="{ latitude: store.profileInfo.AstrometrySettings.Latitude, longitude: store.profileInfo.AstrometrySettings.Longitude }"
            />
            <p v-if="hasLocation" class="text-[11px] leading-relaxed text-content-faint mt-2">
              Uses {{ selected.name }}'s position right now for the whole night — real for a
              star, a slight approximation for a moving object, close enough for a transit curve.
            </p>
          </div>

          <div class="tns-card">
            <div class="flex items-center gap-3 mb-2">
              <span class="tns-stat-label flex-1">10-Night Path</span>
              <span class="flex items-center gap-1 text-[11px] text-content-muted">
                <span class="w-1.5 h-1.5 rounded-full bg-violet-400"></span>Path
              </span>
              <span class="flex items-center gap-1 text-[11px] text-content-muted">
                <span class="w-1.5 h-1.5 rounded-full bg-accent"></span>Tonight
              </span>
            </div>
            <p v-if="pathLoading" class="text-xs text-content-muted">Loading…</p>
            <p v-else-if="pathError" class="text-xs text-status-danger">{{ pathError }}</p>
            <OrbitalPathChart v-else-if="path.length" :points="path" />
            <p class="text-[11px] leading-relaxed text-content-muted mt-2">
              Real path against the fixed stars — while tracking, {{ selected.name }} stays
              centered in-frame all night; this shows motion night to night, not movement within
              a single exposure.
            </p>
          </div>
        </template>
      </template>

      <!-- ===================== TRACK ===================== -->
      <template v-else>
        <p v-if="!selected" class="text-sm text-content-faint italic">
          Pick an object on the Browse tab first.
        </p>
        <template v-else>
          <div class="tns-card flex flex-col gap-2">
            <span class="tns-stat-label">Status</span>
            <div class="flex items-center gap-2">
              <span class="tns-dot" :class="trackingMode !== 'idle' ? 'bg-status-ok' : 'bg-content-faint'"></span>
              <span
                class="text-xl font-bold"
                :class="trackingMode !== 'idle' ? 'text-status-ok' : 'text-content-muted'"
              >
                {{ statusLabel }}
              </span>
            </div>
            <span v-if="trackingMode !== 'idle'" class="text-xs text-content-muted">
              {{ selected.name }} · {{ selected.objectType }}
            </span>
          </div>

          <div v-if="actionStatus" class="tns-card" :class="actionStatus.ok ? 'border-status-ok/40' : 'border-status-danger/40'">
            <p class="text-xs" :class="actionStatus.ok ? 'text-status-ok' : 'text-status-danger'">
              {{ actionStatus.message }}
            </p>
          </div>

          <div v-if="trackingMode === 'idle'" class="flex flex-col gap-3">
            <div class="tns-card flex flex-col gap-2">
              <div class="flex items-center gap-2 mb-1">
                <span class="tns-stat-label flex-1">Imaging Plan</span>
                <span class="text-[10px] text-content-faint">for Add to Sequence only</span>
              </div>
              <label class="block">
                <span class="block text-[10px] text-content-faint mb-1">Filter — from connected wheel</span>
                <select v-model="exposureFilter" class="tns-select">
                  <option value="">Don't change filter</option>
                  <option v-for="f in store.filterInfo?.AvailableFilters ?? []" :key="f.Name" :value="f.Name">
                    {{ f.Name }}
                  </option>
                </select>
              </label>
              <div class="flex gap-2">
                <label class="flex-1">
                  <span class="block text-[10px] text-content-faint mb-1">Exposure (s)</span>
                  <input v-model.number="exposureSeconds" type="number" min="1" class="tns-input" />
                </label>
                <label class="flex-1">
                  <span class="block text-[10px] text-content-faint mb-1">Frames</span>
                  <input v-model.number="frameCount" type="number" min="1" class="tns-input" />
                </label>
              </div>
            </div>

            <div class="tns-card flex flex-col">
              <span class="tns-stat-label mb-2">Before You Start</span>
              <button
                class="flex items-center justify-between gap-3 py-2 cursor-pointer text-left"
                @click="guiding = !guiding"
              >
                <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span class="text-sm font-semibold text-content">Include guider shift rate</span>
                  <span class="text-[11px] text-content-muted leading-tight">
                    Needed if you guide — otherwise it fights this drift.
                  </span>
                </div>
                <span
                  class="relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors"
                  :class="guiding ? 'bg-accent/35' : 'bg-surface-3'"
                >
                  <span
                    class="inline-block h-[18px] w-[18px] transform rounded-full transition-transform"
                    :class="guiding ? 'translate-x-5 bg-accent' : 'translate-x-0.5 bg-content-muted'"
                  ></span>
                </span>
              </button>

              <button
                class="flex items-center justify-between gap-3 py-2 cursor-pointer text-left"
                @click="meridianFlip = !meridianFlip"
              >
                <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span class="text-sm font-semibold text-content">Include meridian flip trigger</span>
                  <span class="text-[11px] text-content-muted leading-tight">
                    Recommended on a GEM mount for anything running past the meridian.
                  </span>
                </div>
                <span
                  class="relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors"
                  :class="meridianFlip ? 'bg-accent/35' : 'bg-surface-3'"
                >
                  <span
                    class="inline-block h-[18px] w-[18px] transform rounded-full transition-transform"
                    :class="meridianFlip ? 'translate-x-5 bg-accent' : 'translate-x-0.5 bg-content-muted'"
                  ></span>
                </span>
              </button>

              <button
                class="flex items-center justify-between gap-3 py-2 cursor-pointer text-left"
                @click="autofocus = !autofocus"
              >
                <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span class="text-sm font-semibold text-content">Include autofocus trigger</span>
                  <span class="text-[11px] text-content-muted leading-tight">
                    Refocuses on a timer during the imaging loop.
                  </span>
                </div>
                <span
                  class="relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors"
                  :class="autofocus ? 'bg-accent/35' : 'bg-surface-3'"
                >
                  <span
                    class="inline-block h-[18px] w-[18px] transform rounded-full transition-transform"
                    :class="autofocus ? 'translate-x-5 bg-accent' : 'translate-x-0.5 bg-content-muted'"
                  ></span>
                </span>
              </button>
              <label v-if="autofocus" class="block pb-1">
                <span class="block text-[10px] text-content-faint mb-1">Every (minutes)</span>
                <input v-model.number="autofocusMinutes" type="number" min="1" class="tns-input" />
              </label>
            </div>

            <button class="tns-btn-primary" :disabled="actionBusy" @click="onAddToSequence">
              {{ actionBusy ? 'Working…' : 'Add to Sequence' }}
            </button>
            <button class="tns-btn-secondary" :disabled="actionBusy" @click="onQuickTrack">
              {{ actionBusy ? 'Working…' : 'Quick Track' }}
            </button>
            <p class="text-[11px] leading-relaxed text-content-faint">
              <strong class="text-content-muted">Add to Sequence</strong> builds a slew + track +
              imaging sequence and loads it into NINA's sequencer for you to review and start.
              <strong class="text-content-muted">Quick Track</strong> sets the mount's rate
              directly right now — for manual or visual use, not a substitute for a real imaging
              sequence.
            </p>
          </div>

          <button v-else class="tns-btn-danger" :disabled="actionBusy" @click="onStop">
            {{ actionBusy ? 'Working…' : stopButtonLabel }}
          </button>

          <p class="text-[11px] leading-relaxed text-content-faint text-center">
            Computed on-device from live orbital elements — works without an internet connection.
          </p>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, h } from 'vue';
import { storeToRefs } from 'pinia';
import SubNav from '@/components/SubNav.vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import { raDecToAltAz } from '@/utils/utils';
import { fetchBrowseObjects } from '../utils/fetchBrowseObjects';
import { fetchPath } from '../utils/fetchPath';
import { sendPerihelionSequence } from '../utils/sendPerihelionSequence';
import { startQuickTrack, stopQuickTrack } from '../utils/quickTrack';
import { usePerihelionStore } from '../store/perihelionStore';
import OrbitalPathChart from '../components/OrbitalPathChart.vue';
import SkyChart from '@/components/framing/SkyChart.vue';

const CometIcon = {
  props: { size: { type: Number, default: 16 } },
  render() {
    return h(
      'svg',
      { width: this.size, height: this.size, viewBox: '0 0 24 24', fill: 'none', stroke: '#a78bfa', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [
        h('circle', { cx: 9, cy: 9, r: 2.6 }),
        h('path', { d: 'M11 11l10 10' }),
        h('path', { d: 'M13.5 13.5l5-1.2' }),
        h('path', { d: 'M13.5 13.5l1.2 5' }),
      ]
    );
  },
};
const AsteroidIcon = {
  props: { size: { type: Number, default: 16 } },
  render() {
    return h(
      'svg',
      { width: this.size, height: this.size, viewBox: '0 0 24 24', fill: 'none', stroke: '#8fa3bf', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [h('path', { d: 'M9 3.5l6 1.3 4 4.6-1 6.4-5.2 4.7-6.4-1.6L4 13z' })]
    );
  },
};

const store = apiStore();
const perihelionStore = usePerihelionStore();
// Persisted across leaving/re-entering this tab (see perihelionStore.js's own doc comment for
// why plain local refs don't survive that) -- everything else below stays a local ref, since
// it's either re-fetched cheaply (objects, path) or purely transient UI feedback (actionStatus,
// actionBusy).
const {
  activeTab,
  selectedId,
  filter,
  searchQuery,
  exposureFilter,
  exposureSeconds,
  frameCount,
  guiding,
  meridianFlip,
  autofocus,
  autofocusMinutes,
  trackingMode,
} = storeToRefs(perihelionStore);

const tabItems = [
  { name: 'Browse', value: 'browse' },
  { name: 'Position & Path', value: 'position' },
  { name: 'Track', value: 'track' },
];

// --- Browse ---
const objects = ref([]);
const objectsLoading = ref(false);
const objectsError = ref(null);
const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Comets', value: 'Comet' },
  { label: 'Asteroids', value: 'Asteroid' },
];

async function loadObjects() {
  objectsLoading.value = true;
  objectsError.value = null;
  try {
    objects.value = await fetchBrowseObjects();
    if (!selectedId.value && objects.value.length) selectedId.value = objects.value[0].id;
  } catch (error) {
    objectsError.value = error?.message ?? 'Could not load objects from Perihelion';
  } finally {
    objectsLoading.value = false;
  }
}
onMounted(loadObjects);

const filteredObjects = computed(() => {
  let list = objects.value;
  if (filter.value !== 'all') list = list.filter((o) => o.objectType === filter.value);
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter((o) => o.name.toLowerCase().includes(q));
  }
  return list;
});

const selected = computed(() => objects.value.find((o) => o.id === selectedId.value) ?? null);

function formatRaHours(raHours) {
  const h = Math.floor(raHours);
  const m = (raHours - h) * 60;
  return `${h}h ${m.toFixed(1)}m`;
}
function formatDecDeg(decDeg) {
  const sign = decDeg < 0 ? '-' : '+';
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const m = (abs - d) * 60;
  return `${sign}${d}° ${m.toFixed(0)}′`;
}

// --- Position & Path ---
const hasLocation = computed(() => {
  const s = store.profileInfo?.AstrometrySettings;
  return s?.Latitude != null && s?.Longitude != null;
});
const altAz = computed(() => {
  if (!selected.value || !hasLocation.value) return null;
  const s = store.profileInfo.AstrometrySettings;
  // raDecToAltAz (src/utils/utils.js) expects RA in degrees; Perihelion returns decimal hours.
  return raDecToAltAz(selected.value.raHours * 15, selected.value.decDeg, s.Latitude, s.Longitude);
});

const path = ref([]);
const pathLoading = ref(false);
const pathError = ref(null);
async function loadPath() {
  if (!selected.value) return;
  pathLoading.value = true;
  pathError.value = null;
  try {
    path.value = await fetchPath({ objectType: selected.value.objectType, targetName: selected.value.name });
  } catch (error) {
    pathError.value = error?.response?.data?.Message ?? error?.message ?? 'Could not load path';
  } finally {
    pathLoading.value = false;
  }
}
watch([activeTab, selected], ([tab]) => {
  if (tab === 'position' && selected.value) loadPath();
});

// --- Track ---
// trackingMode: 'idle' | 'quick' | 'sequence' -- lives in perihelionStore, see above.
const actionBusy = ref(false);
const actionStatus = ref(null);

const statusLabel = computed(() => {
  if (trackingMode.value === 'sequence') return 'Sequence Running';
  if (trackingMode.value === 'quick') return 'Quick Tracking';
  return 'Idle';
});
const stopButtonLabel = computed(() => (trackingMode.value === 'sequence' ? 'Stop Sequence' : 'Stop Quick Track'));

async function onAddToSequence() {
  if (!selected.value) return;
  actionBusy.value = true;
  actionStatus.value = null;
  const result = await sendPerihelionSequence({
    objectType: selected.value.objectType.toLowerCase(),
    targetName: selected.value.name,
    raHours: selected.value.raHours,
    decDeg: selected.value.decDeg,
    guiding: guiding.value,
    meridianFlip: meridianFlip.value,
    autofocusMinutes: autofocus.value ? autofocusMinutes.value : null,
    exposure: {
      filterName: exposureFilter.value || null,
      exposureSeconds: exposureSeconds.value,
      frameCount: frameCount.value,
    },
  });
  actionStatus.value = result;
  actionBusy.value = false;
  // Deliberately stays 'idle' even on success -- Add to Sequence only loads the sequence, it
  // doesn't start it (see sendPerihelionSequence's own doc comment), so there's nothing here
  // for a "Stop Sequence" button to stop yet.
}

async function onQuickTrack() {
  if (!selected.value) return;
  actionBusy.value = true;
  actionStatus.value = null;
  const result = await startQuickTrack({
    objectType: selected.value.objectType.toLowerCase(),
    targetName: selected.value.name,
    guiding: guiding.value,
  });
  actionStatus.value = result;
  actionBusy.value = false;
  if (result.ok) trackingMode.value = 'quick';
}

async function onStop() {
  actionBusy.value = true;
  actionStatus.value = null;
  const result =
    trackingMode.value === 'sequence' ? await apiService.sequenceAction('stop') : await stopQuickTrack();
  actionStatus.value = { ok: !!(result?.Success ?? result?.ok), message: result?.Message ?? result?.message ?? 'Stopped' };
  actionBusy.value = false;
  trackingMode.value = 'idle';
}
</script>
