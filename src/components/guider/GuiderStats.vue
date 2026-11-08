<template>
  <!-- RMS Error — always visible -->
  <div class="shrink-0 text-sm">
    <p class="font-bold">{{ $t('components.guider.rms_error') }}:</p>
    <div class="grid grid-cols-3 gap-x-3 tabular-nums w-fit">
      <span class="text-content-muted">RA</span>
      <span>{{ store.guiderInfo?.RMSError?.RA.Pixel.toFixed(2) }} px</span>
      <span class="text-content-muted"
        >{{ store.guiderInfo?.RMSError?.RA.Arcseconds.toFixed(2) }}"</span
      >
      <span class="text-content-muted">DEC</span>
      <span>{{ store.guiderInfo?.RMSError?.Dec.Pixel.toFixed(2) }} px</span>
      <span class="text-content-muted"
        >{{ store.guiderInfo?.RMSError?.Dec.Arcseconds.toFixed(2) }}"</span
      >
      <span class="text-content-muted">Total</span>
      <span class="font-semibold">{{ store.guiderInfo?.RMSError?.Total.Pixel.toFixed(2) }} px</span>
      <span class="text-content-muted"
        >{{ store.guiderInfo?.RMSError?.Total.Arcseconds.toFixed(2) }}"</span
      >
    </div>
  </div>

  <!-- Algo params (PINS only) -->
  <template v-if="phd2Active">
    <div v-if="algoParams.ra" class="shrink-0 text-sm">
      <p class="font-bold">RA params:</p>
      <div class="grid grid-cols-2 gap-x-3 w-fit">
        <template v-for="(val, name) in algoParams.ra" :key="name">
          <template v-if="!EXCLUDED_PARAMS.includes(String(name))">
            <span class="text-content-muted">{{ name }}</span>
            <span
              v-if="typeof val === 'number'"
              class="cursor-pointer"
              style="color: rgba(100, 170, 230, 1)"
              @click="openParamPicker('ra', String(name), val)"
              >{{ displayVal(String(name), val) }}</span
            >
            <span v-else>{{ val }}</span>
          </template>
        </template>
      </div>
    </div>

    <div v-if="algoParams.dec" class="shrink-0 text-sm">
      <p class="font-bold">DEC params:</p>
      <div class="grid grid-cols-2 gap-x-3 w-fit">
        <template v-for="(val, name) in algoParams.dec" :key="name">
          <template v-if="!EXCLUDED_PARAMS.includes(String(name))">
            <span class="text-content-muted">{{ name }}</span>
            <span
              v-if="typeof val === 'number'"
              class="cursor-pointer"
              style="color: rgba(255, 80, 100, 1)"
              @click="openParamPicker('dec', String(name), val)"
              >{{ displayVal(String(name), val) }}</span
            >
            <span v-else>{{ val }}</span>
          </template>
        </template>
      </div>
    </div>

    <!-- Guide Algorithms — far right -->
    <div class="shrink-0 text-sm">
      <p class="font-bold">Guide Algorithms:</p>
      <div class="grid grid-cols-4 gap-x-3 w-fit">
        <span class="text-content-muted">RA algo</span>
        <span>{{ guiderStore.phd2GuideAlgorithmRA }}</span>
        <span class="text-content-muted">DEC algo</span>
        <span>{{ guiderStore.phd2GuideAlgorithmDEC }}</span>
        <span class="text-content-muted">Max RA</span>
        <span
          class="cursor-pointer"
          style="color: rgba(100, 170, 230, 1)"
          @click="openMaxDurationPicker('ra')"
          >{{ maxRaDuration }}</span
        >
        <span class="text-content-muted">Max DEC</span>
        <span
          class="cursor-pointer"
          style="color: rgba(255, 80, 100, 1)"
          @click="openMaxDurationPicker('dec')"
          >{{ maxDecDuration }}</span
        >
        <span></span>
        <span></span>
        <span class="text-content-muted">Dec mode</span>
        <span
          class="cursor-pointer"
          style="color: rgba(255, 80, 100, 1)"
          @click="cycleDecGuideMode"
          >{{ decGuideMode }}</span
        >
      </div>
    </div>

    <!-- Dark Library indicator — far right -->
    <div class="shrink-0 text-sm">
      <p class="font-bold">{{ $t('components.guider.phd2.darkLibrary.title') }}:</p>
      <span
        :class="
          guiderStore.phd2DarkLibraryInfo?.Loaded
            ? 'bg-status-ok/10 text-status-ok border-status-ok/40'
            : 'bg-status-danger/10 text-status-danger border-status-danger/40'
        "
        class="inline-block px-2 py-0.5 text-xs font-bold rounded-chip border"
        :title="
          guiderStore.phd2DarkLibraryInfo?.Loaded
            ? $t('components.guider.phd2.darkLibrary.loaded')
            : $t('components.guider.phd2.darkLibrary.notLoaded')
        "
      >
        DARKS
      </span>
    </div>
  </template>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { apiStore } from '@/store/store';
import { useGuiderStore } from '@/store/guiderStore';
import apiPinsService from '@/services/apiPinsService';
import apiService from '@/services/apiService';
import { useNumberPicker } from '@/composables/useNumberPicker';
import { useBackgroundAwarePolling } from '@/utils/appLifecycle';

const store = apiStore();
const guiderStore = useGuiderStore();
const { openPicker } = useNumberPicker();

// phd2IsConnected is only refreshed by the PHD2 poll, which stops once another guider
// (e.g. the internal one) is selected - so it can stay true. Check the device as well.
const phd2Active = computed(
  () => store.isPINS && store.guiderInfo?.DeviceId === 'PHD2_Single' && guiderStore.phd2IsConnected
);

