<template>
  <div class="flex flex-col w-full max-w-md space-y-3 mt-4">
    <!-- Global settings -->
    <div class="tns-card space-y-3">
      <!-- Mode selector -->
      <div class="flex flex-row w-full items-center">
        <label class="text-sm text-content mr-3 shrink-0">{{
          $t('components.flatassistant.mode')
        }}</label>
        <select v-model="state.selectedMode" class="tns-select ml-auto w-48">
          <option value="AutoExposure">{{ $t('components.flatassistant.auto_exposure') }}</option>
          <option value="AutoBrightness">
            {{ $t('components.flatassistant.auto_brightness') }}
          </option>
          <option value="SkyFlat">{{ $t('components.flatassistant.skyflat') }}</option>
        </select>
      </div>

      <!-- Keep Closed -->
      <div class="flex items-center justify-between">
        <span class="text-sm text-content">{{ $t('components.flatassistant.keep_closed') }}</span>
        <toggleButton
          :statusValue="state.keepClosed"
          @update:statusValue="state.keepClosed = $event"
        />
      </div>

      <setDarkCount v-if="state.selectedMode !== 'SkyFlat'" />
    </div>

    <!-- Filter list -->
    <template v-if="store.filterInfo.Connected && store.filterInfo.AvailableFilters?.length">
      <div
        v-for="filter in store.filterInfo.AvailableFilters"
        :key="filter.Id"
        class="tns-card space-y-3"
      >
        <!-- Filter header with toggle -->
        <div
          class="flex items-center justify-between"
          :class="isActive(filter.Id) ? 'cursor-pointer' : ''"
          @click.self="isActive(filter.Id) && toggleExpand(filter.Id)"
        >
          <div
            class="flex items-center gap-2 flex-1 min-w-0"
            @click="isActive(filter.Id) && toggleExpand(filter.Id)"
          >
            <!-- Chevron (only when active) -->
            <svg
              v-if="isActive(filter.Id)"
              class="w-4 h-4 text-content-muted shrink-0 transition-transform duration-200"
              :class="isExpanded(filter.Id) ? 'rotate-90' : ''"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="text-sm font-medium text-white truncate">{{ filter.Name }}</span>
            <!-- Per-filter run result indicator -->
            <svg
              v-if="flatsStore.filterResults[filter.Id] === 'success'"
              class="w-4 h-4 text-status-ok shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <template
              v-else-if="['failed', 'dim', 'bright'].includes(flatsStore.filterResults[filter.Id])"
            >
              <svg
                class="w-4 h-4 text-status-danger shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span
                v-if="flatsStore.filterResults[filter.Id] === 'dim'"
                class="text-xs text-status-danger shrink-0"
                >{{ $t('components.flatassistant.result_dim') }}</span
              >
              <span
                v-else-if="flatsStore.filterResults[filter.Id] === 'bright'"
                class="text-xs text-status-danger shrink-0"
                >{{ $t('components.flatassistant.result_bright') }}</span
              >
            </template>
          </div>
          <toggleButton
            :statusValue="isActive(filter.Id)"
            @update:statusValue="toggleFilter(filter.Id, $event)"
          />
        </div>

        <!-- Settings (only when active AND expanded AND config ready) -->
        <div
          v-if="isActive(filter.Id) && isExpanded(filter.Id) && state.filterConfigs[filter.Id]"
          class="space-y-2 pt-2 border-t border-line"
        >
          <!-- Count -->
          <NumberInputPicker
            v-model="state.filterConfigs[filter.Id].count"
            :label="$t('components.flatassistant.count')"
            labelKey="components.flatassistant.count"
            :min="1"
            :max="9999"
            :step="1"
            :decimalPlaces="0"
            :inputId="`count-${filter.Id}`"
          />

          <!-- Gain: dropdown if camera has gain list, otherwise free input -->
          <div
            v-if="store.cameraInfo.Gains?.length > 0"
            class="flex flex-row w-full items-center min-w-28 border border-line-strong p-1 rounded-lg"
          >
            <label class="text-xs mr-3 mb-1 text-content">
              {{ $t('components.camera.gain_iso') }}
            </label>
            <select
              v-model.number="state.filterConfigs[filter.Id].gain"
              class="tns-select ml-auto w-28"
            >
              <option v-for="value in store.cameraInfo.Gains" :key="value" :value="value">
                {{ value }}
              </option>
            </select>
          </div>
          <NumberInputPicker
            v-else
            v-model="state.filterConfigs[filter.Id].gain"
            :label="$t('components.camera.gain_iso')"
            labelKey="components.camera.gain_iso"
            :min="0"
            :max="9999"
            :step="1"
            :decimalPlaces="0"
            :inputId="`gain-${filter.Id}`"
          />

          <!-- Offset -->
          <NumberInputPicker
            v-model="state.filterConfigs[filter.Id].offset"
            :label="$t('components.camera.offset')"
            labelKey="components.camera.offset"
            :min="0"
            :max="9999"
            :step="1"
            :decimalPlaces="0"
            :inputId="`offset-${filter.Id}`"
          />

          <!-- Binning -->
          <div
            v-if="(store.cameraInfo?.BinningModes?.length || 0) > 1"
            class="flex flex-row w-full items-center min-w-28 border border-line-strong p-1 rounded-lg"
          >
            <label class="text-xs mr-3 mb-1 text-content-muted">
              {{ $t('components.camera.binning_mode') }}
            </label>
            <select
              v-model="state.filterConfigs[filter.Id].binning"
              class="tns-select ml-auto w-28"
            >
              <option
                v-for="mode in store.cameraInfo.BinningModes"
                :key="mode.Name"
                :value="mode.Name"
              >
                {{ mode.Name }}
              </option>
            </select>
          </div>

          <!-- AutoExposure specific -->
          <template v-if="state.selectedMode === 'AutoExposure'">
            <NumberInputPicker
              v-model="state.filterConfigs[filter.Id].minExposure"
              :label="$t('components.flatassistant.min_exposure_time')"
              labelKey="components.flatassistant.min_exposure_time"
              :min="0.001"
              :max="3600"
              :step="0.01"
              :decimalPlaces="3"
              :inputId="`minExp-${filter.Id}`"
            />
            <NumberInputPicker
              v-model="state.filterConfigs[filter.Id].maxExposure"
              :label="$t('components.flatassistant.max_exposure_time')"
              labelKey="components.flatassistant.max_exposure_time"
              :min="0.001"
              :max="3600"
              :step="1"
              :decimalPlaces="1"
              :inputId="`maxExp-${filter.Id}`"
            />
            <NumberInputPicker
              v-model="state.filterConfigs[filter.Id].brightness"
              :label="$t('components.flatassistant.brightness')"
              labelKey="components.flatassistant.brightness"
              :min="0"
              :max="100"
              :step="1"
              :decimalPlaces="0"
              :inputId="`brightness-${filter.Id}`"
            />
          </template>

          <!-- AutoBrightness specific -->
          <template v-else-if="state.selectedMode === 'AutoBrightness'">
            <NumberInputPicker
              v-model="state.filterConfigs[filter.Id].exposureTime"
              :label="$t('components.flatassistant.exposure_time')"
              labelKey="components.flatassistant.exposure_time"
              :min="0.001"
              :max="3600"
              :step="0.1"
              :decimalPlaces="1"
              :inputId="`expTime-${filter.Id}`"
            />
            <NumberInputPicker
              v-model="state.filterConfigs[filter.Id].minBrightness"
              :label="$t('components.flatassistant.min_brightness')"
              labelKey="components.flatassistant.min_brightness"
              :min="store.flatdeviceInfo?.MinBrightness || 0"
              :max="store.flatdeviceInfo?.MaxBrightness || 65535"
              :step="1"
              :decimalPlaces="0"
              :inputId="`minBright-${filter.Id}`"
            />
            <NumberInputPicker
              v-model="state.filterConfigs[filter.Id].maxBrightness"
              :label="$t('components.flatassistant.max_brightness')"
              labelKey="components.flatassistant.max_brightness"
              :min="store.flatdeviceInfo?.MinBrightness || 0"
              :max="store.flatdeviceInfo?.MaxBrightness || 65535"
              :step="1"
              :decimalPlaces="0"
              :inputId="`maxBright-${filter.Id}`"
            />
          </template>

          <!-- SkyFlat specific -->
          <template v-else-if="state.selectedMode === 'SkyFlat'">
            <NumberInputPicker
              v-model="state.filterConfigs[filter.Id].minExposure"
              :label="$t('components.flatassistant.min_exposure_time')"
              labelKey="components.flatassistant.min_exposure_time"
              :min="0.001"
              :max="3600"
              :step="0.01"
              :decimalPlaces="3"
              :inputId="`minExp-${filter.Id}`"
            />
            <NumberInputPicker
              v-model="state.filterConfigs[filter.Id].maxExposure"
              :label="$t('components.flatassistant.max_exposure_time')"
              labelKey="components.flatassistant.max_exposure_time"
              :min="0.001"
              :max="3600"
              :step="1"
              :decimalPlaces="1"
              :inputId="`maxExp-${filter.Id}`"
            />
          </template>

          <!-- Histogram settings (all modes) -->
          <NumberInputPicker
            v-model="state.filterConfigs[filter.Id].histogramMean"
            :label="$t('components.flatassistant.histogram_mean_target')"
            labelKey="components.flatassistant.histogram_mean_target"
            :min="0"
            :max="100"
            :step="1"
            :decimalPlaces="0"
            :inputId="`histMean-${filter.Id}`"
          />
          <NumberInputPicker
            v-model="state.filterConfigs[filter.Id].meanTolerance"
            :label="$t('components.flatassistant.mean_tolerance')"
            labelKey="components.flatassistant.mean_tolerance"
            :min="0"
            :max="100"
            :step="1"
            :decimalPlaces="0"
            :inputId="`meanTol-${filter.Id}`"
          />
        </div>
      </div>
    </template>

    <!-- No filter wheel -->
    <div v-else class="tns-card text-center text-content-muted text-sm">
      {{ $t('components.flatassistant.multi_mode_no_filters') }}
    </div>

    <!-- Start / Stop -->
    <div v-show="flatsStore.status.State !== 'Running'">
      <button
        @click="startMultiMode"
        class="tns-btn-primary"
        :disabled="state.activeFilterIds.length === 0"
      >
        {{ $t('components.flatassistant.start_multi_mode') }}
      </button>
    </div>
    <div v-show="flatsStore.status.State === 'Running'">
      <button @click="stopFlats" class="tns-btn-danger">
        {{ $t('components.flatassistant.stop') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch, nextTick } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useFlatassistantStore } from '@/store/flatassistantStore';
