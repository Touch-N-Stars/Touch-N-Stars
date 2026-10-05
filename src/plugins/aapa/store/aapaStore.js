import { watch } from 'vue';
import { defineStore } from 'pinia';
import { ReconnectingWebSocket } from '@/utils/reconnectingWebSocket';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import { useTppaStore } from '@/store/tppaStore';
import apiService from '@/services/apiService';
import websocketTppa from '@/services/websocketTppa';
import { buildTppaStartMessage, unparkMountForTppa } from '@/utils/tppaStart';
import {
  DEFAULT_WS_PORT,
  LOG_LIMIT,
  buildCalibrateMessage,
  buildCommandMessage,
  buildConnectMessage,
  buildNudgeMessage,
  buildSetMessage,
  classifyMessage,
  classifyTppaMessage,
  coerceSettingValue,
  deriveFromLog,
  initialDerivedState,
  resolveRunState,
} from '../utils/aapaProtocol';

const STORAGE_KEY = 'aapa-plugin-settings';

function loadWsPort() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const port = Number(saved.wsPort);
    return Number.isInteger(port) && port > 0 && port <= 65535 ? port : DEFAULT_WS_PORT;
  } catch {
    return DEFAULT_WS_PORT;
  }
}

// The socket lives outside the reactive state: Pinia would deep-proxy it.
let rws = null;
let logSeq = 0;

// One-button polar alignment (TPPA + Auto-Pilot). The AAPA server waits for a TPPA
// reading without any timeout, so every phase of the flow is bounded here instead.
const TPPA_ACK_TIMEOUT_MS = 15000;
const AUTOPILOT_START_TIMEOUT_MS = 20000;
// TPPA pushes progress during exposures and solves; a silence this long means it died.
const TPPA_SILENCE_TIMEOUT_MS = 120000;
let assistTimer = null;
let tppaSilenceTimer = null;
let unsubscribeTppa = null;
let stopRunWatch = null;

