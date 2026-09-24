import test from 'node:test';
import assert from 'node:assert/strict';
import { reactive } from 'vue';
import { installBrowserGlobals } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: apiPinsService } = await import('@/services/apiPinsService');

const { identifySelectedRig, initializeRigConnectionSupervisor, recoverRigConnection } =
  await import('@/services/rigConnectionSupervisor');

test('pinsdaemon recovery is inert for a non-PINS backend', async (t) => {
  let backendSwitches = 0;
  let healthProbes = 0;
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => {
    healthProbes += 1;
    throw new Error('A Windows backend must not be probed as pinsdaemon');
  };

  const instance = { id: 'windows-rig', ip: '192.168.1.20', port: 5000 };
  const settingsStore = {
    selectedInstanceId: instance.id,
    connection: { ip: instance.ip, port: instance.port },
    getInstance: () => instance,
  };
  const backendStore = reactive({
    isPINS: false,
    async switchBackend() {
      backendSwitches += 1;
    },
  });

  await initializeRigConnectionSupervisor({ settingsStore, backendStore });
  const result = await recoverRigConnection({ timeoutMs: 10 });

  assert.equal(result, null);
  assert.equal(healthProbes, 0);
  assert.equal(backendSwitches, 0);
  await assert.rejects(() => identifySelectedRig(), /unavailable for this backend/);
});

test('recovery keeps a healthy active endpoint instead of racing its aliases', async (t) => {
  let backendSwitches = 0;
  const probedUrls = [];
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url) => {
    probedUrls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        status: 'ok',
        service: 'pinsdaemon',
        rigId: 'pins-ce29c',
      }),
    };
  };

  const instance = {
    id: 'pins-rig',
    ip: '192.168.178.109',
    port: 5000,
    rigId: 'pins-ce29c',
    preferredEndpoint: { host: 'pins-ce29c.local' },
    candidateHosts: ['pins.local', '10.42.0.1'],
  };
  const settingsStore = {
    selectedInstanceId: instance.id,
    connection: { ip: instance.ip, port: instance.port },
    getInstance: () => instance,
    promoteInstanceEndpoint(_id, { host }) {
      instance.ip = host;
      this.connection.ip = host;
    },
  };
  const backendStore = reactive({
    isPINS: true,
    isBackendReachable: false,
    async switchBackend() {
      backendSwitches += 1;
    },
  });

  await initializeRigConnectionSupervisor({ settingsStore, backendStore });
  const result = await recoverRigConnection({ timeoutMs: 1000 });

  assert.equal(result.host, '192.168.178.109');
  assert.equal(settingsStore.connection.ip, '192.168.178.109');
  assert.equal(backendSwitches, 0);
  assert.ok(probedUrls.length >= 1);
  assert.ok(probedUrls.every((url) => url.includes('192.168.178.109:8000/health')));
});

test('failed PINS Wi-Fi job stops recovery immediately with its classified reason', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalGetJob = apiPinsService.getPinsDaemonJob;
  const originalGetStatus = apiPinsService.getPinsWifiStatus;
  t.after(() => {
    globalThis.fetch = originalFetch;
    apiPinsService.getPinsDaemonJob = originalGetJob;
    apiPinsService.getPinsWifiStatus = originalGetStatus;
  });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ status: 'ok', service: 'pinsdaemon', rigId: 'pins-test' }),
  });
  apiPinsService.getPinsDaemonJob = async () => ({
    jobId: 'wifi-job',
    status: 'failed',
    exitCode: 1,
    errorCode: 'MISSING_CREDENTIALS',
    errorMessage: 'Saved profile has no NetworkManager secret',
  });
  apiPinsService.getPinsWifiStatus = async () => {
    throw new Error('status must not be polled after a terminal job failure');
  };

  const instance = { id: 'pins-test', ip: '192.168.1.10', port: 5000, rigId: 'pins-test' };
  const settingsStore = {
    selectedInstanceId: instance.id,
    connection: { ip: instance.ip, port: instance.port },
    getInstance: () => instance,
    promoteInstanceEndpoint() {},
  };
  const backendStore = reactive({ isPINS: true, async switchBackend() {} });
  await initializeRigConnectionSupervisor({ settingsStore, backendStore });

  await assert.rejects(
    () =>
      recoverRigConnection({ requestedMode: 'client', operationId: 'wifi-job', timeoutMs: 1000 }),
    /MISSING_CREDENTIALS/
  );
});

test('rig is identified from the page host when no instance is saved', async (t) => {
  const probedUrls = [];
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url) => {
    probedUrls.push(String(url));
    return {
      ok: true,
      json: async () => ({ status: 'ok', service: 'pinsdaemon', rigId: 'pins-503ce' }),
    };
  };

  const settingsStore = {
    selectedInstanceId: null,
    connection: { ip: '10.42.0.1', port: 5000 },
    getInstance: () => undefined,
  };
  const backendStore = reactive({
    isPINS: true,
    isBackendReachable: true,
    async switchBackend() {},
  });

  await initializeRigConnectionSupervisor({ settingsStore, backendStore });
  const rigId = await identifySelectedRig();

  assert.equal(rigId, 'pins-503ce');
  assert.deepEqual(probedUrls, ['http://10.42.0.1:8000/health']);
});
