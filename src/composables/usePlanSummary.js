// summarizeTargets() of the loaded plan with the clock times of the simple mode: from when it is
// dark to the limits of the targets (dawn, too low), and with the pictures the next start takes up
// again. Outside the simple mode the plain summary: there the plan starts as N.I.N.A. does it.
import { computed, toValue } from 'vue';
import { apiStore } from '@/store/store';
import { useSequenceStore } from '@/store/sequenceStore';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useSimpleMode } from '@/composables/useSimpleMode';
import { planCutOff, planWindow, siteFromProfile } from '@/utils/planLimits';
import { FRAME_OVERHEAD_SECONDS, summarizeTargets } from '@/utils/sequenceSimple';

/** @param {import('vue').MaybeRefOrGetter<number>} nowMs the clock the estimate starts from */
export function usePlanSummary(nowMs) {
  const store = apiStore();
  const sequenceStore = useSequenceStore();
  const sequenceV2Store = useSequenceV2Store();
  const { active } = useSimpleMode();

  const site = computed(() => (active.value ? siteFromProfile(store.profileInfo) : null));
  const running = computed(() => Boolean(sequenceStore.sequenceRunning));

  const planTimes = computed(() =>
    planWindow(sequenceV2Store.data, {
      nowMs: toValue(nowMs),
      site: site.value,
      running: running.value,
    })
  );
  const planSummary = computed(() =>
    summarizeTargets(sequenceV2Store.data, {
      overheadSeconds: FRAME_OVERHEAD_SECONDS,
      nowMs: toValue(nowMs),
      resumable: active.value && !running.value,
      notBeforeMs: planTimes.value.notBeforeMs,
      limitAt: planTimes.value.limitAt,
    })
  );
  // Pictures are left, but the night (or the targets' altitude) does not allow any more of them.
  const cutOff = computed(
    () => !running.value && planCutOff(planSummary.value, toValue(nowMs), site.value)
  );

  return { planSummary, planTimes, cutOff, site };
}
