import { computed, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import apiPinsService from '@/services/apiPinsService';
import { useSettingsStore } from '@/store/settingsStore';
import { usePinsStore } from '@/store/pinsStore';
import { PINS_PORT as PORT, DEFAULT_PINS_DAEMON_API_TOKEN as TOKEN } from '@/services/pinsConfig';
import { isJobSuccess } from './pinsJobPolling';

/**
 * Shared operation plumbing for the PINS page tabs: the terminal log and status live in
 * the pins store, so every tab reports into the same terminal on the Update tab.
 * Only one daemon operation runs at a time; `isBusy` gates every action.
 */
export function usePinsJobRunner({ t }) {
  const settingsStore = useSettingsStore();
  const pinsStore = usePinsStore();
  const { terminalStatus: status, activeOperation, currentJobId: jobId } = storeToRefs(pinsStore);

  const isBusy = computed(() => status.value === 'Running');

  let ws = null;
  let isUnmounting = false;

  function appendLog(message) {
    pinsStore.appendTerminalLog(message);
  }

  function getIp() {
    return settingsStore.connection.ip || window.location.hostname;
  }

  /**
   * Marks a new operation as running and resets the terminal.
   * @returns {string|null} the daemon host, or null when none is known (already logged)
   */
  function beginOperation(operation) {
    const ip = getIp();
    if (!ip) {
      appendLog(t('plugins.pins.logs.noIp'));
      return null;
    }

    status.value = 'Running';
    pinsStore.setActiveOperation(operation);
    pinsStore.clearTerminalLogs();
    appendLog(t('plugins.pins.logs.init', { ip }));
    return ip;
  }

  function logServerError(error) {
    if (!error.response) return;
    appendLog(
      t('plugins.pins.logs.serverError', {
        status: error.response.status,
        data: JSON.stringify(error.response.data),
      })
    );
  }

  // Detailed diagnosis for operations whose failure usually means the daemon is unreachable.
  function logDaemonError(error, ip, { corsHint = false } = {}) {
    appendLog(t('plugins.pins.logs.daemonCheck', { ip, port: PORT }));

    if (error.response) {
      logServerError(error);
      if (corsHint && error.response.status === 405) {
        appendLog(t('plugins.pins.logs.corsHint'));
      }
    } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      appendLog(t('plugins.pins.logs.networkError'));
    } else if (error.request) {
      appendLog(t('plugins.pins.logs.noResponse'));
    } else {
      appendLog(t('plugins.pins.logs.error', { message: error.message }));
    }
  }

  /**
   * Streams the daemon's job log into the terminal and resolves the final status when the
   * socket closes. `onClosed(ip)` may take over (returning true), as the upgrade tracker does.
   */
  function followJobLog(ip, id, { onClosed } = {}) {
    jobId.value = id;
    if (ws) {
      ws.close();
    }

    const wsUrl = `ws://${ip}:${PORT}/logs/${id}?token=${TOKEN}`;
    appendLog(t('plugins.pins.logs.wsConnecting', { wsUrl }));

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        appendLog(t('plugins.pins.logs.wsConnected'));
      };

      ws.onmessage = (event) => {
        if (event.data) {
          appendLog(event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        appendLog(t('plugins.pins.logs.wsError'));
      };

      ws.onclose = (event) => {
        if (isUnmounting) {
          return;
        }

        appendLog(t('plugins.pins.logs.wsClosed', { code: event.code }));
        ws = null;

        if (onClosed?.(ip)) {
          return;
        }

        checkFinalStatus(id);
      };
    } catch (e) {
      appendLog(t('plugins.pins.logs.wsCreationFailed', { message: e.message }));
      status.value = 'Failed';
    }
  }

  async function checkFinalStatus(id) {
    appendLog(t('plugins.pins.logs.verifyingStatus'));
    try {
      const result = await apiPinsService.getPinsDaemonJob(id);
      if (typeof result === 'object') {
        appendLog(t('plugins.pins.logs.jobReport', { report: JSON.stringify(result, null, 2) }));

        if (isJobSuccess(result)) {
          status.value = 'Success';
          appendLog(t('plugins.pins.logs.upgradeSuccess'));
        } else {
          status.value = 'Failed';
          appendLog(
            t('plugins.pins.logs.upgradeFailed', { exitCode: result.exitCode ?? 'Unknown' })
          );
        }
      } else {
        appendLog(t('plugins.pins.logs.jobStatus', { status: result }));
        status.value = 'Idle';
      }
    } catch (e) {
      appendLog(t('plugins.pins.logs.statusFetchFailed', { message: e.message }));
      if (status.value === 'Running') status.value = 'Idle';
    }
  }

  onUnmounted(() => {
    isUnmounting = true;
    if (ws) {
      ws.close();
      ws = null;
    }
  });

  return {
    pinsStore,
    status,
    activeOperation,
    jobId,
    isBusy,
    appendLog,
    getIp,
    beginOperation,
    logServerError,
    logDaemonError,
    followJobLog,
  };
}
