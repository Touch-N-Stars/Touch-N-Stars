<template>
  <div>
    <SubNav
      :items="[
        { name: $t('components.guider.title'), value: 'showGuiding' },
        { name: $t('components.camera.settings'), value: 'showSettings' },
      ]"
      v-model:activeItem="currentTab"
    />
    <div v-if="currentTab === 'showGuiding'" class="overflow-hidden" :style="containerStyle">
      <!-- Control Buttons: row at the top in landscape, column on the right in portrait -->
      <!-- The wrapper spans the full width, so it must stay transparent for pointer events -->
      <!-- otherwise it would swallow pinch/pan gestures meant for the image below it. -->
      <div class="relative z-30 p-4 pointer-events-none" :class="buttonContainerClass">
        <div
          v-if="!store.guiderInfo.Connected"
          class="p-4 bg-red-500/20 border border-red-500/30 rounded-lg backdrop-blur-sm pointer-events-auto"
        >
          <p class="text-red-400 font-medium text-center">
            {{ $t('components.guider.notConnected') }}
          </p>
        </div>

        <!-- Portrait Layout: vertical button column on the right -->
        <div v-if="!isLandscape" class="flex flex-col gap-1 items-end">
          <div class="flex flex-col gap-1 pointer-events-auto">
            <!-- Loop Button -->
            <button
              v-if="
                store.guiderInfo.State !== 'Guiding' && store.guiderInfo.State !== 'Calibrating'
              "
              @click="startLooping"
              class="tns-btn-secondary px-3 py-3 rounded-lg font-medium transition-all duration-200 backdrop-blur-sm shadow-lg"
            >
              <span class="flex items-center justify-center">
                <ArrowPathIcon
                  :class="store.guiderInfo.State === 'Looping' ? 'animate-spin' : ''"
                  class="w-5 h-5"
                />
              </span>
            </button>

            <!-- Start Button -->
            <button
              v-if="
                store.guiderInfo.State !== 'Guiding' && store.guiderInfo.State !== 'Calibrating'
              "
              @click="startGuiding"
              class="tns-btn-primary px-3 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg"
            >
              <span class="flex items-center justify-center">
                <template v-if="isProcessing">
                  <svg
                    class="animate-spin w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke-width="4" />
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </template>
                <template v-else>
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </template>
              </span>
            </button>

            <!-- Stop Button (Always Visible) -->
            <button
              @click="stopGuiding"
              class="tns-btn-danger px-3 py-3 rounded-lg font-medium transition-all duration-200 backdrop-blur-sm shadow-lg"
            >
              <span class="flex items-center justify-center">
                <StopIcon class="w-5 h-5" />
              </span>
            </button>

            <!-- Star Components Toggle Button -->
            <button
              v-if="guiderStore.phd2Connection?.IsConnected"
              @click="showStarImage = !showStarImage"
              :class="['tns-btn-secondary', { 'border-accent': showStarImage }]"
              class="flex items-center justify-center px-3 py-3"
              :title="
                showStarImage
                  ? $t('components.guider.phd2.starComponents.hide')
                  : $t('components.guider.phd2.starComponents.show')
              "
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  v-if="!showStarImage"
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
                <path
                  v-else
                  d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                />
              </svg>
            </button>

            <!-- Auto-select Star Button -->
            <button
              v-if="guiderStore.phd2Connection?.IsConnected && store.guiderInfo.State === 'Looping'"
              @click="autoSelectStar"
              :class="['tns-btn-secondary', { 'border-accent': isAutoSelectingStar }]"
              :disabled="isAutoSelectingStar"
              class="flex items-center justify-center px-3 py-3"
              :title="$t('components.guider.phd2.autoSelectStar')"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="3" x2="12" y2="6" stroke-linecap="round" />
                <line x1="12" y1="18" x2="12" y2="21" stroke-linecap="round" />
                <line x1="3" y1="12" x2="6" y2="12" stroke-linecap="round" />
                <line x1="18" y1="12" x2="21" y2="12" stroke-linecap="round" />
              </svg>
            </button>

            <!-- Calibration Assistant Button -->
            <button
              v-if="
                guiderStore.phd2Connection?.IsConnected && store.guiderInfo?.State !== 'Guiding'
              "
              @click="openCalibrationAssistant = true"
              class="tns-btn-secondary flex items-center justify-center px-3 py-3 text-xs font-bold"
              :title="$t('components.guider.calibrationAssistant.title')"
            >
              CAL
            </button>

            <!-- Calibration Data Button -->
            <button
              v-if="guiderStore.phd2Connection?.IsConnected && store.isPINS"
              @click="openCalibrationData = true"
              class="tns-btn-secondary flex items-center justify-center px-3 py-3"
              :title="$t('components.guider.phd2.reviewCalibration')"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <line x1="3" y1="21" x2="3" y2="3" />
                <line x1="3" y1="21" x2="21" y2="21" />
                <line x1="3" y1="21" x2="10" y2="10" stroke="#4499ff" stroke-width="2" />
                <line x1="3" y1="21" x2="16" y2="6" stroke="#ff4444" stroke-width="2" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Landscape Layout: horizontal button row at the top -->
        <div v-else class="flex flex-col w-full items-center gap-2">
          <div class="flex items-center justify-center gap-2 pointer-events-auto">
            <!-- Loop Button -->
            <button
              v-if="
                store.guiderInfo.State !== 'Guiding' && store.guiderInfo.State !== 'Calibrating'
              "
              @click="startLooping"
              class="tns-btn-secondary px-3 py-3 rounded-lg font-medium transition-all duration-200 backdrop-blur-sm shadow-lg"
            >
              <span class="flex items-center justify-center">
                <ArrowPathIcon
                  :class="store.guiderInfo.State === 'Looping' ? 'animate-spin' : ''"
                  class="w-5 h-5"
                />
              </span>
            </button>

            <!-- Start Button -->
            <button
              v-if="
                store.guiderInfo.State !== 'Guiding' && store.guiderInfo.State !== 'Calibrating'
              "
              @click="startGuiding"
              class="tns-btn-primary px-3 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg"
            >
              <span class="flex items-center justify-center">
                <template v-if="isProcessing">
                  <svg
                    class="animate-spin w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke-width="4" />
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </template>
                <template v-else>
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </template>
              </span>
            </button>

            <!-- Stop Button (Always Visible) -->
            <button
              @click="stopGuiding"
              class="tns-btn-danger px-3 py-3 rounded-lg font-medium transition-all duration-200 backdrop-blur-sm shadow-lg"
            >
              <span class="flex items-center justify-center">
                <StopIcon class="w-5 h-5" />
              </span>
            </button>

            <!-- Star Components Toggle Button -->
            <button
              v-if="guiderStore.phd2Connection?.IsConnected"
              @click="showStarImage = !showStarImage"
              :class="['tns-btn-secondary', { 'border-accent': showStarImage }]"
              class="flex items-center justify-center px-3 py-3"
              :title="
                showStarImage
                  ? $t('components.guider.phd2.starComponents.hide')
                  : $t('components.guider.phd2.starComponents.show')
              "
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  v-if="!showStarImage"
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
                <path
                  v-else
                  d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                />
              </svg>
            </button>

            <!-- Auto-select Star Button -->
            <button
              v-if="guiderStore.phd2Connection?.IsConnected && store.guiderInfo.State === 'Looping'"
              @click="autoSelectStar"
              :class="['tns-btn-secondary', { 'border-accent': isAutoSelectingStar }]"
              :disabled="isAutoSelectingStar"
              class="flex items-center justify-center px-3 py-3"
              :title="$t('components.guider.phd2.autoSelectStar')"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="3" x2="12" y2="6" stroke-linecap="round" />
                <line x1="12" y1="18" x2="12" y2="21" stroke-linecap="round" />
                <line x1="3" y1="12" x2="6" y2="12" stroke-linecap="round" />
                <line x1="18" y1="12" x2="21" y2="12" stroke-linecap="round" />
              </svg>
            </button>

            <!-- Calibration Assistant Button -->
            <button
              v-if="
                guiderStore.phd2Connection?.IsConnected && store.guiderInfo?.State !== 'Guiding'
              "
              @click="openCalibrationAssistant = true"
              class="tns-btn-secondary h-12 flex items-center justify-center px-3 py-3 text-xs font-bold"
              :title="$t('components.guider.calibrationAssistant.title')"
            >
              CAL
            </button>

            <!-- Calibration Data Button -->
            <button
              v-if="guiderStore.phd2Connection?.IsConnected && store.isPINS"
              @click="openCalibrationData = true"
              class="tns-btn-secondary flex items-center justify-center px-3 py-3"
              :title="$t('components.guider.phd2.reviewCalibration')"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <line x1="3" y1="21" x2="3" y2="3" />
                <line x1="3" y1="21" x2="21" y2="21" />
                <line x1="3" y1="21" x2="10" y2="10" stroke="#4499ff" stroke-width="2" />
                <line x1="3" y1="21" x2="16" y2="6" stroke="#ff4444" stroke-width="2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Status Display: bottom left in both orientations, so it never covers the -->
      <!-- star image / star profile tiles in the top strip on narrow screens. -->
      <div class="absolute left-4 z-30 pointer-events-none" :style="statusPositionStyle">
        <div class="px-3 py-2 bg-black/30 rounded-lg backdrop-blur-sm">
          <div class="flex items-center gap-2">
            <div class="status-indicator" :class="statusClasses">
              <div class="status-dot"></div>
            </div>
            <span class="text-xs font-medium" :class="statusTextClasses">
              {{ statusText }}
            </span>
          </div>
        </div>
      </div>

      <!-- PHD2 Image Background -->
      <div
        v-if="guiderStore.phd2Connection?.IsConnected"
        class="absolute inset-0 w-full h-full"
        :style="imageStyle"
      >
        <!-- PHD2 Hintergrundbild immer sichtbar -->
        <Phd2Image :show="true" class="opacity-70" />

        <!-- Calibration step message overlay -->
        <div
          v-if="guiderStore.phd2CalibrationMessage"
          class="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-black/70 rounded-lg border border-yellow-500/50 backdrop-blur-sm pointer-events-none"
        >
          <span class="text-yellow-300 text-xs font-medium tracking-wide">{{
            guiderStore.phd2CalibrationMessage
          }}</span>
        </div>

        <!-- Star Components overlay (über Button ein-/ausblendbar) -->
        <!-- Not interactive: keep it transparent so the image below stays zoomable -->
        <div v-if="showStarImage" class="absolute inset-0 pointer-events-none">
          <div v-if="isLandscape" class="absolute inset-0">
            <!-- Star Components oben mittig -->
            <div
              class="p-4 flex gap-4 justify-center relative z-10"
              :style="landscapeContainerStyle"
            >
              <!-- Star Image links -->
              <div
                :style="responsiveStarImageStyle"
                class="relative shrink-0 bg-black/80 rounded border border-gray-600"
              >
                <Phd2Guidstar :show="true" class="opacity-95" />
              </div>

              <!-- Star Profile rechts -->
              <div
                :style="responsiveStarProfileStyle"
                class="relative shrink-0 bg-black/80 rounded border border-gray-600 overflow-hidden"
              >
                <Phd2StarProfile
                  :containerWidth="responsiveStarSize.width"
                  :containerHeight="responsiveStarSize.height"
                />
              </div>
            </div>
          </div>

          <div v-else class="absolute inset-0">
            <!-- Star Components oben -->
            <div
              class="p-4 flex gap-4 justify-center relative z-10"
              :style="portraitContainerStyle"
            >
              <!-- Star Image links -->
              <div
                :style="responsiveStarImageStyle"
                class="relative shrink-0 bg-black/80 rounded border border-gray-600"
              >
                <Phd2Guidstar :show="true" class="opacity-95" />
              </div>

              <!-- Star Profile rechts -->
              <div
                :style="responsiveStarProfileStyle"
                class="relative shrink-0 bg-black/80 rounded border border-gray-600 overflow-hidden"
              >
                <Phd2StarProfile
                  :containerWidth="responsiveStarSize.width"
                  :containerHeight="responsiveStarSize.height"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings Tab: normal page flow, the App stage already offsets navbar and SubNav -->
    <div
      v-if="currentTab === 'showSettings'"
      class="container py-4 flex items-center justify-center"
    >
      <div class="container max-w-md landscape:max-w-xl">
        <div class="border border-line rounded-card shadow-lg bg-surface-1">
          <div class="container pl-5 pb-5 pr-5">
            <div class="mt-5">
              <Phd2Settings />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Calibration Assistant Modal -->
    <CalibrationAssistantModal
      :show="openCalibrationAssistant"
      @close="openCalibrationAssistant = false"
    />

    <!-- Calibration Data Modal -->
    <CalibrationDataModal :show="openCalibrationData" @close="openCalibrationData = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { apiStore } from '@/store/store';
