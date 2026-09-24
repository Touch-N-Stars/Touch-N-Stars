import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { default: apiService } = await import('@/services/apiService');
const { useImagetStore } = await import('@/store/imageStore');
const { historyEntryKey } = await import('@/utils/imageHistoryUtils');

const entry = {
  Id: '3f2b9c6e1d4a4f0b8e7c2a1d5b6e7f80',
  Date: '2026-09-14T01:05:00',
  ImageType: 'LIGHT',
  Filename: 'M31_0007.fits',
};

function setup() {
  freshPinia();
  return useImagetStore();
}

test('a successful delete addresses the Advanced API by entry id plus file name and hides the entry', async (t) => {
  const imageStore = setup();
  const calls = [];
  t.mock.method(apiService, 'deleteHistoryImage', async (id, filename) => {
    calls.push({ id, filename });
    return { Success: true, Response: 'Image deleted' };
  });

  await imageStore.deleteHistoryImage({ absIdx: 12, entry });

  assert.deepEqual(calls, [{ id: entry.Id, filename: 'M31_0007.fits' }]);
  assert.equal(imageStore.deletedHistoryKeys.has(historyEntryKey(12, entry)), true);
});

test('an entry without an id is never sent to the backend', async (t) => {
  const imageStore = setup();
  let calls = 0;
  t.mock.method(apiService, 'deleteHistoryImage', async () => {
    calls++;
    return { Success: true };
  });

  await assert.rejects(
    imageStore.deleteHistoryImage({ absIdx: 1, entry: { Date: entry.Date } }),
    /no id/
  );
  assert.equal(calls, 0);
  assert.equal(imageStore.deletedHistoryKeys.size, 0);
});

test('a refused delete throws the backend error and leaves the entry visible', async (t) => {
  const imageStore = setup();
  t.mock.method(apiService, 'deleteHistoryImage', async () => ({
    Success: false,
    Error: 'Image file does not exist',
  }));

  await assert.rejects(
    imageStore.deleteHistoryImage({ absIdx: 3, entry }),
    /Image file does not exist/
  );
  assert.equal(imageStore.deletedHistoryKeys.size, 0);
});

test('deleting the image held in the full-resolution cache drops that cache entry', async (t) => {
  const imageStore = setup();
  t.mock.method(apiService, 'deleteHistoryImage', async () => ({ Success: true }));
  imageStore.lastImage.index = 5;
  imageStore.lastImage.image = 'blob:cached-5';

  await imageStore.deleteHistoryImage({ absIdx: 5, entry });
  assert.equal(imageStore.lastImage.image, null);

  // A different index must keep its cache.
  imageStore.lastImage.index = 6;
  imageStore.lastImage.image = 'blob:cached-6';
  await imageStore.deleteHistoryImage({ absIdx: 5, entry });
  assert.equal(imageStore.lastImage.image, 'blob:cached-6');
});

test('switching the backend forgets the local delete marks', async (t) => {
  const imageStore = setup();
  t.mock.method(apiService, 'deleteHistoryImage', async () => ({ Success: true }));

  await imageStore.deleteHistoryImage({ absIdx: 0, entry });
  assert.equal(imageStore.deletedHistoryKeys.size, 1);

  imageStore.clearImageCache();
  assert.equal(imageStore.deletedHistoryKeys.size, 0);
});
