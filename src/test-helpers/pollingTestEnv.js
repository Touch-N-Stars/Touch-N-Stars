// Shared helpers for testing pollers under `node --test`. Test-only code - never
// imported by application modules.
import { createRenderer, defineComponent, nextTick } from 'vue';
import { setAppBackgrounded } from '@/utils/appLifecycle';

// No-op renderer: composables need real mount/unmount hooks, but no DOM.
const { createApp } = createRenderer({
  patchProp() {},
  insert() {},
  remove() {},
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  setText() {},
  setElementText() {},
  parentNode: () => null,
  nextSibling: () => null,
});

// Runs a composable inside a mounted component. unmount() is safe to call twice.
export function mountComposable(composable) {
  let result;
  const app = createApp(
    defineComponent({
      setup() {
        result = composable();
        return () => null;
      },
    })
  );
  app.mount({});

  let mounted = true;
  return {
    result,
    unmount() {
      if (mounted) app.unmount();
      mounted = false;
    },
  };
}

// One interval at a time, settling around each: a tick stays "in flight" until its await
// resolves, and createPoller skips any tick that fires while the previous one is in flight.
export async function advanceIntervals(t, intervalMs, intervals = 1) {
  for (let i = 0; i < intervals; i++) {
    await nextTick();
    t.mock.timers.tick(intervalMs);
    await nextTick();
  }
}

export async function setBackgrounded(value) {
  setAppBackgrounded(value);
  await nextTick();
}
