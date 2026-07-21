<template>
  <div
    v-if="store.isBackendReachable"
    class="w-full transition-opacity h-(--statusbar-height) text-sm text-content flex items-center justify-start overflow-x-auto scrollbar-hide safe-area-bottom"
    :class="[activeInstanceColor]"
  >
    <!-- Safety -->
    <div
      v-if="store.safetyInfo.Connected"
      class="tns-status-seg cursor-default!"
      :class="segClass(safetyState, false)"
      :style="{ order: chipOrder(safetyState, 15) }"
    >
      <span class="chip-label">{{ t('components.statusBar.labels.safety') }}</span>
      <span class="chip-value-line">
        <span v-if="showDot(safetyState)" class="tns-dot" :class="dotClass(safetyState)"></span>
        <span class="chip-value">{{
          store.safetyInfo.IsSafe
            ? t('components.statusBar.safety.safe')
            : t('components.statusBar.safety.unsafe')
        }}</span>
      </span>
    </div>
    <!--Camera-->
    <button
      v-if="store.cameraInfo.Connected"
      class="tns-status-seg"
      :class="segClass(cameraState, cameraStore.showCameraInfo)"
      :style="{ order: chipOrder(cameraState, 10) }"
      @click="handleCameraClickWithVisit"
    >
      <span class="chip-label">{{ t('components.statusBar.labels.camera') }}</span>
      <span class="chip-value-line">
        <span v-if="showDot(cameraState)" class="tns-dot" :class="dotClass(cameraState)"></span>
        <span class="chip-value">{{ cameraValue }}</span>
      </span>
    </button>
    <!--Filter-->
    <button
      v-if="store.filterInfo.Connected"
      class="tns-status-seg"
      :class="segClass('idle', filterStore.showFilterwheelInfo)"
      :style="{ order: chipOrder('idle', 13) }"
      @click="handleFilterClickWithVisit"
    >
      <span class="chip-label">{{ t('components.statusBar.labels.filter') }}</span>
      <span class="chip-value-line">
        <span class="tns-dot bg-content-faint"></span>
        <span class="chip-value">{{
          store.filterInfo.SelectedFilter?.Name || t('components.statusBar.filter.none')
        }}</span>
      </span>
    </button>
    <!--Mount-->
    <button
      v-if="store.mountInfo.Connected"
      class="tns-status-seg"
      :class="segClass(mountState, mountStore.showMountInfo)"
      :style="{ order: chipOrder(mountState, 12) }"
      @click="handleMountClickWithVisit"
    >
      <span class="chip-label">{{ t('components.statusBar.labels.mount') }}</span>
      <span class="chip-value-line">
        <span v-if="showDot(mountState)" class="tns-dot" :class="dotClass(mountState)"></span>
        <span class="chip-value">{{ mountValue }}</span>
        <div
          v-if="store.mountInfo.Slewing"
          class="w-3.5 h-3.5 border-2 border-status-ok border-t-transparent border-solid rounded-full animate-spin"
        ></div>
      </span>
    </button>
    <!--Guider-->
    <button
      v-if="store.guiderInfo.Connected"
      class="tns-status-seg"
      :class="segClass(guiderState, guiderStore.showGuiderGraph)"
      :style="{ order: chipOrder(guiderState, 11) }"
      @click="handleGuiderClickWithVisit"
    >
      <span class="chip-label">{{ t('components.statusBar.labels.guiding') }}</span>
      <span class="chip-value-line">
        <span v-if="showDot(guiderState)" class="tns-dot" :class="dotClass(guiderState)"></span>
        <span class="chip-value">{{ guiderValue }}</span>
      </span>
    </button>
    <!-- Weather -->
    <button
      v-if="store.weatherInfo.Connected"
      class="tns-status-seg"
      :style="{ order: chipOrder('idle', 14) }"
      @click.stop.prevent="handleWeatherClick"
    >
      <span class="chip-label">{{ t('components.statusBar.labels.weather') }}</span>
      <span class="chip-value-line">
        <span class="tns-dot bg-content-faint"></span>
        <span class="chip-value">{{ weatherValue }}</span>
      </span>
    </button>
    <!-- System group: pinned to the right edge when there is free space,
         degrades to a normal scroll tail when the bar overflows. -->
    <div class="order-last ml-auto flex items-center self-stretch border-l border-line">
      <!--Progress -->
      <button
        v-if="store.isPINS"
        class="tns-status-seg"
        :class="segClass('idle', showProgress)"
        @click.stop.prevent="handleProgressClick"
      >
        <span class="chip-value">{{ t('components.statusBar.labels.progress') }}</span>
      </button>
      <!--Log -->
      <button class="tns-status-seg" @click.stop.prevent="handleLogClick">
        <span class="chip-value">{{ t('components.statusBar.labels.log') }}</span>
      </button>
      <!--WS Status + Instance Switcher -->
      <button
        class="tns-status-seg"
        :class="segClass(wsState, false)"
        @click.stop.prevent="handleInstanceClick"
      >
        <span class="chip-label">{{ t('components.statusBar.labels.instance') }}</span>
        <span class="chip-value-line">
          <span v-if="showDot(wsState)" class="tns-dot" :class="dotClass(wsState)"></span>
          <span class="chip-value">{{ activeInstanceName }}</span>
        </span>
      </button>
    </div>

    <!-- Instance Switcher Modal -->
    <InstanceSwitcherModal v-if="showInstanceSwitcher" @close="showInstanceSwitcher = false" />

    <!-- Weather modal -->
    <WeatherModal
      v-if="showWeatherModal"
      :weatherInfo="store.weatherInfo"
      @close="showWeatherModal = false"
    />

    <!-- Log modal -->
    <LogModal v-if="showLogModal" @close="showLogModal = false" />
    <!-- Guidegraph -->
    <div
      ref="guiderPanelRef"
      class="bg-gray-800/95 border-t border-cyan-700"
      :class="guiderGraphClasses"
      style="bottom: calc(env(safe-area-inset-bottom, 0px) + var(--statusbar-height))"
      v-show="guiderStore.showGuiderGraph"
    >
      <GuiderGraph />
      <div class="flex gap-2 ml-6 mb-2 overflow-x-auto scrollbar-hide">
        <GuiderStats v-if="store.guiderInfo.Connected" />
      </div>
    </div>

    <div
      ref="cameraPanelRef"
      class="bg-gray-800/95 border-t border-cyan-700"
      :class="guiderGraphClasses"
      style="bottom: calc(env(safe-area-inset-bottom, 0px) + var(--statusbar-height))"
      v-show="cameraStore.showCameraInfo"
    >
      <infoCamera class="p-5" />
    </div>

    <div
      ref="mountPanelRef"
      class="bg-gray-800/95 border-t border-cyan-700"
      :class="guiderGraphClasses"
      style="bottom: calc(env(safe-area-inset-bottom, 0px) + var(--statusbar-height))"
      v-show="mountStore.showMountInfo"
    >
      <infoMount class="p-5" />
    </div>

    <div
      ref="filterPanelRef"
      class="bg-gray-800/95 border-t border-cyan-700"
      :class="guiderGraphClasses"
      style="bottom: calc(env(safe-area-inset-bottom, 0px) + var(--statusbar-height))"
      v-show="filterStore.showFilterwheelInfo"
    >
      <InfoFilterwheel class="p-5" />
    </div>

    <div
      v-if="store.isPINS"
      ref="progressPanelRef"
      class="bg-gray-800/95 border-t border-cyan-700"
      :class="guiderGraphClasses"
      style="bottom: calc(env(safe-area-inset-bottom, 0px) + var(--statusbar-height))"
      v-show="showProgress"
    >
      <infoProgress class="" />
    </div>
  </div>
