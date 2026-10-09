import { defineStore } from 'pinia';
import i18n from '@/i18n';
import apiService from '@/services/apiService';
import websocketNativeGuiderService from '@/services/websocketNativeGuider';
import { useToastStore } from '@/store/toastStore';
import {
  NATIVE_GUIDER_ID,
  alertText,
  appendMarker,
  appendSteps,
  markerFromMessage,
} from '@/utils/nativeGuider';
import { activeHint, hintKey, upsertHint } from '@/utils/nativeGuiderCoach';
import {
  newestSavedAt,
  readLastSeen,
  unseenIncidentCount,
  writeLastSeen,
} from '@/utils/nativeGuiderIncidents';

// Client-side history: enough for the 400-step graph window plus the target plot.
const MAX_STEPS = 2000;
const MAX_ALERTS = 200;
const MAX_MARKERS = 300;
const COACH_HISTORY_MAX = 30;

// Manual marks waiting for their 'saved' event: id → handler of the toast's Replay button (a
// component's router-aware callback; kept out of the reactive state).
const pendingMarks = new Map();
let incidentsReloadTimer = null;

/** Drops the marks waiting for their incident and a scheduled incident list reload. */
function clearPendingIncidentWork() {
  pendingMarks.clear();
  if (incidentsReloadTimer) clearTimeout(incidentsReloadTimer);
  incidentsReloadTimer = null;
}

function emptySummary() {
  return {
    available: false,
    connected: false,
    deviceId: null,
    deviceName: null,
    isNative: false,
    reason: null,
  };
}

/**
 * State of the pins internal guider (IAdvancedGuider behind /api/internal-guider and
 * /ws/internal-guider).
 *
 * Two feeds, deliberately redundant:
 * - the WebSocket pushes every step/alert/state/settle/frame event (app-scoped while a native
 *   guider is connected, so critical alerts toast on every page), and
 * - the guider page polls /status every 2 s (useBackgroundAwarePolling), which stays the
 *   source of truth when the socket is down or missed something.
 */
