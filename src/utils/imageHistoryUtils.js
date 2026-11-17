/**
 * Helpers for the sequence image history.
 *
 * The thumbnail endpoint (`GET /image/thumbnail/{index}?imageType=...`) indexes
 * per image type, while `store.imageHistoryInfo` is a flat list. Everything here
 * translates between the two and keeps the loading of many thumbnails bounded.
 */

/**
 * Maps every absolute index of the history to its type-relative index. Entries
 * without an ImageType keep their absolute index and query the endpoint without the
 * imageType parameter, which is how the endpoint was always addressed for them.
 *
 * @param {Array<{ImageType?: string}>} historyArray
 * @returns {Array<{typeIdx: number, imageType: string|null}>}
 */
export function buildTypeIndexMap(historyArray) {
  const counters = new Map();

  return (historyArray ?? []).map((img, absIdx) => {
    const imageType = img?.ImageType ?? null;
    if (!imageType) {
      return { typeIdx: absIdx, imageType: null };
    }

    const typeIdx = counters.get(imageType) ?? 0;
    counters.set(imageType, typeIdx + 1);
    return { typeIdx, imageType };
  });
}

export function thumbnailCacheKey(typeIdx, imageType) {
  return `${imageType ?? 'ANY'}:${typeIdx}`;
}

/**
 * Identity of a history entry that survives the list being rebuilt. The absolute
 * index alone is not enough: the Advanced API restarts its history at 0 when NINA is
 * restarted, so a freshly saved image would otherwise inherit the "deleted" mark of
 * an old one.
 */
export function historyEntryKey(index, entry) {
  return `${index}:${entry?.Date ?? ''}`;
}

/**
 * True when an image must no longer be offered in the history: the backend reports
 * the file as gone (`IsDeleted`, set by the delete action of the Advanced API fork),
 * or this session deleted it and the poll has not reflected that yet — the history
 * payload replaces the store list every 2 s, so a local mark has to live next to it.
 */
export function isHistoryEntryDeleted(entry, key, deletedKeys) {
  return entry?.IsDeleted === true || Boolean(deletedKeys?.has(key));
}

/**
 * Picks the visible indices that still need a download.
 *
 * `failed` is excluded on purpose: the watcher that drives loading re-runs on every
 * newly saved image, so without this an index whose thumbnail never materialises
 * would be re-queued — retry delays and all — for the rest of the session. Failures
 * are cleared deliberately instead (filter change, or remounting the tab).
 */
export function selectIndicesToLoad(visibleIndices, { loaded, failed, inFlight }) {
  return (visibleIndices ?? []).filter(
    (index) => !loaded.has(index) && !failed.has(index) && !inFlight.has(index)
  );
}

/**
 * Works through `items` with a bounded number of parallel workers. Items are
 * started in order, so the first entries — the ones on screen — win the race for
 * a free slot. Stops picking up new items as soon as `shouldStop()` turns true.
 */
export async function runWithConcurrency(items, worker, { limit = 4, shouldStop } = {}) {
  const queue = items ?? [];
  if (queue.length === 0) return;

  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, queue.length));

  const runners = Array.from({ length: workerCount }, async () => {
    while (cursor < queue.length) {
      if (shouldStop?.()) return;
      const item = queue[cursor++];
      await worker(item);
    }
  });

  await Promise.all(runners);
}

/**
 * Deletes `items` one after another. The Advanced API handles one file per
 * request and the history indices stay stable (deleted entries are flagged, not
 * removed), so a sequential loop is both simplest and safe. A failure does not
 * stop the batch; every failed item is reported with its error.
 *
 * @param {Array} items
 * @param {(item: any) => Promise<void>} deleteOne
 * @param {{ onProgress?: (done: number, total: number) => void }} [options]
 * @returns {Promise<{ deleted: Array, failed: Array<{ item: any, error: any }> }>}
 */
export async function runDeleteBatch(items, deleteOne, { onProgress } = {}) {
  const queue = items ?? [];
  const deleted = [];
  const failed = [];
  onProgress?.(0, queue.length);
  for (const item of queue) {
    try {
      await deleteOne(item);
      deleted.push(item);
    } catch (error) {
      failed.push({ item, error });
    }
    onProgress?.(deleted.length + failed.length, queue.length);
  }
  return { deleted, failed };
}

/**
 * Raw-data source of a history image for histogram and stretch (see histogramStore
 * fetchRaw()). The PINS fork names the file; the official Advanced API only has the
 * position, which the plugin confirms against the entry's mean and median.
 */
export function historyRawSource(index, stats) {
  if (stats?.Filename) return { kind: 'history', filename: stats.Filename };
  if (isNumber(stats?.Mean) && isNumber(stats?.Median)) {
    return { kind: 'history', index, mean: stats.Mean, median: stats.Median };
  }
  return null;
}

function isNumber(value) {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * The entry `step` places away from `current` in the order the grid shows
 * (-1 = the tile before it, +1 = the tile after it). Null at either end, and when
 * `current` is no longer listed (deleted, or outside the filter).
 */
export function neighbourInOrder(order, current, step) {
  const list = order ?? [];
  const position = list.indexOf(current);
  if (position < 0) return null;
  return list[position + step] ?? null;
}

/**
 * Loads one image at a time and only delivers the one asked for last.
 *
 * imageStore keeps a single full-size history image and revokes the previous URL as
 * soon as the next download lands, so two downloads in flight could revoke the image
 * on screen. Requests made while a download runs therefore only replace the wish; the
 * loop fetches whatever is wanted once the running one is done, and a result nobody
 * waits for any more is dropped. Fast browsing skips the images in between.
 *
 * @param {(key: any) => Promise<any>} load
 * @param {(key: any, result: any) => void} onLoaded  result is null when the load failed
 */
export function createLatestLoader(load, onLoaded) {
  let wanted = null;
  let running = false;

  async function request(key) {
    wanted = key;
    if (running) return;
    running = true;
    try {
      while (wanted !== null) {
        const current = wanted;
        let result = null;
        try {
          result = await load(current);
        } catch {
          result = null;
        }
        if (wanted === current) {
          wanted = null;
          onLoaded(current, result);
        }
      }
    } finally {
      running = false;
    }
  }

  function cancel() {
    wanted = null;
  }

  return { request, cancel };
}
