// Simple mode: every target of the plan is slewed to, centered and guided by the plan itself.
// Shared by the atlas' "Add to plan" button and the home page's capture step, so both put the
// same steps into a target.
import { computed } from 'vue';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useSimpleMode } from '@/composables/useSimpleMode';
import { marksForNight, nightKey, simpleTargetSteps } from '@/utils/simpleMode';

export function useSimplePlanTargets() {
  const store = apiStore();
  const settingsStore = useSettingsStore();
  const sequenceV2Store = useSequenceV2Store();
  const { active } = useSimpleMode();

  // Skipping the guiding step means "no guiding tonight": new targets then do not start it.
  const guidingSkipped = computed(
    () => marksForNight(settingsStore.simpleMode?.steps, nightKey()).guide === 'skipped'
  );

  const wantedSteps = computed(() =>
    simpleTargetSteps({
      rotator: Boolean(store.rotatorInfo?.Connected),
      guiding: !guidingSkipped.value,
    })
  );

  /** Puts the simple steps into one target; a target without pictures gets an exposure row. */
  function applyToTarget(containerId, { addExposure = false } = {}) {
    return sequenceV2Store.applySimpleTargetSteps(containerId, wantedSteps.value, { addExposure });
  }

  /** Same for several targets, one after the other (each call reloads the tree). */
  async function applyToTargets(containers) {
    let result = { ok: true };
    for (const container of containers) {
      result = await applyToTarget(container.Id);
      if (!result.ok) break;
    }
    return result;
  }

  return { active, guidingSkipped, wantedSteps, applyToTarget, applyToTargets };
}