function clearAssistTimers() {
  clearTimeout(assistTimer);
  clearTimeout(tppaSilenceTimer);
  assistTimer = null;
  tppaSilenceTimer = null;
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export const useAapaStore = defineStore('aapaStore', {
  state: () => ({
    wsPort: loadWsPort(),
    wsStatus: 'idle',
    server: null,
    derived: initialDerivedState(),
    log: [],
    // 'idle' | 'startingTppa' | 'startingAutoPilot' | 'running'
    assist: 'idle',
    // Key under plugins.aapa.assist.errors, or null
    assistError: null,
    tppaStartedByUs: false,
    tppaPaused: false,
    tppaStatus: null,
    lastTppaReading: null,
  }),

  getters: {
    isWsOpen: (state) => state.wsStatus === 'open',
    deviceConnected: (state) => state.wsStatus === 'open' && Boolean(state.server?.isConnected),
    settings: (state) => state.server?.settings ?? {},
    runState: (state) => resolveRunState(state.server, state.derived),
    assistActive: (state) => state.assist !== 'idle',
    wsUrl: (state) => {
      const host = useSettingsStore().connection.ip || window.location.hostname;
      return host ? `ws://${host}:${state.wsPort}` : null;
    },
  },

  actions: {
    /** Open the socket while the plugin page is shown; stop() closes it again. */
    start() {
      if (!rws) {
        rws = new ReconnectingWebSocket({
          name: 'AAPA',
          getUrl: () => this.wsUrl,
          // The AAPA server runs inside NINA, so there is no point dialing while NINA is down.
          canReconnect: () => apiStore().isApiConnected,
          onStatus: (status) => {
            if (status === 'open') {
              this.wsStatus = 'open';
            } else if ((status === 'closed' || status === 'error') && !rws?.isOpen()) {
              // Stays 'closed' through the reconnect-scheduled/-waiting phases, so an
              // unreachable server reads as unreachable instead of flickering to "connecting".
              this.wsStatus = 'closed';
            }
          },
          onOpen: () => {
            // Whatever ran before is unknown after a reconnect; the next log marker sets it again.
            // A running one-button flow cannot be followed any more either - drop it before the
            // derived reset, so the Auto-Pilot watch does not read the reset as "finished".
            if (this.assist !== 'idle') this.abortAssist('connectionLost');
            this.derived = initialDerivedState();
          },
          onMessage: (message) => this.handleMessage(message),
        });
      }
      if (!unsubscribeTppa) {
        unsubscribeTppa = websocketTppa.addMessageListener((message) =>
          this.onTppaMessage(message)
        );
      }
      if (!stopRunWatch) {
        stopRunWatch = watch(
          () => this.runState.autoPilotRunning,
          (running, wasRunning) => {
            if (running) this.onAutoPilotStarted();
            else if (wasRunning) this.onAutoPilotEnded();
          }
        );
      }
      this.wsStatus = 'connecting';
      rws.connect().catch(() => {
        // The reconnect loop keeps trying; wsStatus reflects the outcome.
      });
    },

    stop() {
      // Leaving the page does not stop TPPA or the Auto-Pilot - both keep running in N.I.N.A.
      // Only the client-side follow-up (the automatic TPPA stop) ends here.
      unsubscribeTppa?.();
      unsubscribeTppa = null;
      stopRunWatch?.();
      stopRunWatch = null;
      clearAssistTimers();
      this.assist = 'idle';
      rws?.disconnect();
      rws = null;
      this.wsStatus = 'idle';
      this.server = null;
    },

    /** One button: start TPPA unless it already runs, then the Auto-Pilot. */
    async startAssist() {
      if (this.assistActive || !this.deviceConnected) return;
      this.assistError = null;
      this.lastTppaReading = null;
      this.tppaStatus = null;
      this.tppaPaused = false;
      this.tppaStartedByUs = false;
      this.assist = 'startingTppa';

      const api = apiStore();
      try {
        if (!websocketTppa.isOpen()) {
          await withTimeout(websocketTppa.connect(), TPPA_ACK_TIMEOUT_MS);
        }
      } catch {
        this.abortAssist('tppaUnavailable');
        return;
      }
      // Stop may have been pressed while waiting.
      if (this.assist !== 'startingTppa') return;

      let tppaRunning = false;
      try {
        const info = await apiService.getTppaInfo();
        tppaRunning = Boolean(info?.Success && info.IsRunning);
      } catch {
        // Unknown - start TPPA; the socket acknowledges the request either way.
      }
      if (this.assist !== 'startingTppa') return;

      if (tppaRunning) {
        this.sendStartAutoPilot();
        return;
      }

      await unparkMountForTppa(api);
      if (this.assist !== 'startingTppa') return;
      const message = buildTppaStartMessage(useTppaStore().settings, api);
      websocketTppa.sendMessage(JSON.stringify(message));
      this.tppaStartedByUs = true;
      clearTimeout(assistTimer);
      assistTimer = setTimeout(() => {
        if (this.assist === 'startingTppa') this.abortAssist('tppaNoResponse');
      }, TPPA_ACK_TIMEOUT_MS);
    },

    sendStartAutoPilot() {
      this.assist = 'startingAutoPilot';
      useTppaStore().setRunning(true);
      this.armTppaSilenceTimer();
      if (!this.command('StartAutoPilot')) {
        this.abortAssist('autoPilotNotStarted');
        return;
      }
      clearTimeout(assistTimer);
      assistTimer = setTimeout(() => {
        if (this.assist === 'startingAutoPilot') this.abortAssist('autoPilotNotStarted');
      }, AUTOPILOT_START_TIMEOUT_MS);
    },

    /** Stop both, whatever state the flow is in. */
    stopAssist() {
      this.command('StopAutoPilot');
      this.stopTppa();
      this.finishAssist();
    },

    stopTppa() {
      websocketTppa.sendMessage(JSON.stringify({ Action: 'stop-alignment' }));
      useTppaStore().setRunning(false);
    },

    /** End the flow on the client without touching N.I.N.A. */
    finishAssist() {
      clearAssistTimers();
      this.assist = 'idle';
    },

    /** Failure path: stop what this flow started, then report why. */
    abortAssist(reason) {
      // After a reconnect the socket state is unknown; the user decides via Stop.
      if (this.assist !== 'idle' && reason !== 'connectionLost') {
        this.command('StopAutoPilot');
        if (this.tppaStartedByUs) this.stopTppa();
      }
      this.finishAssist();
      this.assistError = reason;
    },

    onAutoPilotStarted() {
      if (this.assist !== 'startingAutoPilot') return;
      clearTimeout(assistTimer);
      assistTimer = null;
      this.assist = 'running';
    },

    onAutoPilotEnded() {
      if (this.assist !== 'running') return;
      // Finished, cancelled or failed: TPPA has no job left either.
      this.stopTppa();
      this.finishAssist();
    },

    armTppaSilenceTimer() {
      clearTimeout(tppaSilenceTimer);
      tppaSilenceTimer = null;
      // A paused TPPA sends nothing at all.
      if (this.tppaPaused) return;
      tppaSilenceTimer = setTimeout(() => {
        if (this.assistActive) this.abortAssist('tppaSilent');
      }, TPPA_SILENCE_TIMEOUT_MS);
    },

    onTppaMessage(message) {
      const result = classifyTppaMessage(message);
      if (result.kind === 'reading') this.lastTppaReading = result.reading;
      if (result.kind === 'progress') {
        this.tppaStatus = result.status;
        this.tppaPaused = result.status === 'Paused';
      }
      if (result.kind === 'paused') this.tppaPaused = true;
      if (result.kind === 'resumed') this.tppaPaused = false;
      if (!this.assistActive) return;

      if (result.kind === 'error') {
        this.abortAssist('tppaError');
        return;
      }
      if (this.assist === 'startingTppa') {
        if (result.kind === 'started') this.sendStartAutoPilot();
        return;
      }
      if (result.kind === 'stopped') {
        // TPPA was stopped elsewhere (TPPA page, another client): the Auto-Pilot would wait forever.
        this.command('StopAutoPilot');
        this.finishAssist();
        return;
      }
      this.armTppaSilenceTimer();
    },

    handleMessage(message) {
      const result = classifyMessage(message);
      if (result.kind === 'state') {
        this.server = result.state;
      } else if (result.kind === 'log') {
        this.derived = deriveFromLog(this.derived, result.message);
        this.log.push({ id: ++logSeq, text: result.message });
        if (this.log.length > LOG_LIMIT) this.log.splice(0, this.log.length - LOG_LIMIT);
      }
    },

    send(message) {
      return rws ? rws.send(message) : false;
    },

    /** @returns {boolean} false when the value is invalid for the setting or the socket is down */
    setSetting(key, raw) {
      const value = coerceSettingValue(key, raw);
      if (value === null) return false;
      return this.send(buildSetMessage(key, value));
    },

    command(name, extra) {
      return this.send(buildCommandMessage(name, extra));
    },

    connectDevice(port) {
      return this.send(buildConnectMessage(port));
    },

    nudge(axis, direction) {
      return this.send(buildNudgeMessage(axis, direction, this.settings.NudgeDegrees));
    },

    calibrate(axis) {
      return this.send(buildCalibrateMessage(axis, this.settings.CalibrationSteps));
    },

    setWsPort(port) {
      const value = Number(port);
      if (!Number.isInteger(value) || value <= 0 || value > 65535) return false;
      this.wsPort = value;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ wsPort: value }));
      } catch {
        // Storage can be unavailable (private mode); the port still applies to this session.
      }
      if (rws) {
        this.stop();
        this.start();
      }
      return true;
    },

    clearLog() {
      this.log = [];
    },
  },
});
