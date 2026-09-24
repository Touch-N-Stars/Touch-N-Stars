import { reactive, watch } from 'vue';
import { isAppBackgrounded } from '@/utils/appLifecycle';
import {
  buildPinsEndpointCandidates,
  discoverPinsDaemonHosts,
  normalizeCandidateHost,
  probePinsHealth,
  resolvePinsEndpoint,
} from '@/services/rigEndpointResolver';

const TRANSITION_STORAGE_KEY = 'tns.pins.network-transition.v1';
const DEFAULT_TRANSITION_TIMEOUT_MS = 90000;

export const rigConnectionState = reactive({
  phase: 'idle',
  rigId: '',
  activeHost: '',
  requestedMode: '',
  operationId: '',
  startedAt: '',
  attemptedHosts: [],
  error: '',
});

let settingsStoreRef = null;
let backendStoreRef = null;
let generation = 0;
let activeController = null;
let onlineListenerInstalled = false;
let stopPinsBackendWatch = null;
let pinsInstanceId = '';

class PinsNetworkOperationError extends Error {
  constructor(job) {
    const code = job?.errorCode || 'UNKNOWN';
    const detail = job?.errorMessage || `Network operation ${job?.jobId || ''} failed`;
    super(`${code}: ${detail}`);
    this.name = 'PinsNetworkOperationError';
    this.code = code;
  }
}

