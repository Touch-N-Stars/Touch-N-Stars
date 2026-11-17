import { onUnmounted, ref, watch } from 'vue';

/** The current time, ticking every second only while `plan` holds a plan (for its countdown). */
export function usePlanClock(plan) {
  const now = ref(Date.now());
  let timer = null;

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  watch(
    plan,
    (value) => {
      if (!value) {
        stop();
        return;
      }
      now.value = Date.now();
      if (!timer) timer = setInterval(() => (now.value = Date.now()), 1000);
    },
    { immediate: true }
  );
  onUnmounted(stop);
  return now;
}
