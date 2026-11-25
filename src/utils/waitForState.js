import { watch } from 'vue';

/**
 * Resolves true as soon as the reactive predicate holds, false after the timeout. For
 * device actions the backend acknowledges at once but finishes in the background (unpark,
 * park): the 2 s device poll updates the store, and this waits for it.
 *
 * @param {() => boolean} predicate reactive getter, e.g. () => store.mountInfo.AtPark
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export function waitForState(predicate, timeoutMs) {
  if (predicate()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let stop = null;
    const timer = setTimeout(() => {
      stop?.();
      resolve(false);
    }, timeoutMs);
    stop = watch(predicate, (ok) => {
      if (!ok) return;
      clearTimeout(timer);
      stop();
      resolve(true);
    });
  });
}
