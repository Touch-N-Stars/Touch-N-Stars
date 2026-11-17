import { ref, watch } from 'vue';
import { apiStore } from '@/store/store';
import { createHotspotSettingsApi } from './hotspotSettingsApi';

export function normalizeBandOrAuto(rawBand) {
  const band = typeof rawBand === 'string' ? rawBand.trim() : '';
  if (band === '2.4GHz' || band === '5GHz') {
    return band;
  }
  return 'auto';
}

export function normalizeChannelInput(rawChannel) {
  if (rawChannel === '' || rawChannel === null || typeof rawChannel === 'undefined') {
    return '';
  }

  const numeric = Number(rawChannel);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return '';
  }

  return String(numeric);
}

export function extractBackendErrorDetail(error) {
  const details = error?.response?.data;
  if (typeof details === 'string' && details.trim()) {
    return details.trim();
  }
  if (details && typeof details.message === 'string' && details.message.trim()) {
    return details.message.trim();
  }
  if (details && typeof details.detail === 'string' && details.detail.trim()) {
    return details.detail.trim();
  }
  return error?.message || 'Unknown error';
}

/**
 * Validates the hotspot form and builds the `PUT` payload.
 * @returns {{ payload: object } | { errorKey: string }} errorKey is an i18n key for the log
 */
export function buildHotspotSavePayload({ password, band, channel }) {
  const trimmedPassword = (password || '').trim();
  if (!trimmedPassword || trimmedPassword.length < 8 || trimmedPassword.length > 63) {
    return { errorKey: 'plugins.pins.logs.hotspotPasswordInvalidLength' };
  }

  const trimmedChannel = String(channel || '').trim();
  if (trimmedChannel && !/^[1-9]\d*$/.test(trimmedChannel)) {
    return { errorKey: 'plugins.pins.logs.hotspotChannelInvalid' };
  }

  const payload = { password: trimmedPassword };
  if (band === '2.4GHz' || band === '5GHz') {
    payload.band = band;
  }
  if (trimmedChannel) {
    payload.channel = Number(trimmedChannel);
  }
  return { payload };
}

/** Field hotspot password, band and channel (Network tab). */
export function usePinsHotspot({ t, runner }) {
  const store = apiStore();
  const { isBusy, appendLog, getIp, logServerError } = runner;
  const hotspotSettingsApi = createHotspotSettingsApi();

  const hotspotPassword = ref('');
  // Session-only fallback so a band/channel change can be saved without retyping.
  const lastHotspotPassword = ref('');
  const hotspotConfigured = ref(false);
  const hotspotBand = ref('auto');
  const hotspotChannel = ref('');
  const hotspotSource = ref('default');
  const hotspotInterface = ref('');
  const supportedChannels = ref({});
  const hotspotSaveResult = ref(null);
  const isHotspotLoading = ref(false);
  const isHotspotSaving = ref(false);

  async function loadHotspotSettings() {
    if (!getIp()) {
      appendLog(t('plugins.pins.logs.noIp'));
      return;
    }

    isHotspotLoading.value = true;
    try {
      const data = await hotspotSettingsApi.fetchHotspotSettings();
      hotspotConfigured.value = Boolean(data.configured);
      hotspotSource.value = data.source === 'configured' ? 'configured' : 'default';
      hotspotBand.value = normalizeBandOrAuto(data.band);
      hotspotChannel.value = normalizeChannelInput(data.channel);
      hotspotInterface.value = data.hotspotInterface || '';
      supportedChannels.value =
        data.supportedChannels && typeof data.supportedChannels === 'object'
          ? data.supportedChannels
          : {};

      appendLog(
        t('plugins.pins.logs.hotspotFetched', {
          configured: hotspotConfigured.value ? 'true' : 'false',
          source: hotspotSource.value,
          band: data.band || 'unset',
          channel: data.channel ?? 'unset',
        })
      );
    } catch (error) {
      console.error(error);
      appendLog(
        t('plugins.pins.logs.hotspotFetchFailed', { message: extractBackendErrorDetail(error) })
      );
      logServerError(error);
    } finally {
      isHotspotLoading.value = false;
    }
  }

  async function saveHotspotSettings() {
    if (isBusy.value || isHotspotSaving.value) return;

    if (!getIp()) {
      appendLog(t('plugins.pins.logs.noIp'));
      return;
    }

    const result = buildHotspotSavePayload({
      password: hotspotPassword.value || lastHotspotPassword.value,
      band: hotspotBand.value,
      channel: hotspotChannel.value,
    });
    if (result.errorKey) {
      appendLog(t(result.errorKey));
      return;
    }
    const { payload } = result;

    isHotspotSaving.value = true;
    appendLog(t('plugins.pins.logs.hotspotSaving'));

    try {
      const data = await hotspotSettingsApi.updateHotspotSettings(payload);
      hotspotConfigured.value = Boolean(data.configured);
      lastHotspotPassword.value = payload.password;
      hotspotSaveResult.value = {
        status: data.status || 'success',
        message: data.message || 'Hotspot settings updated',
        appliedToActiveHotspot: Boolean(data.appliedToActiveHotspot),
        band: data.band || null,
        channel: typeof data.channel === 'number' ? data.channel : null,
      };

      appendLog(
        t('plugins.pins.logs.hotspotSaved', {
          message: data.message || 'OK',
          applied: data.appliedToActiveHotspot ? 'true' : 'false',
        })
      );

      // Keep the input empty while retaining a session-only fallback password for future saves.
      hotspotPassword.value = '';

      // Refresh capabilities + normalized values after save.
      await loadHotspotSettings();
    } catch (error) {
      console.error(error);
      hotspotSaveResult.value = null;
      appendLog(
        t('plugins.pins.logs.hotspotSaveFailed', { message: extractBackendErrorDetail(error) })
      );
      logServerError(error);
    } finally {
      isHotspotSaving.value = false;
    }
  }

  watch(
    () => store.isPINS,
    (isPins) => {
      if (isPins) loadHotspotSettings();
    },
    { immediate: true }
  );

  return {
    hotspotPassword,
    lastHotspotPassword,
    hotspotConfigured,
    hotspotBand,
    hotspotChannel,
    hotspotSource,
    hotspotInterface,
    supportedChannels,
    hotspotSaveResult,
    isHotspotLoading,
    isHotspotSaving,
    loadHotspotSettings,
    saveHotspotSettings,
  };
}
