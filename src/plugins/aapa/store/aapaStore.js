import { defineStore } from 'pinia';
import { ReconnectingWebSocket } from '@/utils/reconnectingWebSocket';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import {
  DEFAULT_WS_PORT,
  LOG_LIMIT,
  buildCalibrateMessage,
  buildCommandMessage,
  buildConnectMessage,
  buildNudgeMessage,
  buildSetMessage,
  classifyMessage,
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

export const useAapaStore = defineStore('aapaStore', {
  state: () => ({
    wsPort: loadWsPort(),
    wsStatus: 'idle',
    server: null,
    derived: initialDerivedState(),
    log: [],
  }),

  getters: {
    isWsOpen: (state) => state.wsStatus === 'open',
    deviceConnected: (state) => state.wsStatus === 'open' && Boolean(state.server?.isConnected),
    settings: (state) => state.server?.settings ?? {},
    runState: (state) => resolveRunState(state.server, state.derived),
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
            this.derived = initialDerivedState();
          },
          onMessage: (message) => this.handleMessage(message),
        });
      }
      this.wsStatus = 'connecting';
      rws.connect().catch(() => {
        // The reconnect loop keeps trying; wsStatus reflects the outcome.
      });
    },

    stop() {
      rws?.disconnect();
      rws = null;
      this.wsStatus = 'idle';
      this.server = null;
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
