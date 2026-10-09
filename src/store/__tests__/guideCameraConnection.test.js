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
