<template>
  <!-- flow-root: without a BFC the stage's top/bottom margins collapse through
       to this frame div, which then starts below the SubNav — exposing the raw
       html background as a stripe between the bars and the stage. -->
  <div ref="frameEl" class="dark min-h-screen flow-root text-white" :class="frameColor">
    <div :class="appLayoutClasses">
      <!-- Navigation -->
      <nav>
        <div :class="navContainerClasses">
          <NavigationComp />
        </div>
      </nav>
      <!-- Logo Splash Screen -->
      <Transition name="splash">
        <div
          v-if="shouldShowConnectionSplash"
          class="fixed inset-0 z-40 flex flex-col items-center justify-center bg-gray-900 p-4"
        >
          <!-- Reconnect status: calm spinner-only while just lost, escalates to a
               fuller message + actions after a few seconds (connectionPhase) -->
          <div
            v-if="connectionPhase !== 'hidden'"
            class="absolute top-16 flex flex-col items-center gap-3"
          >
            <div
              class="w-8 h-8 border-4 border-t-transparent border-solid rounded-full animate-spin"
              :class="connectionIsStalled ? 'border-amber-400' : 'border-blue-400'"
            ></div>

            <p
              v-if="connectionPhase === 'connecting'"
              class="text-gray-300 text-sm sm:text-base font-medium text-center"
            >
              {{ connectionConnectingMessage }}
            </p>

            <p
              v-if="connectionPhase === 'attention'"
              class="text-sm sm:text-base font-medium bg-gray-800 px-4 py-2 rounded-lg max-w-[calc(100%-2rem)] text-center"
              :class="
                connectionIsStalled
                  ? 'text-amber-300 border border-amber-500/30'
                  : 'text-blue-300 border border-blue-500/30'
              "
            >
              {{ connectionAttentionMessage }}
            </p>

            <div v-if="connectionPhase === 'attention'" class="text-center">
              <button
                v-if="!showConnectionDetails"
                @click="showConnectionDetails = true"
                class="text-xs text-gray-400 hover:text-gray-300 underline"
              >
                {{ $t('app.connection_splash.show_details') }}
              </button>
              <p v-else class="text-xs text-gray-400 mt-1">
                {{
                  $t('app.connection_splash.details', {
                    endpoint: connectionTargetLabel,
                    elapsed: connectionElapsedSeconds,
                  })
                }}
              </p>
            </div>
          </div>

          <!-- Actions: only once we've escalated to the attention phase -->
          <div
            v-if="connectionPhase === 'attention'"
            class="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-3"
          >
            <button
              @click="retryConnectionNow"
              class="px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm sm:text-base rounded-lg transition-colors flex items-center gap-2"
            >
              {{ $t('app.connection_splash.retry_now') }}
            </button>
            <button
              @click="showSettingsModal = true"
              class="px-4 py-2 sm:px-6 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm sm:text-base rounded-lg border border-gray-600 hover:border-gray-500 transition-colors flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 sm:h-5 sm:w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {{ $t('components.settings.title') }}
            </button>
          </div>

          <h1 class="text-3xl sm:text-4xl md:text-5xl text-yellow-50 font-mono font-bold mb-4">
            {{ $t('app.title') }}
          </h1>
          <img
            class="w-72 h-72"
            src="@/assets/Logo_TouchNStars_600x600.png"
            alt="TouchNStars Logo"
          />
        </div>
      </Transition>

      <!-- Keep the sky viewer outside the splash-gated subtree so reconnects do
           not discard its catalogue and view state. The splash covers it while
           disconnected, and the viewer lifecycle pauses rendering when hidden. -->
      <SkyAtlasView
        v-if="settingsStore.setupCompleted && skyAtlasMounted"
        v-show="store.showSkyAtlas"
      />
      <div v-if="!shouldShowConnectionSplash" :class="stageClasses" :style="stageStyle">
        <div class="container mx-auto px-3 py-4">
          <router-view v-show="!store.showSkyAtlas" :key="routerViewKey" />
        </div>
      </div>
      <!-- Fixed frame mask: paints the frame with a rounded window punched out
           (huge box-shadow), so the stage corners stay pinned to the viewport
           while the content sheet scrolls beneath. Sits above stage content
           (z-5) but below full-bleed views and all bars/overlays (z-10+). -->
      <div
        v-if="!shouldShowConnectionSplash && !store.showSkyAtlas"
        class="stage-frame"
        :style="stageFrameStyle"
      ></div>
      <!-- Footer -->
      <div v-if="settingsStore.setupCompleted" :class="statusBarClasses">
        <StatusBar />
      </div>
    </div>

    <!-- Logs Modal -->
    <div
      v-if="showLogsModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div
        class="bg-gray-900 rounded-lg p-4 sm:p-6 w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-0 scrollbar-hide"
      >
        <button
          @click="showLogsModal = false"
          class="fixed sm:absolute top-2 right-2 sm:top-4 sm:right-4 p-2 text-gray-400 hover:text-white bg-gray-900 rounded-full"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
    <!-- Tutorial Modal -->
    <TutorialModal v-if="showTutorial" :steps="tutorialSteps" @close="closeTutorial" />
    <!-- First-run setup wizard (cancellable) -->
    <SetupWizard v-if="showSetupWizard" @close="closeSetupWizard" />
    <!-- Error Modal -->
    <ToastModal v-if="settingsStore.setupCompleted || store.setupCheckConnectionDone" />
    <!-- Debug Console -->
    <ConsoleViewer class="fixed top-32 right-6 z-60" v-if="settingsStore.showDebugConsole" />
    <!-- LocationSyncModal -->
    <LocationSyncModal />

    <!-- PINS Upgrade Blocking Modal -->
    <Modal
      :show="pinsStore.shouldShowUpgradeOverlay"
      maxWidth="max-w-lg"
      :disableClose="true"
      :closeOnBackdropClick="false"
      zIndex="z-[80]"
    >
      <template #header>
        <h2 class="text-xl font-bold text-blue-300">
          {{ $t('plugins.pins.upgradeOverlay.title') }}
        </h2>
      </template>
      <template #body>
        <div class="flex flex-col items-center text-center gap-4 w-full">
          <svg
            class="h-10 w-10 text-blue-400"
            :class="pinsStore.isUpgradeRunning ? 'animate-spin' : 'animate-pulse'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p class="text-gray-200 text-sm sm:text-base">
            {{ pinsUpgradeOverlayMessage }}
          </p>
          <p class="text-xs text-gray-400">
            {{ $t('plugins.pins.upgradeOverlay.keepOpen') }}
          </p>
          <p v-if="pinsStore.currentJobId" class="text-xs text-blue-300 font-mono break-all">
            {{ $t('plugins.pins.upgradeOverlay.jobId', { jobId: pinsStore.currentJobId }) }}
          </p>
          <button
            @click="closePinsUpgradeOverlay"
            class="mt-2 px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-600 hover:border-gray-400 rounded transition-colors"
          >
            {{ $t('plugins.pins.upgradeOverlay.close') }}
          </button>
        </div>
      </template>
    </Modal>

    <!-- Update Available Modal -->
    <UpdateAvailableModal
      v-if="showUpdateModal && updateInfo"
      :version="updateInfo.version"
      :release-notes="updateInfo.notes"
      :whats-new="updateInfo.whatsNew"
      :progress="updateProgress"
      :status="updateStatus"
      :error="updateError"
      :is-downgrade="updateInfo.isDowngrade || false"
      @confirm="handleUpdateConfirm"
      @cancel="handleUpdateCancel"
    />

    <!-- What's New Modal -->
    <WhatsNewModal
      v-if="showWhatsNew && whatsNewData"
      :data="whatsNewData"
      @close="dismissWhatsNew"
    />

    <!-- Dialog Modal -->
    <DialogModal />

    <!-- MessageBox Modal -->
    <MessageBoxModal />

    <!-- Picker Overlay Component -->
    <PickerOverlay />

    <!-- Screen Lock Overlay (screen-lock plugin) - sits above every other
         layer, see z-lock in tailwind.config.cjs -->
    <ScreenLockOverlay v-if="screenLockActive" />

    <!-- PINS Time Warning Modal -->
    <Modal
      :show="showTimeWarningModal"
      @close="showTimeWarningModal = false"
      maxWidth="max-w-md"
      :closeOnBackdropClick="false"
    >
      <template #header>
        <h2 class="text-xl font-bold text-yellow-400">
          {{ $t('plugins.pins.timeWarning.title') }}
        </h2>
      </template>
      <template #body>
        <div class="flex flex-col gap-4 w-full text-sm">
          <p class="text-gray-300">
            {{
              $t('plugins.pins.timeWarning.message', {
                clientTime: timeWarningClientTime,
                deviceTime: timeWarningDeviceTime,
              })
            }}
          </p>
          <button
            @click="
              syncPinsTimeToClient();
              showTimeWarningModal = false;
            "
            class="w-full py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
          >
            {{ $t('plugins.pins.timeWarning.setTime') }}
          </button>
          <label class="flex items-center gap-2 cursor-pointer text-gray-300">
            <input
              type="checkbox"
              :checked="pinsStore.suppressTimeWarning"
              @change="pinsStore.setSuppressTimeWarning($event.target.checked)"
              class="w-4 h-4"
            />
            <span>{{ $t('plugins.pins.timeWarning.suppress') }}</span>
          </label>
          <button
            @click="showTimeWarningModal = false"
            class="w-full py-2 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            {{ $t('plugins.pins.timeWarning.dismiss') }}
          </button>
        </div>
      </template>
    </Modal>

    <!-- Settings Modal -->
    <Modal
      :show="showSettingsModal"
      @close="showSettingsModal = false"
      maxWidth="max-w-4xl"
      zIndex="z-top"
    >
      <template #header>
        <h2 class="text-xl font-bold text-white">{{ $t('components.settings.title') }}</h2>
      </template>
      <template #body>
        <SettingsComp />
      </template>
    </Modal>
  </div>