import { useGuiderStore } from '@/store/guiderStore';
import { useSettingsStore } from '@/store/settingsStore';
import { StopIcon, ArrowPathIcon } from '@heroicons/vue/24/outline';
import Phd2Settings from '@/components/guider/PHD2/Phd2Settings.vue';
import Phd2Image from '@/components/guider/PHD2/Phd2Image.vue';
import Phd2Guidstar from '@/components/guider/PHD2/Phd2Guidstar.vue';
import Phd2StarProfile from '@/components/guider/PHD2/Phd2StarProfile.vue';
import SubNav from '@/components/SubNav.vue';
import CalibrationAssistantModal from '@/components/guider/PHD2/CalibrationAssistantModal.vue';
import CalibrationDataModal from '@/components/guider/PHD2/CalibrationDataModal.vue';
import apiService from '@/services/apiService';
import { useI18n } from 'vue-i18n';
import { useOrientation } from '@/composables/useOrientation';

const store = apiStore();
const guiderStore = useGuiderStore();
const settingsStore = useSettingsStore();
const { isLandscape, orientation } = useOrientation();
const { t: $t } = useI18n();
// Exposed to the page so it can hide the guider graph panel on the settings tab
const currentTab = defineModel('tab', { type: String, default: 'showGuiding' });
const openCalibrationAssistant = ref(false);
const openCalibrationData = ref(false);
const isProcessing = ref(false);
const showStarImage = ref(false);
const isAutoSelectingStar = ref(false);

