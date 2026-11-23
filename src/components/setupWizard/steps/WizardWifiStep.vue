<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.wifi.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.wifi.description') }}
      </p>
    </div>

    <!-- Current connection -->
    <div v-if="isLoadingStatus && !wifiStatus" class="text-sm text-content-muted">
      {{ t('components.setupWizard.wifi.loadingStatus') }}
    </div>

    <div
      v-else-if="isConnected"
      class="flex items-start gap-3 rounded-control border border-status-ok/40 bg-status-ok/10 p-3"
    >
      <span class="tns-dot bg-status-ok mt-1.5"></span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-content">
          {{ t('components.setupWizard.wifi.connectedTo', { ssid: wifiStatus?.ssid || '—' }) }}
        </p>
        <p class="text-xs text-content-muted break-all">
          {{ connectionDetails }}
        </p>
      </div>
    </div>

    <div
      v-else
      class="flex items-start gap-3 rounded-control border border-status-warn/40 bg-status-warn/10 p-3"
    >
      <span class="tns-dot bg-status-warn mt-1.5"></span>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-content">{{ t('components.setupWizard.wifi.notConnected') }}</p>
        <p class="text-xs text-content-muted mt-1">
          {{ t('components.setupWizard.wifi.notConnectedHint') }}
        </p>
      </div>
    </div>

    <!-- Network transition feedback -->
    <div v-if="isTransitioning" class="flex flex-col gap-2 rounded-control bg-surface-2 p-3">
      <p class="text-sm text-content">{{ t('components.setupWizard.wifi.transitionHint') }}</p>
      <p class="text-xs text-content-faint font-mono">{{ rigConnectionState.phase }}</p>
    </div>

    <button v-if="showRetryFind" class="tns-btn-secondary" :disabled="isBusy" @click="retryFindRig">
      {{ t('components.setupWizard.wifi.retryFind') }}
    </button>

    <!-- Join a network. Not connected is the first-run state: the rig runs its own hotspot
         and the phone is on it, so this is the only way into the home network here. -->
    <button
      v-if="statusLoaded && !showPicker"
      class="tns-btn-secondary"
      :disabled="isBusy"
      @click="openPicker"
    >
      {{
        isConnected
          ? t('components.setupWizard.wifi.chooseOtherNetwork')
          : t('components.setupWizard.wifi.scan')
      }}
    </button>

    <template v-if="showPicker">
      <button class="tns-btn-secondary" :disabled="isBusy || isScanning" @click="scanNetworks">
        <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': isScanning }" />
        {{
          isScanning
            ? t('components.setupWizard.wifi.scanning')
            : t('components.setupWizard.wifi.scan')
        }}
      </button>

      <template v-if="networks.length">
        <label class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase text-content-muted">
            {{ t('components.setupWizard.wifi.selectNetwork') }}
          </span>
          <select v-model="selectedSsid" class="tns-select" :disabled="isBusy">
            <option value="" disabled>{{ t('components.setupWizard.wifi.selectNetwork') }}</option>
            <option v-for="net in networks" :key="net.ssid" :value="net.ssid">
              {{ net.ssid }} ({{ net.quality }}) {{ net.encrypted ? '🔒' : '' }}
            </option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-xs font-semibold uppercase text-content-muted">
            {{ t('components.setupWizard.wifi.password') }}
          </span>
          <input
            v-model="password"
            type="password"
            autocomplete="off"
            class="tns-input"
            :disabled="isBusy"
            :placeholder="t('components.setupWizard.wifi.passwordPlaceholder')"
          />
        </label>

        <label class="flex items-center gap-2 text-sm text-content-muted">
          <input v-model="autoConnect" type="checkbox" class="w-5 h-5" :disabled="isBusy" />
          {{ t('components.setupWizard.wifi.autoConnect') }}
        </label>

        <button
          class="tns-btn-primary"
          :disabled="isBusy || !selectedSsid"
          @click="connectToNetwork"
        >
          {{
            isConnecting
              ? t('components.setupWizard.wifi.connecting')
              : t('components.setupWizard.wifi.connect')
          }}
        </button>
      </template>

      <p v-else-if="hasScanned && !isScanning" class="text-sm text-content-muted italic">
        {{ t('components.setupWizard.wifi.noNetworks') }}
      </p>
    </template>

    <p v-if="errorMessage" class="text-sm text-status-danger break-words">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import apiPinsService from '@/services/apiPinsService';