</template>

<script setup>
import {
  defineAsyncComponent,
  ref,
  onMounted,
  onBeforeUnmount,
  computed,
  watch,
  nextTick,
} from 'vue';
import axios from 'axios';
import { apiStore } from '@/store/store';
import {
  loadSeenProfileIds,
  profileHasEquipment,
  shouldOfferWizardForProfile,
} from '@/utils/setupWizardProfile';
import { useImagetStore } from './store/imageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useHead } from '@unhead/vue';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { KeepAwake } from '@capacitor-community/keep-awake';
import NavigationComp from '@/components/NavigationComp.vue';
import { useLogStore } from '@/store/logStore';
import { useSequenceStore } from './store/sequenceStore';
import { useCameraStore } from './store/cameraStore';
import { useDialogStore } from './store/dialogStore';
import { useMessageboxStore } from './store/messageboxStore';
import { usePickerStore } from '@/store/pickerStore';
import { useI18n } from 'vue-i18n';
import ToastModal from '@/components/helpers/ToastModal.vue';
import StatusBar from '@/components/status/StatusBar.vue';
import LocationSyncModal from '@/components/helpers/LocationSyncModal.vue';
import { useOrientation } from '@/composables/useOrientation';
import { useRoute } from 'vue-router';
import DialogModal from '@/components/helpers/DialogModal.vue';
import MessageBoxModal from '@/components/helpers/MessageBoxModal.vue';
import PickerOverlay from '@/components/helpers/PickerOverlay.vue';
import Modal from '@/components/helpers/Modal.vue';
import { usePinsStore } from '@/plugins/pins/store/pinsStore';
import { useFlatassistantStore } from '@/store/flatassistantStore';
import { useGuiderStore } from '@/store/guiderStore';
import { usePinsDeviceStore } from '@/plugins/pinsDevices/store/pinsDevicesStore';
import { useImageMonitorStore } from '@/plugins/multi-image-monitor/store/imageMonitorStore';
import { usePinsAllSkyStore } from '@/plugins/pins-allsky/store/pinsAllskyStore';
import { useNightSummaryStore } from '@/plugins/nightsummary/store/nightsummaryStore';
import websocketChannelService from '@/services/websocketChannelSocket';
import websocketTppaService from '@/services/websocketTppa';
import websocketMountControlService from '@/services/websocketMountControl';
import {
  checkForManualUpdate,
  downloadAndApplyUpdate,
  fetchChangelogWhatsNew,
  getPreferredUpdateChannel,
  isNativePlatform,
  syncNativeUpdateChannel,
} from '@/services/updateService';
import { getDeviceDateTimePayload, parsePinsTimeToSeconds } from '@/utils/pinsTimeUtils';
import { abortInFlightRequests } from '@/utils/httpLifecycle';
import { setAppBackgrounded, useBackgroundAwarePolling } from '@/utils/appLifecycle';
import { setLocaleLanguage } from '@/i18n';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useToastStore } from '@/store/toastStore';
import { PINS_PORT, DEFAULT_PINS_DAEMON_API_TOKEN as PINS_TOKEN } from '@/services/pinsConfig';
import apiPinsService from '@/services/apiPinsService';
import { createUnderVoltageNotifier } from '@/plugins/systemmetrics/services/underVoltageNotifier';
import { usePluginStore } from '@/store/pluginStore';

const SkyAtlasView = defineAsyncComponent(() => import('./views/CelestiaAtlasView.vue'));
const TutorialModal = defineAsyncComponent(() => import('@/components/TutorialModal.vue'));
const SetupWizard = defineAsyncComponent(() => import('@/components/setupWizard/SetupWizard.vue'));
const ConsoleViewer = defineAsyncComponent(() => import('@/components/helpers/ConsoleViewer.vue'));
const SettingsComp = defineAsyncComponent(() => import('@/components/SettingsComp.vue'));
const WhatsNewModal = defineAsyncComponent(() => import('@/components/helpers/WhatsNewModal.vue'));
const UpdateAvailableModal = defineAsyncComponent(
  () => import('@/components/helpers/UpdateAvailableModal.vue')
);
const ScreenLockOverlay = defineAsyncComponent(
  () => import('@/plugins/screen-lock/components/ScreenLockOverlay.vue')
);

