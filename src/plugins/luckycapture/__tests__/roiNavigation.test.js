import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinia, setActivePinia } from 'pinia';
import { useLuckyCaptureStore } from '../store/luckycaptureStore.js';
import { moveCaptureRoi } from '../utils/captureUi.js';

test('ROI moves preserve size, clamp to sensor bounds and respect odd binning alignment', () => {
  const roi = { x: 12, y: 12, width: 120, height: 60 };
  const camera = { width: 300, height: 201 };
  const settings = { binX: 3, binY: 3 };
  assert.deepEqual(moveCaptureRoi(roi, camera, settings, 1, 0), { ...roi, x: 24 });
  assert.deepEqual(moveCaptureRoi(roi, camera, settings, 0, -1, 0), { ...roi, y: 6 });
  const edge = moveCaptureRoi({ ...roi, x: 180, y: 138 }, camera, settings, 1, 1, 0.5);
  assert.deepEqual(edge, { ...roi, x: 180, y: 138 });
  assert.deepEqual(moveCaptureRoi({ ...roi, x: 0 }, camera, settings, -1, 0), { ...roi, x: 0 });
});

function setup(state = 'PREVIEWING') {
  setActivePinia(createPinia());
  const store = useLuckyCaptureStore();
  store.camera = { connected: true };
  store.status = { state };
  store.settings = {
    exposureSeconds: 0.001,
    gain: 42,
    binX: 1,
    binY: 1,
    roi: { x: 10, y: 20, width: 100, height: 80 },
  };
  return store;
}

test('moving ROI pauses preview, changes only ROI, then resumes with new geometry', async () => {
  const store = setup();
  const calls = [];
  const previous = { ...store.settings };
  const roi = { ...previous.roi, x: 30 };
  store.command = async (path, data, method) => {
    calls.push({ path, data, method });
    if (path === 'settings') return data;
    if (path === 'preview/stop') store.status.state = 'READY';
    if (path === 'preview/start') assert.deepEqual(store.settings.roi, roi);
    return {};
  };
  await store.changeRoi(roi);
  assert.deepEqual(
    calls.map((c) => c.path),
    ['preview/stop', 'settings', 'preview/start']
  );
  assert.deepEqual(calls[1], { path: 'settings', method: 'PUT', data: { ...previous, roi } });
  assert.equal(store.previewUrl, '');
});

test('resetting paused ROI leaves preview paused and clears stale crop geometry', async () => {
  const store = setup('READY');
  store.previewRoi = { ...store.settings.roi };
  const calls = [];
  store.command = async (path, data) => {
    calls.push(path);
    return data;
  };
  await store.changeRoi(null);
  assert.deepEqual(calls, ['settings']);
  assert.equal(store.settings.roi, null);
  assert.equal(store.previewRoi, null);
});

test('ROI controls cannot interrupt recording or finalization', async () => {
  for (const state of ['RECORDING', 'STARTING', 'STOPPING', 'FINALIZING']) {
    const store = setup(state);
    store.command = () => assert.fail('No camera command is allowed');
    await assert.rejects(store.changeRoi(null));
  }
});

test('a rejected ROI does not restart preview or overwrite accepted settings', async () => {
  const store = setup();
  const original = { ...store.settings };
  const calls = [];
  store.command = async (path) => {
    calls.push(path);
    if (path === 'settings') throw Error('Camera rejected ROI');
  };
  await assert.rejects(store.changeRoi(null), /rejected ROI/);
  assert.deepEqual(store.settings, original);
  assert.deepEqual(calls, ['preview/stop', 'settings']);
});

test('ROI presets are centred, aligned and only offered when smaller than the sensor', async () => {
  const { roiPresets, centeredRoi } = await import('../utils/captureUi.js');
  const camera = { width: 1280, height: 960 };
  assert.deepEqual(
    roiPresets(camera, { binX: 1, binY: 1 }).map((preset) => preset.key),
    ['320x240', '640x480', '800x600', '1024x768']
  );
  assert.deepEqual(centeredRoi(camera, { binX: 1, binY: 1 }, 320, 240), {
    x: 480,
    y: 360,
    width: 320,
    height: 240,
  });
  const odd = centeredRoi({ width: 1281, height: 961 }, { binX: 3, binY: 3 }, 320, 240);
  for (const value of Object.values(odd)) assert.equal(value % 6, 0);
  assert.deepEqual(
    roiPresets({ width: 640, height: 480 }, {}).map((preset) => preset.key),
    ['320x240']
  );
  assert.deepEqual(roiPresets(null, {}), []);
});
