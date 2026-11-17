import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';
import { createPinia, setActivePinia } from 'pinia';
import { useLuckyCaptureStore } from '../store/luckycaptureStore.js';

test('a connected camera replaces the disconnected placeholder after a Ready event', async (t) => {
  const pinia = createPinia();
  setActivePinia(pinia);
  pinia._s.set('settings', {
    connection: { ip: 'pi-test', port: 5000 },
    $onAction() {},
  });
  pinia._s.set('store', { apiPort: 1888 });
  const previousAdapter = axios.defaults.adapter;
  const previousEvents = globalThis.EventSource;
  let stream;
  globalThis.EventSource = class {
    constructor() {
      stream = this;
    }
    close() {}
  };
  const store = useLuckyCaptureStore();
  t.after(() => {
    store.close();
    axios.defaults.adapter = previousAdapter;
    globalThis.EventSource = previousEvents;
  });
  let connected = false;
  let cameraReads = 0;
  axios.defaults.adapter = async (config) => {
    const path = config.url.split('/').at(-1);
    const responses = {
      health: { available: true },
      camera: { connected, deviceId: connected ? 'omegon-test' : null },
      controls: [{ id: 'gain', currentValue: 100 }],
      settings: {},
      capabilities: { cameraConnected: connected, stream: { available: connected } },
      status: { state: 'DISCONNECTED', previewSequence: 0 },
    };
    if (path === 'camera') cameraReads++;
    return { data: responses[path], status: 200, statusText: 'OK', headers: {}, config };
  };
  await store.open();
  assert.equal(store.camera.connected, false);
  connected = true;
  await stream.onmessage({ data: JSON.stringify({ state: 'READY', previewSequence: 0 }) });
  assert.equal(store.camera.connected, true);
  assert.equal(store.camera.deviceId, 'omegon-test');
  assert.equal(store.controls[0].id, 'gain');
  assert.equal(store.capabilities.cameraConnected, true);
  assert.equal(store.capabilities.stream.available, true);
  const readsAfterReconnect = cameraReads;
  await stream.onmessage({ data: JSON.stringify({ state: 'READY', previewSequence: 0 }) });
  assert.equal(cameraReads, readsAfterReconnect);
  await stream.onmessage({ data: JSON.stringify({ state: 'DISCONNECTED', previewSequence: 0 }) });
  assert.equal(store.camera.connected, false);
  await stream.onmessage({ data: JSON.stringify({ state: 'READY', previewSequence: 0 }) });
  assert.equal(store.camera.connected, true);
});
