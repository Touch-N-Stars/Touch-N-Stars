<template>
  <!-- Capture & Cancel Buttons -->
  <div
    class="fixed flex items-center justify-center z-50 bg-ground/70 backdrop-blur-md p-3 rounded-card border border-line shadow-lg shadow-black transition-all duration-300"
    :class="[containerClasses, gapClasses]"
    :style="containerStyle"
  >
    <!-- Close dropdown when clicking outside -->
    <div v-if="showDropdown" class="dropdown-backdrop" @click="showDropdown = false"></div>
    <!-- Capture / Cancel Combined Button -->
    <button
      class="relative shrink-0 rounded-full flex items-center justify-center shadow-md shadow-black border border-line-strong active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all duration-150 ease-out"
      :class="[
        store.cameraInfo.IsExposing ? 'bg-status-danger' : 'bg-surface-3',
        buttonSizeClasses,
      ]"
      @click="handleCaptureClick"
      :disabled="
        (cameraStore.loading && !store.cameraInfo.IsExposing) || sequenceStore.sequenceRunning
      "
    >
      <!-- Phase 1: Belichtungsfortschritt mit Server-Countdown -->
      <template v-if="store.cameraInfo.IsExposing">
        <svg :class="['absolute inset-0', progressSizeClasses]" viewBox="0 0 36 36">
          <path
            class="text-white/30 fill-none stroke-current stroke-[2.8]"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            class="fill-none stroke-white stroke-[2.8]"
            :style="{
              strokeDasharray: cameraStore.exposureProgress + ', 100',
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
            }"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span :class="['text-white font-semibold z-10', progressTextClasses]">
          {{ cameraStore.exposureCountdown }}s
        </span>
      </template>

      <!-- Phase 2: Bild-Laden oder Idle -->
      <template v-else>
        <!-- Loading Image - Spinner -->
        <template v-if="cameraStore.isLoadingImage">
          <div :class="['loader', loaderSizeClasses]"></div>
        </template>
        <!-- Idle State - Kamera Icon -->
        <template v-else>
          <svg
            :class="iconSizeClasses"
            viewBox="0 0 72 72"
            id="emoji"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g id="color" />
            <g id="line">
              <circle
                cx="36"
                cy="36"
                r="25"
                fill="none"
                stroke="#D1D5DB"
                stroke-linejoin="round"
                stroke-miterlimit="10"
                stroke-width="2"
              />
              <circle cx="36" cy="36" r="10" fill="#D1D5DB" stroke="none" />
            </g>
            <g id="color-foreground">
              <circle cx="36" cy="36" r="10" fill="#DC2626" stroke="none" />
            </g>
          </svg>
        </template>
      </template>
    </button>

    <button
      @click="toggleLooping"
      :class="[
        'shrink-0 rounded-full bg-surface-3 flex items-center justify-center shadow-md shadow-black border transition-colors duration-200',
        cameraStore.isLooping
          ? 'text-status-ok border-status-ok'
          : 'text-content-muted border-line-strong',
        buttonSizeClasses,
      ]"
    >
      <ArrowPathIcon :class="smallIconSizeClasses" />
    </button>

    <!-- Exposure Time Input with Dropdown -->
    <div class="flex flex-col items-center gap-1 shrink-0">
      <!-- Label -->
      <label for="exposure" :class="labelClasses">
        {{ $t('components.camera.exposure_time') }}
      </label>

      <!-- Combined Input and Dropdown -->
      <div class="relative">
        <!-- Zeit-Eingabe -->
        <input
          id="exposure"
          v-model.number="settingsStore.camera.exposureTime"
          type="number"
          min="0"
          step="0.1"
          :class="inputClasses"
          placeholder="Sek."
          @focus="showDropdown = false"
        />

        <!-- Dropdown Button -->
        <button
          @click="showDropdown = !showDropdown"
          :class="[
            'absolute right-0 top-0 h-full bg-surface-3 border-l border-line-strong rounded-r-control hover:bg-surface-2 transition-colors',
            dropdownButtonClasses,
          ]"
          type="button"
        >
          <svg
            class="w-3 h-3 text-content-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="showDropdown"
          :class="[
            'absolute z-50 bg-surface-2 border border-line-strong rounded-control shadow-lg max-h-48 overflow-y-auto scrollbar-hide',
            dropdownClasses,
          ]"
        >
          <div class="py-1">
            <!-- Quick Times -->
            <button
              v-for="time in quickTimes"
              :key="'quick-' + time"
              @click="selectTime(time)"
              class="w-full text-left px-3 min-h-touch text-sm text-content hover:bg-surface-3 transition-colors"
            >
              {{ formatTime(time) }}
            </button>

            <!-- Common Times -->
            <button
              v-for="time in commonTimes"
              :key="'common-' + time"
              @click="selectTime(time)"
              class="w-full text-left px-3 min-h-touch text-sm text-content hover:bg-surface-3 transition-colors"
            >
              {{ formatTime(time) }}
            </button>

            <!-- Long Exposure -->
            <button
              v-for="time in longTimes"
              :key="'long-' + time"
              @click="selectTime(time)"
              class="w-full text-left px-3 min-h-touch text-sm text-content hover:bg-surface-3 transition-colors"
            >
              {{ formatTime(time) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="shrink-0">
      <button
        @click="openCameraSettings"
        :class="[
          'rounded-full bg-surface-3 flex items-center justify-center shadow-md shadow-black border border-line-strong transition-colors duration-200',
          buttonSizeClasses,
        ]"
      >
        <Cog6ToothIcon :class="smallIconSizeClasses" class="text-content-muted" />
      </button>

      <Modal :show="openSettings" @close="openSettings = false">
        <template #header>
          <h2 class="text-2xl font-semibold">{{ $t('components.camera.settings') }}</h2>
        </template>

        <template #body>
          <!-- Beliebiger Inhalt hier -->
          <SettingsModal />
        </template>
      </Modal>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import apiService from '@/services/apiService';
import { useCameraStore } from '@/store/cameraStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSequenceStore } from '@/store/sequenceStore';
import { apiStore } from '@/store/store';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import SettingsModal from '@/components/camera/SettingsModal.vue';
import { Cog6ToothIcon } from '@heroicons/vue/24/outline';
import { useOrientation } from '@/composables/useOrientation';
import { useHaptics } from '@/composables/useHaptics';

const { tapLight, tapMedium } = useHaptics();
const cameraStore = useCameraStore();
const settingsStore = useSettingsStore();
const sequenceStore = useSequenceStore();
const store = apiStore();
const openSettings = ref(false);
const showDropdown = ref(false);

let saveDebounce;
watch(
  () => settingsStore.camera.exposureTime,
  () => {
    clearTimeout(saveDebounce);
    saveDebounce = setTimeout(() => settingsStore.saveCameraSettings(), 600);
  }
);

// Astrophotography exposure time presets
const quickTimes = [0.1, 0.2, 0.5, 1, 2, 3, 5];
const commonTimes = [10, 15, 20, 30, 45, 60, 90, 120];
const longTimes = [180, 240, 300, 480, 600, 900];

// Functions
const handleCaptureClick = () => {
  if (store.cameraInfo.IsExposing) {
    // Aborting is the destructive branch of this button.
    tapMedium();
    cameraStore.abortExposure(apiService);
    return;
  }
  tapLight();
  cameraStore.capturePhoto(
    apiService,
    settingsStore.camera.exposureTime,
    store.profileInfo.SnapShotControlSettings.Gain,
    settingsStore.camera.useSolve
  );
};

const toggleLooping = () => {
  tapLight();
  cameraStore.isLooping = !cameraStore.isLooping;
};

const openCameraSettings = () => {
  tapLight();
  openSettings.value = true;
};

const selectTime = (time) => {
  tapLight();
  settingsStore.camera.exposureTime = time;
  showDropdown.value = false;
};

const formatTime = (seconds) => {
  if (seconds < 1) {
    return `${seconds}s`;
  } else if (seconds < 60) {
    return `${seconds}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    } else {
      return `${minutes}m ${remainingSeconds}s`;
    }
  }
};

// Check if in landscape mode
const { isLandscape } = useOrientation();

// Container positioning classes
const containerClasses = computed(() => ({
  // Portrait mode - bottom center
  'right-1/2 translate-x-1/2 flex-row': !isLandscape.value,
  // Landscape mode - left side vertical (changed from right to left)
  'right-2 top-1/2 -translate-y-1/2 flex-col': isLandscape.value,
}));

// Gap classes for different orientations
const gapClasses = computed(() => {
  if (isLandscape.value) {
    return 'gap-3'; // All landscape devices
  }
  return 'gap-4'; // Portrait mode
});

// Container dynamic styles.
// Anchored to --above-statusbar (bar height + safe area); --status-panel-height
// adds the height of whichever status bar panel (progress, camera/mount/filter
// info, guider graph) is currently open, so the action bar never gets covered.
const containerStyle = computed(() => {
  return !isLandscape.value
    ? { bottom: 'calc(var(--above-statusbar) + var(--status-panel-height))' }
    : {};
});

// Responsive button sizes — never below the 48px touch target
const buttonSizeClasses = computed(() => {
  if (isLandscape.value) {
    return 'w-12 h-12 lg:w-16 lg:h-16';
  }
  return 'w-12 h-12 lg:w-16 lg:h-16'; // Portrait mode
});

// Icon sizes
const iconSizeClasses = computed(() => {
  if (isLandscape.value) {
    return 'w-12 h-12'; // All landscape
  }
  return 'w-16 h-16'; // Portrait
});

// Progress circle size classes - proportional to button size
const progressSizeClasses = computed(() => {
  if (isLandscape.value) {
    return 'w-12 h-12 lg:w-16 lg:h-16'; // Same as button size
  }
  return 'w-12 h-12 lg:w-16 lg:h-16'; // Portrait mode
});

// Progress text size classes
const progressTextClasses = computed(() => {
  if (isLandscape.value) {
    return 'text-xs md:text-sm lg:text-base'; // Responsive text size
  }
  return 'text-sm lg:text-base'; // Portrait mode
});

// Loader size classes - proportional to button size
const loaderSizeClasses = computed(() => {
  if (isLandscape.value) {
    return 'w-6 h-6 md:w-8 md:h-8 lg:w-10 lg:h-10'; // Responsive to button size
  }
  return 'w-8 h-8 lg:w-10 lg:h-10'; // Portrait mode
});

const smallIconSizeClasses = computed(() => {
  if (isLandscape.value) {
    return 'w-6 h-6'; // All landscape
  }
  return 'w-8 h-8'; // Portrait
});

// Input field classes
const inputClasses = computed(() => {
  const baseClasses = 'tns-input text-center';

  if (isLandscape.value) {
    return `${baseClasses} pr-5 w-20 text-sm`; // All landscape devices
  }

  return `${baseClasses} pr-8 w-24`; // Portrait mode
});

// Dropdown button classes
const dropdownButtonClasses = computed(() => {
  if (isLandscape.value) {
    return 'w-4 px-0.5'; // All landscape devices
  }
  return 'w-8 px-2'; // Portrait mode
});

// Dropdown positioning classes
const dropdownClasses = computed(() => {
  if (isLandscape.value) {
    return 'bottom-full mb-2 right-0 w-40'; // Above input in landscape, aligned left (changed from right-0 to left-0)
  }
  return 'bottom-full mb-2 right-0 w-44'; // Above input in portrait (changed from top-full)
});

// Label classes
const labelClasses = computed(() => {
  if (isLandscape.value) {
    return 'text-xs text-content-muted text-center'; // All landscape
  }
  return 'text-sm text-content-muted'; // Portrait
});
</script>

<style scoped>
.loader {
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Additional responsive adjustments */
@media (max-height: 600px) and (orientation: landscape) {
  /* Very small landscape screens - reduce gap */
  .gap-4 {
    gap: 0.5rem !important;
  }
  .gap-3 {
    gap: 0.375rem !important;
  }
}

@media (max-width: 480px) and (orientation: landscape) {
  /* Very small landscape screens */
  .left-2 {
    left: 0.5rem !important;
  }
}

/* Smooth transitions for orientation changes */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}

/* Scrollbar for dropdown */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Close dropdown when clicking outside */
.dropdown-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
}
</style>
