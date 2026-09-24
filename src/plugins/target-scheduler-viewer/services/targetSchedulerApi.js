import { useSettingsStore } from '@/store/settingsStore';

const DEFAULT_PORT = '8188';

// The port, profile and "have we ever connected" state are properties of a
// specific NINA rig, not of the browser — a user with two saved instances
// (e.g. a home rig on TS port 8188 and a remote one on 4123) must not have
// switching instances keep the previous rig's port applied to the new host.
// Every such key is suffixed with `:${instanceId}`, matching the existing
// `psp.secondaryDrivers.v1:<baseUrl>` / `tppaStore.settings:<...>` convention
// (see src/utils/settingsBackup.js). Falls back to a fixed suffix when no
// instance is selected yet (matches the rest of the app's single/legacy
// pre-multi-instance behavior).
function instanceSuffix() {
  const settingsStore = useSettingsStore();
  return settingsStore.selectedInstanceId || 'default';
}

function scopedKey(base) {
  return `${base}:${instanceSuffix()}`;
}

export function getStoredPort() {
  try {
    return localStorage.getItem(scopedKey('tsviewer.port')) || DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT;
  }
}

export function setStoredPort(port) {
  try {
    localStorage.setItem(scopedKey('tsviewer.port'), String(port));
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

const HEADER_COLLAPSED_KEY = 'tsviewer.headerCollapsed';

export function getStoredHeaderCollapsed() {
  try {
    return localStorage.getItem(HEADER_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setStoredHeaderCollapsed(collapsed) {
  try {
    localStorage.setItem(HEADER_COLLAPSED_KEY, String(collapsed));
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

// Whether this rig has ever successfully connected — lets a first-run
// connection failure show setup guidance instead of a plain error, since
// "not configured yet" is the expected first-load state, not a fault.
// Instance-scoped: switching to a different, never-before-seen rig should
// show the onboarding guide again rather than silently reusing another
// rig's "already set up" state.
export function getStoredHasConnected() {
  try {
    return localStorage.getItem(scopedKey('tsviewer.hasConnected')) === 'true';
  } catch {
    return false;
  }
}

export function setStoredHasConnected() {
  try {
    localStorage.setItem(scopedKey('tsviewer.hasConnected'), 'true');
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

export function getStoredProfileId() {
  try {
    return localStorage.getItem(scopedKey('tsviewer.profileId')) || '';
  } catch {
    return '';
  }
}

export function setStoredProfileId(profileId) {
  try {
    localStorage.setItem(scopedKey('tsviewer.profileId'), profileId);
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

function hostPort() {
  const settingsStore = useSettingsStore();
  const host = settingsStore.connection?.ip || window.location.hostname;
  const port = getStoredPort();
  return { host, port };
}

function baseUrl() {
  const settingsStore = useSettingsStore();
  const { host, port } = hostPort();
  const protocol = settingsStore.backendProtocol || 'http';
  return `${protocol}://${host}:${port}/ts/v0`;
}

const REQUEST_TIMEOUT_MS = 8000;

class TargetSchedulerApiError extends Error {
  constructor(message, { kind }) {
    super(message);
    this.kind = kind; // 'unreachable' | 'timeout' | 'http' | 'parse'
  }
}

// Built from a plain AbortController rather than AbortSignal.any()/
// AbortSignal.timeout() (Chrome 116+/Safari 17.4+) — those aren't available
// in every webview this app runs in, and a missing method there would throw
// before the request even starts. AbortController itself is much older
// (Safari 12.1+) and safe to rely on everywhere.
function raceAbort(externalSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => {
    cancelled = true;
    controller.abort();
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      cancelled = true;
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }

  return {
    signal: controller.signal,
    isTimedOut: () => timedOut,
    isCancelled: () => cancelled,
    cleanup() {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

async function getJson(path, { signal } = {}) {
  const { host, port } = hostPort();
  const url = `${baseUrl()}${path}`;
  const race = raceAbort(signal, REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, { signal: race.signal });
  } catch (e) {
    if (race.isCancelled()) {
      throw new TargetSchedulerApiError('Connection attempt cancelled.', { kind: 'cancelled' });
    }
    if (race.isTimedOut()) {
      throw new TargetSchedulerApiError(
        `Target Scheduler API at ${host}:${port} did not respond within ${REQUEST_TIMEOUT_MS / 1000}s. Check the port is correct and the host is reachable.`,
        { kind: 'timeout' }
      );
    }
    throw new TargetSchedulerApiError(
      `Can't reach Target Scheduler API at ${host}:${port}. Check the port is correct and the API is enabled in the Target Scheduler plugin options in NINA.`,
      { kind: 'unreachable' }
    );
  } finally {
    race.cleanup();
  }

  if (!res.ok) {
    throw new TargetSchedulerApiError(
      `Target Scheduler API at ${host}:${port} returned HTTP ${res.status} for ${path}.`,
      { kind: 'http' }
    );
  }

  try {
    return await res.json();
  } catch {
    throw new TargetSchedulerApiError(
      `Target Scheduler API at ${host}:${port} returned an unreadable response for ${path}.`,
      { kind: 'parse' }
    );
  }
}

// IDs are GUIDs from the TS API's own responses, not user input, but
// encoding them before building the URL is cheap defense-in-depth against a
// malformed/unexpected value (e.g. one containing "/" or "?") altering the
// request path instead of just producing a 404.
export const targetSchedulerApi = {
  getVersion: (opts) => getJson('/version', opts),
  getProfiles: (opts) => getJson('/profiles', opts),
  getProjects: (profileId, opts) =>
    getJson(`/profiles/${encodeURIComponent(profileId)}/projects`, opts),
  getTargets: (projectId, opts) =>
    getJson(`/projects/${encodeURIComponent(projectId)}/targets`, opts),
  getStatistics: (targetId, opts) =>
    getJson(`/targets/${encodeURIComponent(targetId)}/statistics`, opts),
  getPreview: (profileId, opts) =>
    getJson(`/profiles/${encodeURIComponent(profileId)}/preview`, opts),
};
