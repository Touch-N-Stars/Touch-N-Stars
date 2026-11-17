import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { apiStore } = await import('@/store/store');
const { useCameraStore } = await import('@/store/cameraStore');
const { default: apiService } = await import('@/services/apiService');

// Records the guide camera slot calls for one test; restored afterwards.
function stubGuideCameraApi(t, response) {
  const calls = [];
  const original = apiService.guideCameraAction;
  apiService.guideCameraAction = async (action) => {
    calls.push(action);
    return response;
  };
  t.after(() => (apiService.guideCameraAction = original));
  return calls;
}

function setup(connected) {
  freshPinia();
  const store = apiStore();
  store.guideCameraInfo = { Connected: connected, IsExposing: false, BinningModes: [] };
  return useCameraStore();
}

test('readGuideCameraSettings reads the guide camera slot, not the imaging camera', async (t) => {
  const calls = stubGuideCameraApi(t, { Success: true, Response: { USBLimit: 40 } });
  const cameraStore = setup(true);

  await cameraStore.readGuideCameraSettings();

  assert.deepEqual(calls, ['get-settings']);
  assert.deepEqual(cameraStore.guideCameraSettings, { USBLimit: 40 });
  assert.equal(cameraStore.cameraSettings, undefined);
});

test('readGuideCameraSettings asks nothing while the guide camera is not connected', async (t) => {
  const calls = stubGuideCameraApi(t, { Success: true, Response: {} });
  const cameraStore = setup(false);

  await cameraStore.readGuideCameraSettings();

  assert.deepEqual(calls, []);
  assert.equal(cameraStore.guideCameraSettings, undefined);
});

test('readGuideCameraSettings keeps the last settings when the slot reports a failure', async (t) => {
  stubGuideCameraApi(t, { Success: false, Error: 'no camera' });
  const cameraStore = setup(true);
  cameraStore.guideCameraSettings = { USBLimit: 40 };

  await cameraStore.readGuideCameraSettings();

  assert.deepEqual(cameraStore.guideCameraSettings, { USBLimit: 40 });
});