</template>

<script setup>
import { apiStore } from '@/store/store';
import { ref, computed, watchEffect } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import WeatherModal from '../WeatherModal.vue';
import LogModal from './LogModal.vue';
import InstanceSwitcherModal from './InstanceSwitcherModal.vue';
import GuiderGraph from '../guider/GuiderGraph.vue';
import GuiderStats from '../guider/GuiderStats.vue';
import { useGuiderStore } from '@/store/guiderStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useCameraStore } from '@/store/cameraStore';
import { useMountStore } from '@/store/mountStore';
import { useFilterStore } from '@/store/filterStore';
import { useOrientation } from '@/composables/useOrientation';
import infoCamera from '../camera/infoCamera.vue';
import infoMount from '../mount/infoMount.vue';
import InfoFilterwheel from '../filterwheel/InfoFilterwheel.vue';
import infoProgress from './infoProgress.vue';
import { useHaptics } from '@/composables/useHaptics';

const { t } = useI18n();
const { tapLight } = useHaptics();
const store = apiStore();
const showWeatherModal = ref(false);
const showLogModal = ref(false);
const showInstanceSwitcher = ref(false);
const showProgress = ref(false);
const guiderStore = useGuiderStore();
const settingsStore = useSettingsStore();
const cameraStore = useCameraStore();
const mountStore = useMountStore();
const filterStore = useFilterStore();
const showStatusBarPulse = ref(false);
const selectedInstanceId = computed(() => settingsStore.selectedInstanceId);

