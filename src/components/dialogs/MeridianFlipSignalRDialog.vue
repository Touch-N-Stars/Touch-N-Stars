<template>
  <div class="space-y-2">
    <div
      v-for="(step, index) in meridianFlipSteps"
      :key="step.id"
      :class="[
        'flex items-center gap-3 px-4 py-3 rounded-lg transition-all border bg-surface-2',
        step.finished
          ? 'border-line text-content'
          : step.isCurrent
            ? 'border-2 border-accent text-content'
            : 'border-line text-content-muted',
      ]"
    >
      <!-- Step indicator -->
      <div
        :class="[
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors',
          step.finished
            ? 'bg-status-ok/20 text-status-ok'
            : step.isCurrent
              ? 'bg-accent-action text-white'
              : 'bg-surface-3 text-content-muted',
        ]"
      >
        <span v-if="step.finished">✓</span>
        <span v-else>{{ index + 1 }}</span>
      </div>

      <!-- Step text -->
      <span class="flex-1 font-medium">{{ step.title }}</span>

      <!-- Step status icon and time -->
      <div v-if="step.isCurrent && countdownSeconds > 0" class="flex items-center gap-2">
        <span class="text-accent text-sm font-semibold">{{ remainingTime }}</span>
        <span class="text-lg animate-pulse text-accent">⏳</span>
      </div>
      <span
        v-else-if="step.isCurrent && countdownSeconds <= 0"
        class="text-lg animate-pulse text-accent"
        >⏳</span
      >
      <span v-else-if="step.finished" class="text-lg text-status-ok">✓</span>
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
});

// Local countdown state
const countdownSeconds = ref(0);
let countdownInterval = null;

// Initialize countdown from SignalR data
const initializeCountdown = () => {
  // SignalR sends RemainingTime in parameters
  const params = props.dialog?.Parameters || props.dialog?.Content || {};
  const timeStr = params.RemainingTime || '00:00:00';
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
  () => {
    const params = props.dialog?.Parameters || props.dialog?.Content || {};
    return params.RemainingTime;
  },
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

// Get the meridian flip steps from SignalR data
const meridianFlipSteps = computed(() => {
  // SignalR data structure: dialog has meridianFlip property at root level
  const meridianFlip = props.dialog?.meridianFlip;

  if (meridianFlip && meridianFlip.steps && Array.isArray(meridianFlip.steps)) {
    return meridianFlip.steps;
  }

  // Fallback: try Content or Parameters
  const content = props.dialog?.Content || props.dialog?.Parameters || {};
  if (content.meridianFlip && content.meridianFlip.steps) {
    return content.meridianFlip.steps;
  }

  // Return empty array if no data available
  return [];
});
</script>
