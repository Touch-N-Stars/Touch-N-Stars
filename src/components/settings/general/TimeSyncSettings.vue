<template>
  <div
    v-if="store.isBackendReachable"
    class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
  >
    <div class="flex items-center justify-between">
      <h3 class="font-bold text-base text-cyan-400">
        {{ $t('components.settings.timeSync.title') }}
      </h3>
      <button
        @click="loadTimeInfo"
        class="text-gray-400 hover:text-gray-200"
        :title="$t('common.refresh')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          :class="['h-4 w-4', { 'animate-spin': timeSyncLoading }]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
      <div class="bg-gray-900/60 rounded p-2">
        <div class="text-gray-400 mb-1">{{ $t('components.settings.timeSync.backendTime') }}</div>
        <div class="text-gray-100 font-mono">
          {{
            timeInfo.backendUtc
              ? new Date(timeInfo.backendUtc).toLocaleString(undefined, { timeZoneName: 'short' })
              : '—'
          }}
        </div>
      </div>
      <div class="bg-gray-900/60 rounded p-2">
        <div class="text-gray-400 mb-1">{{ $t('components.settings.timeSync.mountTime') }}</div>
        <div v-if="!timeInfo.mountConnected" class="text-gray-500 italic">
          {{ $t('components.settings.timeSync.mountNotConnected') }}
        </div>
        <div v-else-if="timeInfo.mountUtc" class="text-gray-100 font-mono">
          {{ new Date(timeInfo.mountUtc).toLocaleString(undefined, { timeZoneName: 'short' }) }}
        </div>
        <div v-else class="text-gray-500 italic">
          {{ $t('components.settings.timeSync.notSupported') }}
        </div>
      </div>
      <div class="bg-gray-900/60 rounded p-2">
        <div class="text-gray-400 mb-1">{{ $t('plugins.pins.deviceTime') }}</div>
        <div class="text-gray-100 font-mono">
          {{ formatPinsDeviceTime() }}
        </div>
      </div>
    </div>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1">
        <p class="text-gray-300 text-sm">{{ $t('components.settings.timeSync.syncLabel') }}</p>
        <InfoModal
          :title="$t('components.settings.timeSync.syncLabel')"
          :message="$t('components.settings.timeSync.syncLabelInfo')"
          size="w-4 h-4"
        />
      </div>
      <ToggleButton :statusValue="timeInfo.timeSyncEnabled" @update:statusValue="toggleTimeSync" />
    </div>
    <div class="flex items-center justify-between">
      <p class="text-gray-300 text-sm mr-4">{{ $t('plugins.pins.autoSync') }}</p>
      <ToggleButton
        :statusValue="pinsStore.timeSyncEnabled"
        @update:statusValue="togglePinsTimeSync"
      />
    </div>
    <div class="flex items-center justify-between gap-2">
      <button
        class="default-button-gray flex items-center gap-2"
        :disabled="pinsTimeActionLoading"
        @click="manualPinsTimeSync"
      >
        <svg
          v-if="pinsTimeActionLoading"
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {{ $t('plugins.pins.syncNow') }}
      </button>
      <button
        v-if="pinsStore.suppressTimeWarning"
        class="text-xs text-yellow-400 hover:text-yellow-300 underline"
        @click="pinsStore.setSuppressTimeWarning(false)"
      >
        {{ $t('plugins.pins.timeWarning.reenable') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import { usePinsStore } from '@/plugins/pins/store/pinsStore';
import { useSettingsStore } from '@/store/settingsStore';
import ToggleButton from '@/components/helpers/toggleButton.vue';
import InfoModal from '@/components/helpers/infoModal.vue';
import apiService from '@/services/apiService';
import axios from 'axios';
import {
  formatPinsTimeForDisplay,
  getDeviceDateTimePayload,
  parsePinsTimeToSeconds,
} from '@/utils/pinsTimeUtils';

const PINS_PORT = 8000;
const PINS_TOKEN = 'zZDqJ3IKeFaIZqG2JIFvsxzA5E48GC2gyGVagHFZqC0OMtgoupUDZCPhQDYKm35d';

const store = apiStore();
const pinsStore = usePinsStore();
const settingsStore = useSettingsStore();

const timeSyncLoading = ref(false);
const pinsTimeActionLoading = ref(false);
const pinsDeviceTime = ref(null);
const timeInfo = ref({
  backendUtc: null,
  mountUtc: null,
  timeSyncEnabled: false,
  mountConnected: false,
});

function getPinsIp() {
  return settingsStore.connection.ip || window.location.hostname;
}

function formatPinsDeviceTime() {
  return formatPinsTimeForDisplay(pinsDeviceTime.value);
}

async function fetchPinsDeviceTime() {
  const ip = getPinsIp();
  if (!ip) return null;

  const directAxios = axios.create({ headers: {} });
  const response = await directAxios.get(`http://${ip}:${PINS_PORT}/system/time`, {
    headers: {
      Authorization: `Bearer ${PINS_TOKEN}`,
    },
    timeout: 5000,
  });

  return response?.data ?? null;
}

async function syncPinsSystemTime(remoteTime, force = false) {
  const ip = getPinsIp();
  if (!ip || !remoteTime) return;

  const remoteTimeSeconds = parsePinsTimeToSeconds(remoteTime);
  const localTimeSeconds = Date.now() / 1000;
  if (remoteTimeSeconds !== null) {
    const diff = Math.abs(remoteTimeSeconds - localTimeSeconds);
    if (!force && diff <= 5) return;
  }

  const payload = getDeviceDateTimePayload();

  const directAxios = axios.create({ headers: {} });
  await directAxios.post(`http://${ip}:${PINS_PORT}/system/time`, payload, {
    headers: {
      Authorization: `Bearer ${PINS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    timeout: 5000,
  });

  pinsDeviceTime.value = payload;
}

async function loadPinsTimeInfo() {
  try {
    const remoteTime = await fetchPinsDeviceTime();
    pinsDeviceTime.value = remoteTime;

    if (remoteTime && pinsStore.timeSyncEnabled) {
      await syncPinsSystemTime(remoteTime, false);
    }
  } catch (e) {
    console.error('Failed to load PINS device time:', e);
  }
}

const loadTimeInfo = async () => {
  if (!store.isBackendReachable) return;
  timeSyncLoading.value = true;
  try {
    const data = await apiService.getTnsTime();
    if (data) timeInfo.value = data;
    await loadPinsTimeInfo();
  } catch (e) {
    console.error('Failed to load time info:', e);
  } finally {
    timeSyncLoading.value = false;
  }
};

const toggleTimeSync = async (value) => {
  try {
    await apiService.profileChangeValue('TelescopeSettings-TimeSync', value);
    await loadTimeInfo();
  } catch (e) {
    console.error('Failed to toggle time sync:', e);
  }
};

const togglePinsTimeSync = async (value) => {
  pinsStore.setTimeSync(value);
  if (value) {
    await loadPinsTimeInfo();
  }
};

const manualPinsTimeSync = async () => {
  pinsTimeActionLoading.value = true;
  try {
    const remoteTime = await fetchPinsDeviceTime();
    pinsDeviceTime.value = remoteTime;
    await syncPinsSystemTime(remoteTime, true);

    if (timeInfo.value.timeSyncEnabled && store.mountInfo.Connected) {
      await apiService.mountAction('disconnect');
      await apiService.mountAction('connect');
    }

    await loadTimeInfo();
  } catch (e) {
    console.error('Failed to sync PINS system time:', e);
  } finally {
    pinsTimeActionLoading.value = false;
  }
};

onMounted(() => {
  if (store.isBackendReachable) {
    loadTimeInfo();
  }
});
</script>