const checkStatusBarFeatureHighlight = () => {
  const hasVisited = settingsStore.tutorial?.statusBarButtonsVisited === true;
  showStatusBarPulse.value = !hasVisited;
};

const markStatusBarAsVisited = () => {
  settingsStore.tutorial.statusBarButtonsVisited = true;
  showStatusBarPulse.value = false;
};

const handleCameraClickWithVisit = () => {
  tapLight();
  handleCameraClick();
  markStatusBarAsVisited();
};

const handleFilterClickWithVisit = () => {
  tapLight();
  handleFilterClick();
  markStatusBarAsVisited();
};

const handleMountClickWithVisit = () => {
  tapLight();
  handleMountClick();
  markStatusBarAsVisited();
};

const handleGuiderClickWithVisit = () => {
  tapLight();
  handleGuiderClick();
  markStatusBarAsVisited();
};

const handleInstanceClick = () => {
  tapLight();
  showInstanceSwitcher.value = true;
};

// Semantic chip state: 'ok' = running/healthy, 'warn' = attention,
// 'danger' = problem/stopped, 'idle' = neutral, no status meaning.
const DOT_CLASSES = {
  ok: 'bg-status-ok',
  warn: 'bg-status-warn',
  danger: 'bg-status-danger',
  idle: 'bg-content-faint',
};

function dotClass(state) {
  return DOT_CLASSES[state] ?? DOT_CLASSES.idle;
}

// Segment modifier: exactly one of open/warn/danger. Open wins so the accent
// edge is never overridden by a state edge while the panel is visible.
function segClass(state, isOpen) {
  if (isOpen) return 'tns-status-seg-open';
  return {
    'tns-status-seg-warn': state === 'warn',
    'tns-status-seg-danger': state === 'danger',
  };
}

// The dot only marks ok/idle; warn/danger are carried by the colored top edge
// plus the tinted value text, so a second indicator would be noise.
function showDot(state) {
  return state === 'ok' || state === 'idle';
}

// Chips needing attention are pulled to the front of the (scrollable) bar.
// `base` keeps the remaining chips in a stable, predictable order.
function chipOrder(state, base) {
  if (state === 'danger') return 0;
  if (state === 'warn') return 5;
  return base;
}

function formatNumber(value, digits) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(digits) : null;
}

const cameraState = computed(() => {
  if (store.cameraInfo.IsExposing || store.cameraInfo.CoolerOn) return 'ok';
  return 'idle';
});

