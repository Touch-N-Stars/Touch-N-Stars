import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTypeIndexMap,
  historyEntryKey,
  isHistoryEntryDeleted,
  thumbnailCacheKey,
  runWithConcurrency,
  selectIndicesToLoad,
  runDeleteBatch,
  historyRawSource,
  neighbourInOrder,
  createLatestLoader,
} from '../imageHistoryUtils.js';

test('buildTypeIndexMap counts per image type', () => {
  const map = buildTypeIndexMap([
    { ImageType: 'LIGHT' },
    { ImageType: 'FLAT' },
    { ImageType: 'LIGHT' },
    { ImageType: 'FLAT' },
    { ImageType: 'LIGHT' },
  ]);

  assert.deepEqual(map, [
    { typeIdx: 0, imageType: 'LIGHT' },
    { typeIdx: 0, imageType: 'FLAT' },
    { typeIdx: 1, imageType: 'LIGHT' },
    { typeIdx: 1, imageType: 'FLAT' },
    { typeIdx: 2, imageType: 'LIGHT' },
  ]);
});

test('buildTypeIndexMap keeps entries without an image type out of the counters', () => {
  const map = buildTypeIndexMap([
    { ImageType: 'LIGHT' },
    {},
    { ImageType: null },
    { ImageType: 'LIGHT' },
  ]);

  // Typeless entries keep their absolute index and do not disturb the LIGHT counter.
  assert.deepEqual(map[1], { typeIdx: 1, imageType: null });
  assert.deepEqual(map[2], { typeIdx: 2, imageType: null });
  assert.equal(map[3].typeIdx, 1);
});

test('buildTypeIndexMap tolerates null and undefined input', () => {
  assert.deepEqual(buildTypeIndexMap(null), []);
  assert.deepEqual(buildTypeIndexMap(undefined), []);
  assert.deepEqual(buildTypeIndexMap([null]), [{ typeIdx: 0, imageType: null }]);
});

test('thumbnailCacheKey separates types and falls back for missing ones', () => {
  assert.equal(thumbnailCacheKey(3, 'LIGHT'), 'LIGHT:3');
  assert.notEqual(thumbnailCacheKey(3, 'LIGHT'), thumbnailCacheKey(3, 'FLAT'));
  assert.equal(thumbnailCacheKey(0, null), 'ANY:0');
});

test('selectIndicesToLoad returns the visible indices that have nothing yet', () => {
  const todo = selectIndicesToLoad([5, 6, 7], {
    loaded: new Map(),
    failed: new Set(),
    inFlight: new Set(),
  });

  assert.deepEqual(todo, [5, 6, 7]);
});

test('selectIndicesToLoad skips loaded, in-flight and failed indices', () => {
  const todo = selectIndicesToLoad([1, 2, 3, 4], {
    loaded: new Map([[1, 'blob:a']]),
    failed: new Set([2]),
    inFlight: new Set([3]),
  });

  assert.deepEqual(todo, [4]);
});

// Regression guard: the loading watcher re-runs on every newly saved image, so a
// permanently failing thumbnail must not be re-queued each time.
test('selectIndicesToLoad keeps skipping a failed index on repeated calls', () => {
  const state = { loaded: new Map(), failed: new Set([2]), inFlight: new Set() };

  assert.deepEqual(selectIndicesToLoad([1, 2, 3], state), [1, 3]);
  assert.deepEqual(selectIndicesToLoad([1, 2, 3], state), [1, 3]);

  // Clearing the failures (filter change) makes it eligible again.
  state.failed.clear();
  assert.deepEqual(selectIndicesToLoad([1, 2, 3], state), [1, 2, 3]);
});

test('selectIndicesToLoad tolerates a missing index list', () => {
  const state = { loaded: new Map(), failed: new Set(), inFlight: new Set() };
  assert.deepEqual(selectIndicesToLoad(undefined, state), []);
});

test('runWithConcurrency processes every item and starts them in order', async () => {
  const started = [];
  const done = [];

  await runWithConcurrency(
    [1, 2, 3, 4, 5, 6, 7],
    async (item) => {
      started.push(item);
      await Promise.resolve();
      done.push(item);
    },
    { limit: 3 }
  );

  assert.deepEqual(started, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(
    done.slice().sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7]
  );
});

test('runWithConcurrency never exceeds the limit', async () => {
  let inFlight = 0;
  let peak = 0;

  await runWithConcurrency(
    Array.from({ length: 20 }, (_, i) => i),
    async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
    },
    { limit: 4 }
  );

  assert.equal(peak, 4);
});

test('runWithConcurrency stops picking up items once shouldStop turns true', async () => {
  const processed = [];
  let stop = false;

  await runWithConcurrency(
    Array.from({ length: 50 }, (_, i) => i),
    async (item) => {
      processed.push(item);
      if (processed.length >= 4) stop = true;
      await Promise.resolve();
    },
    { limit: 2, shouldStop: () => stop }
  );

  assert.ok(processed.length >= 4, 'the already started items still run to completion');
  assert.ok(processed.length < 50, 'the remaining items are abandoned');
});

test('runWithConcurrency handles an empty or missing queue', async () => {
  await runWithConcurrency([], async () => assert.fail('must not be called'));
  await runWithConcurrency(undefined, async () => assert.fail('must not be called'));
});

test('historyEntryKey ties the index to the capture date', () => {
  // Same index, different capture: after a NINA restart the history starts at 0
  // again, so a bare index would let a new image inherit an old "deleted" mark.
  const oldKey = historyEntryKey(3, { Date: '2026-09-13T22:10:00' });
  const newKey = historyEntryKey(3, { Date: '2026-09-14T01:05:00' });
  assert.notEqual(oldKey, newKey);
  assert.equal(historyEntryKey(3, { Date: '2026-09-13T22:10:00' }), oldKey);
  assert.equal(historyEntryKey(0, null), '0:');
});