const containerStyle = computed(() => {
  if (isLandscape.value) {
    // Landscape: Full viewport minus sidebar, go to bottom
    return {
      position: 'fixed',
      top: 'var(--subnav-offset)', // Start below the fixed SubNav
      left: 'var(--nav-width)', // Start after the navbar sidebar
      right: '0',
      bottom: '0', // Go all the way to bottom
      width: 'auto',
      height: 'auto',
    };
  } else {
    // Portrait: Full viewport minus navbar, SubNav and status bar
    return {
      position: 'fixed',
      top: 'calc(82px + var(--subnav-offset))', // Start after navbar + SubNav
      left: '0',
      right: '0',
      bottom: 'var(--above-statusbar)', // Stop before status bar
      width: 'auto',
      height: 'auto',
    };
  }
});

const buttonContainerClass = computed(() => {
  if (isLandscape.value) {
    return 'flex justify-center items-start'; // Button row centered at the top in landscape
  } else {
    return 'flex justify-end items-start'; // Button column on the right in portrait
  }
});

const imageStyle = computed(() => {
  if (isLandscape.value) {
    // Landscape: Image starts below the button row
    return {
      top: '80px',
      height: 'calc(100% - 80px)',
    };
  } else {
    // Portrait: Image fills the area, buttons overlay on the right
    return {
      top: '0',
      height: '100%',
    };
  }
});