const cameraValue = computed(() => {
  if (cameraStore.exposureCountdown) return `${cameraStore.exposureCountdown} s`;
  if (store.cameraInfo.CoolerOn) {
    const temp = formatNumber(store.cameraInfo.Temperature, 1) ?? '--';
    const power = formatNumber(store.cameraInfo.CoolerPower, 0) ?? '0';
    // Direction arrow while a temperature ramp is running (real state on
    // PINS/newer ninaAPI, heuristic otherwise - see cameraStore).
    const arrow =
      cameraStore.coolingState === 'cooling'
        ? '↓'
        : cameraStore.coolingState === 'warming'
          ? '↑'
          : '';
    return `${temp}°${arrow} · ${power}%`;
  }
  const gain = formatNumber(store.cameraInfo.Gain, 0);
  return gain !== null ? `Gain ${gain}` : t('components.statusBar.camera.idle');
});

const guiderState = computed(() => {
  if (guiderStore.phd2StarLost) return 'danger';
  if (store.guiderInfo.State === 'Guiding') return 'ok';
  return 'idle';
});

const guiderValue = computed(() => {
  if (guiderStore.phd2StarLost) return t('components.statusBar.guiding.starLost');
  const rms = store.guiderInfo.RMSError?.Total;
  if (!rms) return t('components.statusBar.guiding.idle');
  if (store.profileInfo?.GuiderSettings?.PHD2GuiderScale === 'ARCSECONDS') {
    const arcsec = formatNumber(rms.Arcseconds, 2);
    return arcsec !== null ? `${arcsec}"` : t('components.statusBar.guiding.idle');
  }
  return formatNumber(rms.Pixel, 2) ?? t('components.statusBar.guiding.idle');
});

const mountState = computed(() => {
  if (store.mountInfo.AtPark) return 'danger';
  if (!store.mountInfo.TrackingEnabled) return 'warn';
  return 'ok';
});

const mountValue = computed(() => {
  if (store.mountInfo.Slewing) return t('components.statusBar.mount.slewing');
  if (store.mountInfo.AtPark) return t('components.statusBar.mount.parked');
  if (!store.mountInfo.TrackingEnabled) return t('components.statusBar.mount.trackingOff');
  return t('components.statusBar.mount.tracking');
});

const weatherValue = computed(() => {
  const temp = formatNumber(store.weatherInfo.Temperature, 1) ?? '--';
  const clouds = formatNumber(store.weatherInfo.CloudCover, 0);
  return clouds !== null ? `${temp}°C · ${clouds}%` : `${temp}°C`;
});

const safetyState = computed(() => (store.safetyInfo.IsSafe ? 'ok' : 'danger'));

const wsState = computed(() => (store.isWebSocketConnected ? 'ok' : 'danger'));

// Fixed frame surface color, independent of the selected instance.
const activeInstanceColor = 'bg-gray-900/95';

const activeInstanceName = computed(() => {
  return settingsStore.getInstance(selectedInstanceId.value)?.name ?? '';
});

// Initialize feature highlight on mount
checkStatusBarFeatureHighlight();

// Check if in landscape mode
const { isLandscape } = useOrientation();
const guiderGraphClasses = computed(() => ({
  'fixed left-0 w-full': !isLandscape.value,
  'fixed left-(--nav-width) right-0': isLandscape.value,
}));

// Track the height of whichever status-bar panel is currently open, so other
// fixed-positioned overlays (e.g. controlSequence) can offset themselves above it.
const guiderPanelRef = ref(null);
const cameraPanelRef = ref(null);
const mountPanelRef = ref(null);
const filterPanelRef = ref(null);
const progressPanelRef = ref(null);

const { height: guiderPanelHeight } = useElementSize(guiderPanelRef);
const { height: cameraPanelHeight } = useElementSize(cameraPanelRef);
const { height: mountPanelHeight } = useElementSize(mountPanelRef);
const { height: filterPanelHeight } = useElementSize(filterPanelRef);
const { height: progressPanelHeight } = useElementSize(progressPanelRef);

// Only the visible panel (v-show) reports a non-zero height, so the max is the active one.
const activeStatusPanelHeight = computed(() =>
  Math.max(
    guiderPanelHeight.value,
    cameraPanelHeight.value,
    mountPanelHeight.value,
    filterPanelHeight.value,
    progressPanelHeight.value
  )
);

