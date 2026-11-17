import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { apiStore } = await import('@/store/store');
const { useImagetStore } = await import('@/store/imageStore');
const { useCameraStore } = await import('@/store/cameraStore');

freshPinia();
const store = apiStore();
const imageStore = useImagetStore();
const cameraStore = useCameraStore();

const IMAGE_PREPARED = { Response: { Event: 'IMAGE-PREPARED' } };

function spyImageLoads(t) {
  const calls = [];
  t.mock.method(imageStore, 'getImage', async () => calls.push('getImage'));
  t.mock.method(imageStore, 'refreshImageIfChanged', async () => calls.push('refresh'));
  return calls;
}

test('IMAGE-PREPARED during an own capture always loads, even an unchanged frame', async (t) => {
  // capturePhoto() waits for the fetch to start; skipping an identical frame (a simulator
  // replaying its file) left the capture button spinning forever on the second image.
  const calls = spyImageLoads(t);
  imageStore.isImageFetching = false;
  cameraStore.isLoadingImage = true;
  t.after(() => (cameraStore.isLoadingImage = false));

  await store.handleWebSocketMessage(IMAGE_PREPARED);

  assert.deepEqual(calls, ['getImage']);
});

test('IMAGE-PREPARED without an own capture keeps skipping unchanged frames', async (t) => {
  const calls = spyImageLoads(t);
  imageStore.isImageFetching = false;
  cameraStore.isLoadingImage = false;

  await store.handleWebSocketMessage(IMAGE_PREPARED);

  assert.deepEqual(calls, ['refresh']);
});