const EXCLUDED_PARAMS = ['algorithmName', 'fastSwitch', 'periodLength'];

const PARAM_CONFIG = {
  minMove: { min: 0, max: 20, step: 0.01, scale: 1 },
  aggression: { min: 0, max: 100, step: 1, scale: 100 },
  hysteresis: { min: 0, max: 99, step: 1, scale: 100 },
  predictiveWeight: { min: 0, max: 100, step: 1, scale: 100 },
  reactiveWeight: { min: 0, max: 100, step: 1, scale: 100 },
  slopeWeight: { min: 0, max: 20, step: 0.01, scale: 1 },
  expFactor: { min: 0, max: 20, step: 0.1, scale: 1 },
};

function getConfig(name) {
  return PARAM_CONFIG[name] ?? { min: 0, max: 100, step: 0.01, scale: 1 };
}

function displayVal(name, val) {
  if (typeof val !== 'number') return val;
  const cfg = getConfig(name);
  const scaled = val * cfg.scale;
  const dp = String(cfg.step).includes('.') ? String(cfg.step).split('.')[1].length : 0;
  return scaled.toFixed(dp);
}

function openParamPicker(axis, name, currentVal) {
  const cfg = getConfig(name);
  openPicker(name, cfg.min, cfg.max, cfg.step, currentVal * cfg.scale, async (newVal) => {
    await apiService.setPHD2AlgoParam(axis, name, newVal / cfg.scale);
    await fetchAlgoParams();
  });
}

const algoParams = ref({ ra: null, dec: null });
const algoLoading = ref(false);
const decGuideMode = ref(null);
const DEC_GUIDE_MODES = ['Off', 'Auto', 'North', 'South'];
const maxRaDuration = ref(null);
const maxDecDuration = ref(null);

async function fetchParamsForAxis(axis) {
  try {
    const namesResp = await apiPinsService.getAlgoParamNames(axis);
    if (!namesResp?.Success || !Array.isArray(namesResp.Response?.ParameterNames)) return null;
    const names = namesResp.Response.ParameterNames.filter((n) => !EXCLUDED_PARAMS.includes(n));
    const entries = await Promise.all(
      names.map(async (name) => {
        const r = await apiPinsService.getAlgoParam(axis, name);
        return [name, r?.Success ? r.Response?.Value : null];
      })
    );
    return Object.fromEntries(entries);
  } catch {
    return null;
  }
}

async function fetchMaxDurations() {
  if (!phd2Active.value) return;
  try {
    const ra = await apiPinsService.getMaxRaDuration();
    if (ra?.Success) maxRaDuration.value = ra.Response?.MaxRaDuration ?? null;
  } catch {}
  try {
    const dec = await apiPinsService.getMaxDecDuration();
    if (dec?.Success) maxDecDuration.value = dec.Response?.MaxDecDuration ?? null;
  } catch {}
}

function openMaxDurationPicker(axis) {
  const current = axis === 'ra' ? maxRaDuration.value : maxDecDuration.value;
  openPicker(
    axis === 'ra' ? 'Max RA Duration (ms)' : 'Max DEC Duration (ms)',
    0,
    8000,
    10,
    current ?? 0,
    async (newVal) => {
      if (axis === 'ra') {
        await apiPinsService.setMaxRaDuration(Math.round(newVal));
        maxRaDuration.value = Math.round(newVal);
      } else {
        await apiPinsService.setMaxDecDuration(Math.round(newVal));
        maxDecDuration.value = Math.round(newVal);
      }
    },
    0
  );
}

async function fetchDecGuideMode() {
  if (!phd2Active.value) return;
  try {
    const r = await apiPinsService.getDecGuideMode();
    if (r?.Success) decGuideMode.value = r.Response?.DecGuideMode ?? null;
  } catch {
    // ignore
  }
}

async function cycleDecGuideMode() {
  const idx = DEC_GUIDE_MODES.indexOf(decGuideMode.value);
  const next = DEC_GUIDE_MODES[(idx + 1) % DEC_GUIDE_MODES.length];
  try {
    await apiPinsService.setDecGuideMode(next);
    decGuideMode.value = next;
  } catch {
    // ignore
  }
}

async function fetchAlgoParams() {
  if (!phd2Active.value) return;
  algoLoading.value = algoParams.value.ra === null && algoParams.value.dec === null;
  const [ra, dec] = await Promise.all([fetchParamsForAxis('ra'), fetchParamsForAxis('dec')]);
  algoParams.value = { ra, dec };
  algoLoading.value = false;
}

async function fetchGuideAlgorithms() {
  if (!phd2Active.value) return;
  await Promise.all([
    guiderStore.fetchPHD2GuideAlgorithmRA(),
    guiderStore.fetchPHD2GuideAlgorithmDEC(),
  ]);
}

function fetchAll() {
  fetchGuideAlgorithms();
  fetchAlgoParams();
  fetchDecGuideMode();
  fetchMaxDurations();
  guiderStore.fetchPHD2DarkLibraryInfo();
}

watch(
  phd2Active,
  (connected) => {
    if (connected) fetchAll();
  },
  { immediate: true }
);

// Poll only while the guider graph is visible and PHD2 is connected - and
// pause automatically when the app is backgrounded (see src/utils/appLifecycle.js).
const shouldPoll = computed(() => guiderStore.showGuiderGraph && phd2Active.value);

useBackgroundAwarePolling(
  () => {
    if (phd2Active.value) fetchAll();
  },
  5000,
  shouldPoll,
  { immediate: true }
);

watch(() => [guiderStore.phd2GuideAlgorithmRA, guiderStore.phd2GuideAlgorithmDEC], fetchAlgoParams);
</script>

<style scoped></style>