function isPinsBackend() {
  return (
    backendStoreRef?.isPINS === true ||
    (Boolean(settingsStoreRef?.selectedInstanceId) &&
      settingsStoreRef.selectedInstanceId === pinsInstanceId)
  );
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Connection recovery cancelled'));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

function readTransition() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TRANSITION_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    if (
      !parsed.startedAt ||
      Date.now() - Date.parse(parsed.startedAt) > DEFAULT_TRANSITION_TIMEOUT_MS
    ) {
      localStorage.removeItem(TRANSITION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(TRANSITION_STORAGE_KEY);
    return null;
  }
}

function writeTransition(transition) {
  localStorage.setItem(TRANSITION_STORAGE_KEY, JSON.stringify(transition));
}

export function clearNetworkTransition() {
  localStorage.removeItem(TRANSITION_STORAGE_KEY);
  rigConnectionState.requestedMode = '';
  rigConnectionState.operationId = '';
  rigConnectionState.startedAt = '';
}

function selectedInstance() {
  return settingsStoreRef?.getInstance?.(settingsStoreRef.selectedInstanceId) || null;
}

function modeReached(status, requestedMode) {
  if (requestedMode === 'hotspot') {
    return status?.observedMode === 'hotspot' || status?.observedMode === 'dual';
  }
  if (requestedMode === 'auto') {
    return ['client', 'hotspot', 'dual'].includes(status?.observedMode);
  }
  if (requestedMode === 'client') {
    return (
      ['client', 'dual'].includes(status?.observedMode) ||
      status?.connections?.some(
        (connection) => connection?.role === 'client' && connection?.connected
      )
    );
  }
  return true;
}

async function promoteEndpoint(result) {
  const instance = selectedInstance();
  if (!instance) return;
  const currentHost = settingsStoreRef.connection.ip;
  settingsStoreRef.promoteInstanceEndpoint(instance.id, {
    host: result.host,
    rigId: result.health.rigId,
  });
  rigConnectionState.rigId = result.health.rigId;
  rigConnectionState.activeHost = result.host;
  if (normalizeCandidateHost(currentHost) !== normalizeCandidateHost(result.host)) {
    await backendStoreRef.switchBackend();
  }
}

export async function identifySelectedRig() {
  if (!isPinsBackend()) {
    throw new Error('PINS rig discovery is unavailable for this backend');
  }
  const instance = selectedInstance();
  if (!instance) {
    // Browser served directly by the rig (e.g. http://10.42.0.1:5000) has no
    // saved instance; identify the rig behind the page host instead.
    const host = normalizeCandidateHost(
      settingsStoreRef?.connection?.ip || window.location.hostname
    );
    if (!host) throw new Error('No PINS rig is selected');
    const result = await probePinsHealth({ host, source: 'active' });
    rigConnectionState.rigId = result.health.rigId;
    rigConnectionState.activeHost = result.host;
    return result.health.rigId;
  }
  if (instance.rigId) return instance.rigId;

  const result = await probePinsHealth({
    host: settingsStoreRef.connection.ip || instance.ip,
    source: 'active-endpoint',
  });
  await promoteEndpoint(result);
  return result.health.rigId;
}

async function probeRound({ expectedRigId, includeFieldFallback, signal }) {
  const instance = selectedInstance();
  const currentHost = normalizeCandidateHost(
    settingsStoreRef.connection.ip || window.location.hostname
  );
  rigConnectionState.attemptedHosts = currentHost ? [currentHost] : [];

  // Probe the configured endpoint by itself first. Racing aliases for the same
  // rig made the fastest hostname win and caused unnecessary switchBackend()
  // teardown/reconnect loops.
  if (currentHost) {
    try {
      const current = await probePinsHealth({ host: currentHost, source: 'active' }, { signal });
      if (!expectedRigId || current.health.rigId === expectedRigId) {
        return current;
      }
    } catch {
      // Discovery and field fallbacks are attempted below.
    }
  }

  const mdnsHosts = await discoverPinsDaemonHosts();
  const candidates = buildPinsEndpointCandidates({
    instance,
    currentHost,
    pageHost: window.location.hostname,
    mdnsHosts,
    includeFieldFallback,
  }).filter((candidate) => candidate.host !== currentHost);
  rigConnectionState.attemptedHosts = candidates.map((candidate) => candidate.host);
  return resolvePinsEndpoint({ candidates, expectedRigId, signal });
}

export async function recoverRigConnection({
  requestedMode = '',
  operationId = '',
  timeoutMs = DEFAULT_TRANSITION_TIMEOUT_MS,
  includeFieldFallback = true,
} = {}) {
  if (!settingsStoreRef || !isPinsBackend() || !selectedInstance()) return null;

  const myGeneration = ++generation;
  activeController?.abort();
  activeController = new AbortController();
  const signal = activeController.signal;
  const instance = selectedInstance();
  const expectedRigId = instance?.rigId || '';
  const deadline = Date.now() + timeoutMs;

  Object.assign(rigConnectionState, {
    phase: requestedMode ? 'network-transition' : 'probing',
    rigId: expectedRigId,
    requestedMode,
    operationId,
    startedAt: new Date().toISOString(),
    error: '',
  });

  let attempt = 0;
  while (Date.now() < deadline && myGeneration === generation && !signal.aborted) {
    if (isAppBackgrounded.value) {
      await delay(1000, signal);
      continue;
    }

    try {
      const result = await probeRound({ expectedRigId, includeFieldFallback, signal });
      await promoteEndpoint(result);

      if (requestedMode) {
        const { default: apiPinsService } = await import('@/services/apiPinsService');
        if (operationId) {
          const job = await apiPinsService.getPinsDaemonJob(operationId);
          if (job?.status === 'failed' || (job?.exitCode != null && job.exitCode !== 0)) {
            throw new PinsNetworkOperationError(job);
          }
          if (job?.status !== 'success' && job?.exitCode !== 0) {
            throw new Error(
              `Network operation ${operationId} is still ${job?.status || 'running'}`
            );
          }
        }
        const status = await apiPinsService.getPinsWifiStatus();
        if (!modeReached(status, requestedMode)) {
          throw new Error(
            `PINS is reachable but network mode is still ${status?.observedMode || 'unknown'}`
          );
        }
      }

      rigConnectionState.phase = 'connected';
      rigConnectionState.error = '';
      clearNetworkTransition();
      return result;
    } catch (error) {
      if (error instanceof PinsNetworkOperationError) {
        rigConnectionState.phase = 'failed';
        rigConnectionState.error = error.message;
        clearNetworkTransition();
        throw error;
      }
      rigConnectionState.phase = 'reconnecting';
      rigConnectionState.error = error?.message || String(error);
    }

    attempt += 1;
    const backoff =
      Math.min(5000, 750 * 2 ** Math.min(attempt, 3)) + Math.floor(Math.random() * 250);
    await delay(backoff, signal);
  }

  if (myGeneration === generation) {
    rigConnectionState.phase = 'failed';
    rigConnectionState.error =
      rigConnectionState.error || 'Could not reconnect to the selected PINS rig before timeout';
  }
  throw new Error(rigConnectionState.error);
}

export function beginNetworkTransition({ requestedMode, operationId = '' }) {
  if (!isPinsBackend()) {
    return Promise.reject(new Error('PINS network transitions are unavailable for this backend'));
  }
  const instance = selectedInstance();
  const transition = {
    operationId: String(operationId || ''),
    rigId: instance?.rigId || '',
    requestedMode,
    startedAt: new Date().toISOString(),
  };
  writeTransition(transition);
  return recoverRigConnection({
    requestedMode,
    operationId: transition.operationId,
    includeFieldFallback: true,
  });
}

export function cancelRigConnectionRecovery() {
  generation += 1;
  activeController?.abort();
  activeController = null;
  rigConnectionState.phase = 'idle';
}

export async function initializeRigConnectionSupervisor({ settingsStore, backendStore }) {
  settingsStoreRef = settingsStore;
  backendStoreRef = backendStore;
  const initialInstance = selectedInstance();
  if (backendStore.isPINS || initialInstance?.rigId) {
    pinsInstanceId = settingsStore.selectedInstanceId;
  }
  if (!onlineListenerInstalled && typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      recoverRigConnection({ timeoutMs: 12000, includeFieldFallback: true }).catch(() => {});
    });
    onlineListenerInstalled = true;
  }

  const startPinsRecovery = () => {
    const transition = readTransition();
    if (transition) {
      recoverRigConnection({
        requestedMode: transition.requestedMode,
        operationId: transition.operationId,
        timeoutMs: Math.max(
          5000,
          DEFAULT_TRANSITION_TIMEOUT_MS - (Date.now() - Date.parse(transition.startedAt))
        ),
      }).catch(() => {});
      return;
    }

    const instance = selectedInstance();
    if (backendStoreRef?.isPINS && backendStoreRef?.isBackendReachable) {
      rigConnectionState.phase = 'connected';
      rigConnectionState.rigId = instance?.rigId || rigConnectionState.rigId;
      rigConnectionState.activeHost =
        normalizeCandidateHost(settingsStoreRef?.connection?.ip) || rigConnectionState.activeHost;
      return;
    }

    if (instance?.rigId) {
      recoverRigConnection({ timeoutMs: 12000, includeFieldFallback: true }).catch(() => {});
    } else if (instance?.ip) {
      recoverRigConnection({ timeoutMs: 3500, includeFieldFallback: false }).catch(() => {});
    }
  };

  if (isPinsBackend()) {
    startPinsRecovery();
  }

  stopPinsBackendWatch?.();
  stopPinsBackendWatch = watch(
    [() => backendStoreRef?.isPINS, () => settingsStoreRef?.selectedInstanceId],
    ([isPins, selectedInstanceId]) => {
      const instance = selectedInstance();
      if (isPins || instance?.rigId) {
        pinsInstanceId = selectedInstanceId;
        startPinsRecovery();
        return;
      }
      if (selectedInstanceId !== pinsInstanceId) {
        pinsInstanceId = '';
        cancelRigConnectionRecovery();
      }
    }
  );
}