watchEffect(() => {
  document.documentElement.style.setProperty(
    '--status-panel-height',
    `${activeStatusPanelHeight.value}px`
  );
});

function handleWeatherClick(event) {
  tapLight();
  showWeatherModal.value = true;
  event.stopPropagation();
  event.preventDefault();
}

function handleLogClick(event) {
  tapLight();
  showLogModal.value = true;
  event.stopPropagation();
  event.preventDefault();
}

function handleCameraClick() {
  cameraStore.showCameraInfo = !cameraStore.showCameraInfo;
  if (cameraStore.showCameraInfo) {
    guiderStore.showGuiderGraph = false;
    mountStore.showMountInfo = false;
    filterStore.showFilterwheelInfo = false;
    showProgress.value = false;
  }
}

function handleGuiderClick() {
  guiderStore.showGuiderGraph = !guiderStore.showGuiderGraph;
  if (guiderStore.showGuiderGraph) {
    cameraStore.showCameraInfo = false;
    mountStore.showMountInfo = false;
    filterStore.showFilterwheelInfo = false;
    showProgress.value = false;
  }
}

function handleMountClick() {
  mountStore.showMountInfo = !mountStore.showMountInfo;
  if (mountStore.showMountInfo) {
    cameraStore.showCameraInfo = false;
    guiderStore.showGuiderGraph = false;
    filterStore.showFilterwheelInfo = false;
    showProgress.value = false;
  }
}

function handleFilterClick() {
  filterStore.showFilterwheelInfo = !filterStore.showFilterwheelInfo;
  if (filterStore.showFilterwheelInfo) {
    cameraStore.showCameraInfo = false;
    guiderStore.showGuiderGraph = false;
    mountStore.showMountInfo = false;
    showProgress.value = false;
  }
}

function handleProgressClick() {
  tapLight();
  showProgress.value = !showProgress.value;
  if (showProgress.value) {
    cameraStore.showCameraInfo = false;
    guiderStore.showGuiderGraph = false;
    mountStore.showMountInfo = false;
    filterStore.showFilterwheelInfo = false;
  }
}
</script>

<style scoped>
@reference '../../assets/tailwind.css';

/* Segment typography: micro uppercase label above, prominent value line below */
.chip-label {
  @apply text-[10px] uppercase leading-none tracking-wide text-content-faint;
}

.chip-value-line {
  @apply flex items-center gap-1.5;
}

.chip-value {
  @apply text-xs font-semibold leading-tight tabular-nums text-content whitespace-nowrap;
}

/* Warn/danger segments tint the value text (dot is hidden there) */
.tns-status-seg-warn .chip-value {
  @apply text-status-warn;
}

.tns-status-seg-danger .chip-value {
  @apply text-status-danger;
}

.safe-area-bottom {
  /* Add safe area padding for iOS devices */
  padding-bottom: env(safe-area-inset-bottom);
  /* Ensure minimum height is maintained */
  min-height: calc(var(--statusbar-height) + env(safe-area-inset-bottom)); /* bar + safe area */

  /* Ensure content is properly centered when safe area is applied */
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

/* For devices without safe area support, fallback to normal padding */
@supports not (padding-bottom: env(safe-area-inset-bottom)) {
  .safe-area-bottom {
    padding-bottom: 0.5rem; /* Add some padding for non-iOS devices */
    min-height: calc(var(--statusbar-height) + 0.5rem); /* bar + padding */
  }
}

/* Specific handling for iOS devices with curved screens */
@media screen and (max-device-width: 428px) and (-webkit-device-pixel-ratio: 3) {
  .safe-area-bottom {
    padding-bottom: max(env(safe-area-inset-bottom), 0.75rem);
    min-height: calc(var(--statusbar-height) + max(env(safe-area-inset-bottom), 0.75rem));
  }
}

/* Ensure buttons and icons are properly spaced */
.safe-area-bottom button {
  margin-bottom: 0;
  z-index: 1;
}

/* Prevent content from being cut off on curved screens */
.safe-area-bottom > * {
  margin-bottom: 0;
  flex-shrink: 0;
}
</style>