import { useSettingsStore } from '@/store/settingsStore';
import setDarkCount from '@/components/flatassistant/setDarkCount.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import toggleButton from '@/components/helpers/toggleButton.vue';

const store = apiStore();
const flatsStore = useFlatassistantStore();
const settingsStore = useSettingsStore();

// Restore session state (mode, active/expanded filter selections)
const saved = settingsStore.flats.multiMode ?? {};

const state = reactive({
  selectedMode: saved.selectedMode ?? 'AutoExposure',
  keepClosed: saved.keepClosed ?? false,
  activeFilterIds: saved.activeFilterIds ? [...saved.activeFilterIds] : [],
  expandedFilterIds: saved.expandedFilterIds ? [...saved.expandedFilterIds] : [],
  filterConfigs: {},
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

function defaultConfig(filterId) {
  const pf =
    store.profileInfo?.FilterWheelSettings?.FilterWheelFilters?.[filterId]
      ?.FlatWizardFilterSettings;

  if (pf) {
    const cameraGain = store.profileInfo?.CameraSettings?.Gain ?? 0;
    const cameraOffset = store.profileInfo?.CameraSettings?.Offset ?? 0;
    return {
      count: 20, // local only
      gain: pf.Gain === -1 ? cameraGain : pf.Gain,
      offset: pf.Offset === -1 ? cameraOffset : pf.Offset,
      binning: pf.Binning?.Name ?? '1x1',
      histogramMean: Math.round(pf.HistogramMeanTarget * 100),
      meanTolerance: Math.round(pf.HistogramTolerance * 100),
      minExposure: pf.MinFlatExposureTime,
      maxExposure: pf.MaxFlatExposureTime,
      brightness: 50, // local only (% panel brightness)
      exposureTime: 2, // local only
      minBrightness: pf.MinAbsoluteFlatDeviceBrightness,
      maxBrightness: pf.MaxAbsoluteFlatDeviceBrightness,
    };
  }
  // Fallback when profile is not yet loaded
  return {
    count: 20,
    gain: -1,
    offset: -1,
    binning: '1x1',
    histogramMean: 50,
    meanTolerance: 10,
    minExposure: 0.01,
    maxExposure: 20,
    brightness: 50,
    exposureTime: 2,
    minBrightness: 0,
    maxBrightness: 32000,
  };
}

function ensureFilterConfig(filterId) {
  if (!state.filterConfigs[filterId]) {
    state.filterConfigs[filterId] = defaultConfig(filterId);
  }
}

// ── Filter activation / expand ────────────────────────────────────────────────

function isActive(filterId) {
  return state.activeFilterIds.includes(filterId);
}

function isExpanded(filterId) {
  return state.expandedFilterIds.includes(filterId);
}

function toggleExpand(filterId) {
  if (isExpanded(filterId)) {
    state.expandedFilterIds = state.expandedFilterIds.filter((id) => id !== filterId);
  } else {
    state.expandedFilterIds.push(filterId);
  }
}

function toggleFilter(filterId, value) {
  if (value) {
    ensureFilterConfig(filterId);
    if (!state.activeFilterIds.includes(filterId)) {
      state.activeFilterIds.push(filterId);
    }
    if (!state.expandedFilterIds.includes(filterId)) {
      state.expandedFilterIds.push(filterId);
    }
  } else {
    state.activeFilterIds = state.activeFilterIds.filter((id) => id !== filterId);
    state.expandedFilterIds = state.expandedFilterIds.filter((id) => id !== filterId);
  }
}

// ── Session persistence (mode + filter selections + local-only config fields) ──

watch(
  () => ({
    selectedMode: state.selectedMode,
    keepClosed: state.keepClosed,
    activeFilterIds: [...state.activeFilterIds],
    expandedFilterIds: [...state.expandedFilterIds],
    filterConfigs: Object.fromEntries(
      Object.entries(state.filterConfigs).map(([id, cfg]) => [
        id,
        { count: cfg.count, brightness: cfg.brightness, exposureTime: cfg.exposureTime },
      ])
    ),
  }),
  (val) => {
    settingsStore.flats.multiMode = { ...settingsStore.flats.multiMode, ...val };
  },
  { deep: true }
);

// ── Profile save ──────────────────────────────────────────────────────────────

const PROFILE_FIELDS = {
  gain: (cfg, base, cameraGain) => [
    base + '-Gain',
    String(cfg.gain === cameraGain ? -1 : cfg.gain),
  ],
  offset: (cfg, base, _, cameraOffset) => [
    base + '-Offset',
    String(cfg.offset === cameraOffset ? -1 : cfg.offset),
  ],
  minExposure: (cfg, base) => [base + '-MinFlatExposureTime', String(cfg.minExposure)],
  maxExposure: (cfg, base) => [base + '-MaxFlatExposureTime', String(cfg.maxExposure)],
  histogramMean: (cfg, base) => [base + '-HistogramMeanTarget', String(cfg.histogramMean / 100)],
  meanTolerance: (cfg, base) => [base + '-HistogramTolerance', String(cfg.meanTolerance / 100)],
  maxBrightness: (cfg, base) => [
    base + '-MaxAbsoluteFlatDeviceBrightness',
    String(cfg.maxBrightness),
  ],
  minBrightness: (cfg, base) => [
    base + '-MinAbsoluteFlatDeviceBrightness',
    String(cfg.minBrightness),
  ],
};

async function saveFieldToProfile(filterId, cfg, field) {
  const base = `FilterWheelSettings-FilterWheelFilters-${filterId}-FlatWizardFilterSettings`;
  const cameraGain = store.profileInfo?.CameraSettings?.Gain ?? 0;
  const cameraOffset = store.profileInfo?.CameraSettings?.Offset ?? 0;
  const builder = PROFILE_FIELDS[field];
  if (!builder) return;
  const [path, value] = builder(cfg, base, cameraGain, cameraOffset);
  await apiService.profileChangeValue(path, value);
}

const debouncedFieldSaves = {};

function getDebouncedFieldSave(filterId, field) {
  const key = `${filterId}-${field}`;
  if (!debouncedFieldSaves[key]) {
    debouncedFieldSaves[key] = debounce((cfg) => saveFieldToProfile(filterId, cfg, field), 800);
  }
  return debouncedFieldSaves[key];
}

const prevFilterConfigs = {};
let initialized = false;

watch(
  () => state.filterConfigs,
  (configs) => {
    if (!initialized) return;
    for (const [filterId, cfg] of Object.entries(configs)) {
      const prev = prevFilterConfigs[filterId];
      if (prev) {
        for (const field of Object.keys(PROFILE_FIELDS)) {
          if (cfg[field] !== prev[field]) {
            getDebouncedFieldSave(Number(filterId), field)(cfg);
          }
        }
      }
      prevFilterConfigs[filterId] = { ...cfg };
    }
  },
  { deep: true }
);

// ── Start / Stop ──────────────────────────────────────────────────────────────

async function startMultiMode() {
  const wheelOrder = store.filterInfo.AvailableFilters?.map((f) => f.Id) ?? [];
  const sortedIds = [...state.activeFilterIds].sort(
    (a, b) => wheelOrder.indexOf(a) - wheelOrder.indexOf(b)
  );

  // The plugin runs every filter (and the darks) itself, so the run continues while the
  // app is closed. The loop below is the fallback for plugins without that run.
  if (await flatsStore.detectServerWorkflow()) {
    const filters = sortedIds
      .filter((id) => store.filterInfo.AvailableFilters?.some((f) => f.Id === id))
      .map((filterId) => {
        const cfg = state.filterConfigs[filterId];
        return { filterId, ...cfg };
      });
    if (!filters.length) return;
    await flatsStore.startServerRun({
      mode: state.selectedMode,
      keepClosed: state.keepClosed,
      darkCount: state.selectedMode !== 'SkyFlat' ? flatsStore.darkCount : 0,
      filters,
    });
    return;
  }

  // Reset per-filter results
  for (const id of sortedIds) {
    flatsStore.filterResults[id] = null;
  }

  // Initialise run state. Switch currentRunType to 'flats' so fetchFlatsInfos uses
  // NINA's status (not TNS multi-status) while each per-filter call is running.
  flatsStore.startManagedRun('flats-multi');
  flatsStore.currentRunType = 'flats';

  let totalCompleted = 0;
  let totalRequested = 0;
  const darkJobs = [];

  for (const filterId of sortedIds) {
    if (flatsStore.workflowStopRequested) break;

    // Skip filters that are no longer present in the wheel (stale persisted selection)
    const filterEntry = store.filterInfo.AvailableFilters?.find((f) => f.Id === filterId);
    if (!filterEntry) {
      flatsStore.filterResults[filterId] = 'failed';
      continue;
    }

    const cfg = state.filterConfigs[filterId];
    flatsStore.currentFilterName = filterEntry.Name;

    // Sync histogram target for this filter
    flatsStore.histogramMean = cfg.histogramMean / 100;
    flatsStore.meanTolerance = cfg.meanTolerance / 100;

    // Call the appropriate NINA single-filter flat API (same endpoints as single mode,
    // they accept filterId so NINA moves the filter wheel automatically)
    let response;
    try {
      if (state.selectedMode === 'AutoExposure') {
        response = await apiService.flatAutoExposure(
          cfg.count,
          cfg.minExposure,
          cfg.maxExposure,
          cfg.histogramMean / 100,
          cfg.meanTolerance / 100,
          cfg.binning,
          cfg.gain,
          cfg.offset,
          filterId,
          cfg.brightness,
          state.keepClosed
        );
      } else if (state.selectedMode === 'AutoBrightness') {
        response = await apiService.flatAutoBrightness(
          cfg.count,
          cfg.minBrightness,
          cfg.maxBrightness,
          cfg.histogramMean / 100,
          cfg.meanTolerance / 100,
          cfg.binning,
          cfg.gain,
          cfg.offset,
          filterId,
          cfg.exposureTime,
          state.keepClosed
        );
      } else {
        response = await apiService.flatSkyflat(
          cfg.count,
          cfg.minExposure,
          cfg.maxExposure,
          cfg.histogramMean / 100,
          cfg.meanTolerance / 100,
          cfg.binning,
          cfg.gain,
          cfg.offset,
          filterId,
          state.keepClosed
        );
      }
    } catch {
      flatsStore.filterResults[filterId] = 'failed';
      totalRequested += cfg.count;
      continue;
    }

    if (response?.Success === false) {
      flatsStore.filterResults[filterId] = 'failed';
      totalRequested += cfg.count;
      continue;
    }

    // Poll NINA's status. Use a 30-poll grace so a stale Finished state left by a
    // previous failed run doesn't cause an early exit before NINA transitions to Running.
    const { completed, total } = await flatsStore.waitForCompletion(
      () => apiService.flatassistantAction('status'),
      250,
      { gracePollLimit: 120 }
    );

    totalCompleted += completed;
    totalRequested += total || cfg.count;

    if (total > 0 && completed >= total) {
      flatsStore.filterResults[filterId] = 'success';
      if (state.selectedMode !== 'SkyFlat' && flatsStore.darkCount > 0) {
        darkJobs.push({
          count: flatsStore.darkCount,
          filterId,
          binning: cfg.binning,
          gain: cfg.gain,
          offset: cfg.offset,
        });
      }
    } else if (flatsStore.workflowStopRequested) {
      flatsStore.filterResults[filterId] = 'stopped';
    } else {
      // Try to infer dim vs bright from last ADU vs per-filter target
      const lastADU = flatsStore.currentADU;
      const MAX_ADU = flatsStore.maxADU;
      const targetADU = (cfg.histogramMean / 100) * MAX_ADU;
      const toleranceADU = (cfg.meanTolerance / 100) * MAX_ADU;
      if (lastADU !== null && lastADU < targetADU - toleranceADU) {
        flatsStore.filterResults[filterId] = 'dim';
      } else if (lastADU !== null && lastADU > targetADU + toleranceADU) {
        flatsStore.filterResults[filterId] = 'bright';
      } else {
        flatsStore.filterResults[filterId] = 'failed';
      }
    }
  }

  flatsStore.currentFilterName = null;

  // Restore run type and build aggregate result
  flatsStore.currentRunType = 'flats-multi';
  const FAILURE_STATES = ['failed', 'dim', 'bright'];
  const failedFilterNames = sortedIds
    .filter((id) => FAILURE_STATES.includes(flatsStore.filterResults[id]))
    .map((id) => {
      const name = store.filterInfo.AvailableFilters?.find((f) => f.Id === id)?.Name ?? String(id);
      const result = flatsStore.filterResults[id];
      if (result === 'dim') return `${name} (too dim)`;
      if (result === 'bright') return `${name} (too bright)`;
      return name;
    });
  const flatsMultiResult = {
    type: 'flats-multi',
    completed: totalCompleted,
    total: totalRequested,
    success: totalRequested > 0 && totalCompleted >= totalRequested,
    lastADU: flatsStore.currentADU,
    failedFilterNames,
  };

  // Run dark series BEFORE committing lastRun. Setting lastRun first would schedule
  // commitRunOutcome (App.vue watcher) which calls showToast, which overwrites the
  // showConfirmation dialog before the user can see it.
  if (darkJobs.length > 0 && !flatsStore.workflowStopRequested) {
    await flatsStore.runDarkSeries(darkJobs, state.keepClosed);
    // runDarkSeries sets lastRun to the dark result and triggers its own toast.
    // Reset to null so the flats-multi result also triggers the App.vue watcher.
    flatsStore.lastRun = null;
  }

  // Commit flats-multi result — triggers App.vue watcher → toast
  flatsStore.lastRun = flatsMultiResult;
}

async function stopFlats() {
  try {
    await flatsStore.stopWorkflow();
  } catch (error) {
    console.error('Error stopping flats:', error);
  }
}

// ── Init configs from profile (only once on first load) ───────────────────────

let configsInitialized = false;

// Drop stale persisted selections that don't match the current filter wheel
watch(
  () => store.filterInfo.AvailableFilters,
  (filters) => {
    if (!filters?.length) return;
    const validIds = new Set(filters.map((f) => f.Id));
    state.activeFilterIds = state.activeFilterIds.filter((id) => validIds.has(id));
    state.expandedFilterIds = state.expandedFilterIds.filter((id) => validIds.has(id));
  },
  { immediate: true }
);

watch(
  () => store.profileInfo?.FilterWheelSettings?.FilterWheelFilters,
  (profileFilters) => {
    if (!profileFilters?.length || configsInitialized) return;
    const savedConfigs = settingsStore.flats.multiMode?.filterConfigs ?? {};
    profileFilters.forEach((_, idx) => {
      const base = defaultConfig(idx);
      const saved = savedConfigs[idx] ?? {};
      state.filterConfigs[idx] = {
        ...base,
        count: saved.count ?? base.count,
        brightness: saved.brightness ?? base.brightness,
        exposureTime: saved.exposureTime ?? base.exposureTime,
      };
    });
    // Ensure saved active filters have a config even if not in profile list
    state.activeFilterIds.forEach((id) => ensureFilterConfig(id));
    configsInitialized = true;
    nextTick(() => {
      for (const [id, cfg] of Object.entries(state.filterConfigs)) {
        prevFilterConfigs[id] = { ...cfg };
      }
      initialized = true;
    });
  },
  { immediate: true }
);
</script>
