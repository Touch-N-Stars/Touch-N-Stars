import { ref } from 'vue';
import apiPinsService from '@/services/apiPinsService';
import { isAppBackgrounded } from '@/utils/appLifecycle';

const LAST_UPGRADE_JOB_ID_KEY = 'lastUpgradeJobId';
const LAST_UPGRADE_JOB_RESULT_KEY = 'lastUpgradeJobResult';
// The rig (daemon host) the saved job belongs to. Job ids are only meaningful on
// the daemon that created them, so a saved job is never resumed against another rig.
const LAST_UPGRADE_JOB_HOST_KEY = 'lastUpgradeJobHost';
const UPGRADE_STORAGE_KEYS = [
  LAST_UPGRADE_JOB_ID_KEY,
  LAST_UPGRADE_JOB_RESULT_KEY,
  LAST_UPGRADE_JOB_HOST_KEY,
];
const UPGRADE_POLL_INTERVAL_MS = 3000;
const UPGRADE_INITIAL_BACKOFF_MS = 2000;
const UPGRADE_MAX_BACKOFF_MS = 30000;
// A 404 can be a torn read of the daemon's state file on older daemons; only a
// repeated 404 means the daemon really has no record of the job.
const UPGRADE_NOT_FOUND_MAX_RETRIES = 2;

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

/** Forgets the saved upgrade job (id, last result, rig). Leaves all other storage alone. */
export function clearStoredUpgradeTracking() {
  UPGRADE_STORAGE_KEYS.forEach(removeStorageItem);
}

/**
 * Tracks the PINS system upgrade job until the daemon reports a final result.
 *
 * The upgrade outlives the pinsdaemon process (it restarts the daemon when it updates
 * the daemon's own package), so the job is followed by polling `/jobs/{id}`, which the
 * daemon answers from its persisted state after a restart. Every way this tracker stops
 * polling ends in an explicit UI state: Success, Failed, or Unknown when the outcome
 * cannot be established. It never stops while leaving the UI on Running.
 *
 * Status values written to `status`: 'Idle' | 'Running' | 'Success' | 'Failed' | 'Unknown'.
 */
