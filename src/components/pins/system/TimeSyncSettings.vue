<template>
  <div v-if="store.isBackendReachable" class="tns-card flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <h3 class="tns-section-title">
        {{ $t('components.settings.timeSync.title') }}
      </h3>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
      <div class="bg-surface-2 rounded-control p-2">
        <div class="text-content-muted mb-1">
          {{ $t('components.settings.timeSync.backendTime') }}
        </div>
        <div class="text-content font-mono">
          {{
            timeInfo.backendUtc
              ? new Date(timeInfo.backendUtc).toLocaleString(undefined, { timeZoneName: 'short' })
              : '—'
          }}
        </div>
      </div>
      <div class="bg-surface-2 rounded-control p-2">
        <div class="text-content-muted mb-1">
          {{ $t('components.settings.timeSync.mountTime') }}
        </div>
        <div v-if="!timeInfo.mountConnected" class="text-content-faint italic">
          {{ $t('components.settings.timeSync.mountNotConnected') }}
        </div>
        <div v-else-if="timeInfo.mountUtc" class="text-content font-mono">
          {{ new Date(timeInfo.mountUtc).toLocaleString(undefined, { timeZoneName: 'short' }) }}
        </div>
        <div v-else class="text-content-faint italic">
          {{ $t('components.settings.timeSync.notSupported') }}
        </div>
      </div>
      <div class="bg-surface-2 rounded-control p-2">
        <div class="text-content-muted mb-1">{{ $t('plugins.pins.deviceTime') }}</div>
        <div class="text-content font-mono">
          {{ clientTime }}
        </div>
      </div>
    </div>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1">
        <p class="text-content text-sm">{{ $t('components.settings.timeSync.syncLabel') }}</p>
        <InfoModal
          :title="$t('components.settings.timeSync.syncLabel')"
          :message="$t('components.settings.timeSync.syncLabelInfo')"
          size="w-4 h-4"
        />
      </div>
      <ToggleButton :statusValue="timeInfo.timeSyncEnabled" @update:statusValue="toggleTimeSync" />
    </div>
    <div class="flex items-center justify-between">
      <p class="text-content text-sm mr-4">{{ $t('plugins.pins.autoSync') }}</p>
      <ToggleButton
        :statusValue="pinsStore.timeSyncEnabled"
        @update:statusValue="togglePinsTimeSync"
      />
    </div>
    <div class="flex items-center justify-between gap-2">
      <button
        class="tns-btn-secondary"
        :disabled="pinsTimeActionLoading"
        @click="manualPinsTimeSync"
      >
        <Spinner v-if="pinsTimeActionLoading" size="sm" />
        {{ $t('plugins.pins.syncNow') }}
      </button>
      <button
        v-if="pinsStore.suppressTimeWarning"
        class="min-h-touch shrink-0 text-xs text-status-warn hover:brightness-110 underline"
        @click="pinsStore.setSuppressTimeWarning(false)"
      >
        {{ $t('plugins.pins.timeWarning.reenable') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { usePolling } from '@/composables/usePolling';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { usePinsStore } from '@/store/pinsStore';
import { useGuiderStore } from '@/store/guiderStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useToastStore } from '@/store/toastStore';
import ToggleButton from '@/components/helpers/toggleButton.vue';
import InfoModal from '@/components/helpers/infoModal.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import apiService from '@/services/apiService';
import axios from 'axios';
import { getDeviceDateTimePayload, parsePinsTimeToSeconds } from '@/utils/pinsTimeUtils';
import { PINS_PORT, DEFAULT_PINS_DAEMON_API_TOKEN as PINS_TOKEN } from '@/services/pinsConfig';

const { t } = useI18n();
const store = apiStore();
const pinsStore = usePinsStore();
const settingsStore = useSettingsStore();
const toast = useToastStore();

const pinsTimeActionLoading = ref(false);
const pinsDeviceTime = ref(null);
const clientTime = ref('—');
const timeInfo = ref({
  backendUtc: null,
  mountUtc: null,
  timeSyncEnabled: false,
  mountConnected: false,
});

function getPinsIp() {
  return settingsStore.connection.ip || window.location.hostname;
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
  clientTime.value = new Date().toLocaleString(undefined, { timeZoneName: 'short' });
  try {
    const data = await apiService.getTnsTime();
    if (data) {
      timeInfo.value = {
        ...data,
        mountUtc: store.mountInfo?.Coordinates?.DateTime?.UtcNow ?? null,
      };
    }
    await loadPinsTimeInfo();
  } catch (e) {
    console.error('Failed to load time info:', e);
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
      const guiderStore = useGuiderStore();
      const isPhd2 = store.guiderInfo?.DeviceId === 'PHD2_Single';
      const isPhd2EquipmentConnected = isPhd2 && guiderStore.phd2IsConnected;

      let phd2ProfileName = null;
      if (isPhd2EquipmentConnected) {
        try {
          const profileResponse = await apiService.getPhd2CurrentProfile();
          phd2ProfileName = profileResponse?.Response?.Profile?.name ?? null;
        } catch (e) {
          console.warn('Could not get PHD2 profile before mount reconnect:', e);
        }
      }

      await apiService.mountAction('disconnect');
      await apiService.mountAction('connect');

      if (phd2ProfileName) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          await apiService.connectPHD2Equipment(phd2ProfileName);
        } catch (e) {
          console.warn('Could not reconnect PHD2 equipment after mount reconnect:', e);
        }
      }
    }

    await loadTimeInfo();
    toast.showToast({
      type: 'success',
      title: t('components.settings.timeSync.title'),
      message: t('components.settings.timeSync.syncSuccess'),
    });
  } catch (e) {
    console.error('Failed to sync PINS system time:', e);
    toast.showToast({
      type: 'error',
      title: t('components.settings.timeSync.title'),
      message: t('components.settings.timeSync.syncError'),
    });
  } finally {
    pinsTimeActionLoading.value = false;
  }
};

usePolling(() => {
  if (store.isBackendReachable) loadTimeInfo();
}, 1000);
</script>
