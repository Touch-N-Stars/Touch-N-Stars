<template>
  <div class="space-y-1">
    <div
      v-for="(condition, index) in sequenceStore.runningConditions"
      :key="index"
      class="text-sm text-content-muted"
    >
      {{ removeSuffix(condition.Name).replace(/_/g, ' ') }}
      <span v-if="getConditionDetails(condition)" class="text-content-faint">
        - {{ getConditionDetails(condition) }}
      </span>
    </div>
    <div
      v-if="sequenceStore.runningConditions.length === 0"
      class="text-content-faint italic text-sm"
    >
      {{ $t('components.sequence.noConditions') }}
    </div>
  </div>
</template>
<script setup>
import { useSequenceStore } from '@/store/sequenceStore';
import { removeSuffix } from '@/utils/sequenceUtils.js';

const sequenceStore = useSequenceStore();

function getConditionDetails(condition) {
  const details = [];

  // Time-based conditions
  if (
    condition.Hours !== undefined &&
    condition.Minutes !== undefined &&
    condition.Seconds !== undefined
  ) {
    details.push(
      `Time: ${condition.Hours.toString().padStart(2, '0')}:${condition.Minutes.toString().padStart(2, '0')}:${condition.Seconds.toString().padStart(2, '0')}`
    );
  }

  if (condition.RemainingTime) {
    const cleanTime = condition.RemainingTime.replace(/\.\d+$/, '');
    details.push(`Remaining: ${cleanTime}`);
  }

  if (condition.TargetTime) {
    const targetDate = new Date(condition.TargetTime);
    details.push(`Until: ${targetDate.toLocaleTimeString()}`);
  }

  // Iteration-based conditions
  if (condition.Iterations !== undefined) {
    const completed = condition.CompletedIterations || 0;
    details.push(`Iterations: ${completed}/${condition.Iterations}`);
  }

  // Moon illumination conditions
  if (condition.CurrentIllumination !== undefined && condition.TargetIllumination !== undefined) {
    details.push(
      `Moon: ${condition.CurrentIllumination.toFixed(1)}% / ${condition.TargetIllumination}%`
    );
  }

  if (
    condition.CurrentMoonIllumination !== undefined &&
    condition.UserMoonIllumination !== undefined
  ) {
    details.push(
      `Moon: ${condition.CurrentMoonIllumination.toFixed(1)}% / ${condition.UserMoonIllumination}%`
    );
  }

  // Altitude conditions
  if (condition.CurrentAltitude !== undefined && condition.Altitude !== undefined) {
    details.push(`Alt: ${condition.CurrentAltitude.toFixed(1)}° / ${condition.Altitude}°`);
  }

  if (condition.ExpectedTime) {
    details.push(`Expected: ${condition.ExpectedTime}`);
  }

  // Other conditions
  if (condition.InterruptReason) {
    details.push(`Reason: ${condition.InterruptReason}`);
  }

  return details.join(' | ');
}
</script>