import { usePolling } from '@/composables/usePolling';
import {
  beginNetworkTransition,
  identifySelectedRig,
  recoverRigConnection,
  rigConnectionState,
} from '@/services/rigConnectionSupervisor';

const { t } = useI18n();

const wifiStatus = ref(null);
const networks = ref([]);
const selectedSsid = ref('');
const password = ref('');
const autoConnect = ref(true);
const isLoadingStatus = ref(false);
const isScanning = ref(false);
const isConnecting = ref(false);
const isRecovering = ref(false);
const hasScanned = ref(false);
// Set after the first status read, so the join button does not flash up while it loads.
const statusLoaded = ref(false);
const showPicker = ref(false);
const errorMessage = ref('');

const isConnected = computed(() => Boolean(wifiStatus.value?.connected));
const isBusy = computed(() => isConnecting.value || isRecovering.value);
const isTransitioning = computed(() =>
  ['network-transition', 'probing', 'reconnecting'].includes(rigConnectionState.phase)
);
const showRetryFind = computed(() => rigConnectionState.phase === 'failed');

const connectionDetails = computed(() => {
  const status = wifiStatus.value;
  if (!status) return '';
  return [status.ipAddress, status.interface, status.band].filter(Boolean).join(' · ');
});

// Keeps the panel honest while the rig re-associates; stops on unmount.
usePolling(
  () => {
    if (!isBusy.value) return loadStatus();
  },
  10000,
  { immediate: false }
);

async function loadStatus() {
  isLoadingStatus.value = true;
  try {
    wifiStatus.value = (await apiPinsService.getPinsWifiStatus()) || null;
  } catch (error) {
    console.error('[PinsWizard] WiFi status failed:', error);
    wifiStatus.value = null;
  } finally {
    isLoadingStatus.value = false;
    statusLoaded.value = true;
  }
}

function openPicker() {
  showPicker.value = true;
  if (!hasScanned.value) scanNetworks();
}

async function scanNetworks() {
  if (isScanning.value) return;
  isScanning.value = true;
  errorMessage.value = '';
  networks.value = [];
  try {
    const found = (await apiPinsService.scanPinsWifi()) || [];
    // Same normalization as the PINS network tab: drop empty SSIDs, keep the
    // strongest entry per SSID, strongest first.
    const seen = new Set();
    networks.value = found
      .filter((net) => {
        if (!net.ssid || seen.has(net.ssid)) return false;
        seen.add(net.ssid);
        return true;
      })
      .sort((a, b) => b.signal_strength - a.signal_strength);
    hasScanned.value = true;
  } catch (error) {
    console.error('[PinsWizard] WiFi scan failed:', error);
    errorMessage.value = t('components.setupWizard.wifi.scanFailed', { message: error.message });
  } finally {
    isScanning.value = false;
  }
}

async function connectToNetwork() {
  if (isBusy.value || !selectedSsid.value) return;

  isConnecting.value = true;
  errorMessage.value = '';
  try {
    await identifySelectedRig();
    const data = await apiPinsService.connectPinsWifi({
      ssid: selectedSsid.value,
      password: password.value,
      auto_connect: autoConnect.value,
      band: null,
      client_interface: null,
      hotspot_interface: null,
    });

    const jobId = data && typeof data === 'object' ? data.jobId : data;
    if (jobId) {
      // The rig's address changes underneath us - the supervisor finds it again.
      await beginNetworkTransition({ requestedMode: 'client', operationId: jobId });
    }

    await loadStatus();
    if (wifiStatus.value?.connected) {
      showPicker.value = false;
    }
  } catch (error) {
    console.error('[PinsWizard] WiFi connect failed:', error);
    errorMessage.value = t('components.setupWizard.wifi.connectFailed', { message: error.message });
  } finally {
    // Network credentials are session-only and are discarded after submission.
    password.value = '';
    isConnecting.value = false;
  }
}

async function retryFindRig() {
  if (isBusy.value) return;
  isRecovering.value = true;
  errorMessage.value = '';
  try {
    await recoverRigConnection({
      requestedMode: rigConnectionState.requestedMode || 'client',
      operationId: rigConnectionState.operationId || '',
    });
    await loadStatus();
  } catch (error) {
    errorMessage.value = t('components.setupWizard.wifi.retryFailed', { message: error.message });
  } finally {
    isRecovering.value = false;
  }
}

onMounted(loadStatus);
</script>