// Responsive Größen für Star Components: beide Orientierungen zeigen die Kacheln
// horizontal nebeneinander oben, die Breite richtet sich nach dem freien Platz.
const STAR_TILE_MAX_WIDTH = 200;
const STAR_TILE_MIN_WIDTH = 110;
// Breite der Button-Spalte am rechten Rand (Portrait), die freigehalten werden muss.
const PORTRAIT_BUTTON_COLUMN_WIDTH = 80;

const responsiveStarSize = computed(() => {
  const reservedRight = isLandscape.value ? 0 : PORTRAIT_BUTTON_COLUMN_WIDTH;
  const available = orientation.value.width - 32 /* p-4 */ - 16 /* gap */ - reservedRight;
  const width = Math.round(
    Math.min(STAR_TILE_MAX_WIDTH, Math.max(STAR_TILE_MIN_WIDTH, available / 2))
  );
  return { width, height: Math.round(width * 0.75) };
});

const responsiveStarImageStyle = computed(() => ({
  width: `${responsiveStarSize.value.width}px`,
  height: `${responsiveStarSize.value.height}px`,
}));

const responsiveStarProfileStyle = computed(() => ({
  width: `${responsiveStarSize.value.width}px`,
  height: `${responsiveStarSize.value.height}px`,
}));

const portraitContainerStyle = computed(() => ({
  height: `${responsiveStarSize.value.height + 16}px`, // Höhe + Padding
  paddingRight: `${PORTRAIT_BUTTON_COLUMN_WIDTH}px`, // Platz für die Button-Spalte am rechten Rand
}));

// Statusanzeige unten links. Der geöffnete Guider-Graph unten (StatusBar-Panel) wird
// über --status-panel-height eingerechnet, damit die Anzeige nicht dahinter verschwindet.
const statusPositionStyle = computed(() => ({
  bottom: isLandscape.value
    ? 'calc(var(--above-statusbar) + var(--status-panel-height) + 1rem)'
    : 'calc(var(--status-panel-height) + 1rem)',
}));

