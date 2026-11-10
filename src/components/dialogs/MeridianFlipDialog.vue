<template>
  <div class="space-y-2">
    <div
      v-for="(step, index) in meridianFlipSteps"
      :key="step.Id"
      :class="[
        'flex items-center gap-3 px-4 py-3 rounded-lg transition-all border bg-surface-2',
        step.Finished
          ? 'border-line text-content'
          : isStepCurrent(index)
            ? 'border-2 border-accent text-content'
            : 'border-line text-content-muted',
      ]"
    >
      <!-- Step indicator -->
      <div
        :class="[
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors',
          step.Finished
            ? 'bg-status-ok/20 text-status-ok'
            : isStepCurrent(index)
              ? 'bg-accent-action text-white'
              : 'bg-surface-3 text-content-muted',
        ]"
      >
        <span v-if="step.Finished">✓</span>
        <span v-else>{{ index + 1 }}</span>
      </div>

      <!-- Step text -->
      <span class="flex-1 font-medium">{{ step.Title }}</span>

      <!-- Step status icon and time -->
      <div v-if="isStepCurrent(index) && countdownSeconds > 0" class="flex items-center gap-2">
        <span class="text-accent text-sm font-semibold">{{ remainingTime }}</span>
        <span class="text-lg animate-pulse text-accent">⏳</span>
      </div>
      <span
        v-else-if="isStepCurrent(index) && countdownSeconds <= 0"
        class="text-lg animate-pulse text-accent"
        >⏳</span
      >
      <span v-else-if="step.Finished" class="text-lg text-status-ok">✓</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';

const props = defineProps({
  dialog: {
    type: Object,
    required: true,
  },
  meridianFlipData: {
    type: Object,
    default: null,
  },
});

// Local countdown state
const countdownSeconds = ref(0);
let countdownInterval = null;

// Initialize countdown from API time
const initializeCountdown = () => {
  const timeStr = props.dialog?.Content?.RemainingTime || '00:00:00';
  const [hours, minutes, secondsStr] = timeStr.split(':');
  const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(secondsStr);
  countdownSeconds.value = totalSeconds;
};

// Start the countdown interval
const startCountdown = () => {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    if (countdownSeconds.value > 0) {
      countdownSeconds.value--;
    }
  }, 1000);
};

// Format seconds to HH:MM:SS
const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// Get remaining time formatted
const remainingTime = computed(() => {
  return formatTime(countdownSeconds.value);
});

// Watch for API time changes and reinitialize
watch(
  () => props.dialog?.Content?.RemainingTime,
  () => {
    initializeCountdown();
  },
  { immediate: true }
);

// Lifecycle hooks
onMounted(() => {
  initializeCountdown();
  startCountdown();
});

onBeforeUnmount(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});

// Get the meridian flip steps - either from prop or from store/dialog
const meridianFlipSteps = computed(() => {
  // Try to get from prop first
  if (props.meridianFlipData?.Steps && Array.isArray(props.meridianFlipData.Steps)) {
    return props.meridianFlipData.Steps;
  }

  // Fallback: return empty array if no data available
  return [];
});

// Track the current step index
const currentStepIndex = computed(() => {
  if (!props.meridianFlipData?.Steps) return -1;
  return props.meridianFlipData.Steps.findIndex((step) => !step.Finished) || 0;
});

// Check if step is current
const isStepCurrent = (index) => {
  return index === currentStepIndex.value;
};
</script>