export const useNativeGuiderStore = defineStore('nativeGuiderStore', {
  state: () => ({
    feedActive: false,
    wsConnected: false,
    summary: emptySummary(),
    status: null,
    lastStatusAt: 0,
    statusError: null,

    steps: [],
    // Once cleared, this browser session shows only newly received live steps.
    // Reconnect history (including a request already in flight) must not undo the clear.
    graphCleared: false,
    alerts: [],
    markers: [],
    calibration: null,
    calibrationProgress: null,
    settle: null,
    stats: null,
    darks: null,

    /** Latest frame notification { frameNumber, width, height, timestamp }. */
    frame: null,

    settings: [],
    settingsConnected: false,
    settingsLoading: false,
    settingsError: null,
    savingSetting: null,

    /** A setting that only applies after a reconnect was changed while connected. */
    reconnectNeeded: false,
    reconnecting: false,
    reconnectError: null,

    pendingAction: null,
    lastActionResult: null,
    _toastedAlertKeys: [],

    // --- Guiding Coach ---
    /** AdvancedCoachStatus of the current/last session (null until loaded). */
    coach: null,
    /** When the coach status was last applied (compared with lastStatusAt). */
    coachUpdatedAt: 0,
    coachLoading: false,
    coachError: null,
    /** Coach call in flight: start | skip | cancel | apply. */
    coachPending: null,
    /** Stored reports, newest first. */
    coachHistory: [],
    coachHistoryLoading: false,
    coachHistoryError: null,

    /** Live coaching hints: status.hints of the poll, plus 'hint' events in between. */
    hints: [],
    /** hintKey()s of hints dismissed here (hidden at once, before the backend confirms). */
    dismissedHintKeys: [],
    /** Clock for hint expiry, advanced by the status poll. */
    hintClock: 0,

    // --- Flight recorder (incidents) ---
    /** Saved incident summaries, newest first. */
    incidents: [],
    /** AdvancedIncidentList without the incidents (enabled, budget); null until loaded. */
    incidentList: null,
    /** Id of the incident being recorded right now ('started' until 'saved'), null when none. */
    incidentRecordingId: null,
    incidentsLoading: false,
    incidentsError: null,
    /** Keep/delete call in flight: an incident id, or 'all'. */
    incidentPending: null,
    /** Newest save time seen in the Incidents tab (guider clock, ms; per browser). */
    incidentsLastSeen: readLastSeen(),
    /** Incident whose replay is open, null when none. */
    replayIncidentId: null,
  }),

  getters: {
    state: (s) => s.status?.state || (s.summary.connected ? 'Unknown' : 'Disconnected'),
    isAvailable: (s) => s.summary.available === true,
    isSettling: (s) => s.status?.isSettling === true,
    isCalibrated: (s) => s.status?.isCalibrated === true,
    pixelScale: (s) => s.status?.pixelScale || null,
    windowStats: (s) => s.stats?.window || s.status?.windowStats || null,
    sessionStats: (s) => s.stats?.session || s.status?.sessionStats || null,
    /** Highest frame number known from the socket or the status poll. */
    latestFrameNumber: (s) =>
      Math.max(Number(s.frame?.frameNumber) || 0, Number(s.status?.frameNumber) || 0),
    criticalAlertCount: (s) =>
      s.alerts.filter((a) => String(a.severity).toLowerCase() === 'critical').length,
    coachPhase: (s) => s.coach?.phase || 'Idle',
    /**
     * A coach session runs: the guider's own flag and the coach status, whichever is newer (a
     * missed final 'coach' event must not keep the session "running", and right after a start
     * the coach status is ahead of the next status poll).
     */
    coachRunning: (s) => {
      const coachSaysRunning = s.coach?.phase === 'Running';
      if (typeof s.status?.coachRunning !== 'boolean') return coachSaysRunning;
      if (s.status.coachRunning) return true;
      return coachSaysRunning && s.coachUpdatedAt > s.lastStatusAt;
    },
    /** The one live hint the state strip shows (null when none). */
    currentHint: (s) =>
      activeHint(s.hints, { dismissed: s.dismissedHintKeys, now: s.hintClock || Date.now() }),
    /** Incidents saved since the Incidents tab was last opened (tab badge). */
    unseenIncidents: (s) => unseenIncidentCount(s.incidents, s.incidentsLastSeen),
  },

  actions: {
    // --- Feed lifecycle ---------------------------------------------------------

    /** Opens the live feed (idempotent). Called while a native guider is connected. */
    startFeed() {
      if (this.feedActive) return;
      this.feedActive = true;
      websocketNativeGuiderService.setMessageCallback((message) => this.handleMessage(message));
      websocketNativeGuiderService.setStatusCallback((status) => {
        this.wsConnected = status === 'open';
      });
      websocketNativeGuiderService.connect();
    },

    stopFeed() {
      clearPendingIncidentWork();
      if (!this.feedActive) return;
      this.feedActive = false;
      this.wsConnected = false;
      websocketNativeGuiderService.disconnect();
    },

    resumeAfterBackground() {
      if (this.feedActive) websocketNativeGuiderService.resumeAfterBackground();
    },

    // --- REST loads -------------------------------------------------------------

    async refreshStatus() {
      try {
        const result = await apiService.getNativeGuiderStatus();
        if (!result) return;
        const wasAvailable = this.summary.available;
        this.summary = {
          available: result.available === true,
          connected: result.connected === true,
          deviceId: result.deviceId ?? null,
          deviceName: result.deviceName ?? null,
          isNative: result.isNative === true,
          reason: result.reason ?? null,
        };
        this.status = result.status ?? null;
        this.lastStatusAt = Date.now();
        this.hintClock = this.lastStatusAt;
        this.statusError = null;
        // The poll is the source of truth for the active hints; 'hint' events fill the gaps.
        this.hints = Array.isArray(result.status?.hints) ? result.status.hints : [];
        if (!wasAvailable && this.summary.available) {
          // (Re)connected: the history may belong to a previous session.
          this.loadHistory();
        }
      } catch (error) {
        if (!error?.cancelled) this.statusError = error?.message || String(error);
      }
    },

    async loadHistory() {
      await Promise.allSettled([this.loadSteps(), this.loadAlerts(), this.loadCalibration()]);
    },

    clearGraph() {
      this.graphCleared = true;
      this.steps = [];
      this.markers = [];
    },

    async loadSteps(max = 1000) {
      if (this.graphCleared) return;
      try {
        const steps = await apiService.getNativeGuiderSteps(max);
        if (!this.graphCleared && Array.isArray(steps)) {
          this.steps = appendSteps([], steps, MAX_STEPS);
        }
      } catch (error) {
        this.logLoadError('steps', error);
      }
    },

    async loadAlerts(max = 100) {
      try {
        const alerts = await apiService.getNativeGuiderAlerts(max);
        if (Array.isArray(alerts)) {
          this.alerts = alerts.slice(-MAX_ALERTS);
          // Alerts already in the history are not news: never toast them again.
          this._toastedAlertKeys = alerts.map((a) => this.alertKey(a)).slice(-MAX_ALERTS);
        }
      } catch (error) {
        this.logLoadError('alerts', error);
      }
    },

    async loadCalibration() {
      try {
        this.calibration = await apiService.getNativeGuiderCalibration();
      } catch (error) {
        this.logLoadError('calibration', error);
      }
    },

    async loadSettings() {
      this.settingsLoading = true;
      try {
        const result = await apiService.getNativeGuiderSettings();
        this.settings = Array.isArray(result?.settings) ? result.settings : [];
        this.settingsConnected = result?.connected === true;
        this.settingsError = null;
      } catch (error) {
        if (!error?.cancelled) this.settingsError = error?.message || String(error);
      } finally {
        this.settingsLoading = false;
      }
    },

    /**
     * Saves one setting. Resolves to the updated setting; rejects with the backend's
     * validation message (the caller shows it next to the field).
     */
    async saveSetting(name, value) {
      this.savingSetting = name;
      try {
        const updated = await apiService.setNativeGuiderSetting(name, value);
        if (updated) {
          const index = this.settings.findIndex((s) => s.name === updated.name);
          if (index >= 0) this.settings.splice(index, 1, updated);
          if (updated.requiresReconnect && this.summary.connected) this.reconnectNeeded = true;
        }
        return updated;
      } finally {
        this.savingSetting = null;
      }
    },

    /** Reconnects the native guider so settings that need a reconnect take effect. */
    async reconnectGuider() {
      this.reconnecting = true;
      this.reconnectError = null;
      try {
        await apiService.guiderAction('disconnect');
        const response = await apiService.guiderAction(
          'connect?to=' + encodeURIComponent(NATIVE_GUIDER_ID)
        );
        if (response && response.Success === false) {
          throw new Error(response.Error || 'connect failed');
        }
        this.reconnectNeeded = false;
        await this.loadSettings();
      } catch (error) {
        this.reconnectError = error?.message || String(error);
      } finally {
        this.reconnecting = false;
      }
    },

    logLoadError(what, error) {
      // 409 just means "no native guider connected" - the page shows that state already.
      if (error?.cancelled || error?.status === 409) return;
      console.warn(`[NativeGuider] loading ${what} failed:`, error?.message || error);
    },

    // --- Actions ----------------------------------------------------------------

    /**
     * Runs a guider action. Resolves true when accepted; failures are toasted with the
     * backend's reason and resolve false.
     * @param {string} action loop | stop | start-guiding | stop-guiding | pause | resume | dither | clear-calibration
     */
    async runAction(action, params = {}, { title } = {}) {
      if (this.pendingAction) return false;
      this.pendingAction = action;
      try {
        await apiService.nativeGuiderAction(action, params);
        // Pick up the new state without waiting for the next poll tick.
        this.refreshStatus();
        if (action === 'clear-calibration') this.loadCalibration();
        return true;
      } catch (error) {
        if (!error?.cancelled) {
          useToastStore().showToast({
            type: 'error',
            title: title || action,
            message: error?.message || String(error),
          });
        }
        return false;
      } finally {
        this.pendingAction = null;
      }
    },

    async buildDarks(options, { title } = {}) {
      try {
        await apiService.buildNativeGuiderDarks(options);
        this.darks = { status: 'starting', index: 0, total: 0 };
        return true;
      } catch (error) {
        useToastStore().showToast({
          type: 'error',
          title: title || i18n.global.t('components.guider.native.darks.title'),
          message: error?.message || String(error),
        });
        return false;
      }
    },

    async cancelDarks() {
      try {
        await apiService.cancelNativeGuiderDarks();
      } catch (error) {
        console.warn('[NativeGuider] cancel darks failed:', error?.message || error);
      }
    },

    // --- Guiding Coach ------------------------------------------------------------

    /** Loads the coach status (409 = no native guider: nothing to show, no error). */
    async loadCoach() {
      this.coachLoading = true;
      try {
        const status = await apiService.getNativeGuiderCoach();
        if (status) this.setCoach(status);
        this.coachError = null;
      } catch (error) {
        if (error?.cancelled) return;
        this.coachError = error?.status === 409 ? null : error?.message || String(error);
      } finally {
        this.coachLoading = false;
      }
    },

    /** Applies a coach status; a session that just completed refreshes the history. */
    setCoach(status) {
      if (!status || typeof status !== 'object') return;
      const previous = this.coach;
      this.coach = status;
      this.coachUpdatedAt = Date.now();
      const finished = status.phase === 'Complete' && status.report;
      const wasFinished =
        previous?.phase === 'Complete' && previous?.sessionId === status.sessionId;
      // The first load of the tab fetches the history itself.
      if (finished && previous && !wasFinished) this.loadCoachHistory();
    },

    /**
     * Starts a session. Resolves { ok: true } or { ok: false, message, messageCode } - the start
     * screen shows the (localized) reason next to the button instead of a toast.
     */
    async startCoach(options) {
      if (this.coachPending) return { ok: false, message: null, messageCode: null };
      this.coachPending = 'start';
      try {
        const result = await apiService.startNativeGuiderCoach(options);
        if (result?.status) this.setCoach(result.status);
        this.refreshStatus();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          cancelled: error?.cancelled === true,
          message: error?.message || String(error),
          messageCode: error?.messageCode || null,
          messageParameters: error?.messageParameters || {},
        };
      } finally {
        this.coachPending = null;
      }
    },

    async skipCoachStep({ title } = {}) {
      return this.coachCall('skip', () => apiService.skipNativeGuiderCoachStep(), title);
    },

    async cancelCoach({ title } = {}) {
      return this.coachCall('cancel', () => apiService.cancelNativeGuiderCoach(), title);
    },

    /**
     * Applies findings/trials by id. The guider's status marks them applied; until it arrives
     * they are marked here, and the settings are reloaded so the sheet shows the new values.
     */
    async applyCoachActions(ids, { title } = {}) {
      const ok = await this.coachCall(
        'apply',
        async () => {
          const result = await apiService.applyNativeGuiderCoachActions(ids);
          if (result?.status) this.setCoach(result.status);
          this.markCoachApplied(result?.applied || ids);
          return result;
        },
        title
      );
      if (ok) this.loadSettings();
      return ok;
    },

    /** Runs a coach call; failures are toasted with the backend's reason. */
    async coachCall(name, call, title) {
      if (this.coachPending) return false;
      this.coachPending = name;
      try {
        const result = await call();
        if (name !== 'apply' && result?.status) this.setCoach(result.status);
        return true;
      } catch (error) {
        if (!error?.cancelled) {
          useToastStore().showToast({
            type: 'error',
            title: title || i18n.global.t('components.guider.native.coach.title'),
            message: error?.message || String(error),
          });
        }
        return false;
      } finally {
        this.coachPending = null;
      }
    },

    markCoachApplied(ids) {
      if (!this.coach || !Array.isArray(ids) || !ids.length) return;
      const set = new Set(ids);
      const markFindings = (list) =>
        Array.isArray(list) ? list.map((f) => (set.has(f.id) ? { ...f, applied: true } : f)) : list;
      const markTrials = (list) =>
        Array.isArray(list)
          ? list.map((trial) =>
              set.has(`trial:${trial.id}`) ? { ...trial, applied: true } : trial
            )
          : list;
      const coach = { ...this.coach };
      coach.findings = markFindings(coach.findings);
      coach.trials = markTrials(coach.trials);
      if (coach.report) {
        coach.report = {
          ...coach.report,
          findings: markFindings(coach.report.findings),
          trials: markTrials(coach.report.trials),
        };
      }
      this.coach = coach;
    },

    async loadCoachHistory(max = COACH_HISTORY_MAX) {
      this.coachHistoryLoading = true;
      try {
        const reports = await apiService.getNativeGuiderCoachHistory(max);
        this.coachHistory = Array.isArray(reports) ? reports : [];
        this.coachHistoryError = null;
      } catch (error) {
        if (error?.cancelled) return;
        this.coachHistoryError = error?.status === 409 ? null : error?.message || String(error);
      } finally {
        this.coachHistoryLoading = false;
      }
    },

    /**
     * Applies a live hint's setting changes (coach/apply accepts active hint ids and dismisses
     * the hint). Resolves true on success; failures are toasted with the backend's reason.
     */
    async applyHint(hint, { title } = {}) {
      if (!hint?.id) return false;
      try {
        await apiService.applyNativeGuiderCoachActions([hint.id]);
        const key = hintKey(hint);
        if (!this.dismissedHintKeys.includes(key)) {
          this.dismissedHintKeys = [...this.dismissedHintKeys, key].slice(-100);
        }
        this.loadSettings();
        return true;
      } catch (error) {
        if (!error?.cancelled) {
          useToastStore().showToast({
            type: 'error',
            title: title || i18n.global.t('components.guider.native.coach.title'),
            message: error?.message || String(error),
          });
        }
        return false;
      }
    },

    /** Hides a hint at once and tells the guider (an already expired hint is fine). */
    async dismissHint(hint) {
      if (!hint?.id) return;
      const key = hintKey(hint);
      if (!this.dismissedHintKeys.includes(key)) {
        this.dismissedHintKeys = [...this.dismissedHintKeys, key].slice(-100);
      }
      try {
        const result = await apiService.dismissNativeGuiderHint(hint.id);
        if (Array.isArray(result?.hints)) this.hints = result.hints;
      } catch (error) {
        if (!error?.cancelled && error?.status !== 409) {
          console.warn('[NativeGuider] dismissing the hint failed:', error?.message || error);
        }
      }
    },

    // --- Flight recorder (incidents) ---------------------------------------------

    /** Loads the incident list (409 = no native guider: nothing to show, no error). */
    async loadIncidents() {
      this.incidentsLoading = true;
      try {
        const list = await apiService.getNativeGuiderIncidents();
        if (list && typeof list === 'object') {
          const { incidents, ...rest } = list;
          this.incidents = Array.isArray(incidents) ? incidents : [];
          this.incidentList = rest;
          this.incidentRecordingId = rest.recordingId ?? null;
        }
        this.incidentsError = null;
      } catch (error) {
        if (error?.cancelled) return;
        this.incidentsError = error?.status === 409 ? null : error?.message || String(error);
      } finally {
        this.incidentsLoading = false;
      }
    },

    /** Reloads the list shortly after events (budget and usage are not in the events). */
    scheduleIncidentsReload(delayMs = 1500) {
      if (incidentsReloadTimer) clearTimeout(incidentsReloadTimer);
      incidentsReloadTimer = setTimeout(() => {
        incidentsReloadTimer = null;
        this.loadIncidents();
      }, delayMs);
    },

    /** Replaces a summary in place, or inserts a new one (newest first). */
    upsertIncident(summary) {
      if (!summary?.id) return;
      const index = this.incidents.findIndex((i) => i?.id === summary.id);
      if (index >= 0) {
        const list = [...this.incidents];
        list[index] = summary;
        this.incidents = list;
        return;
      }
      this.incidents = [...this.incidents, summary].sort(
        (a, b) => (Date.parse(b.start) || 0) - (Date.parse(a.start) || 0)
      );
    },

    /** The Incidents tab was seen: its incidents no longer count for the badge. */
    markIncidentsSeen() {
      const newest = newestSavedAt(this.incidents);
      if (newest > this.incidentsLastSeen) {
        this.incidentsLastSeen = newest;
        writeLastSeen(newest);
      }
    },

    /** Applies an 'incident' message { action: started | saved | deleted, id, summary }. */
    handleIncidentEvent(payload) {
      const id = payload?.id;
      if (!id) return;
      switch (String(payload.action || '').toLowerCase()) {
        case 'started':
          this.incidentRecordingId = id;
          break;
        case 'saved': {
          if (this.incidentRecordingId === id) this.incidentRecordingId = null;
          if (payload.summary) this.upsertIncident({ ...payload.summary, id });
          const onReplay = pendingMarks.get(id);
          if (onReplay) {
            pendingMarks.delete(id);
            onReplay(payload.summary || { id });
          }
          this.scheduleIncidentsReload();
          break;
        }
        case 'deleted':
          this.incidents = this.incidents.filter((i) => i?.id !== id);
          if (this.incidentRecordingId === id) this.incidentRecordingId = null;
          this.scheduleIncidentsReload();
          break;
        default:
          break;
      }
    },

    /** Runs a keep/delete call; failures are toasted with the backend's reason. */
    async incidentCall(pending, call, title) {
      if (this.incidentPending) return null;
      this.incidentPending = pending;
      try {
        return (await call()) ?? true;
      } catch (error) {
        if (!error?.cancelled) {
          useToastStore().showToast({
            type: 'error',
            title: title || i18n.global.t('components.guider.native.incidents.title'),
            message: error?.message || String(error),
          });
        }
        return null;
      } finally {
        this.incidentPending = null;
      }
    },

    /** Keeps (never rotated out) or releases an incident. Resolves true on success. */
    async keepIncident(id, kept, { title } = {}) {
      const result = await this.incidentCall(
        id,
        () => apiService.keepNativeGuiderIncident(id, kept),
        title
      );
      if (!result) return false;
      const current = this.incidents.find((i) => i?.id === id);
      this.upsertIncident(result?.id ? result : { ...current, id, kept });
      return true;
    },

    async deleteIncident(id, { title } = {}) {
      const result = await this.incidentCall(
        id,
        () => apiService.deleteNativeGuiderIncident(id),
        title
      );
      if (!result) return false;
      this.incidents = this.incidents.filter((i) => i?.id !== id);
      if (this.replayIncidentId === id) this.replayIncidentId = null;
      this.scheduleIncidentsReload(0);
      return true;
    },

    /** Deletes all incidents that are not kept; resolves the number deleted (null on failure). */
    async deleteAllIncidents({ title } = {}) {
      const result = await this.incidentCall(
        'all',
        () => apiService.deleteAllNativeGuiderIncidents(),
        title
      );
      if (!result) return null;
      this.incidents = this.incidents.filter((i) => i?.kept === true);
      this.scheduleIncidentsReload(0);
      return Number(result?.deleted) || 0;
    },

    /**
     * Marks the moment as a manual incident. Resolves { ok: true, id } or { ok: false, message }.
     * onSaved(summary) runs when the incident has been saved (the toast with Replay).
     */
    async markIncident(note, { onSaved } = {}) {
      try {
        const result = await apiService.markNativeGuiderIncident(note);
        const id = result?.id || null;
        if (id) {
          this.incidentRecordingId = id;
          if (typeof onSaved === 'function') pendingMarks.set(id, onSaved);
        }
        return { ok: true, id };
      } catch (error) {
        return {
          ok: false,
          cancelled: error?.cancelled === true,
          message: error?.message || String(error),
        };
      }
    },

    openReplay(id) {
      if (id) this.replayIncidentId = id;
    },

    closeReplay() {
      this.replayIncidentId = null;
    },

    // --- Feed messages ----------------------------------------------------------

    alertKey(alert) {
      return `${alert?.code ?? ''}|${alert?.timestamp ?? ''}|${alert?.title ?? ''}`;
    },

    /** Applies one { type, timestamp, payload } message from /ws/internal-guider. */
    handleMessage(message) {
      const payload = message?.payload;
      switch (message?.type) {
        case 'hello':
        case 'device':
        case 'heartbeat':
          if (payload && typeof payload === 'object') {
            const wasAvailable = this.summary.available;
            this.summary = { ...this.summary, ...payload };
            if (!wasAvailable && this.summary.available) this.loadHistory();
          }
          break;
        case 'step':
          if (payload) this.steps = appendSteps(this.steps, payload, MAX_STEPS);
          break;
        case 'alert':
          if (payload) this.addAlert(payload);
          break;
        case 'state':
          this.applyState(payload);
          break;
        case 'calibration':
          if (payload && payload.raAngleDeg !== undefined) {
            this.calibration = payload;
            this.calibrationProgress = null;
          } else if (payload) {
            this.calibrationProgress = payload;
          }
          break;
        case 'settle':
          this.settle = payload || null;
          if (this.status && payload?.status) {
            const s = String(payload.status).toLowerCase();
            this.status = { ...this.status, isSettling: s === 'begin' || s === 'settling' };
          }
          break;
        case 'frame':
          if (payload) this.frame = payload;
          break;
        case 'stats':
          if (payload) this.stats = payload;
          break;
        case 'darks':
          this.darks = payload || null;
          break;
        case 'coach':
          this.setCoach(payload);
          break;
        case 'incident':
          this.handleIncidentEvent(payload);
          break;
        case 'hint':
          if (payload?.id) {
            this.hints = upsertHint(this.hints, payload);
            this.hintClock = Date.now();
          }
          break;
        case 'action':
          this.lastActionResult = { ...(payload || {}), at: Date.now() };
          if (payload && payload.success === false && payload.error) {
            useToastStore().showToast({
              type: 'error',
              title: this.actionFailedTitle(payload.action),
              message: payload.error,
            });
          }
          break;
        default:
          break;
      }
      const marker = markerFromMessage(message);
      if (marker) this.markers = appendMarker(this.markers, marker, MAX_MARKERS);
    },

    applyState(payload) {
      if (!payload) return;
      if (typeof payload === 'string') {
        this.status = { ...(this.status || {}), state: payload };
      } else if (typeof payload === 'object') {
        this.status = { ...(this.status || {}), ...payload };
        if (Array.isArray(payload.hints)) this.hints = payload.hints;
      }
    },

    /** Toast title of a failed background action: the localized action name, else its id. */
    actionFailedTitle(action) {
      const { t, te } = i18n.global;
      if (!action) return t('components.guider.title');
      const key = `components.guider.native.controls.actions.${action}`;
      return t('components.guider.native.controls.failed', { action: te(key) ? t(key) : action });
    },

    addAlert(alert) {
      const key = this.alertKey(alert);
      this.alerts = [...this.alerts, alert].slice(-MAX_ALERTS);
      if (String(alert.severity).toLowerCase() !== 'critical') return;
      if (this._toastedAlertKeys.includes(key)) return;
      this._toastedAlertKeys = [...this._toastedAlertKeys, key].slice(-MAX_ALERTS);
      const text = alertText(i18n.global, alert);
      const message = [text.explanation, text.fix].filter(Boolean).join(' ');
      useToastStore().showToast({
        type: 'error',
        title: text.title || i18n.global.t('components.guider.title'),
        message: message || alert.detail || '',
        autoClose: false,
      });
    },

    /** Forget everything instance-bound (used when the guider disconnects). */
    resetLive() {
      clearPendingIncidentWork();
      this.status = null;
      this.steps = [];
      this.markers = [];
      this.frame = null;
      this.settle = null;
      this.stats = null;
      this.calibrationProgress = null;
      this.hints = [];
    },
  },
});
