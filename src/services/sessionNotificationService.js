/**
 * Rig notifications while Touch-N-Stars is in the background or closed (#1492).
 *
 * PINS sends its notifications over SignalR only to clients connected at that
 * moment, and the app disconnects every transport when it goes to the background.
 * The pinsdaemon notify relay keeps them in a buffer with a sequence number. Two
 * consumers here:
 *
 * - Android background monitor: a native foreground service (SessionMonitorPlugin)
 *   that keeps the daemon's notification stream open and posts phone notifications.
 *   It works on the PINS hotspot without internet because it is local network only.
 * - Catch-up (all platforms): on resume or cold start, a toast summarises what
 *   happened since this device last looked. That is the iOS fallback until an
 *   NEAppPushProvider extension exists.
 */
import { reactive, watch } from 'vue';
import { Capacitor } from '@capacitor/core';
import i18n from '@/i18n';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useToastStore } from '@/store/toastStore';
import apiPinsService from '@/services/apiPinsService';
import { resolvePinsDaemonApiToken } from '@/services/api/core';
import { isAppBackgrounded } from '@/utils/appLifecycle';
import { SessionMonitor } from '@/utils/sessionMonitor';
import { readStoredJson, writeStoredJson } from '@/utils/safeStorage';
import {
  advanceCursor,
  isRelayResponse,
  sinceForCursor,
  summarizeMissedEvents,
  toastTypeForSeverity,
} from '@/utils/sessionNotifications';

const CURSOR_KEY = 'tns.sessionNotifications.cursor.v1';
// `since` beyond any real sequence number: returns the head (bootId, lastSeq) only.
const HEAD_SINCE = 2147483647;
// A cursor older than this is from another night; skip the summary, just resync.
const STALE_CURSOR_MS = 18 * 60 * 60 * 1000;
const RESUME_WAIT_MS = 30000;

export const sessionNotificationState = reactive({
  // null: unknown yet, false: the daemon has no notify relay (update pinsdaemon)
  relayAvailable: null,
  monitor: null,
  error: '',
});

let initialized = false;
let catchUpRunning = false;

export function isBackgroundMonitorSupported() {
  return Capacitor.getPlatform() === 'android';
}

export function loadCursor() {
  return readStoredJson(CURSOR_KEY, null);
}

function saveCursor(cursor) {
  writeStoredJson(CURSOR_KEY, { ...cursor, savedAt: Date.now() });
}

async function fetchNotifications(since, limit) {
  try {
    const payload = await apiPinsService.getPinsNotifications(since, limit);
    const available = isRelayResponse(payload);
    sessionNotificationState.relayAvailable = available;
    return available ? payload : null;
  } catch (error) {
    if (error?.response?.status === 404) sessionNotificationState.relayAvailable = false;
    return null;
  }
}

function monitorLabels() {
  const t = i18n.global.t;
  const key = (name) => `components.settings.sessionNotifications.native.${name}`;
  return {
    channelService: t(key('channelService')),
    channelAlerts: t(key('channelAlerts')),
    channelEvents: t(key('channelEvents')),
    ongoingTitle: t(key('ongoingTitle')),
    // {rig} is replaced natively; vue-i18n would otherwise try to interpolate it.
    ongoingConnected: t(key('ongoingConnected'), { rig: '{rig}' }),
    ongoingReconnecting: t(key('ongoingReconnecting'), { rig: '{rig}' }),
    stop: t(key('stop')),
    defaultTitle: t(key('defaultTitle')),
  };
}

function rigName(settingsStore) {
  const instance = settingsStore.connection.instances?.find(
    (entry) => entry.id === settingsStore.selectedInstanceId
  );
  return instance?.name || settingsStore.connection.ip || 'PINS';
}

export async function refreshMonitorStatus() {
  if (!isBackgroundMonitorSupported()) return null;
  try {
    sessionNotificationState.monitor = await SessionMonitor.getStatus();
  } catch (error) {
    sessionNotificationState.monitor = null;
    console.warn('[SessionNotifications] status failed:', error?.message || error);
  }
  return sessionNotificationState.monitor;
}

/**
 * Starts, restarts or stops the Android monitor to match the settings. Only stops on
 * an explicit user choice: `isPINS` drops while the app reconnects, and that must not
 * kill the monitor that is supposed to cover exactly those moments.
 */
