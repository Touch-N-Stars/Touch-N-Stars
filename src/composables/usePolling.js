import { onMounted, onBeforeUnmount, watch } from 'vue';
import { createPoller } from '@/utils/poller';
import { isAppBackgrounded } from '@/utils/appLifecycle';

/**
 * Component-lifecycle wrapper around createPoller: starts polling on mount and
 * always stops on unmount, so callers cannot leak intervals. Ticks are guarded
 * against overlap by createPoller (a slow fetch never stacks with the next tick).
 *
 * Polling also pauses while the app is backgrounded. It picks up again on the regular
 * interval, never with an immediate tick: App.vue aborts stale requests shortly after
 * the foreground switch, and an aborted request resolves as an empty response that
 * callers would write into their state.
 *
 * @param {() => Promise<void>|void} fetchFn - function to invoke on every tick
 * @param {number} intervalMs - polling interval in milliseconds
 * @param {{ immediate?: boolean, autoStart?: boolean }} [options]
 *   immediate: run fetchFn once right away when starting (default true)
 *   autoStart: start polling on mount (default true); pass false to control
 *              start/stop manually via the returned poller
 * @returns {{ start: () => void, stop: () => void, isRunning: () => boolean }}
 */
export function usePolling(fetchFn, intervalMs, options = {}) {
  const { immediate = true, autoStart = true } = options;
  const poller = createPoller(fetchFn, intervalMs, { immediate });
  // Whether the caller wants polling, independent of the background pause: a poller
  // the caller never started or stopped itself must stay stopped on foreground.
  let wanted = false;

  const sync = (startOptions) => {
    if (wanted && !isAppBackgrounded.value) {
      poller.start(startOptions);
    } else {
      poller.stop();
    }
  };

  const start = () => {
    wanted = true;
    sync();
  };
  const stop = () => {
    wanted = false;
    poller.stop();
  };

  watch(isAppBackgrounded, () => sync({ immediate: false }));

  onMounted(() => {
    if (autoStart) start();
  });
  onBeforeUnmount(stop);

  return { start, stop, isRunning: poller.isRunning };
}
