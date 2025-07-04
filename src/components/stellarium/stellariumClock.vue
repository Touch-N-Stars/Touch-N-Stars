<template>
  <button
    class="fixed left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 p-2 px-4 sm:px-8 rounded-full text-gray-200 font-mono text-sm sm:text-base"
    style="bottom: calc(env(safe-area-inset-bottom, 0px) + 48px)"
    @click="toggleDateTimeControls"
  >
    <p class="text-center">{{ formattedTime }}</p>
    <p class="text-xs text-center">{{ formattedDate }}</p>
  </button>
  <!-- Date/Time Control Panel -->
  <div
    v-if="isDateTimeVisible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    @click.self="isDateTimeVisible = false"
  >
    <div
      class="bg-black bg-opacity-90 p-4 sm:p-6 rounded-lg shadow-lg text-white w-full max-w-sm sm:max-w-md mx-4"
    >
      <h3 class="text-lg font-semibold mb-3">{{ $t('components.stellarium.datetime.title') }}</h3>

      <div class="mb-3">
        <label class="block text-sm mb-1">{{ $t('components.stellarium.datetime.date') }}</label>
        <input
          @blur="applyDateTime"
          @change="applyDateTime"
          type="date"
          v-model="dateValue"
          class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div class="mb-4">
        <label class="block text-sm mb-1">{{ $t('components.stellarium.datetime.time') }}</label>
        <input
          @blur="applyDateTime"
          @change="applyDateTime"
          type="time"
          v-model="timeValue"
          class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div class="flex gap-3 mb-4">
        <button
          @click="resetToCurrentTime"
          class="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg shadow-md text-sm sm:text-base touch-manipulation"
        >
          {{ $t('components.stellarium.datetime.now') }}
        </button>
      </div>

      <div class="mt-4">
        <label class="block text-sm mb-1">{{ $t('components.stellarium.datetime.speed') }}</label>
        <div class="flex items-center gap-3">
          <input
            type="range"
            v-model="timeSpeed"
            min="-10"
            max="10"
            step="1"
            class="flex-1 h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span class="text-sm font-mono w-16 text-right">{{ displayTimeSpeed }}</span>
        </div>
        <div class="mt-2 text-xs text-gray-300 text-center">
          {{ timeSpeedDescription }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue';
import { useStellariumStore } from '@/store/stellariumStore';
import { mjdToUTC, utcToMJD } from '@/utils/utils.js';

const stellariumStore = useStellariumStore();
const formattedTime = ref('');
const formattedDate = ref('');
const isDateTimeVisible = ref(false);
const dateValue = ref(formatDateForInput(new Date()));
const timeValue = ref(formatTimeForInput(new Date()));
const timeSpeed = ref(1);
let animationFrameId = null;

function updateTime() {
  if (!stellariumStore.stel) return;

  const mjd = stellariumStore.stel.core.observer.utc;
  const date = mjdToDate(mjd);
  formatDateTime(date);

  // Request next animation frame
  animationFrameId = requestAnimationFrame(updateTime);
}

function mjdToDate(mjd) {
  const mjdBaseDate = new Date(Date.UTC(1858, 10, 17, 0, 0, 0));
  const daysToMilliseconds = 86400000;
  return new Date(mjdBaseDate.getTime() + mjd * daysToMilliseconds);
}

function formatDateTime(date) {
  // Time format
  const timeOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  formattedTime.value = date.toLocaleString(undefined, timeOptions);

  // Date format
  const dateOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  formattedDate.value = date.toLocaleString(undefined, dateOptions);
}

// Format current date as YYYY-MM-DD for input
function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format current time as HH:MM for input
function formatTimeForInput(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Toggle date/time control panel
function toggleDateTimeControls() {
  isDateTimeVisible.value = !isDateTimeVisible.value;

  // Update values with current Stellarium time when opening
  if (isDateTimeVisible.value && stellariumStore.stel) {
    updateInputsFromStellariumTime();
  }
}

// Get current time from Stellarium and update inputs
function updateInputsFromStellariumTime() {
  if (!stellariumStore.stel) return;

  const mjd = stellariumStore.stel.core.observer.utc;
  const stelDate = mjdToUTC(mjd);

  dateValue.value = formatDateForInput(stelDate);
  timeValue.value = formatTimeForInput(stelDate);
}

// Apply the selected date and time to Stellarium
function applyDateTime() {
  if (!stellariumStore.stel) return;

  try {
    // Combine date and time inputs
    const [year, month, day] = dateValue.value.split('-').map(Number);
    const [hours, minutes] = timeValue.value.split(':').map(Number);

    // Create Date object (using local timezone)
    const dateObj = new Date(year, month - 1, day, hours, minutes, 0, 0);

    // Convert to MJD
    const mjd = utcToMJD(dateObj);

    // Set Stellarium time
    stellariumStore.stel.core.observer.utc = mjd;

    console.log('Time set to:', dateObj.toString());
    console.log('MJD:', mjd);
  } catch (error) {
    console.error('Error setting date/time:', error);
  }
}

// Reset to current time
function resetToCurrentTime() {
  if (!stellariumStore.stel) return;

  // Get current time
  const now = new Date();
  dateValue.value = formatDateForInput(now);
  timeValue.value = formatTimeForInput(now);

  // Apply to Stellarium
  applyDateTime();
}

// Format time speed for display
const displayTimeSpeed = computed(() => {
  const speed = Math.pow(2, Number(timeSpeed.value));
  if (speed === 1) return '1×';
  return speed > 0 ? `${speed}×` : `1/${Math.abs(1 / speed)}×`;
});

// Description for time speed
const timeSpeedDescription = computed(() => {
  const speed = Math.pow(2, Number(timeSpeed.value));
  if (speed === 0) return 'Paused';
  if (speed === 1) return 'Real-time';
  if (speed > 1) return 'Time lapse';
  return 'Time rewind';
});

// Watch for changes in time speed
watch(timeSpeed, (newValue) => {
  if (!stellariumStore.stel) return;

  const speed = Math.pow(2, Number(newValue));
  stellariumStore.stel.core.time_speed = speed;
  console.log('Time speed set to:', speed);
});

onMounted(() => {
  updateTime();
  timeSpeed.value = 0; // ini
});

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});
</script>

<style scoped>
/* Improve range slider for mobile devices */
input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

input[type='range']::-webkit-slider-track {
  background: #374151;
  height: 12px;
  border-radius: 6px;
}

input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  background: #60a5fa;
  height: 24px;
  width: 24px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input[type='range']::-moz-range-track {
  background: #374151;
  height: 12px;
  border-radius: 6px;
  border: none;
}

input[type='range']::-moz-range-thumb {
  background: #60a5fa;
  height: 24px;
  width: 24px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Improve touch targets for mobile */
@media (max-width: 640px) {
  input[type='range']::-webkit-slider-thumb {
    height: 28px;
    width: 28px;
  }

  input[type='range']::-moz-range-thumb {
    height: 28px;
    width: 28px;
  }
}

/* Ensure proper touch handling */
.touch-manipulation {
  touch-action: manipulation;
}
</style>
