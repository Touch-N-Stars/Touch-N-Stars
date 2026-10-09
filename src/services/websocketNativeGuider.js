import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import { ReconnectingWebSocket } from '@/utils/reconnectingWebSocket';
import { isAppBackgrounded } from '@/utils/appLifecycle';

// A 10 s server heartbeat keeps the feed alive; without any message for this long the socket
// is treated as a half-open zombie and redialed.
const STALE_AFTER_MS = 25000;

/**
 * Live feed of the PINS native guider (/ws/internal-guider on the Touch'N'Stars plugin port).
 * Messages are { type, timestamp, payload }; see NativeGuiderSocket.cs for the types.
 *
 * App-scoped while a native guider is connected (critical alerts must surface on every page),
 * started/stopped by nativeGuiderStore. The ReconnectingWebSocket core owns backoff and
 * reachability gating; the 2 s status poll of the guider page stays the source of truth.
 */
class WebSocketNativeGuiderService {
  constructor() {
    this.messageCallback = null;
    this.statusCallback = null;
    this._staleTimer = null;

    this._rws = new ReconnectingWebSocket({
      name: 'NativeGuider',
      getUrl: () => {
        const settingsStore = useSettingsStore();
        const host = settingsStore.connection.ip || window.location.hostname;
        const port = settingsStore.connection.port || window.location.port || 80;
        const protocol = settingsStore.backendProtocol === 'https' ? 'wss' : 'ws';
        return `${protocol}://${host}:${port}/ws/internal-guider`;
      },
      canReconnect: () => apiStore().isTnsPluginConnected,
      backoffInitialMs: 1000,
      backoffMaxMs: 15000,
      onOpen: () => {
        this._armStaleCheck();
        if (this.statusCallback) this.statusCallback('open');
      },
      onClose: () => {
        // Nothing to watch until the next open re-arms it.
        this._clearStaleCheck();
        if (this.statusCallback) this.statusCallback('closed');
      },
      onStatus: (status) => {
        if (status === 'error' && this.statusCallback) this.statusCallback('error');
      },
      onMessage: (message) => {
        if (!message || typeof message !== 'object' || !message.type) return;
        if (this.messageCallback) this.messageCallback(message);
      },
    });
  }

  setMessageCallback(callback) {
    this.messageCallback = callback;
  }

  setStatusCallback(callback) {
    this.statusCallback = callback;
  }

  get isConnected() {
    return this._rws.isOpen();
  }

  connect() {
    // Fire-and-forget: the core keeps retrying on its own.
    return this._rws.connect().catch(() => {});
  }

  disconnect() {
    this._clearStaleCheck();
    this._rws.disconnect();
  }

  resumeAfterBackground() {
    this._rws.resumeReconnect();
  }

  _armStaleCheck() {
    this._clearStaleCheck();
    this._staleTimer = setInterval(() => {
      // In the background the WebView is suspended and silence means nothing; redialing from
      // there is what the background rule forbids. resumeAfterBackground() redials on return.
      if (isAppBackgrounded.value) return;
      const last = this._rws.lastMessageAt;
      if (this._rws.isOpen() && last && Date.now() - last > STALE_AFTER_MS) {
        console.warn('[NativeGuider] feed stale, reconnecting');
        this._rws.forceReconnect().catch(() => {
          // onclose arms the next attempt; nothing to do here
        });
      }
    }, 5000);
  }

  _clearStaleCheck() {
    if (this._staleTimer) {
      clearInterval(this._staleTimer);
      this._staleTimer = null;
    }
  }
}

const websocketNativeGuiderService = new WebSocketNativeGuiderService();
export default websocketNativeGuiderService;