test('isHistoryEntryDeleted honours the backend flag and the local marks', () => {
  const deleted = new Set([historyEntryKey(1, { Date: 'd1' })]);

  assert.equal(
    isHistoryEntryDeleted({ Date: 'd1' }, historyEntryKey(1, { Date: 'd1' }), deleted),
    true
  );
  assert.equal(
    isHistoryEntryDeleted({ Date: 'd2' }, historyEntryKey(2, { Date: 'd2' }), deleted),
    false
  );
  assert.equal(isHistoryEntryDeleted({ IsDeleted: true }, 'x', new Set()), true);
  // A backend that does not know the flag, and no local mark: the image is shown.
  assert.equal(isHistoryEntryDeleted({}, 'x', undefined), false);
  assert.equal(isHistoryEntryDeleted(null, 'x', new Set()), false);
});

test('runDeleteBatch deletes sequentially, keeps going after a failure and reports progress', async () => {
  const order = [];
  const progress = [];
  const result = await runDeleteBatch(
    [1, 2, 3],
    async (item) => {
      order.push(item);
      if (item === 2) throw new Error('boom');
    },
    { onProgress: (done, total) => progress.push([done, total]) }
  );
  assert.deepEqual(order, [1, 2, 3]);
  assert.deepEqual(result.deleted, [1, 3]);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].item, 2);
  assert.equal(result.failed[0].error.message, 'boom');
  assert.deepEqual(progress, [
    [0, 3],
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
});

test('runDeleteBatch with nothing to do resolves empty', async () => {
  const result = await runDeleteBatch([], async () => {});
  assert.deepEqual(result, { deleted: [], failed: [] });
});

test('historyRawSource prefers the file name and falls back to position plus statistics', () => {
  assert.deepEqual(historyRawSource(3, { Filename: 'L_001.fits', Mean: 1, Median: 2 }), {
    kind: 'history',
    filename: 'L_001.fits',
  });
  assert.deepEqual(historyRawSource(3, { Mean: 1.5, Median: 2 }), {
    kind: 'history',
    index: 3,
    mean: 1.5,
    median: 2,
  });
  assert.equal(historyRawSource(3, { Mean: NaN, Median: 2 }), null);
  assert.equal(historyRawSource(3, undefined), null);
});

test('neighbourInOrder steps through the order the grid shows', () => {
  // Newest first: absolute indices run backwards.
  const order = [7, 5, 4, 0];
  assert.equal(neighbourInOrder(order, 5, -1), 7);
  assert.equal(neighbourInOrder(order, 5, 1), 4);
  assert.equal(neighbourInOrder(order, 4, 1), 0);
});

test('neighbourInOrder stops at both ends and for entries no longer listed', () => {
  const order = [7, 5, 4, 0];
  assert.equal(neighbourInOrder(order, 7, -1), null);
  assert.equal(neighbourInOrder(order, 0, 1), null);
  assert.equal(neighbourInOrder(order, 6, 1), null);
  assert.equal(neighbourInOrder([], 0, 1), null);
  assert.equal(neighbourInOrder(undefined, 0, 1), null);
});

function deferredLoads() {
  const pending = [];
  const load = (key) =>
    new Promise((resolve) => {
      pending.push({ key, resolve });
    });
  return { load, pending };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('createLatestLoader delivers a single request', async () => {
  const { load, pending } = deferredLoads();
  const delivered = [];
  const loader = createLatestLoader(load, (key, result) => delivered.push([key, result]));

  loader.request(4);
  pending[0].resolve('url-4');
  await flush();

  assert.deepEqual(delivered, [[4, 'url-4']]);
});

test('createLatestLoader never runs two loads at once and skips what was passed over', async () => {
  const { load, pending } = deferredLoads();
  const delivered = [];
  const loader = createLatestLoader(load, (key, result) => delivered.push([key, result]));

  loader.request(4);
  loader.request(3);
  loader.request(2);
  assert.equal(pending.length, 1, 'requests made during a load wait for it');

  pending[0].resolve('url-4');
  await flush();
  assert.deepEqual(delivered, [], 'a result nobody waits for is dropped');
  assert.deepEqual(
    pending.map((p) => p.key),
    [4, 2],
    'only the last wish is fetched next'
  );

  pending[1].resolve('url-2');
  await flush();
  assert.deepEqual(delivered, [[2, 'url-2']]);
});

test('createLatestLoader delivers an image that was asked for again while it loaded', async () => {
  const { load, pending } = deferredLoads();
  const delivered = [];
  const loader = createLatestLoader(load, (key, result) => delivered.push([key, result]));

  loader.request(4);
  loader.request(3);
  loader.request(4);
  pending[0].resolve('url-4');
  await flush();

  assert.deepEqual(delivered, [[4, 'url-4']]);
  assert.equal(pending.length, 1);
});

test('createLatestLoader drops the running load after cancel and reports failures as null', async () => {
  const delivered = [];
  const { load, pending } = deferredLoads();
  const loader = createLatestLoader(load, (key, result) => delivered.push([key, result]));

  loader.request(4);
  loader.cancel();
  pending[0].resolve('url-4');
  await flush();
  assert.deepEqual(delivered, []);

  const failing = createLatestLoader(
    async () => {
      throw new Error('offline');
    },
    (key, result) => delivered.push([key, result])
  );
  await failing.request(1);
  assert.deepEqual(delivered, [[1, null]]);
});
