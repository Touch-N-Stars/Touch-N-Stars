import apiPinsService from '@/services/apiPinsService';

export function createHotspotSettingsApi() {
  async function fetchHotspotSettings() {
    const response = await apiPinsService.getPinsHotspotSettings();
    return response || {};
  }

  async function updateHotspotSettings(payload) {
    const response = await apiPinsService.setPinsHotspotSettings(payload);
    return response || {};
  }

  return {
    fetchHotspotSettings,
    updateHotspotSettings,
  };
}
