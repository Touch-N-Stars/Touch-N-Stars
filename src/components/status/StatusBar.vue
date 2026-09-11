<template>
  <div
    v-if="store.isBackendReachable"
    class="w-full transition-opacity h-(--statusbar-height) text-sm text-content flex items-center justify-start overflow-x-auto scrollbar-hide safe-area-bottom"
    :class="[activeInstanceColor]"
  >
    <!-- Screen lock (screen-lock plugin) -->
    <button
      v-if="isScreenLockPluginEnabled && !isStatusItemHidden('screenlock')"
      class="tns-status-seg"
      :style="{ order: getStatusOrder('screenlock') }"
      @click.stop.prevent="handleScreenLockClick"
    >
      <LockOpenIcon class="w-4 h-4" />
      <span class="chip-value">{{ t('components.statusBar.labels.screenlock') }}</span>
    </button>
    <!-- Safety -->
    <div
      v-if="store.safetyInfo.Connected && !isStatusItemHidden('safety')"
      class="tns-status-seg cursor-default!"
      :class="segClass(safetyState, false)"
      :style="{ order: getStatusOrder('safety') }"
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
      v-if="store.cameraInfo.Connected && !isStatusItemHidden('camera')"
      class="tns-status-seg"
      :class="segClass(cameraState, statusBarStore.isPanelOpen('camera'))"
      :style="{ order: getStatusOrder('camera') }"
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
      v-if="store.filterInfo.Connected && !isStatusItemHidden('filter')"
      class="tns-status-seg"
      :class="segClass('idle', statusBarStore.isPanelOpen('filter'))"
      :style="{ order: getStatusOrder('filter') }"
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
    <!--Switch-->
    <button
      v-if="store.switchInfo.Connected && !isStatusItemHidden('switch')"
      class="tns-status-seg"
      :class="segClass(switchState, statusBarStore.isPanelOpen('switch'))"
      :style="{ order: getStatusOrder('switch') }"
      @click="handleSwitchClickWithVisit"
    >
      <span class="chip-label">{{ t('components.statusBar.labels.switch') }}</span>
      <span class="chip-value-line">
        <span class="tns-dot" :class="dotClass(switchState)"></span>
        <span class="chip-value">{{ switchValue }}</span>
      </span>
    </button>
    <!--Mount-->
    <button
      v-if="store.mountInfo.Connected && !isStatusItemHidden('mount')"
      class="tns-status-seg"
      :class="segClass(mountState, statusBarStore.isPanelOpen('mount'))"
      :style="{ order: getStatusOrder('mount') }"
      @click="handleMountClickWithVisit"
    >
      <span class="chip-label">{{ t('components.statusBar.labels.mount') }}</span>
      <span class="chip-value-line">
        <span v-if="showDot(mountState)" class="tns-dot" :class="dotClass(mountState)"></span>
        <span class="chip-value">{{ mountValue }}</span>
        <div
          v-if="store.mountIsSlewing"
          class="w-3.5 h-3.5 border-2 border-status-ok border-t-transparent border-solid rounded-full animate-spin"
        ></div>
      </span>
    </button>
    <!--Guider-->
    <button
      v-if="store.guiderInfo.Connected && !isStatusItemHidden('guider')"
      class="tns-status-seg"
      :class="segClass(guiderState, statusBarStore.isPanelOpen('guider'))"
      :style="{ order: getStatusOrder('guider') }"
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
      v-if="store.weatherInfo.Connected && !isStatusItemHidden('weather')"
      class="tns-status-seg"
      :style="{ order: getStatusOrder('weather') }"
      @click.stop.prevent="handleWeatherClick"
    >
      <span class="chip-label">{{ t('components.statusBar.labels.weather') }}</span>
      <span class="chip-value-line">
        <span class="tns-dot bg-content-faint"></span>
        <span class="chip-value">{{ weatherValue }}</span>
      </span>
    </button>
    <!--Progress -->
    <button
      v-if="store.isPINS && !isStatusItemHidden('progress')"
      class="tns-status-seg"
      :class="segClass('idle', statusBarStore.isPanelOpen('progress'))"
      :style="{ order: getStatusOrder('progress') }"
      @click.stop.prevent="handleProgressClick"
    >
      <span class="chip-value">{{ t('components.statusBar.labels.progress') }}</span>
    </button>
    <!--Log -->
    <button
      v-if="!isStatusItemHidden('log')"
      class="tns-status-seg"
      :style="{ order: getStatusOrder('log') }"
      @click.stop.prevent="handleLogClick"
    >
      <span class="chip-value">{{ t('components.statusBar.labels.log') }}</span>
    </button>
    <!--WS Status + Instance Switcher -->
    <button
      v-if="!isStatusItemHidden('instance')"
      class="tns-status-seg"
      :class="segClass(wsState, false)"
      :style="{ order: getStatusOrder('instance') }"
      @click.stop.prevent="handleInstanceClick"
    >
      <span class="chip-label">{{ t('components.statusBar.labels.instance') }}</span>
      <span class="chip-value-line">
        <span v-if="showDot(wsState)" class="tns-dot" :class="dotClass(wsState)"></span>
        <span class="chip-value">{{ activeInstanceName }}</span>
      </span>
    </button>

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
    <!-- Docked panels. All stay mounted (v-show): the guider graph keeps its
         chart instance, the others are cheap and switch without a flash. -->
    <div ref="panelRef" :class="statusPanelClasses" v-show="statusBarStore.activePanel">
      <div v-show="statusBarStore.isPanelOpen('guider')">
        <GuiderGraph />
        <div class="flex gap-2 ml-6 mb-2 overflow-x-auto scrollbar-hide">
          <GuiderStats v-if="store.guiderInfo.Connected" />
        </div>
      </div>
      <div v-show="statusBarStore.isPanelOpen('camera')">
        <infoCamera class="p-5" />
      </div>
      <div v-show="statusBarStore.isPanelOpen('mount')">
        <infoMount class="p-5" />
      </div>
      <div v-show="statusBarStore.isPanelOpen('filter')">
        <InfoFilterwheel class="p-5" />
      </div>
      <div
        v-show="statusBarStore.isPanelOpen('switch')"
        class="p-5 flex flex-col gap-3 max-h-[50vh] overflow-y-auto"
      >
        <div
          v-if="store.switchInfo.ReadonlySwitches?.length"
          class="grid gap-2 grid-cols-2 lg:grid-cols-3"
        >
          <InfoSwitch />
        </div>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <ControlSwitch />
        </div>
      </div>
      <div v-if="store.isPINS" v-show="statusBarStore.isPanelOpen('progress')">
        <infoProgress />
      </div>
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
import { useStatusBarStore } from '@/store/statusBarStore';
import { useOrientation } from '@/composables/useOrientation';
import infoCamera from '../camera/infoCamera.vue';
import infoMount from '../mount/infoMount.vue';
import InfoFilterwheel from '../filterwheel/InfoFilterwheel.vue';
import infoProgress from './infoProgress.vue';
import ControlSwitch from '../switch/ControlSwitch.vue';
import InfoSwitch from '../switch/InfoSwitch.vue';
import { usePluginStore } from '@/store/pluginStore';
import { LockOpenIcon } from '@heroicons/vue/24/outline';

