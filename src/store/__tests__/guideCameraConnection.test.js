import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { apiStore } = await import('@/store/store');

function eventHistory(...events) {
  return {
    Success: true,
    Response: events.map(([Event, seconds]) => ({
      Event,
      Time: new Date(Date.UTC(2026, 9, 8, 20, 0, seconds)).toISOString(),
    })),
  };
}

test('GUIDECAMERA events set the guide camera, not the camera', () => {
  freshPinia();
  const store = apiStore();

  store.processEventHistory(eventHistory(['GUIDECAMERA-CONNECTED', 1]));

  assert.equal(store.isGuideCameraConnected, true);
  assert.equal(store.isCameraConnected, false);
});

test('CAMERA events leave the guide camera alone', () => {
  freshPinia();
  const store = apiStore();

  store.processEventHistory(
    eventHistory(['GUIDECAMERA-CONNECTED', 1], ['CAMERA-CONNECTED', 2], ['CAMERA-DISCONNECTED', 3])
  );

  assert.equal(store.isGuideCameraConnected, true);
  assert.equal(store.isCameraConnected, false);
});

test('a disconnected guide camera clears its info', () => {
  freshPinia();
  const store = apiStore();
  store.guideCameraInfo = { Connected: true, IsExposing: false, Name: 'ToupTek G3M678C' };

  store.processEventHistory(
    eventHistory(['GUIDECAMERA-CONNECTED', 1], ['GUIDECAMERA-DISCONNECTED', 2])
  );

  assert.equal(store.isGuideCameraConnected, false);
  assert.equal(store.guideCameraInfo.Connected, false);
  assert.equal(store.guideCameraInfo.Name, undefined);
});

test('the guide camera joins the equipment list right after the camera, only when the profile has it', () => {
  freshPinia();
  const store = apiStore();

  store.getExistingEquipment({
    CameraSettings: { Id: 'cam' },
    GuideCameraSettings: { Id: 'guide' },
    TelescopeSettings: { Id: 'mount' },
  });
  assert.deepEqual(
    store.existingEquipmentList.map((d) => d.apiName),
    ['camera', 'guidecamera', 'mount']
  );

  // Official NINA: no GuideCameraSettings in the profile.
  store.getExistingEquipment({ CameraSettings: { Id: 'cam' }, TelescopeSettings: { Id: 'mount' } });
  assert.deepEqual(
    store.existingEquipmentList.map((d) => d.apiName),
    ['camera', 'mount']
  );
});

test('device info is polled for the guide camera and stays with its device when flags flip', async (t) => {
  freshPinia();
  const store = apiStore();
  const { default: apiService } = await import('@/services/apiService');
  const originals = {
    cameraAction: apiService.cameraAction,
    guideCameraAction: apiService.guideCameraAction,
    mountAction: apiService.mountAction,
  };
  t.after(() => Object.assign(apiService, originals));
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  Object.assign(apiService, {
    cameraAction: async () => ({ Success: true, Response: { Name: 'cam' } }),
    guideCameraAction: async () => {
      await gate;
      return { Success: true, Response: { Name: 'guide' } };
    },
    mountAction: async () => ({ Success: true, Response: { Name: 'mount' } }),
  });
  store.isCameraConnected = true;
  store.isGuideCameraConnected = true;
  store.isMountConnected = true;

  const pending = store.fetchDeviceInfos();
  // A DISCONNECTED event arrives while the requests are in flight.
  store.isGuideCameraConnected = false;
  release();
  const data = await pending;

  assert.equal(data.cameraResponse.Response.Name, 'cam');
  assert.equal(data.guideCameraResponse.Response.Name, 'guide');
  assert.equal(data.mountResponse.Response.Name, 'mount');
});
