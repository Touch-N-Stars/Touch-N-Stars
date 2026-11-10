<template>
  <div v-if="!store.rotatorInfo.Connected" class="text-status-danger">
    <p>{{ $t('components.rotator.please_connect_rotator') }}</p>
  </div>
  <div
    v-else
    :class="
      compact
        ? 'flex flex-wrap items-center gap-x-5 gap-y-2'
        : 'grid grid-cols-2 landscape:grid-cols-3 gap-2'
    "
  >
    <StatusBool
      :compact="compact"
      :isEnabled="store.rotatorInfo.Connected"
      :enabledText="$t('components.rotator.connected')"
      :disabledText="$t('components.rotator.disconnected')"
    />
    <StatusBool
      :compact="compact"
      :isEnabled="store.rotatorInfo.IsMoving"
      :enabledText="$t('components.rotator.moving')"
      :disabledText="$t('components.rotator.stationary')"
    />
    <StatusString
      :compact="compact"
      :isEnabled="
        store.rotatorInfo.MechanicalPosition !== undefined &&
        store.rotatorInfo.MechanicalPosition !== null
      "
      :Name="$t('components.rotator.currentPosition')"
      :Value="
        store.rotatorInfo.MechanicalPosition !== undefined &&
        store.rotatorInfo.MechanicalPosition !== null
          ? store.rotatorInfo.MechanicalPosition.toFixed(1) + '°'
          : ''
      "
    />
    <StatusString
      :compact="compact"
      :isEnabled="framingStore.hasSolvedRotation"
      :Name="$t('components.rotator.solvedPositionAngle')"
      :Value="
        framingStore.hasSolvedRotation ? framingStore.solvedRotationAngle.toFixed(1) + '°' : ''
      "
    />
    <StatusString
      :compact="compact"
      :isEnabled="store.rotatorInfo.StepSize !== undefined && store.rotatorInfo.StepSize !== null"
      :Name="$t('components.rotator.stepSize')"
      :Value="
        store.rotatorInfo.StepSize !== undefined && store.rotatorInfo.StepSize !== null
          ? store.rotatorInfo.StepSize.toFixed(4) + '°'
          : ''
      "
    />
  </div>
</template>

<script setup>
import StatusBool from '@/components/helpers/StatusBool.vue';
import StatusString from '@/components/helpers/StatusString.vue';
import { apiStore } from '@/store/store';
import { useFramingStore } from '@/store/framingStore';
const store = apiStore();
// Sky position angle of the last plate solve — deliberately separate from the
// rotator's mechanical position, which is a different reference frame.
const framingStore = useFramingStore();

// Dense page layout: inline state chips + two value columns.
const { compact } = defineProps({
  compact: {
    type: Boolean,
    default: false,
  },
});
</script>
