// Simple mode: every target of the plan is slewed to, centered, guided and refocused after a
// filter change by the plan itself, the plan flips at the meridian, and when it is done it parks
// the mount and warms the camera up. Shared by the atlas' "Add to plan" button and the home
// page's capture step, so both put the same steps into a plan.
import { computed } from 'vue';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useSimpleMode } from '@/composables/useSimpleMode';
import { marksForNight, nightKey, simpleTargetSteps } from '@/utils/simpleMode';
import { warmUpMinutes } from '@/utils/coolingPresets';
import {
  END_AREA_TYPE,
  MERIDIAN_FLIP_TRIGGER_TYPE,
  WARM_CAMERA_TYPE,
  findAreaContainer,
  findByType,
  isActive,
  missingEndSteps,
} from '@/utils/sequenceSimple';

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

  // Users who come from the ASIAIR start the plan and go to bed. Without these closing steps
  // the mount tracks on past the meridian into the tripod or pier once the plan is done.
  // The warm-up needs a connected camera that cools; otherwise only parking is asked for.
  const endStepsMissing = computed(() =>
    missingEndSteps(sequenceV2Store.data, {
      canCool: Boolean(store.cameraInfo?.Connected && store.cameraInfo?.CanSetTemperature),
    })
  );

  // From the profile, not the connection: targets are often added before the rig is connected.
  const inProfile = (settings) => Boolean(settings?.Id) && settings.Id !== 'No_Device';
  const focusOnFilterChange = computed(
    () =>
      inProfile(store.profileInfo?.FocuserSettings) &&
      inProfile(store.profileInfo?.FilterWheelSettings)
  );

  const wantedSteps = computed(() =>
    simpleTargetSteps({
      rotator: Boolean(store.rotatorInfo?.Connected),
      guiding: !guidingSkipped.value,
      focusOnFilterChange: focusOnFilterChange.value,
    })
  );

  /** Switches the plan's meridian flip on (re-enables a disabled one, or adds it). */
  function addFlipTrigger() {
    return sequenceV2Store.setGlobalTriggerEnabled(MERIDIAN_FLIP_TRIGGER_TYPE, true);
  }

  /**
   * Switches the missing closing steps on. A warm-up the plan did not have yet gets the same
   * ramp as "End the night"; one that was only switched off keeps its own duration.
   */
  async function addEndSteps() {
    for (const type of endStepsMissing.value) {
      const endItems = () => findAreaContainer(sequenceV2Store.data, END_AREA_TYPE)?.Items;
      const existed = Boolean(findByType(endItems(), type));
      await sequenceV2Store.setEndItemEnabled(type, true);
      if (type !== WARM_CAMERA_TYPE || existed) continue;
      const warm = findByType(endItems(), WARM_CAMERA_TYPE);
      if (warm) {
        await sequenceV2Store.setProperty(
          warm.Id,
          'Duration',
          warmUpMinutes(store.profileInfo?.CameraSettings)
        );
      }
    }
  }

  /**
   * Puts the simple steps into one target; a target without pictures gets an exposure row.
   * The plan gets its meridian flip and its closing steps along with it.
   */
  async function applyToTarget(containerId, { addExposure = false } = {}) {
    const result = await sequenceV2Store.applySimpleTargetSteps(containerId, wantedSteps.value, {
      addExposure,
    });
    if (result.ok && flipTriggerMissing.value) await addFlipTrigger();
    if (result.ok && endStepsMissing.value.length) await addEndSteps();
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
    endStepsMissing,
    addEndSteps,
    applyToTarget,
    applyToTargets,
  };
}