const store = apiStore();
const settingsStore = useSettingsStore();
const toastStore = useToastStore();
const pinsStore = usePinsStore();
const nightSummaryStore = useNightSummaryStore();
const route = useRoute();
const pluginStore = usePluginStore();
const skyAtlasMounted = ref(Boolean(store.showSkyAtlas));

// The lock only exists while its plugin is on. Rendering on the combined
// condition and clearing the persisted flag when the plugin is switched off
// makes it impossible to end up in a state that locks the user out.
const isScreenLockPluginEnabled = computed(
  () => pluginStore.plugins.find((plugin) => plugin.id === 'screen-lock')?.enabled === true
);
const screenLockActive = computed(
  () => settingsStore.screenLock.active && isScreenLockPluginEnabled.value
);
watch(isScreenLockPluginEnabled, (enabled) => {
  if (!enabled) settingsStore.unlockScreen();
});

watch(
  () => store.showSkyAtlas,
  (visible) => {
    if (visible) skyAtlasMounted.value = true;
  },
  { immediate: true }
);

const showTimeWarningModal = ref(false);
let appStateListenerHandle = null;
const timeWarningClientTime = ref('');
const timeWarningDeviceTime = ref('');

async function checkPinsTimeMismatch() {
  if (pinsStore.suppressTimeWarning) return;
  const ip = settingsStore.connection.ip || window.location.hostname;
  if (!ip) return;
  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.get(`http://${ip}:${PINS_PORT}/system/time`, {
      headers: { Authorization: `Bearer ${PINS_TOKEN}` },
      timeout: 5000,
    });
    const deviceTimestamp = parsePinsTimeToSeconds(response.data);
    if (deviceTimestamp !== null) {
      const clientTimestamp = Date.now() / 1000;
      const diff = Math.abs(deviceTimestamp - clientTimestamp);
      if (diff > 60) {
        timeWarningClientTime.value = new Date(clientTimestamp * 1000).toLocaleTimeString();
        timeWarningDeviceTime.value = new Date(deviceTimestamp * 1000).toLocaleTimeString();
        showTimeWarningModal.value = true;
      }
    }
  } catch (e) {
    console.warn('[TimeWarning] Could not fetch PINS time:', e.message);
  }
}

