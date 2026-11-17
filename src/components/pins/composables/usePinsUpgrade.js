import { watch } from 'vue';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import { usePinsUpgradeTracker } from './usePinsUpgradeTracker';
import { parseJobIdFromResponse } from './pinsJobPolling';

/** System upgrade of the PINS host (Update tab). */
export function usePinsUpgrade({ t, runner }) {
  const store = apiStore();
  const { pinsStore, status, jobId, activeOperation, isBusy, appendLog, getIp } = runner;

  const {
    upgradeExitCode,
    stopUpgradePolling,
    restoreUpgradeState,
    beginUpgradeTrackingFromStart,
    adoptRunningUpgrade,
    handleUpgradeWsClosed,
    resetUpgradeForNewRun,
  } = usePinsUpgradeTracker({
    t,
    appendLog,
    pinsStore,
    status,
    jobId,
    activeOperation,
    getIp,
    shouldWaitForApiRecovery: () => !store.isBackendReachable,
  });

  async function startUpgrade() {
    if (isBusy.value) return;

    const ip = runner.beginOperation('upgrade');
    if (!ip) {
      status.value = 'Failed';
      return;
    }
    resetUpgradeForNewRun();

    try {
      const data = await apiPinsService.startPinsUpgrade({ dryRun: false });
      const returnedJobId = parseJobIdFromResponse(data);

      if (!returnedJobId) {
        throw new Error('No valid Job ID returned. server response: ' + JSON.stringify(data));
      }

      appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
      beginUpgradeTrackingFromStart(ip, returnedJobId, data);

      // Upgrade status resolution uses polling with /jobs/{id} and /jobs/latest fallback.
      runner.followJobLog(ip, returnedJobId, { onClosed: handleUpgradeWsClosed });
    } catch (error) {
      if (adoptRunningUpgrade(ip, error)) return;
      console.error(error);
      // Without a response the request may still have reached the daemon, so the
      // upgrade is not known to have failed.
      status.value = error?.response ? 'Failed' : 'Unknown';
      runner.logDaemonError(error, ip, { corsHint: true });
    }
  }

  watch(
    () => store.isPINS,
    (isPins) => {
      if (isPins) {
        restoreUpgradeState();
      } else if (!pinsStore.shouldShowUpgradeOverlay) {
        // Keep polling while an upgrade lifecycle is active, even if PINS detection
        // temporarily drops during service restart.
        stopUpgradePolling();
      }
    },
    { immediate: true }
  );

  // No stop on unmount: the tracker is app-wide and drives the global overlay in App.vue,
  // which stays up when this tab unmounts (route change, orientation re-key). It stops on
  // its own once the upgrade reaches a final or unknown state.

  return {
    upgradeExitCode,
    startUpgrade,
  };
}
