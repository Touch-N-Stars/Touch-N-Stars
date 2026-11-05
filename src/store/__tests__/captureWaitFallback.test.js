import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { apiStore } = await import('@/store/store');
const { useCameraStore } = await import('@/store/cameraStore');
const { useImagetStore } = await import('@/store/imageStore');
const { useToastStore } = await import('@/store/toastStore');

function setup(t) {
  freshPinia();
  const store = apiStore();
  store.profileInfo = { SnapShotControlSettings: { Save: false } };
  const cameraStore = useCameraStore();
  const imageStore = useImagetStore();
  imageStore.imageData = 'blob:old';
  imageStore.isImageFetching = false;

  const loads = [];
  t.mock.method(imageStore, 'getImage', async () => {
    loads.push(Date.now());
    imageStore.imageData = 'blob:new';
  });
  return { cameraStore, imageStore, loads };
}

function withTimeout(promise, ms, label) {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
}

const IN_PROGRESS = { Success: true, Response: 'Capture already in progress' };
const DONE = { Success: true, Response: {} };

test('a finished capture without IMAGE-PREPARED loads its image instead of spinning forever', async (t) => {
  const { cameraStore, loads } = setup(t);
  const answers = [IN_PROGRESS, DONE, DONE];
  const fakeApi = {
    startCapture: async () => {},
    getImageData: async () => answers.shift() ?? DONE,
  };

  await withTimeout(cameraStore.capturePhoto(fakeApi, 0.01, 100), 8000, 'capture never ended');

  assert.equal(loads.length, 1, 'the image was loaded once by the fallback');
  assert.equal(cameraStore.isLoadingImage, false);
  assert.equal(cameraStore.loading, false);
});

test('a failed capture ends the wait at once and stops the loop', async (t) => {
  const { cameraStore, loads } = setup(t);
  const fakeApi = {
    startCapture: async () => ({ Success: true }),
    getImageData: async () => ({
      Success: false,
      StatusCode: 500,
      Error: 'Capture failed: camera disconnected',
    }),
  };
  cameraStore.isLooping = true;

  await withTimeout(cameraStore.capturePhoto(fakeApi, 0.01, 100), 3000, 'kept waiting');

  assert.equal(loads.length, 0);
  assert.equal(cameraStore.isLooping, false);
  assert.equal(cameraStore.loading, false);
  assert.equal(useToastStore().message, 'Capture failed: camera disconnected');
});

test('an exposure aborted elsewhere ends the wait without an error toast', async (t) => {
  const { cameraStore } = setup(t);
  const toastStore = useToastStore();
  const fakeApi = {
    startCapture: async () => ({ Success: true }),
    getImageData: async () => ({
      Success: false,
      StatusCode: 500,
      Error: 'Capture failed: cancelled',
    }),
  };

  await withTimeout(cameraStore.capturePhoto(fakeApi, 0.01, 100), 3000, 'kept waiting');

  assert.equal(toastStore.newMessage, false);
  assert.equal(cameraStore.loading, false);
});

test('no fallback load while NINA still reports the capture in progress', async (t) => {
  const { cameraStore, loads } = setup(t);
  const fakeApi = {
    startCapture: async () => {},
    getImageData: async () => IN_PROGRESS,
  };

  const capture = cameraStore.capturePhoto(fakeApi, 0.01, 100);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  assert.equal(loads.length, 0);
  assert.equal(cameraStore.isLoadingImage, true);

  cameraStore.resetCaptureState();
  await withTimeout(capture, 2000, 'capture did not honour the abort');
  assert.equal(cameraStore.isLoadingImage, false);
});

// Drives a capture through its wait loops without waiting for real, one second per round.
async function pumpUntilDone(t, capture, maxSeconds = 120) {
  let done = false;
  capture.finally(() => (done = true));
  for (let second = 0; second < maxSeconds && !done; second++) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(1000);
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(done, true, 'capture ended');
}

test('an image that never arrives after the download started tells the user', async (t) => {
  const { cameraStore, imageStore } = setup(t);
  const toastStore = useToastStore();
  imageStore.isImageFetching = true;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fakeApi = { startCapture: async () => {}, getImageData: async () => IN_PROGRESS };

  await pumpUntilDone(t, cameraStore.capturePhoto(fakeApi, 0.01, 100));

  assert.equal(toastStore.newMessage, true);
  assert.equal(toastStore.type, 'error');
  assert.equal(cameraStore.isLoadingImage, false);
});

test('the hard limit of the wait for the download tells the user', async (t) => {
  const { cameraStore } = setup(t);
  const toastStore = useToastStore();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const fakeApi = { startCapture: async () => {}, getImageData: async () => IN_PROGRESS };

  await pumpUntilDone(t, cameraStore.capturePhoto(fakeApi, 0.01, 100));

  assert.equal(toastStore.newMessage, true);
  assert.equal(toastStore.type, 'error');
});

test('an aborted capture stays silent even though no image arrived', async (t) => {
  const { cameraStore, imageStore } = setup(t);
  const toastStore = useToastStore();
  imageStore.isImageFetching = true;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fakeApi = { startCapture: async () => {}, getImageData: async () => IN_PROGRESS };

  const capture = cameraStore.capturePhoto(fakeApi, 0.01, 100);
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(1000);
  cameraStore.resetCaptureState();
  await pumpUntilDone(t, capture);

  assert.equal(toastStore.newMessage, false);
});