async function syncPinsTimeToClient() {
  const ip = settingsStore.connection.ip || window.location.hostname;
  if (!ip) return;
  try {
    const directAxios = axios.create({ headers: {} });
    const payload = getDeviceDateTimePayload();
    await directAxios.post(`http://${ip}:${PINS_PORT}/system/time`, payload, {
      headers: {
        Authorization: `Bearer ${PINS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
  } catch (e) {
    console.warn('[TimeWarning] Could not set PINS time:', e.message);
  }
}

watch(
  () => store.isPINS,
  (isPINS) => {
    if (isPINS) {
      setTimeout(checkPinsTimeMismatch, 3000);
    }
  }
);
const sequenceStore = useSequenceStore();
const logStore = useLogStore();
const flatsStore = useFlatassistantStore();
const guiderStore = useGuiderStore();
const pinsDeviceStore = usePinsDeviceStore();
const imageMonitorStore = useImageMonitorStore();
const sequenceV2Store = useSequenceV2Store();
const pinsAllSkyStore = usePinsAllSkyStore();

// Global flat run outcome — fires regardless of which page is active.
// prevRun !== null guard mirrors the original page watcher: first setter wins,
// so fetchFlatsInfos (Running-state values) beats waitForCompletion (Finished-state
// values which NINA may zero out).
watch(
  () => flatsStore.lastRun,
  (run, prevRun) => {
    if (!run || prevRun !== null) return;
    flatsStore.commitRunOutcome(run);
  }
);
const cameraStore = useCameraStore();
const dialogStore = useDialogStore();
const messageboxStore = useMessageboxStore();
const imageStore = useImagetStore();
const showLogsModal = ref(false);
const showTutorial = ref(false);
const showSplashScreen = ref(true);
const showSettingsModal = ref(false);
const showWhatsNew = ref(false);
const whatsNewData = ref(null);
const whatsNewPending = ref(false);
const showSetupWizard = ref(false);
// "Remind me later" must hold for this session even though isPINS can flip back
// and forth while the backend reconnects.
const setupWizardDismissed = ref(false);
const connectionCheckCompleted = ref(false);
const { t } = useI18n();
const PINS_POWER_STATUS_INTERVAL_MS = 5 * 60 * 1000;
const pinsPowerMonitoringActive = computed(() => store.isPINS && store.closeErrorModal);
const notifyUnderVoltage = createUnderVoltageNotifier({
  showToast: (toast) => toastStore.showToast(toast),
  translate: t,
});

const checkPinsPowerStatus = async () => {
  if (!store.isPINS) {
    return;
  }

  const powerStatus = await apiPinsService.fetchSystemPowerStatus();
  if (powerStatus) {
    notifyUnderVoltage(powerStatus, true);
  }
};

watch(pinsPowerMonitoringActive, (active) => {
  if (!active) {
    notifyUnderVoltage(null, false);
  }
});

useBackgroundAwarePolling(
  checkPinsPowerStatus,
  PINS_POWER_STATUS_INTERVAL_MS,
  pinsPowerMonitoringActive,
  { immediate: true }
);
// Reconnecting after being backgrounded routinely takes up to ~12s on its own (Android
// radio/network wake-up after Doze, see websocketChannelSocket reconnect timing) - that
// is normal, not a stall. CONNECTION_STALL_HINT_SECONDS must stay comfortably above that
// so the "this may indicate a problem" wording only kicks in once it's genuinely unusual.
const CONNECTION_STALL_HINT_SECONDS = 15;
const CONNECTION_ATTENTION_THRESHOLD_SECONDS = 3;
// Short grace period before the reconnect overlay actually renders. isBackendReachable
// flips false immediately on every resume (even ones that recover in well under a
// second), so without this a near-instant reconnect would still flash the full-screen
// overlay (which hides the whole app content, not just a status line) briefly.
const RECONNECT_SPLASH_GRACE_MS = 300;
const connectionAttemptStartedAt = ref(Date.now());
const connectionElapsedSeconds = ref(0);
const showConnectionDetails = ref(false);
const showReconnectOverlay = ref(false);
let connectionElapsedIntervalId = null;
let reconnectSplashGraceTimer = null;
const tutorialSteps = computed(() => settingsStore.tutorial.steps);
const orientation = ref(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
const routerViewKey = ref(Date.now());
const showUpdateModal = ref(false);
const updateInfo = ref(null);
const updateStatus = ref('idle');
const updateProgress = ref(0);
const updateError = ref('');
const dismissedUpdateVersion = ref(null);
const checkingUpdate = ref(false);
let initialWidth = window.innerWidth;
let initialHeight = window.innerHeight;
let pinsUpgradeRecoveryTimer = null;

// Orientation tracking
const { isLandscape } = useOrientation();

useHead({
  title: 'TouchNStars',
});

function updateOrientation() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Check if width and height changed significantly
  if (Math.abs(width - initialWidth) > 100 && Math.abs(height - initialHeight) > 100) {
    const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';

    if (newOrientation !== orientation.value) {
      orientation.value = newOrientation;
      routerViewKey.value = Date.now();
      console.log('Orientation changed, re-rendering router-view:', newOrientation);
    }

    initialWidth = width;
    initialHeight = height;
  }
}

// Computed classes for responsive layout
const appLayoutClasses = computed(() => ({
  'app-portrait': !isLandscape.value,
  'app-landscape': isLandscape.value,
}));

// Fixed frame surface color, independent of the selected instance.
const frameColor = 'bg-gray-900/95';

const navContainerClasses = computed(() => ({
  'z-20 fixed top-0 w-full': !isLandscape.value,
  'z-20 fixed left-0 top-0 h-full': isLandscape.value,
}));

// Content sheet ("stage") inset inside the unified bar frame; see
// LAYOUT-BUEHNE-UMSETZUNGSPLAN.md. It scrolls with the page (no own scroll
// container) - its top corners intentionally slide under the navbar/statusbar
// while scrolling.
// The sheet itself is square — rounding and border are drawn by the fixed
// .stage-frame mask so the corners stay pinned while the sheet scrolls.
const stageClasses = computed(() => ({
  'bg-ground transition-all': true,
  'mt-[calc(82px+var(--subnav-offset))] mx-[var(--stage-inset)] mb-[calc(var(--statusbar-height)+env(safe-area-inset-bottom)+var(--stage-inset))]':
    !isLandscape.value,
  'ml-[calc(var(--nav-width)+var(--stage-inset))] mr-[var(--stage-inset)] mt-[calc(var(--stage-inset)+var(--subnav-offset))] mb-[calc(var(--statusbar-height)+var(--stage-inset))]':
    isLandscape.value,
}));

const stageStyle = computed(() => ({
  minHeight: isLandscape.value
    ? 'calc(100dvh - var(--stage-inset) - var(--subnav-offset) - var(--statusbar-height) - var(--stage-inset))'
    : 'calc(100dvh - 82px - var(--subnav-offset) - var(--statusbar-height) - env(safe-area-inset-bottom) - var(--stage-inset))',
}));

// Viewport rect of the frame mask — mirrors the stage margins, plus
// --status-panel-height so an open status-bar panel does not swallow the rounded
// bottom corners. The panels sit above the mask (they are children of the z-20
// bar container), so the window has to yield instead. The sheet keeps its
// margins and simply scrolls on beneath the panel.
const stageFrameStyle = computed(() =>
  isLandscape.value
    ? {
        top: 'calc(var(--stage-inset) + var(--subnav-offset))',
        left: 'calc(var(--nav-width) + var(--stage-inset))',
        right: 'var(--stage-inset)',
        bottom: 'calc(var(--statusbar-height) + var(--status-panel-height) + var(--stage-inset))',
      }
    : {
        top: 'calc(82px + var(--subnav-offset))',
        left: 'var(--stage-inset)',
        right: 'var(--stage-inset)',
        bottom:
          'calc(var(--statusbar-height) + env(safe-area-inset-bottom) + var(--status-panel-height) + var(--stage-inset))',
      }
);

// The frame mask paints with box-shadow, which needs a concrete color — read
// the instance color off the frame div at runtime (same technique as the nav
// scroll fades) and expose it as --frame-color for the mask.
const frameEl = ref(null);
function updateFrameColor() {
  nextTick(() => {
    const el = frameEl.value;
    if (!el) return;
    const bg = getComputedStyle(el).backgroundColor;
    if (bg) {
      el.style.setProperty('--frame-color', bg);
    }
  });
}
watch(frameColor, updateFrameColor);

const statusBarClasses = computed(() => ({
  'fixed bottom-0 w-full z-20': !isLandscape.value,
  'fixed bottom-0 left-(--nav-width) right-0 z-20': isLandscape.value,
}));

const shouldShowConnectionSplash = computed(() => {
  return (
    (showSplashScreen.value || (showReconnectOverlay.value && route.path !== '/settings')) &&
    // The setup wizard runs before an instance even exists, so "not connected"
    // is its normal state - the splash would just sit behind it.
    !showSetupWizard.value &&
    !pinsStore.shouldShowUpgradeOverlay
  );
});

const pinsUpgradeOverlayMessage = computed(() => {
  if (pinsStore.isUpgradeWaitingForBackend) {
    return t('plugins.pins.upgradeOverlay.waitingForApi');
  }
  return t('plugins.pins.upgradeOverlay.running');
});

const connectionTargetLabel = computed(() => {
  const host =
    settingsStore.connection.ip ||
    window.location.hostname ||
    t('app.connection_splash.configured_instance');
  const port = settingsStore.connection.port || 5000;
  return `${host}:${port}`;
});

const connectionInstanceName = computed(() => {
  const selectedId = settingsStore.selectedInstanceId;
  const selectedInstance = selectedId ? settingsStore.getInstance(selectedId) : null;
  return selectedInstance?.name || t('app.connection_splash.default_instance_name');
});

const connectionRemainingSeconds = computed(() => {
  return Math.max(CONNECTION_STALL_HINT_SECONDS - connectionElapsedSeconds.value, 0);
});

// 'hidden': backend reachable (or first-ever check still pending) - splash content
// stays hidden entirely. 'connecting': just lost the connection, show a calm spinner
// only - covers the common case of a brief background/foreground blip without ever
// showing an alarming error state. 'attention': still not reachable after a few
// seconds - now show the full message plus actionable buttons.
const connectionPhase = computed(() => {
  if (!connectionCheckCompleted.value || store.isBackendReachable) return 'hidden';
  return connectionElapsedSeconds.value < CONNECTION_ATTENTION_THRESHOLD_SECONDS
    ? 'connecting'
    : 'attention';
});

const connectionConnectingMessage = computed(() => t('app.connection_splash.connecting'));

// Only true once we're past the normal-reconnect window (CONNECTION_STALL_HINT_SECONDS) -
// drives both the wording and the color (blue/neutral while still within the expected
// up-to-~12s reconnect time, amber only once it's genuinely taking unusually long).
const connectionIsStalled = computed(
  () => connectionPhase.value === 'attention' && connectionRemainingSeconds.value === 0
);

const connectionAttentionMessage = computed(() => {
  if (connectionIsStalled.value) {
    return t('app.connection_splash.delayed', {
      instance: connectionInstanceName.value,
    });
  }

  return t('app.connection_splash.trying', {
    instance: connectionInstanceName.value,
  });
});

function resetConnectionAttemptTimer() {
  connectionAttemptStartedAt.value = Date.now();
  connectionElapsedSeconds.value = 0;
  showConnectionDetails.value = false;
}

function updateConnectionElapsed() {
  if (!connectionCheckCompleted.value || store.isBackendReachable) {
    return;
  }

  connectionElapsedSeconds.value = Math.floor(
    (Date.now() - connectionAttemptStartedAt.value) / 1000
  );
}

function startConnectionTimer() {
  if (!connectionElapsedIntervalId) {
    resetConnectionAttemptTimer();
    connectionElapsedIntervalId = setInterval(updateConnectionElapsed, 1000);
  }
  // Debounce the overlay itself: only actually show it once we've been unreachable for
  // RECONNECT_SPLASH_GRACE_MS, so a reconnect that resolves faster than that never
  // flashes the full-screen overlay at all.
  if (!reconnectSplashGraceTimer && !showReconnectOverlay.value) {
    reconnectSplashGraceTimer = setTimeout(() => {
      reconnectSplashGraceTimer = null;
      if (!store.isBackendReachable) {
        showReconnectOverlay.value = true;
      }
    }, RECONNECT_SPLASH_GRACE_MS);
  }
}

function stopConnectionTimer() {
  if (connectionElapsedIntervalId) {
    clearInterval(connectionElapsedIntervalId);
    connectionElapsedIntervalId = null;
  }
  if (reconnectSplashGraceTimer) {
    clearTimeout(reconnectSplashGraceTimer);
    reconnectSplashGraceTimer = null;
  }
  showReconnectOverlay.value = false;
}

function closePinsUpgradeOverlay() {
  if (pinsUpgradeRecoveryTimer) {
    clearTimeout(pinsUpgradeRecoveryTimer);
    pinsUpgradeRecoveryTimer = null;
  }
  pinsStore.resetUpgradeOverlay();
  try {
    window.localStorage.removeItem('lastUpgradeJobId');
    window.localStorage.removeItem('lastUpgradeJobResult');
  } catch {
    // Ignore storage cleanup errors.
  }
}

function finalizePinsUpgradeRecoveryIfReady() {
  if (!(pinsStore.isUpgradeWaitingForBackend && store.isBackendReachable)) {
    return;
  }

  if (pinsUpgradeRecoveryTimer) {
    clearTimeout(pinsUpgradeRecoveryTimer);
  }

  // Require a short stable reachable window before leaving the blocking overlay.
  pinsUpgradeRecoveryTimer = setTimeout(() => {
    if (pinsStore.isUpgradeWaitingForBackend && store.isBackendReachable) {
      pinsStore.finalizeUpgradeRecovery();
      try {
        window.localStorage.removeItem('lastUpgradeJobId');
        window.localStorage.removeItem('lastUpgradeJobResult');
      } catch {
        // Ignore storage cleanup errors.
      }
    }
    pinsUpgradeRecoveryTimer = null;
  }, 1500);
}

function handleOrientationChange() {
  setTimeout(() => {
    updateOrientation();
  }, 100);
}

// Global picker functions - delegated to PickerStore
const pickerStore = usePickerStore();

window.openPickerOverlay = (label, min, max, value, callback, decimalPlaces = 0) => {
  pickerStore.open(label, min, max, value, callback, decimalPlaces);
};

window.getPickerValue = () => {
  return pickerStore.getValueFromDigits();
};

window.closePickerOverlay = () => {
  pickerStore.close();
};

// Lifecycle re-entrancy guards: on mobile, multiple triggers (Capacitor
// resume/appStateChange + DOM visibilitychange/pageshow/focus) can fire almost
// simultaneously. Without guarding, several concurrent resumeApp() runs race each
// other's socket connect() calls and cause reconnect churn.
let isResuming = false;
let isPaused = false;
let resumeDebounceId = null;
// Set when resumeApp() fires while a previous performResume() is still stuck
// (e.g. a slow fetchAllInfos() retry loop after a network hiccup). Without this,
// that later resume trigger would just be dropped by the isResuming guard below,
// leaving the app permanently disconnected even after coming back to foreground.
let resumePending = false;
const RESUME_DEBOUNCE_MS = 300;
// guiderStore's and pinsDeviceStore's pollers are normally owned by their
// respective view's mount lifecycle (only running while that view is open),
// not started globally like the other stores. Track whether they were
// actually running at pause time so resume only restarts them when their
// view was open, instead of starting a poller for a view that isn't mounted.
let wasGuiderFetchingBeforePause = false;
let wasPinsDevicePollingBeforePause = false;
let wasSequenceV2PollingBeforePause = false;
let wasDarkLibraryBuildPollingBeforePause = false;
let wasPinsAllSkyPollingBeforePause = false;

function pauseApp() {
  // Cancel any pending resume so a quick background->foreground->background does
  // not leave a scheduled resume running after we already paused.
  if (resumeDebounceId) {
    clearTimeout(resumeDebounceId);
    resumeDebounceId = null;
  }
  // Checked by performResume() after each await so a pause that lands mid-resume
  // (long async chain: fetchAllInfos, checkForPINS, SignalR init...) still wins —
  // otherwise performResume() would restart all intervals after we already paused.
  isPaused = true;
  // Flip the shared background flag so any useBackgroundAwarePolling() consumer
  // (see src/utils/appLifecycle.js) pauses itself without needing to be listed here.
  setAppBackgrounded(true);
  console.log('App paused, stopping all intervals...');
  store.stopFetchingInfo();
  logStore.stopFetchingLog();
  sequenceStore.stopFetching();
  flatsStore.stopFetchingFlats();
  cameraStore.stopCountdown();
  dialogStore.stopPolling();
  wasGuiderFetchingBeforePause = guiderStore.isFetchingGraph();
  guiderStore.stopFetching();
  wasDarkLibraryBuildPollingBeforePause = guiderStore.isDarkLibraryBuildPolling();
  guiderStore.stopDarkLibraryBuildPolling();
  wasPinsDevicePollingBeforePause = pinsDeviceStore.isFetchingDevices();
  pinsDeviceStore.stopPolling();
  wasSequenceV2PollingBeforePause = sequenceV2Store.isFetching();
  sequenceV2Store.stopPolling();
  wasPinsAllSkyPollingBeforePause = pinsAllSkyStore.isPolling();
  pinsAllSkyStore.stopPolling();
  // imageMonitorStore already tracks paused cameras internally (it also has its
  // own visibilitychange listener), so this call is a safe no-op if nothing is
  // running or if visibilitychange already paused it - it exists so the
  // canonical native appStateChange trigger covers it too.
  imageMonitorStore.pauseAllAutoRefresh();
  // Keine States zurücksetzen - UI bleibt erhalten
}

// Debounced entry point: collapses the burst of resume triggers into a single
// reconnect run. The actual work lives in performResume().
function resumeApp() {
  // Reflect the foreground state immediately (not just once performResume() runs) so
  // a stale run's isPaused check — and the resumePending replay in its finally block —
  // see the current state even if this trigger itself gets swallowed by the isResuming
  // guard below.
  isPaused = false;
  setAppBackgrounded(false);
  if (resumeDebounceId) {
    clearTimeout(resumeDebounceId);
  }
  resumeDebounceId = setTimeout(() => {
    resumeDebounceId = null;
    void performResume();
  }, RESUME_DEBOUNCE_MS);
}

// Manual "Retry now" trigger from the connection splash. performResume() is already
// re-entrancy-guarded (isResuming/resumePending) and sets isBackendReachable = false
// itself, so calling it directly here is safe. Resetting the timer first drops the
// splash back to the calm "connecting" phase immediately instead of staying on the
// attention view while the new attempt is in flight.
function retryConnectionNow() {
  resetConnectionAttemptTimer();
  void performResume();
}

async function performResume() {
  // Re-entrancy guard: don't run overlapping resume attempts, but remember that
  // one was requested so it can be replayed once the in-flight run finishes.
  if (isResuming) {
    console.log('App resume already in progress, queueing follow-up resume');
    resumePending = true;
    return;
  }
  isResuming = true;
  isPaused = false;
  // The last known reachable state is stale after being backgrounded - show the
  // reconnect splash immediately instead of leaving the (possibly outdated) page up
  // for a few seconds until the first poll tick notices the connection is actually
  // gone. It clears itself again via fetchAllInfos() once fresh data confirms we're
  // really back.
  store.isBackendReachable = false;
  try {
    console.log('App resumed, restarting intervals...');

    // Set flag for recently returned from background
    store.setPageReturnedFromBackground();

    // Force-close any channel socket that may have been silently killed by the OS
    // while backgrounded (a half-open "zombie" socket can still report readyState
    // OPEN, which would make fetchAllInfos skip the reconnect). disconnect() clears
    // shouldReconnect, so we re-enable it right after to allow a fresh connect.
    websocketChannelService.disconnect();
    websocketChannelService.shouldReconnect = true;

    // Same for the TPPA/mount sockets, which reconnect via their internal loop
    // instead of fetchAllInfos: drop any backoff built up while backgrounded
    // (every dial failed -> maxed out at 10s) and redial now. No-op when the
    // respective socket was disconnected on purpose.
    websocketTppaService.resumeAfterBackground();
    websocketMountControlService.resumeAfterBackground();

    // Kill all HTTP requests still in flight from before the background phase.
    // Their TCP connections are likely dead (Android cuts them), but they hog
    // the browser's ~6 connection slots per host until they time out - the
    // reconnect probes below would queue behind them for many seconds.
    abortInFlightRequests();

    await store.fetchAllInfos(t);
    // The app may have been paused again while we were awaiting above (long async
    // chain racing a quick foreground->background). Bail out instead of restarting
    // intervals pauseApp() already stopped.
    if (isPaused) return;
    store.startFetchingInfo(t);
    logStore.startFetchingLog();
    // Only restart the guider graph poller if the guiding view was actually
    // open when we paused - otherwise this would start polling for a view
    // that isn't mounted (GuiderGraph.vue normally owns this via its own
    // onMounted/onBeforeUnmount).
    if (wasGuiderFetchingBeforePause) {
      guiderStore.startFetching();
    }
    if (wasDarkLibraryBuildPollingBeforePause) {
      guiderStore.startDarkLibraryBuildPolling();
    }
    // Same reasoning as guiderStore above: only resume if the PINS devices
    // view was actually open when we paused.
    if (wasPinsDevicePollingBeforePause) {
      pinsDeviceStore.startPolling();
    }
    // Same reasoning: only resume if the sequence editor view was actually
    // open when we paused (sequenceV2Store's polling is otherwise owned by
    // SequenceCurrentView.vue's own onMounted/onUnmounted).
    if (wasSequenceV2PollingBeforePause) {
      sequenceV2Store.startPolling();
    }
    // Same reasoning: only resume if the AllSky view was actually open when we paused.
    if (wasPinsAllSkyPollingBeforePause) {
      pinsAllSkyStore.startPolling();
    }
    if (imageMonitorStore.hasPausedCameras()) {
      imageMonitorStore.resumeAllAutoRefresh();
    }

    // Initialize dialog updates based on mode
    if (store.isPINS) {
      // PINS/Headless mode: Use SignalR for real-time updates
      await dialogStore.initializeDialogSignalR();
      await messageboxStore.initializeMessageboxSignalR();
      if (isPaused) return;
      flatsStore.startFetchingFlats();
    } else {
      // WPF mode: Use polling
      dialogStore.startPolling();
    }

    // Clear any stale in-flight fetch flags from before the pause — connections
    // killed by the OS in background would otherwise leave isImageFetching stuck true.
    imageStore.isImageFetching = false;
    imageStore.isSequenceImageFetching = false;
    imageStore.getImage();
    if (!sequenceStore.sequenceEdit) {
      sequenceStore.startFetching();
    }

    if (isNativePlatform()) {
      void checkForAppUpdate();
    }
  } finally {
    isResuming = false;
    // A resume was requested while this run was still busy. Replay it now,
    // unless we're paused again by the time we get here.
    if (resumePending) {
      resumePending = false;
      if (!isPaused) {
        void performResume();
      }
    }
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    pauseApp();
  } else {
    resumeApp();
  }
}

// pageshow/focus are redundant safety nets for a missed "we're visible again"
// transition, NOT resume triggers in their own right: performResume() drops
// isBackendReachable and refetches every store, which visibly tears the open page
// apart. Both therefore require that we actually paused - handleVisibilityChange
// and the native appStateChange listener set isPaused before either can fire.
// Without that guard any in-page focus change resumes the app; Sortable emits one
// on every drag, so reordering the navbar/status bar triggered a full reconnect.
function handlePageShow(event) {
  // pageshow is triggered faster than visibilitychange. A bfcache restore froze
  // the page without a visibilitychange, so it counts even if pauseApp() never ran.
  if (!document.hidden && (isPaused || event?.persisted)) {
    resumeApp();
  }
}

function handleFocus() {
  if (!document.hidden && isPaused) {
    resumeApp();
  }
}

async function checkForAppUpdate(options = {}) {
  // force = manually triggered check: offers the latest release of the current channel even if it
  // matches or is older than the installed one, and ignores a previously dismissed version.
  const { allowDowngrade = false, force = false } = options;

  if (!isNativePlatform() || checkingUpdate.value || showUpdateModal.value) {
    if (force) {
      // Nothing was started, so release the manual trigger right away.
      window.dispatchEvent(new CustomEvent('app-update-check-finished'));
    }
    return;
  }

  checkingUpdate.value = true;
  let updateOffered = false;
  let checkFailed = false;
  try {
    // Resolve currently active OTA bundle version first to avoid re-offering the same update.
    let currentBundleVersion;
    try {
      const current = await CapacitorUpdater.current();
      const versionFromBundle = current?.bundle?.version;
      currentBundleVersion =
        versionFromBundle && versionFromBundle !== 'builtin'
          ? versionFromBundle
          : current?.native || undefined;
    } catch (currentVersionError) {
      console.warn('Failed to resolve current bundle version in App.vue:', currentVersionError);
      currentBundleVersion = undefined;
    }

    const result = await checkForManualUpdate(currentBundleVersion, {
      allowDowngrade: allowDowngrade || force,
    });

    if (
      !force &&
      result?.available &&
      currentBundleVersion &&
      result.version === currentBundleVersion
    ) {
      // Extra guard in case update service fallback/version parsing returns a false positive.
      return;
    }

    if (result?.available && (force || result.version !== dismissedUpdateVersion.value)) {
      let whatsNewDetails = null;
      try {
        whatsNewDetails = await fetchChangelogWhatsNew(result);
        console.info('Update whats-new content resolved:', whatsNewDetails);
      } catch (whatsNewError) {
        console.warn('Failed to load whats-new content:', whatsNewError);
      }

      updateInfo.value = {
        ...result,
        whatsNew: whatsNewDetails,
      };
      updateStatus.value = 'idle';
      updateProgress.value = 0;
      updateError.value = '';
      showUpdateModal.value = true;
      updateOffered = true;
    }
  } catch (error) {
    console.warn('Update check failed:', error);
    checkFailed = true;
    if (force) {
      toastStore.showToast({
        type: 'error',
        title: t('updates.checkFailedTitle'),
        message: t('updates.error'),
      });
    }
  } finally {
    checkingUpdate.value = false;
    if (force) {
      if (!updateOffered && !checkFailed) {
        toastStore.showToast({
          type: 'info',
          title: t('updates.upToDateTitle'),
          message: t('updates.upToDateMessage'),
        });
      }
      // Let the manual trigger drop its busy state.
      window.dispatchEvent(new CustomEvent('app-update-check-finished'));
    }
  }
}

async function handleCheckAppUpdate(event) {
  console.log('Update check requested via channel switch');
  const channel = event?.detail?.channel ?? getPreferredUpdateChannel();

  if (event?.detail?.resetDismissed) {
    dismissedUpdateVersion.value = null;
    console.log('Cleared dismissed update version for channel switch');
  }

  if (event?.detail?.syncChannel) {
    await syncNativeUpdateChannel(channel, { triggerAutoUpdate: false });
  }

  if (isNativePlatform()) {
    showUpdateModal.value = false;
    updateInfo.value = null;
    updateStatus.value = 'idle';
    updateProgress.value = 0;
    updateError.value = '';

    // Allow downgrades when switching channels or when beta mode is selected.
    void checkForAppUpdate({ allowDowngrade: true, force: event?.detail?.force === true });
  }
}

async function handleUpdateConfirm() {
  if (!updateInfo.value || updateStatus.value === 'downloading') {
    return;
  }

  updateStatus.value = 'downloading';
  updateError.value = '';
  updateProgress.value = 0;

  try {
    await downloadAndApplyUpdate({
      version: updateInfo.value.version,
      downloadUrl: updateInfo.value.assetUrl,
      onProgress: (percent) => {
        if (Number.isFinite(percent)) {
          updateProgress.value = Math.min(100, Math.max(0, percent));
        }
      },
      onPreparing: () => {
        updateStatus.value = 'setting';
      },
    });
  } catch (error) {
    console.warn('Manual update failed:', error);
    updateStatus.value = 'error';
    const message = error?.message ? `${t('updates.error')} ${error.message}` : t('updates.error');
    updateError.value = message.trim();
  }
}

function handleUpdateCancel() {
  if (updateStatus.value === 'downloading' || updateStatus.value === 'setting') {
    return;
  }

  if (updateInfo.value?.version) {
    dismissedUpdateVersion.value = updateInfo.value.version;
  }

  showUpdateModal.value = false;
  updateStatus.value = 'idle';
  updateProgress.value = 0;
  updateError.value = '';
  updateInfo.value = null;
}

onMounted(async () => {
  updateFrameColor();
  window.addEventListener('resize', updateOrientation);
  window.addEventListener('orientationchange', handleOrientationChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pageshow', handlePageShow);
  window.addEventListener('focus', handleFocus);

  if (!store.isBackendReachable) {
    startConnectionTimer();
  }

  // Check for app update immediately - independent from backend status
  if (isNativePlatform()) {
    void checkForAppUpdate({ allowDowngrade: getPreferredUpdateChannel() === 'beta' });
  }

  // Capacitor App Lifecycle Events for mobile platforms.
  // Use only appStateChange as the canonical trigger; it covers both foreground
  // and background. Separate pause/resume listeners would be redundant and, since
  // resumeApp is now debounced, only add noise. pauseApp/resumeApp are internally
  // guarded against duplicate triggers.
  if (['android', 'ios'].includes(Capacitor.getPlatform())) {
    appStateListenerHandle = await CapacitorApp.addListener('appStateChange', (state) => {
      console.log('Capacitor App state change:', state.isActive);
      if (state.isActive) {
        resumeApp();
      } else {
        pauseApp();
      }
    });
  }

  window.addEventListener('check-app-update', handleCheckAppUpdate);

  // Timeout for connectionCheckCompleted after 3 seconds
  const connectionTimeout = setTimeout(() => {
    connectionCheckCompleted.value = true;
  }, 3000);

  await store.fetchAllInfos(t);
  // Connection check is completed after first connection attempt
  connectionCheckCompleted.value = true;
  clearTimeout(connectionTimeout);

  store.startFetchingInfo(t);
  logStore.startFetchingLog();

  // PINS detection already ran inside fetchAllInfos() above; see the resume
  // path's comment for why calling it again here is unsafe.

  // Initialize dialog updates based on mode
  if (store.isPINS) {
    // PINS/Headless mode: Use SignalR for real-time updates
    await dialogStore.initializeDialogSignalR();
    await messageboxStore.initializeMessageboxSignalR();
    flatsStore.startFetchingFlats();
  } else {
    // WPF mode: Use polling
    dialogStore.startPolling();
  }

  if (!sequenceStore.sequenceEdit) {
    sequenceStore.startFetching();
  }

  // Initialize language from settings store
  await setLocaleLanguage(settingsStore.getLanguage());

  // Show tutorial on first visit
  if (!settingsStore.tutorial.completed) {
    showTutorial.value = true;
  }

  // Initialize Keep Screen Awake for mobile platforms
  if (['android', 'ios'].includes(Capacitor.getPlatform())) {
    try {
      const res = await KeepAwake.isSupported();
      if (res?.isSupported && settingsStore.keepAwakeEnabled) {
        setTimeout(async () => {
          try {
            await KeepAwake.keepAwake();
            console.log('Keep Awake activated on app start');
          } catch (e) {
            console.warn('KeepAwake activation error:', e);
          }
        }, 1000);
      }
    } catch (e) {
      console.warn('KeepAwake support check failed:', e);
    }
  }

  // Load What's New content generated at build-time
  try {
    const res = await fetch('/whats-new.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      whatsNewData.value = data;
      const lastShownVersion = localStorage.getItem('tns.whatsnew.version');
      const shouldShow = data?.version && data.version !== lastShownVersion;
      if (shouldShow) {
        if (!showTutorial.value && !showSetupWizard.value) {
          showWhatsNew.value = true;
        } else {
          whatsNewPending.value = true;
        }
      }
    }
  } catch (e) {
    // silently ignore
  }
});

// Watch for backend connection and add delay before hiding splash screen
watch(
  () => store.isBackendReachable,
  async (isReachable, wasReachable) => {
    if (isReachable) {
      connectionElapsedSeconds.value = 0;
      showConnectionDetails.value = false;
      stopConnectionTimer();
    } else if (wasReachable) {
      startConnectionTimer();
    }

    if (isReachable && showSplashScreen.value) {
      setTimeout(() => {
        showSplashScreen.value = false;
      }, 200); // delay
    }

    // Re-initialize dialog and messagebox SignalR after an instance switch
    // (clearAllStates disconnects them; they don't auto-reconnect on their own)
    if (isReachable && store.isPINS) {
      await dialogStore.initializeDialogSignalR();
      await messageboxStore.initializeMessageboxSignalR();
    }

    // Re-initialize night summary plugin after an instance switch so it
    // fetches its status, settings, and sessions from the new backend.
    if (isReachable && store.isPINS) {
      nightSummaryStore.initialize();
    }

    if (isReachable) {
      finalizePinsUpgradeRecoveryIfReady();
    }
  }
);

watch(connectionCheckCompleted, (isCompleted) => {
  if (isCompleted) {
    updateConnectionElapsed();
  }
});

watch(
  () => pinsStore.isUpgradeWaitingForBackend,
  (isWaiting) => {
    if (isWaiting) {
      finalizePinsUpgradeRecoveryIfReady();
    }
  }
);

// Onboarding overlays run one at a time: setup wizard -> tutorial -> What's New.
// The wizard comes first because TutorialModal only renders once setupCompleted
// is true - and that is exactly what finishing or cancelling the wizard sets.
function releaseWhatsNew() {
  if (whatsNewPending.value && whatsNewData.value) {
    showWhatsNew.value = true;
    whatsNewPending.value = false;
  }
}

function closeTutorial() {
  showTutorial.value = false;
  settingsStore.completeTutorial();
  releaseWhatsNew();
}

function closeSetupWizard() {
  showSetupWizard.value = false;
  setupWizardDismissed.value = true;
  // The tutorial was already armed in onMounted but stayed invisible while
  // setupCompleted was false; now it takes over and releases What's New itself.
  if (showTutorial.value) return;
  releaseWhatsNew();
}

// Mirrored into the store so settingsStore._canReloadOnEndpointChange() can see
// it: changing the instance from inside the wizard must not reload the page.
watch(showSetupWizard, (isOpen) => settingsStore.setSetupWizardOpen(isOpen), { immediate: true });

watch(
  () => [settingsStore.setupWizard.completed, settingsStore.setupWizard.openRequest],
  ([completed, openRequest], [, previousRequest] = []) => {
    // resetSetupWizard() bumps openRequest, which is the only reliable "open it
    // now" signal: after a cancel the wizard is neither completed nor open, so
    // watching `completed` alone would never fire again.
    if (previousRequest !== undefined && openRequest > previousRequest) {
      setupWizardDismissed.value = false;
    }

    // No isPINS / setupCompleted condition: this is the first-run wizard now, so
    // it has to open before either of those can possibly be true.
    if (completed || showSetupWizard.value || setupWizardDismissed.value) return;
    showSetupWizard.value = true;
  },
  { immediate: true }
);

// PINS only: reopen the wizard for a new profile - a freshly flashed image or
// one added in the profile manager. The first-run pass has to be done first;
// it covers the same ground on its own.
watch(
  () => [store.isPINS, store.profileInfo],
  ([isPINS, profile]) => {
    if (!settingsStore.setupWizard.completed || showSetupWizard.value) return;
    const profileId = profile?.Id;
    const offer = shouldOfferWizardForProfile({
      isPINS,
      profileId,
      hasEquipment: profileHasEquipment(profile),
      seenIds: loadSeenProfileIds(),
    });
    if (offer) settingsStore.openSetupWizardForNewProfile(profileId);
  }
);

function dismissWhatsNew() {
  showWhatsNew.value = false;
  if (whatsNewData.value?.version) {
    localStorage.setItem('tns.whatsnew.version', whatsNewData.value.version);
  }
}

onBeforeUnmount(async () => {
  console.log('App.vue unmounted, cleaning up...');
  // Cancel any pending debounced resume so it cannot fire after teardown.
  if (resumeDebounceId) {
    clearTimeout(resumeDebounceId);
    resumeDebounceId = null;
  }
  store.stopFetchingInfo();
  logStore.stopFetchingLog();
  sequenceStore.stopFetching();
  flatsStore.stopFetchingFlats();

  stopConnectionTimer();

  if (pinsUpgradeRecoveryTimer) {
    clearTimeout(pinsUpgradeRecoveryTimer);
    pinsUpgradeRecoveryTimer = null;
  }

  // Stop dialog updates based on mode
  if (store.isPINS) {
    // Disconnect SignalR in PINS mode
    await dialogStore.disconnectDialogSignalR();
    await messageboxStore.disconnectMessageboxSignalR();
  } else {
    // Stop polling in WPF mode
    dialogStore.stopPolling();
  }

  store.clearAllStates();
  store.isApiConnected = false;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('pageshow', handlePageShow);
  window.removeEventListener('focus', handleFocus);
  window.removeEventListener('resize', updateOrientation);
  window.removeEventListener('orientationchange', handleOrientationChange);
  window.removeEventListener('check-app-update', handleCheckAppUpdate);

  // Remove Capacitor listeners
  if (['android', 'ios'].includes(Capacitor.getPlatform())) {
    await appStateListenerHandle?.remove();
    appStateListenerHandle = null;
  }
});
</script>

<style scoped>
/* Smooth Transitions */
.container {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Fixed frame mask around the stage: the huge box-shadow paints everything
   outside the rounded window in the frame color, pinning the corners to the
   viewport while the content sheet scrolls beneath. */
.stage-frame {
  position: fixed;
  z-index: 5;
  pointer-events: none;
  border-radius: var(--stage-radius);
  border: 1px solid var(--color-line);
  box-shadow: 0 0 0 200vmax var(--frame-color, rgba(17, 24, 39, 0.95));
  transition: all 150ms ease;
}

/* Splash Screen Transition */
.splash-enter-active {
  transition: opacity 0.3s ease-in;
}

.splash-leave-active {
  transition: opacity 0.3s ease-out;
}

.splash-enter-from,
.splash-leave-to {
  opacity: 0;
}

/* Fade Transition for Picker Overlay */
.fade-enter-active {
  transition: opacity 0.2s ease-in;
}

.fade-leave-active {
  transition: opacity 0.2s ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