export function createPinsUpgradeTracker({
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

  let upgradePollTimer = null;
  let upgradePollBackoffMs = UPGRADE_INITIAL_BACKOFF_MS;
  let lastUpgradeStatus = null;
  let upgradeNotFoundCount = 0;
  let trackedHost = null;
  // Bumped whenever tracking starts or stops, so a response that arrives for an
  // abandoned poll (overlay closed, rig switched, new run) is dropped.
  let pollGeneration = 0;

  function logError(message) {
    appendLog(t('plugins.pins.logs.error', { message }));
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
      errorMessage: rawJob.errorMessage ?? null,
    };
  }

  function isUpgradeTerminalStatus(statusValue) {
    return statusValue === 'success' || statusValue === 'failed';
  }

  function isUpgradeRunningInUi() {
    return activeOperation.value === 'upgrade' && status.value === 'Running';
  }

  function setUpgradeJobId(nextJobId, host = null) {
    pinsStore.setCurrentJobId(nextJobId || null);
    if (nextJobId) {
      setStorageItem(LAST_UPGRADE_JOB_ID_KEY, String(nextJobId));
      if (host) {
        setStorageItem(LAST_UPGRADE_JOB_HOST_KEY, host);
      }
    } else {
      removeStorageItem(LAST_UPGRADE_JOB_ID_KEY);
      removeStorageItem(LAST_UPGRADE_JOB_HOST_KEY);
    }
  }

  function saveUpgradeResult(job) {
    setStorageItem(LAST_UPGRADE_JOB_RESULT_KEY, JSON.stringify(job));
  }

  function clearStoredUpgradeResult() {
    removeStorageItem(LAST_UPGRADE_JOB_RESULT_KEY);
  }

  function getStoredUpgradeResult() {
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

  function getTrackedJobId() {
    return jobId.value || getStorageItem(LAST_UPGRADE_JOB_ID_KEY);
  }

  function clearUpgradePollTimer() {
    if (upgradePollTimer) {
      clearTimeout(upgradePollTimer);
      upgradePollTimer = null;
    }
  }

  function stopUpgradePolling() {
    isUpgradePolling.value = false;
    pollGeneration += 1;
    clearUpgradePollTimer();
    upgradePollBackoffMs = UPGRADE_INITIAL_BACKOFF_MS;
    upgradeNotFoundCount = 0;
  }

  function scheduleUpgradePolling(ip, delayMs = UPGRADE_POLL_INTERVAL_MS) {
    if (!isUpgradePolling.value || !ip) {
      return;
    }

    clearUpgradePollTimer();
    upgradePollTimer = setTimeout(() => {
      upgradePollTimer = null;
      // Not with delayMs: it can be 0, which would spin until the app is back in the foreground.
      if (isAppBackgrounded.value) scheduleUpgradePolling(ip);
      else pollUpgradeStatus(ip);
    }, delayMs);
  }

  function scheduleRetry(ip, message) {
    const retryDelay = Math.min(upgradePollBackoffMs, UPGRADE_MAX_BACKOFF_MS);
    upgradePollBackoffMs = Math.min(upgradePollBackoffMs * 2, UPGRADE_MAX_BACKOFF_MS);
    logError(`${message} Retrying in ${Math.round(retryDelay / 1000)}s.`);
    scheduleUpgradePolling(ip, retryDelay);
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

  /**
   * Ends tracking without a confirmed result. The upgrade may or may not have finished;
   * the user gets the controls back and can check for updates or start a new run.
   */
  function markUpgradeStatusUnknown(reason) {
    stopUpgradePolling();
    if (reason) {
      logError(reason);
    }
    appendLog(t('plugins.pins.logs.jobStatus', { status: 'unknown' }));
    setUpgradeJobId(null);
    clearStoredUpgradeResult();
    lastUpgradeStatus = 'unknown';
    upgradeExitCode.value = null;
    pinsStore.setActiveOperation('upgrade');
    status.value = 'Unknown';
  }

  function applyUpgradeJobState(job, { persistFinal = true } = {}) {
    const normalized = normalizeUpgradeJob(job);
    if (!normalized) {
      return false;
    }

    if (normalized.status === 'unknown') {
      // The daemon settled a record whose detached unit vanished without a result.
      markUpgradeStatusUnknown(normalized.errorMessage);
      return true;
    }

    const previousStatus = lastUpgradeStatus;
    if (normalized.jobId) {
      setUpgradeJobId(normalized.jobId, trackedHost);
    }

    if (normalized.status && normalized.status !== previousStatus) {
      appendLog(t('plugins.pins.logs.jobStatus', { status: normalized.status }));
    }

    upgradeExitCode.value = normalized.exitCode ?? null;
    lastUpgradeStatus = normalized.status || previousStatus;
    pinsStore.setActiveOperation('upgrade');

    if (persistFinal || !isUpgradeTerminalStatus(normalized.status)) {
      saveUpgradeResult(normalized);
    }

    if (normalized.status === 'success') {
      stopUpgradePolling();
      status.value = 'Success';
      if (previousStatus !== 'success') {
        appendLog(t('plugins.pins.logs.upgradeSuccess'));
      }
      return true;
    }

    if (normalized.status === 'failed') {
      stopUpgradePolling();
      status.value = 'Failed';
      if (previousStatus !== 'failed') {
        appendLog(
          t('plugins.pins.logs.upgradeFailed', {
            exitCode: normalized.exitCode ?? 'Unknown',
          })
        );
      }
      return true;
    }

    // started, running, or a status this client does not know yet: keep following it.
    status.value = 'Running';
    return false;
  }

  /** Drops tracking that belongs to another rig without touching its saved record. */
  function releaseForOtherRig() {
    stopUpgradePolling();
    pinsStore.setCurrentJobId(null);
    if (isUpgradeRunningInUi()) {
      pinsStore.setActiveOperation(null);
      status.value = 'Idle';
    }
    lastUpgradeStatus = null;
    upgradeExitCode.value = null;
  }

  async function pollUpgradeStatus(ip) {
    if (!isUpgradePolling.value) {
      return;
    }

    if (trackedHost && getIp() !== trackedHost) {
      appendLog(
        t('plugins.pins.logs.error', {
          message: 'Connected to a different rig. Upgrade tracking for the previous rig stopped.',
        })
      );
      releaseForOtherRig();
      return;
    }

    const trackedJobId = getTrackedJobId();
    if (!trackedJobId) {
      // The job id was cleared under us (overlay closed, storage wiped).
      if (isUpgradeRunningInUi()) {
        markUpgradeStatusUnknown(
          'The upgrade job id is no longer known. Upgrade tracking stopped.'
        );
      } else {
        stopUpgradePolling();
      }
      return;
    }

    const generation = pollGeneration;
    // True when the answer no longer belongs to the current tracking. If this poller is
    // still the current one, the job was dropped under it (overlay closed): end it here,
    // otherwise the polling flag would stay set with no timer behind it.
    const isStale = () => {
      if (generation !== pollGeneration || !isUpgradePolling.value) {
        return true;
      }
      if (getTrackedJobId() !== trackedJobId) {
        stopUpgradePolling();
        return true;
      }
      return false;
    };

    let currentJob;
    try {
      currentJob = await apiPinsService.getPinsDaemonJob(trackedJobId);
    } catch (error) {
      if (isStale()) {
        return;
      }
      handlePollError(ip, trackedJobId, error);
      return;
    }

    if (isStale()) {
      return;
    }

    upgradePollBackoffMs = UPGRADE_INITIAL_BACKOFF_MS;
    upgradeNotFoundCount = 0;
    const normalized = normalizeUpgradeJob(currentJob);
    if (normalized?.jobId && String(normalized.jobId) !== String(trackedJobId)) {
      // Never follow a different job than the one this upgrade started.
      markUpgradeStatusUnknown(
        `The PINS daemon answered for job ${normalized.jobId} instead of ${trackedJobId}.`
      );
      return;
    }
    if (!applyUpgradeJobState(currentJob)) {
      scheduleUpgradePolling(ip);
    }
  }

  function handlePollError(ip, trackedJobId, error) {
    const statusCode = error?.response?.status;

    if (statusCode === 404) {
      upgradeNotFoundCount += 1;
      if (upgradeNotFoundCount <= UPGRADE_NOT_FOUND_MAX_RETRIES) {
        scheduleRetry(ip, `Upgrade job ${trackedJobId} not found yet.`);
        return;
      }
      // Deliberately no fallback to /jobs/latest: that returns whatever job ran last on
      // the daemon (a time sync, a Wi-Fi change...), which says nothing about this upgrade.
      markUpgradeStatusUnknown(
        `The PINS daemon has no record of upgrade job ${trackedJobId}. Its result cannot be determined.`
      );
      return;
    }

    if (statusCode === 401 || statusCode === 403) {
      appendLog(
        t('plugins.pins.logs.serverError', {
          status: statusCode,
          data: JSON.stringify(error.response.data),
        })
      );
      markUpgradeStatusUnknown('Unauthorized. Please re-authenticate or refresh your token.');
      return;
    }

    if (shouldRetryUpgradePolling(error)) {
      // The daemon restarts during its own package update: keep waiting for it.
      scheduleRetry(ip, `Status check failed (${error?.message}).`);
      return;
    }

    appendLog(t('plugins.pins.logs.statusFetchFailed', { message: error?.message }));
    markUpgradeStatusUnknown(null);
  }

  function beginUpgradeTracking(ip, nextJobId) {
    if (!ip || !nextJobId) {
      return;
    }

    stopUpgradePolling();
    isUpgradePolling.value = true;
    trackedHost = ip;
    setUpgradeJobId(nextJobId, ip);
    scheduleUpgradePolling(ip, 0);
  }

  function beginUpgradeTrackingFromStart(ip, nextJobId, rawStartResponse) {
    if (!ip || !nextJobId) {
      return;
    }

    trackedHost = ip;
    setUpgradeJobId(nextJobId, ip);

    const normalizedResponseJob = normalizeUpgradeJob(rawStartResponse);
    if (normalizedResponseJob) {
      applyUpgradeJobState({ ...normalizedResponseJob, jobId: nextJobId }, { persistFinal: false });
    }

    beginUpgradeTracking(ip, nextJobId);
  }

  /**
   * Attaches to an upgrade that is already running when the daemon refuses a second
   * one (409 with the running job's id). Returns true when it took over.
   */
  function adoptRunningUpgrade(ip, error) {
    const detail = error?.response?.data?.detail;
    const runningJobId = error?.response?.status === 409 ? detail?.jobId : null;
    if (!ip || !runningJobId) {
      return false;
    }

    appendLog(
      t('plugins.pins.logs.error', {
        message: `An upgrade is already running (job ${runningJobId}). Following it instead.`,
      })
    );
    resetUpgradeForNewRun();
    pinsStore.setActiveOperation('upgrade');
    status.value = 'Running';
    beginUpgradeTracking(ip, runningJobId);
    return true;
  }

  /**
   * Re-attaches to the saved upgrade job of the current rig. Safe to call repeatedly
   * (on every PINS detection and component mount): it does nothing while tracking runs.
   */
  function restoreUpgradeState() {
    const ip = getIp();
    if (!ip || isUpgradePolling.value) {
      return;
    }

    const savedHost = getStorageItem(LAST_UPGRADE_JOB_HOST_KEY);
    if (savedHost && savedHost !== ip) {
      // Saved by another rig: keep it for when that rig is selected again.
      if (jobId.value === getStorageItem(LAST_UPGRADE_JOB_ID_KEY)) {
        releaseForOtherRig();
      }
      return;
    }

    const trackedJobId = getTrackedJobId();
    const storedResult = getStoredUpgradeResult();
    const storedResultBelongsToJob =
      storedResult && (!storedResult.jobId || !trackedJobId || storedResult.jobId === trackedJobId);

    if (storedResultBelongsToJob && isUpgradeTerminalStatus(storedResult.status)) {
      trackedHost = ip;

      if (isUpgradeRunningInUi()) {
        // The UI still waits for a job whose final result is already known.
        applyUpgradeJobState(storedResult);
        return;
      }

      if (trackedJobId && shouldWaitForApiRecovery?.()) {
        // App.vue keeps the overlay up until the backend answers again.
        applyUpgradeJobState(storedResult);
        return;
      }

      if (status.value === 'Idle' && storedResult.status === 'failed') {
        // Reload after a failed run: report it once instead of silently dropping it.
        applyUpgradeJobState(storedResult);
      }

      // Completed earlier: nothing to resume. Whatever result the UI shows stays.
      clearStoredUpgradeTracking();
      if (jobId.value && jobId.value === trackedJobId) {
        pinsStore.setCurrentJobId(null);
      }
      lastUpgradeStatus = null;
      return;
    }

    if (!trackedJobId) {
      if (isUpgradeRunningInUi()) {
        markUpgradeStatusUnknown('No upgrade job id is saved. Upgrade tracking cannot resume.');
      }
      return;
    }

    if (storedResult && !storedResultBelongsToJob) {
      clearStoredUpgradeResult();
    }

    pinsStore.setActiveOperation('upgrade');
    status.value = 'Running';
    beginUpgradeTracking(ip, trackedJobId);
  }

  function handleUpgradeWsClosed(ip) {
    if (activeOperation.value !== 'upgrade') {
      return false;
    }

    // The tracker owns the upgrade's final status, never the generic socket fallback:
    // that one would call a still-running job "failed".
    if (isUpgradePolling.value) {
      scheduleUpgradePolling(ip, 0);
    }
    return true;
  }

  function resetUpgradeForNewRun() {
    stopUpgradePolling();
    clearStoredUpgradeResult();
    upgradeExitCode.value = null;
    lastUpgradeStatus = null;
  }

  return {
    upgradeExitCode,
    isUpgradePolling,
    stopUpgradePolling,
    restoreUpgradeState,
    beginUpgradeTrackingFromStart,
    adoptRunningUpgrade,
    handleUpgradeWsClosed,
    resetUpgradeForNewRun,
    markUpgradeStatusUnknown,
  };
}

let sharedTracker = null;

/**
 * The app-wide upgrade tracker. The PINS Update tab and the setup wizard both show the
 * same upgrade and the blocking overlay in App.vue outlives either of them, so they
 * share one poller instead of each running (and abandoning) their own.
 */
export function usePinsUpgradeTracker(options) {
  if (!sharedTracker) {
    sharedTracker = createPinsUpgradeTracker(options);
  }
  return sharedTracker;
}
