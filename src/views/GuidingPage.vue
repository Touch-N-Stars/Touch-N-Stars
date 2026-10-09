<template>
  <div>
    <!-- PINS native guider: rich page (frame, graph, stats, calibration, log, settings).
         Also shown while it is the selected but not yet connected guider, so the guide
         camera can be set up before the first connect. -->
    <NativeGuiderLayout v-if="isNativeGuider" />

    <!-- PHD2 Mode: New layout with image background -->
    <Phd2GuiderLayout
      v-else-if="store.guiderInfo.DeviceId === 'PHD2_Single'"
      v-model:tab="phd2Tab"
    />

    <!-- Non-PHD2 Mode: Original layout -->
    <template v-else>
      <div class="container max-w-3xl mx-auto p-4">
        <h5 class="text-xl text-center font-bold text-white mb-4">
          {{ $t('components.guider.title') }}
        </h5>
        <!-- PINS' guide camera slot, usable without a guider, e.g. to focus the guide camera -->
        <GuideCameraCard v-if="store.guideCameraInfo.Connected" class="mb-4" />
        <div
          v-if="!store.guiderInfo.Connected"
          class="p-4 bg-status-danger/10 border border-status-danger/30 rounded-card"
        >
          <p class="text-status-danger font-medium text-center">
            {{ $t('components.guider.notConnected') }}
          </p>
        </div>
        <div v-else>
          <!-- Original control buttons layout -->
          <div
            class="flex flex-col md:flex-row gap-1 md:space-x-4 mt-4 border border-line rounded-card bg-surface-1 shadow-lg p-5"
          >
            <ControlGuider />
          </div>

          <!-- Status Component -->
          <div class="mt-4">
            <GuiderStatus />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, h, ref, onMounted, onUnmounted, watch } from 'vue';
import { apiStore } from '@/store/store';
import { useStatusBarStore } from '@/store/statusBarStore';
import Phd2GuiderLayout from '@/components/guider/PHD2/Phd2GuiderLayout.vue';
import ControlGuider from '@/components/guider/ControlGuider.vue';
import GuiderStatus from '@/components/guider/GuiderStatus.vue';
import GuideCameraCard from '@/components/guider/GuideCameraCard.vue';
import AsyncLoadState from '@/components/helpers/AsyncLoadState.vue';
import { isNativeGuiderInUse } from '@/utils/nativeGuider';
import { useI18n } from 'vue-i18n';

// Loaded only in native mode, so PHD2 users don't download the native UI and its charts.
const NativeGuiderLayout = defineAsyncComponent({
  loader: () => import('@/components/guider/native/NativeGuiderLayout.vue'),
  // A slow or lost link to the rig must not leave the guider page blank.
  loadingComponent: AsyncLoadState,
  delay: 200,
  timeout: 30000,
  errorComponent: () =>
    h(AsyncLoadState, { failed: true, message: $t('components.guider.native.pageLoadFailed') }),
});

const store = apiStore();
const statusBarStore = useStatusBarStore();
const { t: $t } = useI18n();

const isNativeGuider = computed(() => isNativeGuiderInUse(store));

// Open the guider graph panel while on this page. Leaving restores the panel
// that was open before - unless the user switched panels in the meantime, then
// their choice stays. Panel changes made by the page itself are not user choices.
// The native guider page has its own graph and needs the height, so in native
// mode the panel is left alone.
let panelToRestore = null;
let stopPanelWatch = null;
let settingPanelFromPage = false;

function setPanelFromPage(id) {
  settingPanelFromPage = true;
  statusBarStore.activePanel = id;
  settingPanelFromPage = false;
}

// The PHD2 settings tab needs the room, so the guider graph is hidden there and
// shown again when returning to the guiding tab.
const phd2Tab = ref('showGuiding');
let graphHiddenForSettings = false;

watch(phd2Tab, (tab) => {
  if (tab === 'showSettings') {
    graphHiddenForSettings = statusBarStore.activePanel === 'guider';
    if (graphHiddenForSettings) setPanelFromPage(null);
  } else if (graphHiddenForSettings) {
    graphHiddenForSettings = false;
    if (statusBarStore.activePanel === null) setPanelFromPage('guider');
  }
});

function openGuiderPanel() {
  panelToRestore = statusBarStore.activePanel;
  setPanelFromPage('guider');

  stopPanelWatch = watch(
    () => statusBarStore.activePanel,
    (panel) => {
      if (!settingPanelFromPage) panelToRestore = panel;
    },
    { flush: 'sync' }
  );
}

function restorePanel() {
  stopPanelWatch();
  stopPanelWatch = null;
  statusBarStore.activePanel = panelToRestore;
}

onMounted(() => {
  if (!isNativeGuider.value) openGuiderPanel();

  // The mode can change on the page, e.g. when the profile loads after a reload here.
  watch(isNativeGuider, (native) => {
    if (native && stopPanelWatch) restorePanel();
    else if (!native && !stopPanelWatch) openGuiderPanel();
  });
});

onUnmounted(() => {
  if (stopPanelWatch) restorePanel();
});
</script>
