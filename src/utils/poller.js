/**
 * Creates a guarded setInterval-based poller: skips a tick if the previous
 * fetch is still in flight, so slow responses can never overlap on the same poller.
 * @param {() => Promise<void>|void} fetchFn - function to invoke on every tick
 * @param {number} intervalMs - polling interval in milliseconds
 * @param {{ immediate?: boolean }} [options] - immediate: run fetchFn once before starting the interval
 * @returns {{ start: (startOptions?: { immediate?: boolean }) => void, stop: () => void, isRunning: () => boolean }}
 *   start() can override `immediate` for a single start
 */
export function createPoller(fetchFn, intervalMs, options = {}) {
  let intervalId = null;
  let isFetching = false;

  const tick = async () => {
    if (isFetching) return;
    isFetching = true;
    try {
      await fetchFn();
    } finally {
      isFetching = false;
    }
  };

  return {
    start({ immediate = options.immediate } = {}) {
      if (intervalId) return;
      if (immediate) tick();
      intervalId = setInterval(tick, intervalMs);
    },
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    isRunning() {
      return intervalId !== null;
    },
  };
}
