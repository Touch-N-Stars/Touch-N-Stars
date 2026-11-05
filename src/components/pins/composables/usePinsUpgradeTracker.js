import { ref } from 'vue';
import apiPinsService from '@/services/apiPinsService';
import { isAppBackgrounded } from '@/utils/appLifecycle';

const LAST_UPGRADE_JOB_ID_KEY = 'lastUpgradeJobId';
const LAST_UPGRADE_JOB_RESULT_KEY = 'lastUpgradeJobResult';
const UPGRADE_POLL_INTERVAL_MS = 3000;
const UPGRADE_INITIAL_BACKOFF_MS = 2000;
const UPGRADE_MAX_BACKOFF_MS = 30000;
const UPGRADE_LATEST_NOT_FOUND_MAX_RETRIES = 2;

export function usePinsUpgradeTracker({
  t,
  appendLog,
  pinsStore,
  status,
  jobId,
  activeOperation,
  getIp,
  shouldWaitForApiRecovery = () => false,
}) {
  const upgradeExitCode = ref(null);
  const isUpgradePolling = ref(false);

  let hasRestoredUpgradeState = false;
  let upgradePollTimer = null;
  let upgradePollBackoffMs = UPGRADE_INITIAL_BACKOFF_MS;
  let lastUpgradeStatus = null;
  let upgradeLatestNotFoundCount = 0;

  function getStorageItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function setStorageItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage write errors.
    }
  }

  function removeStorageItem(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage remove errors.
    }
  }

  function toFiniteNumber(value) {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeUpgradeJob(rawJob) {
    if (!rawJob || typeof rawJob !== 'object') {
      return null;
    }

    return {
      jobId: rawJob.jobId ?? null,
      status: String(rawJob.status ?? '').toLowerCase(),
      exitCode: rawJob.exitCode ?? rawJob.exit_code ?? null,
      startedAt: toFiniteNumber(rawJob.startedAt),
      finishedAt: toFiniteNumber(rawJob.finishedAt),
      command: rawJob.command ?? null,
    };
  }

  function isUpgradeTerminalStatus(statusValue) {
    return statusValue === 'success' || statusValue === 'failed';
  }

  function isUpgradeInProgressStatus(statusValue) {
    return statusValue === 'started' || statusValue === 'running';
  }

  function setUpgradeJobId(nextJobId) {
    pinsStore.setCurrentJobId(nextJobId || null);
    if (nextJobId) {
      setStorageItem(LAST_UPGRADE_JOB_ID_KEY, String(nextJobId));
    } else {
      removeStorageItem(LAST_UPGRADE_JOB_ID_KEY);
    }
  }

  function getStoredUpgradeJobId() {
    return getStorageItem(LAST_UPGRADE_JOB_ID_KEY);
  }

  function saveUpgradeFinalResult(job) {
    setStorageItem(LAST_UPGRADE_JOB_RESULT_KEY, JSON.stringify(job));
  }

  function clearStoredUpgradeFinalResult() {
    removeStorageItem(LAST_UPGRADE_JOB_RESULT_KEY);
  }

  function getStoredUpgradeFinalResult() {
    const raw = getStorageItem(LAST_UPGRADE_JOB_RESULT_KEY);
    if (!raw) {
      return null;
    }

    try {
      return normalizeUpgradeJob(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function clearUpgradePollTimer() {
    if (upgradePollTimer) {
      clearTimeout(upgradePollTimer);
      upgradePollTimer = null;
    }
  }

  function stopUpgradePolling() {
    isUpgradePolling.value = false;
    clearUpgradePollTimer();
    upgradePollBackoffMs = UPGRADE_INITIAL_BACKOFF_MS;
    upgradeLatestNotFoundCount = 0;
  }

  function scheduleUpgradePolling(ip, delayMs = UPGRADE_POLL_INTERVAL_MS) {
    if (!isUpgradePolling.value || !ip) {
      return;
    }

    clearUpgradePollTimer();
    upgradePollTimer = setTimeout(() => {
      // Not with delayMs: it can be 0, which would spin until the app is back in the foreground.
      if (isAppBackgrounded.value) scheduleUpgradePolling(ip);
      else pollUpgradeStatus(ip);
    }, delayMs);
  }

  function shouldRetryUpgradePolling(error) {
    const statusCode = error?.response?.status;
    if (!error?.response) {
      return true;
    }
    if (statusCode >= 500) {
      return true;
    }
    return statusCode === 408 || statusCode === 429;
  }

  function applyUpgradeJobState(job, { persistFinal = true } = {}) {
    const normalized = normalizeUpgradeJob(job);
    if (!normalized) {
      return false;
    }

    const previousStatus = lastUpgradeStatus;
    if (normalized.jobId) {
      setUpgradeJobId(normalized.jobId);
    }

    if (normalized.status && normalized.status !== previousStatus) {
      appendLog(t('plugins.pins.logs.jobStatus', { status: normalized.status }));
    }

    if (normalized.exitCode !== null && normalized.exitCode !== undefined) {
      upgradeExitCode.value = normalized.exitCode;
    }

    lastUpgradeStatus = normalized.status || previousStatus;
    pinsStore.setActiveOperation('upgrade');

    if (persistFinal || !isUpgradeTerminalStatus(normalized.status)) {
      saveUpgradeFinalResult(normalized);
    }

    if (normalized.status === 'success') {
      status.value = 'Success';
      if (previousStatus !== 'success') {
        appendLog(t('plugins.pins.logs.upgradeSuccess'));
      }
      stopUpgradePolling();
      return true;
    }

    if (normalized.status === 'failed') {
      status.value = 'Failed';
      if (previousStatus !== 'failed') {
        appendLog(
          t('plugins.pins.logs.upgradeFailed', {
            exitCode: normalized.exitCode ?? 'Unknown',
          })
        );
      }
      stopUpgradePolling();
      return true;
    }

    if (isUpgradeInProgressStatus(normalized.status)) {
      status.value = 'Running';
      return false;
    }

    status.value = 'Running';
    return false;
  }

  async function fetchUpgradeJobById(ip, id) {
    if (!ip) {
      throw new Error('Missing host IP');
    }

    const response = await apiPinsService.getPinsDaemonJob(id);
    return normalizeUpgradeJob(response);
  }

  async function fetchLatestUpgradeJob(ip) {
    if (!ip) {
      throw new Error('Missing host IP');
    }

    const response = await apiPinsService.getPinsDaemonLatestJob();
    return normalizeUpgradeJob(response);
  }

  function selectPreferredJob(storedFinalResult, latestJob) {
    if (!storedFinalResult) {
      return latestJob;
    }
    if (!latestJob) {
      return storedFinalResult;
    }
    if (storedFinalResult.jobId === latestJob.jobId) {
      return latestJob;
    }

    const storedStartedAt = storedFinalResult.startedAt ?? -Infinity;
    const latestStartedAt = latestJob.startedAt ?? -Infinity;
    return latestStartedAt >= storedStartedAt ? latestJob : storedFinalResult;
  }

  async function pollUpgradeStatus(ip) {
    if (!isUpgradePolling.value) {
      return;
    }

    const trackedJobId = jobId.value || getStoredUpgradeJobId();
    if (!trackedJobId) {
      stopUpgradePolling();
      return;
    }

    try {
      const currentJob = await fetchUpgradeJobById(ip, trackedJobId);
      upgradePollBackoffMs = UPGRADE_INITIAL_BACKOFF_MS;
      upgradeLatestNotFoundCount = 0;
      const terminal = applyUpgradeJobState(currentJob);
      if (!terminal) {
        scheduleUpgradePolling(ip);
      }
      return;
    } catch (error) {
      if (error?.response?.status === 404) {
        try {
          const latestJob = await fetchLatestUpgradeJob(ip);
          const storedFinal = getStoredUpgradeFinalResult();
          const selectedJob = selectPreferredJob(storedFinal, latestJob);

          if (selectedJob?.jobId && selectedJob.jobId !== trackedJobId) {
            setUpgradeJobId(selectedJob.jobId);
          }

          upgradePollBackoffMs = UPGRADE_INITIAL_BACKOFF_MS;
          const terminal = applyUpgradeJobState(selectedJob);
          if (!terminal) {
            scheduleUpgradePolling(ip);
          }
          return;
        } catch (latestError) {
          if (latestError?.response?.status === 404) {
            upgradeLatestNotFoundCount += 1;
            if (upgradeLatestNotFoundCount <= UPGRADE_LATEST_NOT_FOUND_MAX_RETRIES) {
              const retryDelay = Math.min(upgradePollBackoffMs, UPGRADE_MAX_BACKOFF_MS);
              appendLog(
                t('plugins.pins.logs.error', {
                  message: `No jobs found yet. Retrying in ${Math.round(retryDelay / 1000)}s.`,
                })
              );
              upgradePollBackoffMs = Math.min(upgradePollBackoffMs * 2, UPGRADE_MAX_BACKOFF_MS);
              scheduleUpgradePolling(ip, retryDelay);
              return;
            }

            appendLog(
              t('plugins.pins.logs.error', {
                message: 'No upgrade jobs available. Upgrade tracking stopped.',
              })
            );

            stopUpgradePolling();
            setUpgradeJobId(null);
            lastUpgradeStatus = null;

            // If there is no terminal result saved, return controls to idle.
            const latestStoredResult = getStoredUpgradeFinalResult();
            if (!latestStoredResult || !isUpgradeTerminalStatus(latestStoredResult.status)) {
              status.value = 'Idle';
              pinsStore.setActiveOperation(null);
              upgradeExitCode.value = null;
            }
            return;
          }

          error = latestError;
        }
      }

      if (error?.response?.status === 401) {
        appendLog(
          t('plugins.pins.logs.serverError', {
            status: error.response.status,
            data: JSON.stringify(error.response.data),
          })
        );
        appendLog(
          t('plugins.pins.logs.error', {
            message: 'Unauthorized. Please re-authenticate or refresh your token.',
          })
        );
        status.value = 'Failed';
        stopUpgradePolling();
        return;
      }

      if (shouldRetryUpgradePolling(error)) {
        const retryDelay = Math.min(upgradePollBackoffMs, UPGRADE_MAX_BACKOFF_MS);
        upgradePollBackoffMs = Math.min(upgradePollBackoffMs * 2, UPGRADE_MAX_BACKOFF_MS);
        appendLog(
          t('plugins.pins.logs.error', {
            message: `Status check failed (${error.message}). Retrying in ${Math.round(
              retryDelay / 1000
            )}s.`,
          })
        );
        scheduleUpgradePolling(ip, retryDelay);
        return;
      }

      appendLog(t('plugins.pins.logs.statusFetchFailed', { message: error.message }));
      status.value = 'Failed';
      stopUpgradePolling();
    }
  }

  function beginUpgradeTracking(ip, nextJobId) {
    if (!ip || !nextJobId) {
      return;
    }

    isUpgradePolling.value = true;
    upgradePollBackoffMs = UPGRADE_INITIAL_BACKOFF_MS;
    upgradeLatestNotFoundCount = 0;
    setUpgradeJobId(nextJobId);
    scheduleUpgradePolling(ip, 0);
  }

  function beginUpgradeTrackingFromStart(ip, nextJobId, rawStartResponse) {
    if (!ip || !nextJobId) {
      return;
    }

    setUpgradeJobId(nextJobId);

    const normalizedResponseJob = normalizeUpgradeJob(rawStartResponse);
    if (normalizedResponseJob) {
      applyUpgradeJobState({ ...normalizedResponseJob, jobId: nextJobId }, { persistFinal: false });
    }

    beginUpgradeTracking(ip, nextJobId);
  }

  function restoreUpgradeState() {
    if (hasRestoredUpgradeState) {
      return;
    }
    hasRestoredUpgradeState = true;

    const ip = getIp();
    if (!ip) {
      return;
    }

    const trackedJobId = jobId.value || getStoredUpgradeJobId();
    const storedFinalResult = getStoredUpgradeFinalResult();

    if (storedFinalResult && isUpgradeTerminalStatus(storedFinalResult.status)) {
      const shouldKeepTerminalRecovery =
        Boolean(trackedJobId) && Boolean(shouldWaitForApiRecovery?.());

      if (!shouldKeepTerminalRecovery) {
        clearStoredUpgradeFinalResult();
        setUpgradeJobId(null);
        lastUpgradeStatus = null;
        upgradeExitCode.value = null;

        if (activeOperation.value === 'upgrade' && status.value !== 'Running') {
          pinsStore.setActiveOperation(null);
          status.value = 'Idle';
        }
        return;
      }

      pinsStore.setActiveOperation('upgrade');
      lastUpgradeStatus = storedFinalResult.status;
      upgradeExitCode.value = storedFinalResult.exitCode;
      status.value = storedFinalResult.status === 'success' ? 'Success' : 'Failed';
    }

    if (!trackedJobId) {
      return;
    }

    setUpgradeJobId(trackedJobId);
    if (!storedFinalResult || !isUpgradeTerminalStatus(storedFinalResult.status)) {
      pinsStore.setActiveOperation('upgrade');
      status.value = 'Running';
      beginUpgradeTracking(ip, trackedJobId);
    }
  }

  function handleUpgradeWsClosed(ip) {
    if (activeOperation.value === 'upgrade' && isUpgradePolling.value) {
      scheduleUpgradePolling(ip, 0);
      return true;
    }

    return false;
  }

  function resetUpgradeForNewRun() {
    stopUpgradePolling();
    clearStoredUpgradeFinalResult();
    upgradeExitCode.value = null;
    lastUpgradeStatus = null;
  }

  return {
    upgradeExitCode,
    stopUpgradePolling,
    restoreUpgradeState,
    beginUpgradeTrackingFromStart,
    handleUpgradeWsClosed,
    resetUpgradeForNewRun,
  };
}
