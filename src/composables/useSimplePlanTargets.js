// Simple mode: every target of the plan is slewed to, centered and guided by the plan itself,
// and the plan flips at the meridian. Shared by the atlas' "Add to plan" button and the home page's capture step, so both put the
// same steps into a target.
import { computed } from 'vue';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useSimpleMode } from '@/composables/useSimpleMode';
import { marksForNight, nightKey, simpleTargetSteps } from '@/utils/simpleMode';
import { MERIDIAN_FLIP_TRIGGER_TYPE, findByType, isActive } from '@/utils/sequenceSimple';

export function useSimplePlanTargets() {
  const store = apiStore();
  const settingsStore = useSettingsStore();
  const sequenceV2Store = useSequenceV2Store();
  const { active } = useSimpleMode();

  // Skipping the guiding step means "no guiding tonight": new targets then do not start it.
  const guidingSkipped = computed(
    () => marksForNight(settingsStore.simpleMode?.steps, nightKey()).guide === 'skipped'
  );
  // NINA's flip trigger is global: without it the plan tracks on past the meridian until the
  // telescope hits the tripod or pier, whatever the flip settings say.
  const flipTriggerMissing = computed(
    () => !isActive(findByType(sequenceV2Store.globalTriggers, MERIDIAN_FLIP_TRIGGER_TYPE))
  );

  const wantedSteps = computed(() =>
    simpleTargetSteps({
      rotator: Boolean(store.rotatorInfo?.Connected),
      guiding: !guidingSkipped.value,
    })
  );

  /** Switches the plan's meridian flip on (re-enables a disabled one, or adds it). */
  function addFlipTrigger() {
    return sequenceV2Store.setGlobalTriggerEnabled(MERIDIAN_FLIP_TRIGGER_TYPE, true);
  }

  /**
   * Puts the simple steps into one target; a target without pictures gets an exposure row.
   * The plan gets its meridian flip along with it.
   */
  async function applyToTarget(containerId, { addExposure = false } = {}) {
    const result = await sequenceV2Store.applySimpleTargetSteps(containerId, wantedSteps.value, {
      addExposure,
    });
    if (result.ok && flipTriggerMissing.value) await addFlipTrigger();
    return result;
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

  return {
    active,
    guidingSkipped,
    wantedSteps,
    flipTriggerMissing,
    addFlipTrigger,
    applyToTarget,
    applyToTargets,
  };
}