const { t } = useI18n();
const store = apiStore();
const showWeatherModal = ref(false);
const showLogModal = ref(false);
const showInstanceSwitcher = ref(false);
const guiderStore = useGuiderStore();
const settingsStore = useSettingsStore();
const cameraStore = useCameraStore();
const statusBarStore = useStatusBarStore();
const pluginStore = usePluginStore();
const isScreenLockPluginEnabled = computed(
  () => pluginStore.plugins.find((plugin) => plugin.id === 'screen-lock')?.enabled === true
);

function handleScreenLockClick() {
  settingsStore.lockScreen();
}

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
  statusBarStore.togglePanel('camera');
  markStatusBarAsVisited();
};

const handleFilterClickWithVisit = () => {
  statusBarStore.togglePanel('filter');
  markStatusBarAsVisited();
};

const handleSwitchClickWithVisit = () => {
  statusBarStore.togglePanel('switch');
  markStatusBarAsVisited();
};

const handleMountClickWithVisit = () => {
  statusBarStore.togglePanel('mount');
  markStatusBarAsVisited();
};

const handleGuiderClickWithVisit = () => {
  statusBarStore.togglePanel('guider');
  markStatusBarAsVisited();
};

const handleInstanceClick = () => {
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

// Chip position and visibility are user-configurable (see
// StatusBarCustomizationSettings.vue). Unknown ids sort to the end.
function getStatusOrder(id) {
  const order = settingsStore.statusbar?.itemOrder;
  if (!order) return 99;
  const idx = order.indexOf(id);
  return idx === -1 ? 99 : idx;
}

function isStatusItemHidden(id) {
  return settingsStore.statusbar?.hiddenItems?.includes(id) ?? false;
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

// Park and slew share the same precedence as mountValue below, otherwise a
// driver that latches Slewing while parked paints a red chip labelled "Slewing".
// A running slew is an active, healthy state - green, not the tracking-off warn.
const mountState = computed(() => {
  if (store.mountInfo.AtPark) return 'danger';
  if (store.mountIsSlewing) return 'ok';
  if (!store.mountInfo.TrackingEnabled) return 'warn';
  return 'ok';
});

const mountValue = computed(() => {
  if (store.mountIsSlewing) return t('components.statusBar.mount.slewing');
  if (store.mountInfo.AtPark) return t('components.statusBar.mount.parked');
  if (!store.mountInfo.TrackingEnabled) return t('components.statusBar.mount.trackingOff');
  return t('components.statusBar.mount.tracking');
});

// Powered ports vs. all writable ports; PWM/dimmer outputs count as on above zero.
const switchOnCount = computed(
  () => (store.switchInfo.WritableSwitches ?? []).filter((s) => s.Value > 0).length
);
const switchValue = computed(
  () => `${switchOnCount.value}/${store.switchInfo.WritableSwitches?.length ?? 0}`
);
const switchState = computed(() => (switchOnCount.value > 0 ? 'ok' : 'idle'));

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
// Panels dock onto the bar inside the stage rails (see tns-status-panel), so the
// stage frame can end above them with its rounded corners intact.
const statusPanelClasses = computed(() => ({
  'tns-status-panel': true,
  'left-(--stage-inset)': !isLandscape.value,
  'left-[calc(var(--nav-width)+var(--stage-inset))]': isLandscape.value,
}));

// Track the height of the open status-bar panel, so other fixed-positioned
// overlays (e.g. controlSequence) can offset themselves above it. The wrapper
// is hidden (height 0) while no panel is open.
const panelRef = ref(null);
const { height: activeStatusPanelHeight } = useElementSize(panelRef);

watchEffect(() => {
  document.documentElement.style.setProperty(
    '--status-panel-height',
    `${activeStatusPanelHeight.value}px`
  );
});

function handleWeatherClick(event) {
  showWeatherModal.value = true;
  event.stopPropagation();
  event.preventDefault();
}

function handleLogClick(event) {
  showLogModal.value = true;
  event.stopPropagation();
  event.preventDefault();
}

function handleProgressClick() {
  statusBarStore.togglePanel('progress');
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