export async function applyBackgroundMonitor() {
  if (!isBackgroundMonitorSupported()) return;
  const settingsStore = useSettingsStore();
  const store = apiStore();
  sessionNotificationState.error = '';

  if (!settingsStore.sessionNotifications.background) {
    const status = await refreshMonitorStatus();
    if (status?.enabled) {
      sessionNotificationState.monitor = await SessionMonitor.stop();
    }
    return;
  }
  if (!store.isPINS || !settingsStore.connection.ip) return;

  const head = await fetchNotifications(HEAD_SINCE, 1);
  if (!head) return;
  try {
    sessionNotificationState.monitor = await SessionMonitor.start({
      streamUrl: apiPinsService.getPinsNotificationStreamUrl(),
      token: resolvePinsDaemonApiToken(),
      minSeverity: settingsStore.sessionNotifications.minSeverity,
      rigName: rigName(settingsStore),
      bootId: head.bootId,
      since: head.lastSeq,
      labels: monitorLabels(),
    });
  } catch (error) {
    sessionNotificationState.error =
      error?.code === 'PERMISSION_DENIED'
        ? i18n.global.t('components.settings.sessionNotifications.permissionDenied')
        : error?.message || String(error);
    if (error?.code === 'PERMISSION_DENIED') {
      settingsStore.setSessionNotifications({ background: false });
    }
  }
}

/** Remember the newest event while the app is still in the foreground. */
async function rememberHead() {
  const settingsStore = useSettingsStore();
  const head = await fetchNotifications(HEAD_SINCE, 1);
  if (head) saveCursor(advanceCursor(loadCursor(), head, settingsStore.connection.ip));
}

function waitForBackend(store, timeoutMs) {
  if (store.isBackendReachable && store.isPINS) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve(false);
    }, timeoutMs);
    const stop = watch(
      () => store.isBackendReachable && store.isPINS,
      (ready) => {
        if (!ready) return;
        clearTimeout(timer);
        stop();
        resolve(true);
      }
    );
  });
}

/**
 * Shows a toast with what happened since this device last looked. On Android with the
 * monitor running, events the monitor already handled are skipped: the user got phone
 * notifications for those.
 */
export async function runCatchUp() {
  const settingsStore = useSettingsStore();
  const store = apiStore();
  if (catchUpRunning || !store.isPINS) return;
  catchUpRunning = true;
  try {
    const host = settingsStore.connection.ip;
    const cursor = loadCursor();
    const head = await fetchNotifications(HEAD_SINCE, 1);
    if (!head) return;

    const stale = !cursor?.savedAt || Date.now() - cursor.savedAt > STALE_CURSOR_MS;
    let since = sinceForCursor(cursor, { bootId: head.bootId, host });
    const monitor = await refreshMonitorStatus();
    if (monitor?.enabled && monitor.bootId === head.bootId) {
      since = Math.max(since, monitor.lastSeq || 0);
    }

    if (!settingsStore.sessionNotifications.catchUp || stale || since >= head.lastSeq) {
      saveCursor(advanceCursor(cursor, head, host));
      return;
    }

    const payload = await fetchNotifications(since, 200);
    if (!payload) return;
    saveCursor(advanceCursor(cursor, payload, host));

    const summary = summarizeMissedEvents(
      payload.events,
      settingsStore.sessionNotifications.minSeverity
    );
    if (!summary) return;
    const t = i18n.global.t;
    const lines = summary.latest.map((event) =>
      event.title ? `${event.title}: ${event.message}` : event.message
    );
    useToastStore().showToast({
      type: toastTypeForSeverity(summary.worst),
      title: t('components.settings.sessionNotifications.catchUpTitle'),
      message: [
        t('components.settings.sessionNotifications.catchUpMessage', { count: summary.count }),
        ...lines,
      ].join('\n'),
      autoClose: summary.worst !== 'error',
      autoCloseDelay: 12000,
    });
  } finally {
    catchUpRunning = false;
  }
}

export function initSessionNotifications() {
  if (initialized) return;
  initialized = true;
  const settingsStore = useSettingsStore();
  const store = apiStore();

  watch(
    () => [
      settingsStore.sessionNotifications.background,
      settingsStore.sessionNotifications.minSeverity,
      store.isPINS,
      settingsStore.connection.ip,
      settingsStore.language,
    ],
    () => {
      void applyBackgroundMonitor();
    },
    { immediate: true }
  );

  // Cold start: the app may have been closed while things happened on the rig.
  void waitForBackend(store, 5 * 60 * 1000).then((ready) => {
    if (ready) void runCatchUp();
  });

  watch(isAppBackgrounded, async (backgrounded) => {
    if (backgrounded) {
      if (store.isPINS) void rememberHead();
      return;
    }
    if (await waitForBackend(store, RESUME_WAIT_MS)) void runCatchUp();
  });
}
