<template>
  <div class="px-4 py-6 lg:px-8">
    <div class="mx-auto max-w-3xl space-y-6">
      <!-- Header -->
      <header
        class="rounded-2xl border border-gray-700/70 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-5 shadow-lg backdrop-blur"
      >
        <h1 class="text-2xl font-bold text-white">{{ $t('plugins.filterOffset.title') }}</h1>
        <p class="mt-1 text-sm text-gray-400">{{ $t('plugins.filterOffset.subtitle') }}</p>
      </header>

      <!-- ── Setup section (visible when Idle / Error) ─────────────────────── -->
      <section v-if="status.State === 'Idle' || status.State === 'Error'" class="space-y-4">
        <!-- Iterations -->
        <div class="space-y-3 rounded-xl border border-gray-700/70 bg-gray-900/50 p-4">
          <div class="flex items-center gap-4">
            <label class="w-40 shrink-0 text-sm text-gray-300">
              {{ $t('plugins.filterOffset.iterations') }}
            </label>
            <input
              v-model.number="loops"
              type="number"
              min="1"
              max="20"
              class="w-24 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-center text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <!-- Outlier rejection needs 3 samples before it can discard anything, so anything less
               silently averages a bad AutoFocus into the result. -->
          <p v-if="loops < 3" class="text-xs leading-relaxed text-amber-300/90">
            {{ $t('plugins.filterOffset.tooFewIterations') }}
          </p>
        </div>

        <!-- Filter selection table -->
        <div class="rounded-xl border border-gray-700/70 bg-gray-900/50 p-4">
          <h2 class="mb-3 text-sm font-semibold text-gray-300">
            {{ $t('plugins.filterOffset.selectFilters') }}
          </h2>

          <div v-if="filters.length === 0" class="py-8 text-center text-gray-500">
            {{ $t('plugins.filterOffset.noFilters') }}
          </div>

          <table v-else class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-700 text-left text-xs text-gray-400">
                <th class="pb-2 pr-4 font-medium">{{ $t('plugins.filterOffset.calculate') }}</th>
                <th class="pb-2 pr-4 font-medium">{{ $t('plugins.filterOffset.position') }}</th>
                <th class="pb-2 font-medium">{{ $t('plugins.filterOffset.filter') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="f in filters"
                :key="f.position"
                class="border-b border-gray-800/50 last:border-0"
              >
                <td class="py-2 pr-4">
                  <input
                    type="checkbox"
                    :checked="selectedPositions.includes(f.position)"
                    @change="toggleFilter(f.position)"
                    class="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-blue-500"
                  />
                </td>
                <td class="py-2 pr-4 text-gray-400">{{ f.position }}</td>
                <td class="py-2 text-white">{{ f.name }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Error message -->
        <div
          v-if="status.State === 'Error'"
          class="rounded-xl border border-red-700/50 bg-red-900/30 p-4 text-sm text-red-300"
        >
          {{ $t('plugins.filterOffset.errorLabel') }}: {{ status.Error }}
        </div>

        <!-- What the failed run managed to measure before it died — kept by the backend on error
             precisely because that is when it is worth reading. -->
        <MeasurementBoard
          v-if="status.State === 'Error' && (status.Measurements ?? []).length"
          :measurements="status.Measurements"
          :total-loops="status.TotalLoops"
        />

        <!-- Connection warnings -->
        <div v-if="connectionWarnings.length" class="space-y-1">
          <div
            v-for="(warn, i) in connectionWarnings"
            :key="'cw' + i"
            class="rounded-lg bg-amber-900/40 px-4 py-2 text-center text-sm text-amber-200"
          >
            {{ warn }}
          </div>
        </div>

        <!-- Validation issues -->
        <div v-if="issues.length" class="space-y-1">
          <div
            v-for="(issue, i) in issues"
            :key="i"
            class="rounded-lg bg-red-900/40 px-4 py-2 text-center text-sm text-red-200"
          >
            {{ issue }}
          </div>
        </div>

        <!-- Start button -->
        <button
          :disabled="
            selectedPositions.length < 2 ||
            loading ||
            !store.isCameraConnected ||
            !store.isFocuserConnected ||
            !store.isFilterConnected
          "
          class="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          @click="startCalculation"
        >
          {{ $t('plugins.filterOffset.start') }}
        </button>
      </section>

      <!-- ── Running section ────────────────────────────────────────────────── -->
      <section v-else-if="status.State === 'Running'" class="space-y-4">
        <div class="rounded-xl border border-blue-700/50 bg-blue-900/20 p-5 space-y-4">
          <!-- Loop progress -->
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-300">{{ $t('plugins.filterOffset.loop') }}</span>
            <span class="font-mono text-white">
              {{ status.CurrentLoop }} / {{ status.TotalLoops }}
            </span>
          </div>
          <div class="h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              class="h-full rounded-full bg-blue-500 transition-all"
              :style="{ width: loopProgressPct + '%' }"
            />
          </div>

          <!-- Filter progress -->
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-300">{{ $t('plugins.filterOffset.filterProgress') }}</span>
            <span class="font-mono text-white">
              {{ status.CurrentFilterIndex }} / {{ status.TotalFilters }}
            </span>
          </div>
          <div class="h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              class="h-full rounded-full bg-green-500 transition-all"
              :style="{ width: filterProgressPct + '%' }"
            />
          </div>

          <!-- Current filter name -->
          <p v-if="status.CurrentFilterName" class="text-center text-sm text-gray-300">
            {{ $t('plugins.filterOffset.runningFilter') }}:
            <span class="font-semibold text-white">{{ status.CurrentFilterName }}</span>
          </p>
        </div>

        <!-- Per-iteration AutoFocus results, filling in as the run progresses. Withheld until there
             is something in it, which also keeps a permanently empty panel off the screen when the
             frontend is newer than the plugin and no measurements are ever sent. -->
        <MeasurementBoard
          v-if="(status.Measurements ?? []).length"
          :measurements="status.Measurements"
          :total-loops="status.TotalLoops"
        />

        <!-- Stop button -->
        <button
          class="w-full rounded-xl bg-red-700 px-6 py-3 font-semibold text-white transition hover:bg-red-600"
          @click="stopCalculation"
        >
          {{ $t('plugins.filterOffset.stop') }}
        </button>
      </section>

      <!-- ── Result / pending dialog section ───────────────────────────────── -->
      <section v-else-if="status.State === 'PendingResult' && result" class="space-y-5">
        <!-- Without the base filter there is nothing to state the others against, so every offset
             below is 0 — which otherwise looks like a real result. -->
        <div
          v-if="result.BaseFilterUnmeasured"
          class="rounded-xl border border-red-700/50 bg-red-900/30 p-4 text-sm leading-relaxed text-red-300"
        >
          {{ $t('plugins.filterOffset.baseFilterUnmeasured') }}
        </div>

        <!-- Old / New offsets side by side -->
        <div class="grid grid-cols-2 gap-4">
          <!-- Old offsets -->
          <div class="rounded-xl border border-gray-700/70 bg-gray-900/50 p-4">
            <h3 class="mb-3 text-sm font-semibold text-gray-300">
              {{ $t('plugins.filterOffset.currentOffsets') }}
            </h3>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-700 text-xs text-gray-400">
                  <th class="pb-2 pr-2 font-medium text-left">
                    {{ $t('plugins.filterOffset.position') }}
                  </th>
                  <th class="pb-2 pr-2 font-medium text-left">
                    {{ $t('plugins.filterOffset.filter') }}
                  </th>
                  <th class="pb-2 font-medium text-right">
                    {{ $t('plugins.filterOffset.offset') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="o in result.OldOffsets"
                  :key="o.Position"
                  class="border-b border-gray-800/50 last:border-0"
                >
                  <td class="py-1.5 pr-2 text-gray-400">{{ o.Position }}</td>
                  <td class="py-1.5 pr-2 text-white">{{ o.Name }}</td>
                  <td class="py-1.5 text-right font-mono text-gray-300">{{ o.FocusOffset }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- New offsets -->
          <div class="rounded-xl border border-green-700/50 bg-green-900/10 p-4">
            <h3 class="mb-3 text-sm font-semibold text-green-300">
              {{ $t('plugins.filterOffset.newOffsets') }}
            </h3>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-700 text-xs text-gray-400">
                  <th class="pb-2 pr-2 font-medium text-left">
                    {{ $t('plugins.filterOffset.position') }}
                  </th>
                  <th class="pb-2 pr-2 font-medium text-left">
                    {{ $t('plugins.filterOffset.filter') }}
                  </th>
                  <th class="pb-2 font-medium text-right">
                    {{ $t('plugins.filterOffset.offset') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="o in displayedNewOffsets"
                  :key="o.Position"
                  class="border-b border-gray-800/50 last:border-0"
                >
                  <td class="py-1.5 pr-2 text-gray-400">{{ o.Position }}</td>
                  <td class="py-1.5 pr-2 text-white">{{ o.Name }}</td>
                  <!-- Same convention as MeasurementBoard: green only for offsets measured this run -->
                  <td
                    class="py-1.5 text-right font-mono"
                    :class="o.measured ? 'text-green-200' : 'text-gray-500'"
                    :title="o.measured ? '' : $t('plugins.filterOffset.notMeasured')"
                  >
                    {{ o.FocusOffset }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- What the offsets above were computed from. The offsets are handed in rather than taken
             from the details, so the board's last column is the same number as the table above it:
             the details carry the run's own base-filter anchoring, which differs by a constant from
             the anchoring the user picks in the dropdown. -->
        <MeasurementBoard
          v-if="(status.Measurements ?? []).length"
          :measurements="status.Measurements"
          :details="result.Details ?? []"
          :offsets="displayedNewOffsets"
          :total-loops="status.TotalLoops"
          :temperature-drift="result.TemperatureDrift ?? 0"
        />

        <!-- Old AutoFocus filter -->
        <div
          class="flex items-center gap-4 rounded-xl border border-gray-700/70 bg-gray-900/50 px-5 py-3"
        >
          <span class="flex-1 text-sm text-gray-400">{{
            $t('plugins.filterOffset.currentAutoFocusFilter')
          }}</span>
          <span class="text-sm text-white">{{
            oldDefaultFilterName || $t('plugins.filterOffset.none')
          }}</span>
        </div>

        <!-- New AutoFocus filter selector -->
        <div
          class="flex items-center gap-4 rounded-xl border border-gray-700/70 bg-gray-900/50 px-5 py-3"
        >
          <label class="flex-1 shrink-0 text-sm text-gray-300">
            {{ $t('plugins.filterOffset.newAutoFocusFilter') }}
          </label>
          <select
            v-model="newDefaultFilterPosition"
            class="w-40 rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option :value="null">{{ $t('plugins.filterOffset.none') }}</option>
            <!-- Every filter in the profile, not just the calibrated ones: keeping an AutoFocus
                 filter that was left out of this run is a legitimate choice. -->
            <option v-for="f in filters" :key="f.position" :value="f.position">
              {{ f.name }}
            </option>
          </select>
        </div>

        <!-- Apply error -->
        <div
          v-if="applyError"
          class="rounded-xl border border-red-700/50 bg-red-900/30 p-4 text-sm text-red-300"
        >
          {{ $t('plugins.filterOffset.errorLabel') }}: {{ applyError }}
        </div>

        <!-- Accept / Abort buttons. Accepting an all-zero result is never what anyone wants: it does
             not merely fail to improve the profile, it flattens the real offsets of every filter the
             run covered, and the banner above is easy to tap past on a phone. Discard stays open. -->
        <div class="grid grid-cols-2 gap-3">
          <button
            class="rounded-xl bg-green-700 px-6 py-3 font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="loading || result.BaseFilterUnmeasured"
            :title="
              result.BaseFilterUnmeasured ? $t('plugins.filterOffset.baseFilterUnmeasured') : ''
            "
            @click="applyResult"
          >
            {{ $t('plugins.filterOffset.accept') }}
          </button>
          <button
            class="rounded-xl border border-gray-600 bg-gray-800 px-6 py-3 font-semibold text-gray-200 transition hover:bg-gray-700"
            :disabled="loading"
            @click="discardResult"
          >
            {{ $t('plugins.filterOffset.abort') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { usePolling } from '@/composables/usePolling';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { getActivePinia } from 'pinia';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import MeasurementBoard from '../components/MeasurementBoard.vue';

const { t } = useI18n();
const store = apiStore();
const toastStore = useToastStore();

// ── API base URL ────────────────────────────────────────────────────────────
function getApiUrl() {
  const pinia = getActivePinia();
  const settings = pinia?._s.get('settings');
  const protocol = settings?.backendProtocol || 'http';
  const host = settings?.connection?.ip || window.location.hostname;
  const port = settings?.connection?.port || window.location.port || 80;
  return `${protocol}://${host}:${port}/api`;
}

// ── Reactive state ──────────────────────────────────────────────────────────
const filters = ref([]);
const selectedPositions = ref([]);
const loops = ref(3);
const loading = ref(false);

const status = ref({
  State: 'Idle',
  CurrentLoop: 0,
  TotalLoops: 0,
  CurrentFilterIndex: 0,
  TotalFilters: 0,
  CurrentFilterName: '',
  Error: '',
  Measurements: [],
});

const result = ref(null);
const newDefaultFilterPosition = ref(null);
const applyError = ref('');

const issues = ref([]);

// ── Connection warnings (computed, no state) ────────────────────────────────
const connectionWarnings = computed(() => {
  const warns = [];
  if (!store.isCameraConnected)
    warns.push(
      t('plugins.filterOffset.notConnected', { device: t('plugins.filterOffset.deviceCamera') })
    );
  if (!store.isFocuserConnected)
    warns.push(
      t('plugins.filterOffset.notConnected', { device: t('plugins.filterOffset.deviceFocuser') })
    );
  if (!store.isFilterConnected)
    warns.push(
      t('plugins.filterOffset.notConnected', {
        device: t('plugins.filterOffset.deviceFilterWheel'),
      })
    );
  return warns;
});

const statusPoller = usePolling(() => fetchStatus(), 2000, {
  autoStart: false,
  immediate: false,
});

// ── Computed ────────────────────────────────────────────────────────────────
const loopProgressPct = computed(() => {
  if (!status.value.TotalLoops) return 0;
  return Math.round((status.value.CurrentLoop / status.value.TotalLoops) * 100);
});

const filterProgressPct = computed(() => {
  if (!status.value.TotalFilters) return 0;
  return Math.round((status.value.CurrentFilterIndex / status.value.TotalFilters) * 100);
});

/**
 * The offsets as they will actually be written — a mirror of the backend's BuildOffsetTable. The two
 * must agree, or the preview shows one set of numbers while a different set reaches the profile.
 *
 * Every filter in the profile appears, stated relative to the one selected as the AutoFocus filter,
 * which comes out at 0. Only the spacing between filters affects a focuser move, so where the set is
 * zeroed is free — and zeroing it on the AutoFocus filter is the reading that matches the equipment,
 * since that is the filter AutoFocus runs through.
 *
 * A filter that was not calibrated this run keeps its previous distance to the base filter. Only
 * differences of the previous offsets are used, never a previous offset by itself, so a profile left
 * holding absolute focuser positions by an older build still comes out clean.
 */
const displayedNewOffsets = computed(() => {
  const measured = result.value?.NewOffsets ?? [];
  if (!measured.length || !filters.value.length) {
    return measured.map((o) => ({ ...o, measured: o.Measured !== false }));
  }

  const measuredByPosition = new Map(measured.map((o) => [o.Position, o]));
  const basePosition = measured[0].Position;
  const baseMeasured = measured[0].FocusOffset;
  const basePrevious =
    result.value.OldOffsets?.find((o) => o.Position === basePosition)?.FocusOffset ?? 0;

  // A filter whose autofocus failed in every loop comes back with Measured: false and keeps its
  // previous offset; older plugins send no flag at all.
  const table = filters.value.map((f) => {
    const entry = measuredByPosition.get(f.position);
    return {
      Position: f.position,
      Name: f.name,
      FocusOffset: entry ? entry.FocusOffset : baseMeasured + (f.focusOffset - basePrevious),
      measured: !!entry && entry.Measured !== false,
    };
  });

  const reference =
    table.find((t) => t.Position === newDefaultFilterPosition.value) ??
    table.find((t) => t.Position === basePosition) ??
    table[0];

  const zero = reference.FocusOffset;
  return zero === 0 ? table : table.map((t) => ({ ...t, FocusOffset: t.FocusOffset - zero }));
});

const oldDefaultFilterName = computed(() => {
  if (result.value?.OldDefaultFilterPosition == null) return null;
  const f = filters.value.find((f) => f.position === result.value.OldDefaultFilterPosition);
  return f?.name ?? null;
});

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await fetchFilters();
  await fetchStatus();
  statusPoller.start();
});

// ── Data fetching ────────────────────────────────────────────────────────────
async function fetchFilters() {
  try {
    const { data } = await axios.get(`${getApiUrl()}/filter-offset/filters`);
    if (data.Success) {
      filters.value = data.Response.Filters ?? [];
      // Pre-select all filters by default (mirrors WPF behaviour)
      if (selectedPositions.value.length === 0) {
        selectedPositions.value = filters.value.map((f) => f.position);
      }
    }
  } catch (err) {
    console.error('[FilterOffset] fetchFilters error:', err);
  }
}

async function fetchStatus() {
  try {
    const { data } = await axios.get(`${getApiUrl()}/filter-offset/status`);
    if (data.Success) {
      status.value = data.Response;

      // A run starting means whatever result this client is still holding belongs to a previous one
      // — another tab (or another client) accepted or discarded it and started over. Dropping it here
      // is what makes the next PendingResult fetch the new result instead of keeping the old one,
      // which would otherwise put one run's offsets on screen next to another run's measurements.
      if (data.Response.State === 'Running' && result.value) {
        result.value = null;
      }

      if (data.Response.State === 'PendingResult' && !result.value) {
        await fetchResult();
      }
    }
  } catch (err) {
    console.error('[FilterOffset] fetchStatus error:', err);
  }
}

async function fetchResult() {
  try {
    const { data } = await axios.get(`${getApiUrl()}/filter-offset/result`);
    if (data.Success) {
      result.value = data.Response;
      newDefaultFilterPosition.value = data.Response.SuggestedDefaultFilterPosition ?? null;
      applyError.value = '';
    }
  } catch (err) {
    console.error('[FilterOffset] fetchResult error:', err);
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────
function toggleFilter(position) {
  const idx = selectedPositions.value.indexOf(position);
  if (idx >= 0) {
    selectedPositions.value.splice(idx, 1);
  } else {
    selectedPositions.value.push(position);
  }
  validateSelection();
}

function validateSelection() {
  issues.value = [];
  if (selectedPositions.value.length < 2) {
    issues.value.push(t('plugins.filterOffset.minTwoFilters'));
  }
}

async function startCalculation() {
  validateSelection();
  if (issues.value.length) return;

  loading.value = true;
  try {
    await axios.post(`${getApiUrl()}/filter-offset/start`, {
      Loops: loops.value,
      FilterPositions: selectedPositions.value,
    });
    result.value = null;
    applyError.value = '';
    await fetchStatus();
  } catch (err) {
    console.error('[FilterOffset] start error:', err);
    issues.value.push(err.response?.data?.Error ?? err.message);
  } finally {
    loading.value = false;
  }
}

async function stopCalculation() {
  // A run is a long series of AutoFocus passes — potentially the better part of an hour — and
  // stopping discards every measurement taken so far, so it must not go through on a stray tap.
  const confirmed = await toastStore.showConfirmation(
    t('plugins.filterOffset.confirmStopTitle'),
    t('plugins.filterOffset.confirmStopMessage'),
    t('plugins.filterOffset.stop'),
    t('common.cancel')
  );
  if (!confirmed) return;

  try {
    await axios.get(`${getApiUrl()}/filter-offset/stop`);
  } catch (err) {
    console.error('[FilterOffset] stop error:', err);
  }
}

async function applyResult() {
  loading.value = true;
  applyError.value = '';
  try {
    const { data } = await axios.post(`${getApiUrl()}/filter-offset/apply`, {
      NewDefaultFilterPosition: newDefaultFilterPosition.value,
    });
    // The backend answers 4xx/5xx with an Error body; keep the result on screen so the user can
    // correct the selection and retry instead of silently losing the measurement.
    if (data?.Success === false) {
      applyError.value = data.Error || t('plugins.filterOffset.applyFailed');
      return;
    }
    result.value = null;
    await fetchFilters();
    await fetchStatus();
  } catch (err) {
    console.error('[FilterOffset] apply error:', err);
    applyError.value =
      err?.response?.data?.Error || err?.message || t('plugins.filterOffset.applyFailed');
  } finally {
    loading.value = false;
  }
}

async function discardResult() {
  loading.value = true;
  try {
    await axios.get(`${getApiUrl()}/filter-offset/discard`);
    result.value = null;
    applyError.value = '';
    await fetchStatus();
  } catch (err) {
    console.error('[FilterOffset] discard error:', err);
  } finally {
    loading.value = false;
  }
}
</script>
