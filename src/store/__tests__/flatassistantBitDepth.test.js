import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { useFlatassistantStore } = await import('@/store/flatassistantStore');
const { apiStore } = await import('@/store/store');

function setup(cameraBitDepth) {
  freshPinia();
  apiStore().cameraInfo = { BitDepth: cameraBitDepth };
  return useFlatassistantStore();
}

function statusLoader(statuses) {
  let index = 0;
  return async () => ({ Response: statuses[Math.min(index++, statuses.length - 1)] });
}

test('maxADU follows the bit depth /flats/status reports for the measured image', async () => {
  // libgphoto2 camera: the camera info carries the profile's 16 bit, the NEF is 14 bit.
  const flatsStore = setup(16);

  await flatsStore.waitForCompletion(
    statusLoader([
      {
        State: 'Running',
        TotalIterations: 10,
        CompletedIterations: 0,
        CurrentADU: 8192,
        BitDepth: 14,
      },
      { State: 'Finished', TotalIterations: -1, CompletedIterations: -1 },
    ]),
    0
  );

  assert.equal(flatsStore.currentADU, 8192);
  assert.equal(flatsStore.currentADUBitDepth, 14);
  assert.equal(flatsStore.maxADU, 16383);
});

test('maxADU falls back to the camera bit depth when the backend reports none', async () => {
  const flatsStore = setup(12);

  await flatsStore.waitForCompletion(
    statusLoader([
      { State: 'Running', TotalIterations: 10, CompletedIterations: 0, CurrentADU: 2000 },
      { State: 'Finished', TotalIterations: -1, CompletedIterations: -1 },
    ]),
    0
  );

  assert.equal(flatsStore.currentADUBitDepth, null);
  assert.equal(flatsStore.maxADU, 4095);
});

test('startManagedRun() clears the measured bit depth with the ADU', () => {
  const flatsStore = setup(16);
  flatsStore.currentADU = 8192;
  flatsStore.currentADUBitDepth = 14;

  flatsStore.startManagedRun('flats');

  assert.equal(flatsStore.currentADUBitDepth, null);
  assert.equal(flatsStore.maxADU, 65535);
});
