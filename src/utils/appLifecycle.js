/**
 * App-wide background/foreground flag, set by App.vue's pauseApp()/resumeApp().
 *
 * Components/stores that own their own setInterval-based polling (rather than
 * being started/stopped explicitly by App.vue) can use useBackgroundAwarePolling()
 * below to automatically pause while the app is backgrounded, instead of every
 * new poller needing to be wired into App.vue's pause/resume lists by hand.
 */
import { ref, watch, onUnmounted } from 'vue';
import { createPoller } from '@/utils/poller';

export const isAppBackgrounded = ref(false);

export function setAppBackgrounded(value) {
  isAppBackgrounded.value = value;
}

/**
 * Creates a poller that starts/stops with `activeRef` (e.g. a `show` prop or
 * `v-if` condition) and additionally pauses/resumes with app background state,
 * without the caller having to hook into App.vue directly.
 *
 * `immediate` applies when activeRef turns true, not on the foreground switch: App.vue
 * aborts stale requests shortly after it, and an aborted request resolves as an empty
 * response that callers would write into their state. Set `immediateOnResume` only if
 * waiting a full interval after resume is worse and fetchFn tolerates that response.
 * @param {() => Promise<void>|void} fetchFn
 * @param {number} intervalMs
 * @param {import('vue').Ref<boolean>} activeRef - poll only while this is true
 * @param {{ immediate?: boolean, immediateOnResume?: boolean }} [options]
 */
export function useBackgroundAwarePolling(fetchFn, intervalMs, activeRef, options = {}) {
  const { immediateOnResume = false, ...pollerOptions } = options;
  const poller = createPoller(fetchFn, intervalMs, pollerOptions);
  let disposed = false;

  const canRun = () => !disposed && activeRef.value && !isAppBackgrounded.value;

  const sync = (startOptions) => {
    if (canRun()) {
      poller.start(startOptions);
    } else {
      poller.stop();
    }
  };

  const stopWatchActive = watch(activeRef, () => sync(), { immediate: true });
  const stopWatchBackground = watch(isAppBackgrounded, () =>
    sync(immediateOnResume ? undefined : { immediate: false })
  );

  onUnmounted(() => {
    disposed = true;
    poller.stop();
    stopWatchActive();
    stopWatchBackground();
  });

  // Return a guarded wrapper rather than the raw poller: a caller that calls
  // start() directly (e.g. to reset cadence after a manual refresh) must not be
  // able to bypass the active/background/unmounted guards and revive a poller
  // that should stay stopped. stop() stays a plain passthrough.
  return {
    start() {
      if (canRun()) {
        poller.start();
      }
    },
    stop() {
      poller.stop();
    },
    isRunning() {
      return poller.isRunning();
    },
  };
}
