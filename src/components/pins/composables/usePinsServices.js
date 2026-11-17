import { ref, watch } from 'vue';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import { parseJobIdFromResponse } from './pinsJobPolling';

/** Samba share and PHD2 service on the PINS host (Services tab). */
export function usePinsServices({ t, runner }) {
  const store = apiStore();
  const { status, isBusy, appendLog, getIp, beginOperation, logServerError, logDaemonError } =
    runner;

  const sambaEnabled = ref(false);
  const phd2Enabled = ref(false);
  const phd2Running = ref(false);

  async function checkSambaStatus() {
    if (!getIp()) return;

    try {
      const response = await apiPinsService.getPinsSambaStatus();

      if (response && typeof response.enabled !== 'undefined') {
        sambaEnabled.value = response.enabled;
      }
    } catch (error) {
      console.error('Failed to check Samba status:', error);
    }
  }

  async function checkPhd2Status() {
    if (!getIp()) return;

    try {
      const response = await apiPinsService.getPinsPhd2Status();

      if (response) {
        if (typeof response.enabled !== 'undefined') {
          phd2Enabled.value = response.enabled;
        }
        if (typeof response.running !== 'undefined') {
          phd2Running.value = response.running;
        }
      }
    } catch (error) {
      console.error('Failed to check PHD2 status:', error);
    }
  }

  async function toggleSamba(newValue) {
    if (isBusy.value) return;

    const ip = beginOperation('samba');
    if (!ip) return;

    sambaEnabled.value = newValue;
    const actionKey = newValue ? 'plugins.pins.logs.sambaEnable' : 'plugins.pins.logs.sambaDisable';
    appendLog(t('plugins.pins.logs.sambaAction', { action: t(actionKey) }));

    try {
      const data = await apiPinsService.setPinsSambaStatus(newValue);
      const returnedJobId = parseJobIdFromResponse(data);

      if (!returnedJobId) {
        throw new Error('No valid Job ID returned. server response: ' + JSON.stringify(data));
      }

      appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
      runner.followJobLog(ip, returnedJobId);
    } catch (error) {
      console.error(error);
      status.value = 'Failed';
      sambaEnabled.value = !newValue; // Revert on failure
      logDaemonError(error, ip);
    }
  }

  async function togglePhd2(newValue) {
    if (isBusy.value) return;

    const ip = beginOperation('phd2');
    if (!ip) return;

    phd2Enabled.value = newValue; // Optimistic update
    const actionKey = newValue
      ? 'plugins.pins.logs.phd2Enabling'
      : 'plugins.pins.logs.phd2Disabling';
    appendLog(t('plugins.pins.logs.phd2Action', { action: t(actionKey) }));

    try {
      const data = await apiPinsService.setPinsPhd2Status(newValue);
      const returnedJobId = parseJobIdFromResponse(data);

      if (returnedJobId) {
        appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
        runner.followJobLog(ip, returnedJobId);
      } else {
        appendLog(t('plugins.pins.logs.phd2Success'));
        status.value = 'Success';
        phd2Running.value = newValue;

        // Double check status after delay
        setTimeout(checkPhd2Status, 2000);
      }
    } catch (error) {
      status.value = 'Failed';
      phd2Enabled.value = !newValue; // Revert
      console.error(error);
      appendLog(t('plugins.pins.logs.phd2Failed', { message: error.message }));
      logServerError(error);
    }
  }

  watch(
    () => store.isPINS,
    (isPins) => {
      if (isPins) {
        checkSambaStatus();
        checkPhd2Status();
      }
    },
    { immediate: true }
  );

  return {
    sambaEnabled,
    phd2Enabled,
    phd2Running,
    toggleSamba,
    togglePhd2,
  };
}
