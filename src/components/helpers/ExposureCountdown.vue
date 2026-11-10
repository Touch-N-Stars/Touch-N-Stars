<template>
  <!-- Fortschrittsbalken -->
  <div class="w-full rounded-lg overflow-hidden">
    <div
      v-if="cameraStore.exposureProgress > 0"
      class="bg-gradient-to-r from-accent-action to-accent"
      :style="{
        width: cameraStore.exposureProgress + '%',
        height: '1px',
        transition: cameraStore.exposureProgress > 0 ? 'width 0.5s linear' : 'none', // Animiert nur, wenn > 0
      }"
    ></div>
  </div>
</template>

<script setup>
import { watch, onMounted, onUnmounted, nextTick, ref } from 'vue';
import { apiStore } from '@/store/store';
import { useCameraStore } from '@/store/cameraStore';

const store = apiStore();
const cameraStore = useCameraStore();

// Watchdog: Periodically check if countdown is stuck
let watchdogInterval = null;
const lastCountdownValue = ref(null);

watch(
  () => store.cameraInfo.ExposureEndTime,
  async (newVal) => {
    if (newVal && store.cameraInfo.IsExposing) {
      cameraStore.updateCountdown();
    } else {
      // Warte einen Tick, damit die Animation nicht beeinflusst wird
      await nextTick();
      cameraStore.exposureProgress = 0;
    }
  }
);

// Additional watcher: Monitor if exposure is running but countdown is not
watch(
  () => store.cameraInfo.IsExposing,
  async (isExposing) => {
    if (isExposing && store.cameraInfo.ExposureEndTime) {
      // Check if countdown should be running but isn't
      if (!cameraStore.countdownRunning) {
        console.warn('[ExposureCountdown] Exposure running but countdown stopped, restarting...');
        cameraStore.updateCountdown();
      }
    }
  }
);

onMounted(() => {
  if (store.cameraInfo.ExposureEndTime) {
    cameraStore.updateCountdown();
  }

  // Start watchdog timer - checks every 5 seconds if countdown is stuck
  watchdogInterval = setInterval(() => {
    if (store.cameraInfo.IsExposing && store.cameraInfo.ExposureEndTime) {
      const currentCountdown = cameraStore.exposureCountdown;

      // Check if countdown value hasn't changed in 3 seconds
      if (
        lastCountdownValue.value !== null &&
        lastCountdownValue.value === currentCountdown &&
        currentCountdown > 0
      ) {
        console.error(
          `[ExposureCountdown Watchdog] Countdown stuck at ${currentCountdown}s for 4+ seconds, forcing restart...`
        );
        cameraStore.updateCountdown();
      }

      lastCountdownValue.value = currentCountdown;
    } else {
      // Reset when not exposing
      lastCountdownValue.value = null;
    }
  }, 4000); // Check every 4 seconds
});

onUnmounted(() => {
  // Clean up watchdog interval
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
});
</script>
