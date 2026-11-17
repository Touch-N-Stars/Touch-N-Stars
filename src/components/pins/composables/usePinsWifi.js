import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import { WifiSignal } from '@/utils/wifiSignal';
import { usePolling } from '@/composables/usePolling';
import {
  beginNetworkTransition,
  identifySelectedRig,
  recoverRigConnection,
  rigConnectionState,
} from '@/services/rigConnectionSupervisor';
import { usePinsWifiInterfaces } from './usePinsWifiInterfaces';
import { parseJobIdFromResponse } from './pinsJobPolling';

/**
 * Keeps one entry per SSID (first wins), drops hidden networks and sorts by signal.
 */
export function dedupeWifiNetworks(networks) {
  const seen = new Set();
  return (networks || [])
    .filter((n) => {
      if (!n.ssid) return false;
      if (seen.has(n.ssid)) return false;
      seen.add(n.ssid);
      return true;
    })
    .sort((a, b) => b.signal_strength - a.signal_strength);
}

async function loadMobileWifiSignal() {
  try {
    return await WifiSignal.getCurrent();
  } catch (error) {
    return {
      available: false,
      platform: 'unknown',
      reason: error?.message || 'native-unavailable',
      source: 'mobile-device',
    };
  }
}

/** Wi-Fi client, network mode, adapters and DHCP clients of the PINS host (Network tab). */
export function usePinsWifi({ t, runner }) {
  const store = apiStore();
  const { pinsStore, status, jobId, isBusy, appendLog, getIp, logServerError } = runner;
  const {
    stationaryMode,
    wifiList,
    selectedSsid,
    wifiPassword,
    selectedBand,
    autoConnect,
    isScanning,
    wifiConnected,
  } = storeToRefs(pinsStore);

  const wifiStatus = ref(null);
  const wifiMode = ref(null);
  const mobileWifiSignal = ref(null);
  const dhcpClients = ref([]);
  const isDhcpClientsLoading = ref(false);
  const showDisconnectWifiModal = ref(false);

  const {
    wifiAdapters,
    isWifiAdaptersLoading,
    isWifiInterfacesSaving,
    selectedClientInterface,
    selectedHotspotInterface,
    loadWifiInterfaceConfig,
    saveWifiInterfaces,
  } = usePinsWifiInterfaces({ t, appendLog, getIp, status });

  const allowConcurrentWifiAndHotspot = computed(() => {
    const hasMultipleAdapters = wifiAdapters.value.length >= 2;
    const hasDedicatedClientInterface = Boolean(selectedClientInterface.value);
    const hasDedicatedHotspotInterface = Boolean(selectedHotspotInterface.value);
    const usesDifferentInterfaces =
      selectedClientInterface.value !== selectedHotspotInterface.value;

    return (
      hasMultipleAdapters &&
      hasDedicatedClientInterface &&
      hasDedicatedHotspotInterface &&
      usesDifferentInterfaces
    );
  });

  // WiFi status polling while PINS is detected; stopped automatically on unmount
  const wifiStatusPoller = usePolling(
    () => {
      if (store.isPINS) {
        return loadWifiStatus();
      }
    },
    10000,
    { autoStart: false, immediate: false }
  );

  watch(selectedSsid, () => {
    selectedBand.value = 'auto';
    wifiPassword.value = '';
  });

  async function loadWifiStatus() {
    if (!getIp()) return;

    try {
      const [response, mode, mobileSignal] = await Promise.all([
        apiPinsService.getPinsWifiStatus(),
        apiPinsService.getPinsWifiMode(),
        loadMobileWifiSignal(),
      ]);
      wifiStatus.value = response || null;
      wifiMode.value = mode || null;
      mobileWifiSignal.value = mobileSignal;
      wifiConnected.value = Boolean(response?.connected);
    } catch (error) {
      console.error('Failed to load WiFi status:', error);
      wifiStatus.value = null;
      mobileWifiSignal.value = await loadMobileWifiSignal();
      wifiConnected.value = false;
    }
  }

  async function loadDhcpClients() {
    if (!getIp()) return;

    isDhcpClientsLoading.value = true;
    try {
      const response = await apiPinsService.getPinsDhcpClients();
      dhcpClients.value = response?.clients || [];
    } catch (error) {
      console.error('Failed to load DHCP clients:', error);
      dhcpClients.value = [];
    } finally {
      isDhcpClientsLoading.value = false;
    }
  }

  async function scanWifi() {
    if (!getIp()) {
      appendLog(t('plugins.pins.logs.noIp'));
      return;
    }

    isScanning.value = true;
    wifiList.value = [];

    try {
      await loadWifiStatus();
      wifiList.value = dedupeWifiNetworks(await apiPinsService.scanPinsWifi());
    } catch (error) {
      console.error(error);
      appendLog(t('plugins.pins.logs.error', { message: 'Wifi Scan Failed: ' + error.message }));
    } finally {
      isScanning.value = false;
    }
  }

  function toggleStationary(newValue) {
    if (isBusy.value) return;
    stationaryMode.value = newValue;
    if (newValue) {
      scanWifi();
    } else {
      wifiList.value = [];
      selectedSsid.value = '';
      wifiPassword.value = '';
    }
  }

  async function connectWifi(savedNetwork = null) {
    if (isBusy.value) return;

    const ip = runner.beginOperation('wifi');
    if (!ip) return;
    appendLog(
      t('plugins.pins.logs.connectingToWifi', { ssid: savedNetwork?.ssid || selectedSsid.value })
    );

    try {
      await identifySelectedRig();
      const data = savedNetwork?.uuid
        ? await apiPinsService.connectPinsSavedWifiNetwork(savedNetwork.uuid)
        : await apiPinsService.connectPinsWifi({
            ssid: selectedSsid.value,
            password: wifiPassword.value,
            auto_connect: autoConnect.value,
            band: selectedBand.value === 'auto' ? null : selectedBand.value,
            client_interface: selectedClientInterface.value || null,
            hotspot_interface: selectedHotspotInterface.value || null,
          });
      const returnedJobId = parseJobIdFromResponse(data);

      if (returnedJobId) {
        jobId.value = returnedJobId;
        appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
        appendLog('The rig may disconnect while its Wi-Fi address changes. Looking for it again.');
        await beginNetworkTransition({
          requestedMode: 'client',
          operationId: returnedJobId,
        });
        await loadWifiStatus();
        wifiConnected.value = Boolean(wifiStatus.value?.connected);
        status.value = 'Success';
      } else {
        appendLog(t('plugins.pins.logs.wifiResponse', { response: JSON.stringify(data) }));
        await loadWifiStatus();
        status.value = 'Success';
      }
    } catch (error) {
      console.error(error);
      status.value = 'Failed';
      appendLog(
        t('plugins.pins.logs.error', { message: 'Wifi Connection Failed: ' + error.message })
      );
      logServerError(error);
    } finally {
      // Network credentials are deliberately session-only and are discarded after submission.
      wifiPassword.value = '';
    }
  }

  async function setNetworkMode(desiredMode) {
    if (isBusy.value) return;

    const ip = runner.beginOperation('wifi');
    if (!ip) return;
    appendLog(
      desiredMode === 'hotspot'
        ? 'Switching the rig to its field hotspot…'
        : 'Enabling automatic Wi-Fi with hotspot fallback…'
    );

    try {
      await identifySelectedRig();
      const data = await apiPinsService.setPinsWifiMode(desiredMode);
      const returnedJobId = data?.job?.jobId || data?.jobId || '';

      if (returnedJobId) {
        jobId.value = returnedJobId;
        appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
      }
      appendLog('The current connection may close. This screen will reconnect to the same rig.');
      await beginNetworkTransition({
        requestedMode: desiredMode,
        operationId: returnedJobId,
      });
      await loadWifiStatus();
      status.value = 'Success';
      appendLog(`Rig found at ${rigConnectionState.activeHost || getIp()}.`);
    } catch (error) {
      console.error(error);
      status.value = 'Failed';
      appendLog(
        t('plugins.pins.logs.error', { message: 'Network mode change failed: ' + error.message })
      );
      logServerError(error);
    }
  }

  function requestDisableWifi() {
    if (isBusy.value) return;
    showDisconnectWifiModal.value = true;
  }

  function confirmDisableWifi() {
    showDisconnectWifiModal.value = false;
    setNetworkMode('hotspot');
  }

  async function retryNetworkRecovery() {
    if (isBusy.value) return;
    status.value = 'Running';
    pinsStore.setActiveOperation('wifi');
    try {
      await recoverRigConnection({
        requestedMode: rigConnectionState.requestedMode || wifiMode.value?.desiredMode || '',
        operationId: rigConnectionState.operationId || '',
      });
      await loadWifiStatus();
      status.value = 'Success';
    } catch (error) {
      status.value = 'Failed';
      appendLog(`Rig rediscovery failed: ${error.message}`);
    }
  }

  // Saved-network actions run inside their card; mirror them into the shared busy state.
  function setSavedNetworkBusy(busy) {
    status.value = busy ? 'Running' : 'Success';
  }

  watch(
    () => store.isPINS,
    (isPins) => {
      if (isPins) {
        loadWifiInterfaceConfig();
        loadDhcpClients();
        loadWifiStatus();
        wifiStatusPoller.start();
      } else {
        wifiStatusPoller.stop();
      }
    },
    { immediate: true }
  );

  return {
    stationaryMode,
    wifiList,
    selectedSsid,
    wifiPassword,
    selectedBand,
    autoConnect,
    isScanning,
    wifiStatus,
    wifiMode,
    mobileWifiSignal,
    connectionState: rigConnectionState,
    dhcpClients,
    isDhcpClientsLoading,
    showDisconnectWifiModal,
    wifiAdapters,
    isWifiAdaptersLoading,
    isWifiInterfacesSaving,
    selectedClientInterface,
    selectedHotspotInterface,
    allowConcurrentWifiAndHotspot,
    loadWifiInterfaceConfig,
    saveWifiInterfaces,
    loadDhcpClients,
    scanWifi,
    toggleStationary,
    connectWifi,
    setNetworkMode,
    requestDisableWifi,
    confirmDisableWifi,
    retryNetworkRecovery,
    setSavedNetworkBusy,
  };
}
