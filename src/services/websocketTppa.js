import { useSettingsStore } from '../store/settingsStore';
import { apiStore } from '@/store/store';
import { ReconnectingWebSocket } from '@/utils/reconnectingWebSocket';

const backendProtokol = 'ws';
const backendPfad = '/v2/tppa';

/**
 * TPPA alignment WebSocket. Thin adapter over ReconnectingWebSocket so the
 * reconnect lifecycle (backoff, dedup, generation guard, cancelable timers,
 * idle recheck while unreachable) is shared with the other sockets.
 *
 * App-scoped: the socket survives page navigation. TppaPage only nulls the
 * callbacks on unmount; only store.clearAllStates() / disconnect() closes it.
 */
class WebSocketTppaService {
  constructor() {
    this.statusCallback = null;
    this.messageCallback = null;
    // Extra subscribers besides the TPPA page (e.g. the AAPA plugin's one-button flow).
    this.messageListeners = new Set();

    this._rws = new ReconnectingWebSocket({
      name: 'TPPA',
      getUrl: () => {
        const settingsStore = useSettingsStore();
        const store = apiStore();
        const host = settingsStore.connection.ip || window.location.hostname;
        const port = store.apiPort;
        if (port === null || port === undefined) return null;
        return `${backendProtokol}://${host}:${port}${backendPfad}`;
      },
      // Gate on the raw reachability inputs, not the composite isBackendReachable
      // (which itself includes isWebSocketConnected and would create a cycle).
      canReconnect: () => {
        const store = apiStore();
        return store.isApiConnected && store.isTnsPluginConnected;
      },
      onStatus: (status) => {
        if (!this.statusCallback) return;
        // Preserve the exact strings TppaPage compares against.
        if (status === 'open') this.statusCallback('connected');
        else if (status === 'closed') this.statusCallback('Closed');
        else if (status === 'error') this.statusCallback('Error: TPPA websocket error');
      },
      onMessage: (message) => {
        if (this.messageCallback) this.messageCallback(message);
        for (const listener of this.messageListeners) listener(message);
      },
    });
  }

  setStatusCallback(callback) {
    this.statusCallback = callback;
  }

  setMessageCallback(callback) {
    this.messageCallback = callback;
  }

  /** @returns {() => void} unsubscribe */
  addMessageListener(listener) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  isOpen() {
    return this._rws.isOpen();
  }

  get shouldReconnect() {
    return this._rws.shouldReconnect;
  }

  connect() {
    return this._rws.connect();
  }

  disconnect() {
    this._rws.disconnect();
  }

  resumeAfterBackground() {
    this._rws.resumeReconnect();
  }

  sendMessage(message) {
    this._rws.send(message);
  }
}

const websocketService = new WebSocketTppaService();
export default websocketService;
