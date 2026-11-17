import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import { useMountStore } from '@/store/mountStore';
import { ReconnectingWebSocket } from '@/utils/reconnectingWebSocket';

const backendProtokol = 'ws';

/**
 * Manual mount-slew WebSocket. Thin adapter over ReconnectingWebSocket.
 *
 * Page-scoped: moveAxis.vue connects on mount and disconnects on unmount.
 * The reachability gate + idle recheck mean that if the backend dies while the
 * page stays open, the socket stops hammering and recovers on its own once the
 * backend returns - previously it re-dialed every 2s regardless.
 */
class WebSocketMountControlService {
  constructor() {
    this.statusCallback = null;
    this.messageCallback = null;

    this._rws = new ReconnectingWebSocket({
      name: 'Mount',
      getUrl: () => {
        const settingsStore = useSettingsStore();
        const store = apiStore();
        const host = settingsStore.connection.ip || window.location.hostname;
        // PINS serves manual slew INDI-direct from the Touch-N-Stars plugin (TNS
        // port, /ws/mount-control, direction only). Upstream NINA uses the
        // ninaAPI socket (/v2/mount).
        if (store.isPINS) {
          const port = settingsStore.connection.port || window.location.port || 80;
          return `${backendProtokol}://${host}:${port}/ws/mount-control`;
        }
        const port = store.apiPort;
        if (port === null || port === undefined) return null;
        return `${backendProtokol}://${host}:${port}/v2/mount`;
      },
      canReconnect: () => {
        const store = apiStore();
        // PINS serves this socket from the TNS plugin port directly (see
        // getUrl() above), independent of the ninaAPI. Gating on isApiConnected
        // too would keep the manual slew socket dead whenever the ninaAPI is
        // briefly unreachable, even though the plugin endpoint this socket
        // actually talks to is fine.
        if (store.isPINS) {
          return store.isTnsPluginConnected;
        }
        return store.isApiConnected && store.isTnsPluginConnected;
      },
      onOpen: () => {
        useMountStore().wsIsConnected = true;
        if (this.statusCallback) this.statusCallback('connected');
      },
      onClose: () => {
        useMountStore().wsIsConnected = false;
        if (this.statusCallback) this.statusCallback('Closed');
      },
      onStatus: (status) => {
        if (status === 'error') {
          useMountStore().wsIsConnected = false;
          if (this.statusCallback) this.statusCallback('Error: mount websocket error');
        }
      },
      onMessage: (message) => {
        // Mount API wraps every payload in a Success flag
        if (!message) return;
        if (this.messageCallback) this.messageCallback(message);
      },
    });
  }

  setStatusCallback(callback) {
    this.statusCallback = callback;
  }

  setMessageCallback(callback) {
    this.messageCallback = callback;
  }

  get shouldReconnect() {
    return this._rws.shouldReconnect;
  }

  connect() {
    // Fire-and-forget: callers don't await. The core sinks its own rejection,
    // so a failed dial won't surface as an unhandled rejection.
    return this._rws.connect();
  }

  disconnect() {
    useMountStore().wsIsConnected = false;
    this._rws.disconnect();
  }

  resumeAfterBackground() {
    // No-op unless the slew page is open (it disconnects on unmount, which
    // turns the reconnect loop off).
    this._rws.resumeReconnect();
  }

  sendMessage(message) {
    this._rws.send(message);
  }
}

const websocketService = new WebSocketMountControlService();
export default websocketService;
