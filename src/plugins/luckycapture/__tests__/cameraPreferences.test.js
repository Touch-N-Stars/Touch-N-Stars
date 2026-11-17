import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cameraPreferenceKey,
  readCameraPreferences,
  writeCameraPreferences,
  sensorPoint,
  cameraDefaults,
} from '../utils/cameraPreferences.js';
import { selectionToRoi } from '../utils/captureUi.js';

test('camera preferences are separated by host, driver and stable camera ID', () => {
  const a = { connected: true, backend: 'ASICamera', deviceId: 'camera-a', name: 'same model' };
  const b = { ...a, deviceId: 'camera-b' };
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  writeCameraPreferences(storage, cameraPreferenceKey('pi-a', a), {
    settings: { bitDepth: 8 },
    rotatedPreview: true,
  });
  assert.deepEqual(readCameraPreferences(storage, cameraPreferenceKey('pi-a', a)), {
    settings: { bitDepth: 8 },
    rotatedPreview: true,
  });
  assert.equal(readCameraPreferences(storage, cameraPreferenceKey('pi-a', b)), null);
  assert.equal(readCameraPreferences(storage, cameraPreferenceKey('pi-b', a)), null);
  assert.equal(cameraPreferenceKey('pi-a', { connected: false }), null);
});

test('disabled storage and corrupt preferences do not prevent capture', () => {
  assert.equal(readCameraPreferences({ getItem: () => '{broken' }, 'camera'), null);
  assert.doesNotThrow(() =>
    writeCameraPreferences(
      {
        setItem: () => {
          throw Error('disabled');
        },
      },
      'camera',
      {}
    )
  );
});

test('ROI selection on rotated preview maps back to the original sensor coordinates', () => {
  const start = sensorPoint({ x: 0.75, y: 0.75 }, true);
  const end = sensorPoint({ x: 0.5, y: 0.5 }, true);
  assert.deepEqual(
    selectionToRoi(
      { x: 0, y: 0, width: 640, height: 480 },
      { x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y }
    ),
    { x: 160, y: 120, width: 160, height: 120 }
  );
  assert.deepEqual(sensorPoint({ x: 0.25, y: 0.75 }, false), { x: 0.25, y: 0.75 });
});

test('a new camera uses its own driver defaults and leaves experimental streaming disabled', () => {
  const result = cameraDefaults(
    { bitDepth: 12, binX: 1, binY: 1 },
    [
      { id: 'exposure', min: 0.000032, max: 0.01 },
      { id: 'gain', currentValue: 7 },
    ],
    { rawDepthOptions: [8, 16] }
  );
  assert.equal(result.bitDepth, 16);
  assert.equal(result.exposureSeconds, 0.01);
  assert.equal(result.gain, 7);
  assert.equal(result.roi, null);
  assert.equal(result.allowExperimentalStreaming, false);
});