const landscapeContainerStyle = computed(() => ({
  height: `${responsiveStarSize.value.height + 16}px`, // Höhe + Padding
}));

// Status computed properties
const statusText = computed(() => {
  const state = store.guiderInfo?.State;
  if (!state) return $t('components.guider.status.unknown');

  switch (state) {
    case 'Looping':
      return $t('components.guider.status.looping');
    case 'LostLock':
      return $t('components.guider.status.lostLock');
    case 'Guiding':
      return $t('components.guider.status.guiding');
    case 'Stopped':
      return $t('components.guider.status.stopped');
    case 'Calibrating':
      return $t('components.guider.status.calibrating');
    default:
      return state;
  }
});

const statusClasses = computed(() => {
  const state = store.guiderInfo?.State;
  return {
    'status-guiding': state === 'Guiding',
    'status-calibrating': state === 'Calibrating',
    'status-looping': state === 'Looping',
    'status-error': state === 'LostLock',
    'status-stopped': state === 'Stopped',
    'status-unknown': !state,
  };
});

const statusTextClasses = computed(() => {
  const state = store.guiderInfo?.State;
  return {
    'text-green-400': state === 'Guiding',
    'text-blue-400': state === 'Calibrating',
    'text-yellow-400': state === 'Looping',
    'text-red-400': state === 'LostLock',
    'text-gray-400': state === 'Stopped',
    'text-gray-500': !state,
  };
});

// Start guiding function
async function startGuiding() {
  if (guiderStore.isDarkLibraryBuildActive) return;
  isProcessing.value = true;
  try {
    await apiService.guiderStart(settingsStore.guider.phd2ForceCalibration);
    console.log(
      'Guider started',
      settingsStore.guider.phd2ForceCalibration
        ? 'with forced calibration'
        : 'without forced calibration'
    );
  } catch (error) {
    console.error('Error during guider start:', error.response?.data || error);
  } finally {
    isProcessing.value = false;
  }
}

// Start guiding function
async function startLooping() {
  if (guiderStore.isDarkLibraryBuildActive) return;
  try {
    await apiService.setPHD2StartLooping(settingsStore.guider.phd2ForceCalibration);
    console.log('[PHD2] Start looping');
  } catch (error) {
    console.error('[PHD2] Error during guider start:', error.response?.data || error);
  } finally {
  }
}

async function stopGuiding() {
  if (guiderStore.isDarkLibraryBuildActive) return;
  try {
    if (!store.checkVersionNewerOrEqual(store.currentTnsPluginVersion, '1.1.4.0')) {
      await apiService.guiderAction('stop');
      console.log('Guiding stopped via guiderAction');
    } else {
      await apiService.setPHD2StopGuiding();
      console.log('Guiding stopped via setPHD2StopGuiding');
    }
  } catch (error) {
    console.error('Error during guiding toggle:', error.response?.data || error);
  } finally {
    isProcessing.value = false;
  }
}

async function autoSelectStar() {
  if (guiderStore.isDarkLibraryBuildActive) return;
  isAutoSelectingStar.value = true;
  try {
    await apiService.findPhd2Star();
    console.log('[PHD2] Auto-selected guide star');
  } catch (error) {
    console.error('[PHD2] Error auto-selecting star:', error);
  } finally {
    isAutoSelectingStar.value = false;
  }
}
</script>

<style scoped>
@reference '../../../assets/tailwind.css';
.status-indicator {
  @apply relative w-4 h-4 rounded-full flex items-center justify-center;
}

.status-dot {
  @apply w-3 h-3 rounded-full animate-pulse;
}

.status-guiding .status-dot {
  @apply bg-green-500 shadow-lg shadow-green-500/50;
}

.status-calibrating .status-dot {
  @apply bg-blue-500 shadow-lg shadow-blue-500/50;
}

.status-looping .status-dot {
  @apply bg-yellow-500 shadow-lg shadow-yellow-500/50;
}

.status-error .status-dot {
  @apply bg-red-500 shadow-lg shadow-red-500/50;
}

.status-stopped .status-dot {
  @apply bg-gray-500 shadow-lg shadow-gray-500/50;
  animation: none;
}

.status-unknown .status-dot {
  @apply bg-gray-600 shadow-lg shadow-gray-600/50;
  animation: none;
}
</style>
