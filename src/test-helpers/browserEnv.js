// Shared environment for `node --test` runs: installs the browser globals the
// application modules touch (window, localStorage, WebSocket, URL object
// helpers) and provides a fresh Pinia per test. Test-only code - never
// imported by application modules.
import { after } from 'node:test';
import { createPinia, setActivePinia } from 'pinia';

// --- Fake WebSocket ---------------------------------------------------------
// Minimal stand-in for the browser WebSocket (same pattern as
// utils/__tests__/reconnectingWebSocket.test.js). Tests drive the lifecycle
// manually via emitOpen/emitClose/emitMessage.

const socketRegistry = [];

export class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.bufferedAmount = 0;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    socketRegistry.push(this);
  }

  send(data) {
    this.sent.push(data);
  }

  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000, reason: 'closed by test' });
  }

  emitOpen() {
    this.readyState = FakeWebSocket.OPEN;
    if (this.onopen) this.onopen();
  }

  emitMessage(data) {
    if (this.onmessage) this.onmessage({ data });
  }

  emitClose(code = 1006, reason = 'abnormal') {
    this.readyState = FakeWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code, reason });
  }
}

export function liveSockets() {
  return socketRegistry;
}

export function lastSocket() {
  return socketRegistry[socketRegistry.length - 1];
}

export function resetSockets() {
  socketRegistry.length = 0;
}

// --- localStorage -----------------------------------------------------------

export class MemoryStorage {
  #map = new Map();

  // Enumeration half of the Web Storage API, used by utils/settingsBackup.js
  // to walk every stored key.
  get length() {
    return this.#map.size;
  }

  key(index) {
    return [...this.#map.keys()][index] ?? null;
  }

  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }

  setItem(key, value) {
    this.#map.set(String(key), String(value));
  }

  removeItem(key) {
    this.#map.delete(key);
  }

  clear() {
    this.#map.clear();
  }
}

// --- Global installation ----------------------------------------------------

let disposeHookRegistered = false;

export function installBrowserGlobals() {
  // Test files call this at module top level, so the hook lands on the root
  // and disposes the last test's stores once the file is done.
  if (!disposeHookRegistered) {
    disposeHookRegistered = true;
    after(disposePinia);
  }
  if (!globalThis.window) {
    globalThis.window = {
      location: { hostname: '127.0.0.1', port: '8080', protocol: 'http:' },
      addEventListener() {},
      removeEventListener() {},
    };
  }
  globalThis.localStorage = new MemoryStorage();
  globalThis.WebSocket = FakeWebSocket;
  // Stand-in for Vite's import.meta.env (rewritten by scripts/test-loader.mjs).
  globalThis.__viteEnv = { DEV: false };
  // Blob URL helpers used by the image/histogram stores.
  if (!globalThis.URL.createObjectURL) {
    globalThis.URL.createObjectURL = () => `blob:fake-${Math.random()}`;
  }
  if (!globalThis.URL.revokeObjectURL) {
    globalThis.URL.revokeObjectURL = () => {};
  }
}

// Stops the stores of the current Pinia: their effect scopes end, so
// watchers stop and `onScopeDispose` cleanups clear pending timers. Without
// this a store timer outlives its test and keeps the test process alive.
let currentPinia = null;

export function disposePinia() {
  currentPinia?._e.stop();
  currentPinia = null;
}

export function freshPinia() {
  disposePinia();
  currentPinia = createPinia();
  setActivePinia(currentPinia);
  return currentPinia;
}
