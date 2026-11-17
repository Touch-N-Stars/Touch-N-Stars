import { ref } from 'vue';
import apiPinsService from '@/services/apiPinsService';
import { resolveWifiInterfaceSelection } from './wifiInterfaceSelection';

export function usePinsWifiInterfaces({ t, appendLog, getIp, status }) {
  const wifiAdapters = ref([]);
  const isWifiAdaptersLoading = ref(false);
  const isWifiInterfacesSaving = ref(false);
  const selectedClientInterface = ref('');
  const selectedHotspotInterface = ref('');

  function normalizeWifiAdapter(adapter) {
    if (!adapter || typeof adapter !== 'object') {
      return null;
    }

    return {
      interface: adapter.interface || '',
      state: adapter.state || 'unknown',
      connection: adapter.connection ?? null,
      role: adapter.role || 'idle',
      mac: adapter.mac ?? null,
      driver: adapter.driver ?? null,
      mtu: adapter.mtu ?? null,
    };
  }

  function reconcileSelectedWifiInterfaces() {
    const resolved = resolveWifiInterfaceSelection(
      wifiAdapters.value,
      selectedClientInterface.value,
      selectedHotspotInterface.value
    );
    selectedClientInterface.value = resolved.clientInterface;
    selectedHotspotInterface.value = resolved.hotspotInterface;
  }

  async function loadWifiAdapters() {
    const ip = getIp();
    if (!ip || isWifiAdaptersLoading.value) return;

    isWifiAdaptersLoading.value = true;
    try {
      const response = await apiPinsService.getPinsWifiAdapters();
      const adapters = response?.adapters || [];
      wifiAdapters.value = adapters.map(normalizeWifiAdapter).filter(Boolean);
      reconcileSelectedWifiInterfaces();
    } catch (error) {
      console.error(error);
      appendLog(t('plugins.pins.logs.wifiAdaptersLoadFailed', { message: error.message }));
    } finally {
      isWifiAdaptersLoading.value = false;
    }
  }

  async function loadWifiInterfaces() {
    const ip = getIp();
    if (!ip) return;

    try {
      const data = (await apiPinsService.getPinsWifiInterfaces()) || {};
      selectedClientInterface.value = data.client_interface || '';
      selectedHotspotInterface.value = data.hotspot_interface || '';
      // No reconcile here: this runs in parallel with loadWifiAdapters, and reconciling against
      // a not yet loaded (empty) adapter list wipes the configured roles back to wlan0/wlan0.
      // loadWifiInterfaceConfig reconciles once both requests are done.
    } catch (error) {
      console.error(error);
      appendLog(t('plugins.pins.logs.wifiInterfacesLoadFailed', { message: error.message }));
    }
  }

  async function loadWifiInterfaceConfig() {
    await Promise.all([loadWifiAdapters(), loadWifiInterfaces()]);
    reconcileSelectedWifiInterfaces();
  }

  async function saveWifiInterfaces() {
    if (status.value === 'Running' || isWifiInterfacesSaving.value) return;

    const ip = getIp();
    if (!ip) {
      appendLog(t('plugins.pins.logs.noIp'));
      return;
    }

    isWifiInterfacesSaving.value = true;
    try {
      const data =
        (await apiPinsService.setPinsWifiInterfaces({
          clientInterface: selectedClientInterface.value || null,
          hotspotInterface: selectedHotspotInterface.value || null,
        })) || {};
      selectedClientInterface.value = data.client_interface || '';
      selectedHotspotInterface.value = data.hotspot_interface || '';
      reconcileSelectedWifiInterfaces();
      appendLog(
        t('plugins.pins.logs.wifiInterfacesSaved', {
          clientInterface: selectedClientInterface.value || 'auto',
          hotspotInterface: selectedHotspotInterface.value || 'auto',
        })
      );
      await loadWifiAdapters();
    } catch (error) {
      console.error(error);
      appendLog(t('plugins.pins.logs.wifiInterfacesSaveFailed', { message: error.message }));

      if (error.response) {
        appendLog(
          t('plugins.pins.logs.serverError', {
            status: error.response.status,
            data: JSON.stringify(error.response.data),
          })
        );
      }
    } finally {
      isWifiInterfacesSaving.value = false;
    }
  }

  return {
    wifiAdapters,
    isWifiAdaptersLoading,
    isWifiInterfacesSaving,
    selectedClientInterface,
    selectedHotspotInterface,
    loadWifiInterfaceConfig,
    saveWifiInterfaces,
  };
}
