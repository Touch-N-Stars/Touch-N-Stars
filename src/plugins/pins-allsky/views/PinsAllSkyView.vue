<template>
  <div class="container py-8 sm:py-12 px-4">
    <div class="mx-auto max-w-7xl space-y-6">
      <section class="rounded-2xl border border-cyan-900/40 bg-gray-800/80 p-6 shadow-2xl">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white">{{ t('plugins.pinsAllSky.title') }}</h1>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2 self-start lg:ml-auto">
            <button
              type="button"
              :title="t('plugins.pinsAllSky.buttons.automation')"
              :aria-label="t('plugins.pinsAllSky.buttons.automation')"
              class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-100 transition hover:bg-cyan-500/20"
              @click="openSettingsModal('automation')"
            >
              <Cog6ToothIcon class="h-5 w-5" />
            </button>
            <button
              type="button"
              :title="t('plugins.pinsAllSky.buttons.camera')"
              :aria-label="t('plugins.pinsAllSky.buttons.camera')"
              class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-100 transition hover:bg-cyan-500/20"
              @click="openSettingsModal('camera')"
            >
              <CameraIcon class="h-5 w-5" />
            </button>
            <button
              type="button"
              :title="t('plugins.pinsAllSky.buttons.outputs')"
              :aria-label="t('plugins.pinsAllSky.buttons.outputs')"
              class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-100 transition hover:bg-cyan-500/20"
              @click="openSettingsModal('outputs')"
            >
              <PhotoIcon class="h-5 w-5" />
            </button>
            <button
              type="button"
              :title="t('plugins.pinsAllSky.buttons.showStatus')"
              :aria-label="t('plugins.pinsAllSky.buttons.showStatus')"
              class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-100 transition hover:bg-cyan-500/20"
              @click="showStatusModal = true"
            >
              <InformationCircleIcon class="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      <PinsAllSkyStatusModal
        :show="showStatusModal"
        :status-rows="statusRows"
        :backend-update-busy="backendUpdateBusy"
        :disable-update="backendUpdateBusy || status?.captureRunning || status?.generateInProgress"
        @close="showStatusModal = false"
        @update-backend="updateBackend"
      />

      <div
        v-if="showBackendSetupBanner"
        class="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-4 text-sm text-cyan-100"
      >
        <div class="font-semibold text-white">
          {{ t('plugins.pinsAllSky.banners.backendUnavailableTitle') }}
        </div>
        <p class="mt-1">
          {{ t('plugins.pinsAllSky.banners.backendUnavailableBody') }}
        </p>
        <div class="mt-3 text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
          {{ t('plugins.pinsAllSky.banners.backendUnavailableInstallLabel') }}
        </div>
        <pre
          class="mt-2 overflow-x-auto rounded-xl border border-cyan-500/20 bg-gray-950/70 px-4 py-3 text-xs text-cyan-50"
        ><code>{{ backendInstallCommands }}</code></pre>
      </div>

      <div
        v-else-if="error"
        class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
      >
        {{ error }}
      </div>

      <div
        v-if="backendError"
        class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      >
        {{ backendError }}
      </div>

      <div
        v-if="actionMessage"
        class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
      >
        {{ actionMessage }}
      </div>

      <div
        v-if="missingDependencies.length > 0"
        class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      >
        {{
          t('plugins.pinsAllSky.banners.missingRuntimeDependencies', {
            dependencies: missingDependencies.join(', '),
          })
        }}
      </div>

      <PinsAllSkySessionControls
        :manual-label="manualLabelInput"
        :default-manual-label="defaultManualLabel"
        :loading="loading"
        :status="status"
        :current-session="currentSession"
        :current-image-url="currentImageUrl"
        :config="config"
        :estimate-start-local="estimateWindow.startLocal"
        :estimate-end-local="estimateWindow.endLocal"
        :estimate-duration-label="estimateDurationLabel"
        :estimated-frame-count="estimatedFrameCount"
        :estimated-storage-bytes="estimatedStorageBytes"
        :estimate-exceeds-available="estimateExceedsAvailable"
        :estimate-warning="estimateWarning"
        :format-date="formatDate"
        :format-interval="formatInterval"
        :format-exposure="formatExposure"
        :format-gain="formatGain"
        :format-count="formatCount"
        :format-size="formatSize"
        :is-action-busy="isActionBusy"
        @update:manual-label="manualLabelInput = $event"
        @update:estimate-start-local="estimateWindow.startLocal = $event"
        @update:estimate-end-local="estimateWindow.endLocal = $event"
        @start-session="startSession"
        @generate-artifacts="generateArtifacts(currentSession?.id || null)"
        @stop-session="stopSession"
        @refresh-all="refreshAll"
      />

      <Modal
        :show="Boolean(settingsPanelComponent)"
        max-width="max-w-6xl"
        :disable-close="saving"
        :close-on-backdrop-click="!saving"
        @close="closeSettingsModal()"
      >
        <template #header>
          <h2 class="text-xl font-semibold text-white">{{ settingsModalTitle }}</h2>
        </template>

        <template #body>
          <div class="w-full">
            <component
              :is="settingsPanelComponent"
              v-if="settingsPanelComponent && config"
              v-bind="settingsPanelProps"
            />

            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                class="rounded-xl border border-gray-600 bg-gray-800/80 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-cyan-400 hover:text-white"
                :disabled="saving"
                @click="closeSettingsModal()"
              >
                {{ t('plugins.pinsAllSky.common.cancel') }}
              </button>
              <button
                type="button"
                class="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="saving"
                @click="saveSettingsModal"
              >
                {{
                  saving ? t('plugins.pinsAllSky.common.saving') : t('plugins.pinsAllSky.common.ok')
                }}
              </button>
            </div>
          </div>
        </template>
      </Modal>

      <PinsAllSkyRecentSessions
        :is-open="sectionOpen.recentSessions"
        :storage="storage"
        :recent-sessions="recentSessions"
        :cleanup-busy="cleanupBusy"
        :status="status"
        :current-session-id="currentSession?.id || null"
        :session-details-by-id="sessionDetailsById"
        :details-loading-by-id="detailsLoadingById"
        :session-detail-open="sessionDetailOpen"
        :is-action-busy="isActionBusy"
        :format-date="formatDate"
        :format-count="formatCount"
        :format-size="formatSize"
        :describe-artifact="describeArtifact"
        :format-session-reason="formatSessionReason"
        @toggle="toggleSection('recentSessions')"
        @delete-all="deleteAllSessions"
        @generate-artifacts="generateArtifacts($event)"
        @delete-session="deleteSession($event)"
        @toggle-session-details="toggleSessionDetails($event)"
        @refresh-session-details="refreshSessionDetails($event)"
        @download-file="downloadRelativePath($event.relativePath, $event.fallbackName || null)"
        @delete-artifact="deleteArtifact($event.session, $event.artifact)"
        @delete-frame="deleteFrame($event.session, $event.frame)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useToastStore } from '@/store/toastStore';
import {
  CameraIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
  PhotoIcon,
} from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import PinsAllSkyAutomationSettings from '../components/PinsAllSkyAutomationSettings.vue';
import PinsAllSkyCameraSettings from '../components/PinsAllSkyCameraSettings.vue';
import PinsAllSkyOutputsSettings from '../components/PinsAllSkyOutputsSettings.vue';
import PinsAllSkyRecentSessions from '../components/PinsAllSkyRecentSessions.vue';
import PinsAllSkySessionControls from '../components/PinsAllSkySessionControls.vue';
import PinsAllSkyStatusModal from '../components/PinsAllSkyStatusModal.vue';
import { usePinsAllSkyStore } from '../store/pinsAllskyStore';

const { t } = useI18n({ useScope: 'global' });
const toastStore = useToastStore();
const store = usePinsAllSkyStore();
const {
  status,
  config,
  error,
  loading,
  saving,
  cleanupBusy,
  backendUpdateBusy,
  actionMessage,
  currentImageUrl,
  sessionDetailsById,
  detailsLoadingById,
} = storeToRefs(store);

const sectionOpen = reactive({
  recentSessions: false,
});

const sessionDetailOpen = reactive({});
const estimateWindow = reactive({
  startLocal: '',
  endLocal: '',
});
const showStatusModal = ref(false);
const settingsModal = ref(null);
const settingsModalSnapshot = ref(null);

const currentSession = computed(() => status.value?.currentSession || null);
const recentSessions = computed(() => status.value?.recentSessions || []);
const backendError = computed(() => status.value?.lastError || null);
const storage = computed(() => {
  const raw = status.value?.storage || {};
  const diskAvailableBytes = Number(raw.diskAvailableBytes || 0);
  const diskTotalBytes = Number(raw.diskTotalBytes || 0);

  return {
    ...raw,
    diskUsedBytes: Number(raw.diskUsedBytes ?? Math.max(0, diskTotalBytes - diskAvailableBytes)),
  };
});
const estimateBaseline = computed(() => status.value?.estimateBaseline || null);
const estimateBaselineAverageFrameBytes = computed(
  () => estimateBaseline.value?.averageFrameBytes || 0
);
const showBackendSetupBanner = computed(
  () => !loading.value && !status.value && Boolean(error.value)
);
const backendInstallCommands = `cd /home/pi
git clone https://github.com/sharon92/pins-allsky-plugin.git
cd pins-allsky-plugin
./scripts/install-backend-plugin.sh --restart-pins`;

const dependencyRows = computed(() => [
  {
    label: t('plugins.pinsAllSky.dependencies.rpiCamStill'),
    ready: Boolean(status.value?.dependencies?.rpiCamStillAvailable),
  },
  {
    label: t('plugins.pinsAllSky.dependencies.ffmpeg'),
    ready: Boolean(status.value?.dependencies?.ffmpegAvailable),
  },
  {
    label: t('plugins.pinsAllSky.dependencies.keogram'),
    ready: Boolean(status.value?.dependencies?.keogramAvailable),
  },
  {
    label: t('plugins.pinsAllSky.dependencies.startrails'),
    ready: Boolean(status.value?.dependencies?.startrailsAvailable),
  },
]);

const missingDependencies = computed(() =>
  dependencyRows.value.filter((item) => !item.ready).map((item) => item.label)
);
const statusRows = computed(() => {
  const pluginLimitValue = storage.value.limitEnabled
    ? formatSize(storage.value.maxPluginUsageBytes)
    : t('plugins.pinsAllSky.common.unlimited');
  const pluginAvailableValue = storage.value.limitEnabled
    ? formatSize(storage.value.pluginAvailableBytes)
    : t('plugins.pinsAllSky.common.unlimited');

  return [
    {
      label: t('plugins.pinsAllSky.statusRows.backend'),
      value: status.value?.advancedApiReachable
        ? t('plugins.pinsAllSky.statusRows.online')
        : t('plugins.pinsAllSky.statusRows.offline'),
      className: status.value?.advancedApiReachable ? 'text-emerald-300' : 'text-amber-300',
    },
    {
      label: t('plugins.pinsAllSky.statusRows.session'),
      value:
        currentSession.value?.label ||
        currentSession.value?.id ||
        t('plugins.pinsAllSky.preview.noActiveSession'),
      className: 'text-white',
    },
    {
      label: t('plugins.pinsAllSky.statusRows.sequence'),
      value: status.value?.sequenceRunning
        ? t('plugins.pinsAllSky.statusRows.running')
        : t('plugins.pinsAllSky.statusRows.idle'),
      className: status.value?.sequenceRunning ? 'text-emerald-300' : 'text-gray-300',
    },
    {
      label: t('plugins.pinsAllSky.statusRows.capture'),
      value: status.value?.captureRunning
        ? t('plugins.pinsAllSky.statusRows.active')
        : t('plugins.pinsAllSky.statusRows.stopped'),
      className: status.value?.captureRunning ? 'text-emerald-300' : 'text-gray-300',
    },
    {
      label: t('plugins.pinsAllSky.statusRows.rendering'),
      value: status.value?.generateInProgress
        ? t('plugins.pinsAllSky.statusRows.inProgress')
        : t('plugins.pinsAllSky.statusRows.idle'),
      className: status.value?.generateInProgress ? 'text-cyan-300' : 'text-gray-300',
    },
    {
      label: t('plugins.pinsAllSky.statusRows.piUsed'),
      value: formatSize(storage.value.diskUsedBytes),
      className: 'text-white',
    },
    {
      label: t('plugins.pinsAllSky.statusRows.piAvailable'),
      value: formatSize(storage.value.diskAvailableBytes),
      className: estimateExceedsAvailable.value ? 'text-amber-300' : 'text-white',
    },
    {
      label: t('plugins.pinsAllSky.statusRows.pluginUsed'),
      value: formatSize(storage.value.pluginUsedBytes),
      className: 'text-white',
    },
    {
      label: t('plugins.pinsAllSky.statusRows.pluginLimit'),
      value: pluginLimitValue,
      className: 'text-white',
    },
    {
      label: t('plugins.pinsAllSky.statusRows.pluginAvailable'),
      value: pluginAvailableValue,
      className:
        storage.value.withinLimit || !storage.value.limitEnabled ? 'text-white' : 'text-amber-300',
    },
    ...dependencyRows.value.map((item) => ({
      label: item.label,
      value: item.ready
        ? t('plugins.pinsAllSky.statusRows.available')
        : t('plugins.pinsAllSky.statusRows.missing'),
      className: item.ready ? 'text-emerald-300' : 'text-amber-300',
    })),
  ];
});

const parsedEstimateStart = computed(() => parseLocalInputValue(estimateWindow.startLocal));
const parsedEstimateEnd = computed(() => parseLocalInputValue(estimateWindow.endLocal));
const estimateDurationSeconds = computed(() => {
  if (!parsedEstimateStart.value || !parsedEstimateEnd.value) {
    return 0;
  }

  return Math.max(
    0,
    Math.round((parsedEstimateEnd.value.getTime() - parsedEstimateStart.value.getTime()) / 1000)
  );
});
const estimatedFrameCount = computed(() => {
  const intervalSeconds = Number(config.value?.camera?.intervalSeconds || 0);
  if (intervalSeconds <= 0 || estimateDurationSeconds.value <= 0) {
    return 0;
  }

  return Math.floor(estimateDurationSeconds.value / intervalSeconds) + 1;
});
const estimatedFrameStorageBytes = computed(() => {
  if (!config.value?.products?.keepFrames) {
    return 0;
  }

  return estimateBaselineAverageFrameBytes.value * estimatedFrameCount.value;
});
const estimatedTimelapseBytes = computed(() => {
  if (!config.value?.products?.timelapseEnabled || estimatedFrameCount.value <= 0) {
    return 0;
  }

  const fps = Math.max(1, Number(config.value?.products?.timelapseFps || 1));
  const bitrateKbps = Math.max(1000, Number(config.value?.products?.timelapseBitrateKbps || 1000));
  const videoSeconds = estimatedFrameCount.value / fps;
  return Math.round((videoSeconds * bitrateKbps * 1000) / 8);
});
const estimatedKeogramBytes = computed(() =>
  config.value?.products?.keogramEnabled ? Number(estimateBaseline.value?.keogramBytes || 0) : 0
);
const estimatedStartrailsBytes = computed(() =>
  config.value?.products?.startrailsEnabled
    ? Number(estimateBaseline.value?.startrailsBytes || 0)
    : 0
);
const estimatedStorageBytes = computed(
  () =>
    estimatedFrameStorageBytes.value +
    estimatedTimelapseBytes.value +
    estimatedKeogramBytes.value +
    estimatedStartrailsBytes.value
);
const estimateDurationLabel = computed(() => formatDuration(estimateDurationSeconds.value));
const estimateExceedsAvailable = computed(() => {
  if (estimatedStorageBytes.value <= 0) {
    return false;
  }

  const diskAvailableBytes = Number(storage.value.diskAvailableBytes || 0);
  if (diskAvailableBytes > 0 && estimatedStorageBytes.value > diskAvailableBytes) {
    return true;
  }

  if (storage.value.limitEnabled) {
    const pluginAvailableBytes = Number(storage.value.pluginAvailableBytes || 0);
    return estimatedStorageBytes.value > pluginAvailableBytes;
  }

  return false;
});
const estimateWarning = computed(() => {
  if (!parsedEstimateStart.value || !parsedEstimateEnd.value) {
    return t('plugins.pinsAllSky.estimate.invalidWindow');
  }

  if (estimateDurationSeconds.value <= 0) {
    return t('plugins.pinsAllSky.estimate.endBeforeStart');
  }

  if (!estimateBaseline.value) {
    return t('plugins.pinsAllSky.estimate.noBaseline');
  }

  if (estimatedStorageBytes.value <= 0) {
    return null;
  }

  const warnings = [];
  const diskAvailableBytes = Number(storage.value.diskAvailableBytes || 0);
  if (diskAvailableBytes > 0 && estimatedStorageBytes.value > diskAvailableBytes) {
    warnings.push(
      t('plugins.pinsAllSky.estimate.piFreeSpace', { size: formatSize(diskAvailableBytes) })
    );
  }

  if (storage.value.limitEnabled) {
    const pluginAvailableBytes = Number(storage.value.pluginAvailableBytes || 0);
    if (estimatedStorageBytes.value > pluginAvailableBytes) {
      warnings.push(
        t('plugins.pinsAllSky.estimate.pluginLimitRemaining', {
          size: formatSize(pluginAvailableBytes),
        })
      );
    }
  }

  if (warnings.length === 0) {
    return null;
  }

  return t('plugins.pinsAllSky.estimate.exceeds', {
    size: formatSize(estimatedStorageBytes.value),
    limits: warnings.join(` ${t('plugins.pinsAllSky.common.and')} `),
  });
});

const settingsModalTitle = computed(() => {
  switch (settingsModal.value) {
    case 'automation':
      return t('plugins.pinsAllSky.buttons.automation');
    case 'camera':
      return t('plugins.pinsAllSky.buttons.camera');
    case 'outputs':
      return t('plugins.pinsAllSky.buttons.outputs');
    default:
      return '';
  }
});

const settingsPanelComponent = computed(() => {
  switch (settingsModal.value) {
    case 'automation':
      return PinsAllSkyAutomationSettings;
    case 'camera':
      return PinsAllSkyCameraSettings;
    case 'outputs':
      return PinsAllSkyOutputsSettings;
    default:
      return null;
  }
});

const settingsPanelProps = computed(() => {
  if (!config.value) {
    return {};
  }

  switch (settingsModal.value) {
    case 'automation':
      return {
        config: config.value,
        setRootConfigValue,
        setAdvancedApiSetting,
      };
    case 'camera':
      return {
        config: config.value,
        setCameraSetting,
      };
    case 'outputs':
      return {
        config: config.value,
        setProductSetting,
      };
    default:
      return {};
  }
});

const toggleSection = (sectionKey) => {
  sectionOpen[sectionKey] = !sectionOpen[sectionKey];
};

const openSettingsModal = (modalKey) => {
  if (!config.value) {
    return;
  }

  settingsModalSnapshot.value = JSON.stringify(config.value);
  settingsModal.value = modalKey;
};

const restoreSettingsSnapshot = () => {
  if (!settingsModalSnapshot.value) {
    return;
  }

  config.value = JSON.parse(settingsModalSnapshot.value);
};

const closeSettingsModal = ({ restore = true } = {}) => {
  if (restore) {
    restoreSettingsSnapshot();
  }

  settingsModal.value = null;
  settingsModalSnapshot.value = null;
};

const saveSettingsModal = async () => {
  await saveConfig();

  if (!error.value) {
    settingsModal.value = null;
    settingsModalSnapshot.value = null;
  }
};

const setRootConfigValue = (key, value) => {
  if (!config.value) {
    return;
  }

  config.value[key] = value;
};

const setCameraSetting = (key, value) => {
  if (!config.value?.camera) {
    return;
  }

  config.value.camera[key] = value;
};

const setProductSetting = (key, value) => {
  if (!config.value?.products) {
    return;
  }

  config.value.products[key] = value;
};

const setAdvancedApiSetting = (key, value) => {
  if (!config.value?.advancedApi) {
    return;
  }

  config.value.advancedApi[key] = value;
};

const refreshAll = async () => {
  await store.refreshAll();
};

const saveConfig = async () => {
  await store.saveConfig();
};

const startSession = async () => {
  store.manualLabel = (store.manualLabel || '').trim() || defaultManualLabel.value;
  await store.startSession();
};

const stopSession = async () => {
  await store.stopSession(true);
};

const generateArtifacts = async (sessionId = null) => {
  await store.generateArtifacts(sessionId);
};

const updateBackend = async () => {
  await store.updateBackend();
};

const isActionBusy = (key) => store.isActionBusy(key);

const formatSessionReason = (reason) => {
  if (!reason) {
    return t('plugins.pinsAllSky.recentSessions.reasons.unknown');
  }

  const normalizedReason = String(reason)
    .replace(/-([a-z])/g, (_, character) => character.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');

  switch (normalizedReason) {
    case 'manualStart':
      return t('plugins.pinsAllSky.recentSessions.reasons.manualStart');
    case 'manualStop':
      return t('plugins.pinsAllSky.recentSessions.reasons.manualStop');
    case 'sequenceStart':
      return t('plugins.pinsAllSky.recentSessions.reasons.sequenceStart');
    case 'sequenceStop':
      return t('plugins.pinsAllSky.recentSessions.reasons.sequenceStop');
    default:
      return reason;
  }
};

const confirmDelete = (message) =>
  toastStore.showConfirmation(t('common.confirm'), message, t('common.delete'), t('common.cancel'));

const deleteSession = async (session) => {
  const sessionName =
    session?.label || session?.id || t('plugins.pinsAllSky.preview.noActiveSession');
  if (!(await confirmDelete(t('plugins.pinsAllSky.dialogs.deleteSession', { sessionName })))) {
    return;
  }

  await store.deleteSession(session.id);
};

const deleteAllSessions = async () => {
  if (!(await confirmDelete(t('plugins.pinsAllSky.dialogs.deleteAllSessions')))) {
    return;
  }

  await store.deleteAllSessions();
};

const deleteArtifact = async (session, artifact) => {
  if (!artifact?.relativePath) {
    return;
  }

  const artifactName =
    artifact.name ||
    artifact.relativePath.split('/').pop() ||
    t('plugins.pinsAllSky.common.notGenerated');
  if (!(await confirmDelete(t('plugins.pinsAllSky.dialogs.deleteArtifact', { artifactName })))) {
    return;
  }

  await store.deleteArtifact(session.id, artifact.relativePath);
};

const deleteFrame = async (session, frame) => {
  if (!frame?.relativePath) {
    return;
  }

  const frameName =
    frame.name ||
    frame.relativePath.split('/').pop() ||
    t('plugins.pinsAllSky.common.notAvailable');
  if (!(await confirmDelete(t('plugins.pinsAllSky.dialogs.deleteFrame', { frameName })))) {
    return;
  }

  await store.deleteFrame(session.id, frame.relativePath);
};

const downloadRelativePath = async (relativePath, fallbackName = null) => {
  const derivedName =
    fallbackName || relativePath?.split('/').pop() || t('plugins.pinsAllSky.common.download');
  await store.downloadFile(relativePath, derivedName);
};

const refreshSessionDetails = async (sessionId) => {
  await store.fetchSessionDetails(sessionId);
};
const toggleSessionDetails = async (sessionId) => {
  sessionDetailOpen[sessionId] = !sessionDetailOpen[sessionId];
  if (sessionDetailOpen[sessionId]) {
    await store.fetchSessionDetails(sessionId);
  }
};

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object') {
    const utcDateTime = typeof value.utcDateTime === 'string' ? value.utcDateTime : null;
    if (utcDateTime) {
      const parsedUtc = new Date(
        /[zZ]|[+-]\d{2}:\d{2}$/.test(utcDateTime) ? utcDateTime : `${utcDateTime}Z`
      );
      if (!Number.isNaN(parsedUtc.getTime())) {
        return parsedUtc;
      }
    }

    const localDateTime = typeof value.localDateTime === 'string' ? value.localDateTime : null;
    if (localDateTime) {
      const parsedLocal = new Date(localDateTime);
      if (!Number.isNaN(parsedLocal.getTime())) {
        return parsedLocal;
      }
    }

    const dateTime = typeof value.dateTime === 'string' ? value.dateTime : null;
    if (dateTime) {
      const parsedDateTime = new Date(dateTime);
      if (!Number.isNaN(parsedDateTime.getTime())) {
        return parsedDateTime;
      }
    }
  }

  return null;
};

const sameLocalDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const buildDefaultManualLabel = () => {
  const now = new Date();
  const datePrefix = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const sessionsById = new Map();
  const candidateSessions = [currentSession.value, ...recentSessions.value].filter(Boolean);

  for (const session of candidateSessions) {
    const sessionKey =
      session.id || `${session.label || ''}:${JSON.stringify(session.startedAtUtc || null)}`;
    if (!sessionsById.has(sessionKey)) {
      sessionsById.set(sessionKey, session);
    }
  }

  let sessionsStartedToday = 0;
  let maxLabelCounter = 0;

  for (const session of sessionsById.values()) {
    const startedAt = parseDateValue(session.startedAtUtc);
    if (startedAt && sameLocalDay(startedAt, now)) {
      sessionsStartedToday += 1;
    }

    const label = typeof session.label === 'string' ? session.label.trim() : '';
    const match = label.match(new RegExp(`^${datePrefix}_(\\d+)$`));
    if (match) {
      maxLabelCounter = Math.max(maxLabelCounter, Number(match[1]));
    }
  }

  const nextCounter = Math.max(sessionsStartedToday, maxLabelCounter) + 1;
  return `${datePrefix}_${nextCounter}`;
};

const defaultManualLabel = computed(() => buildDefaultManualLabel());
const manualLabelInput = computed({
  get: () => store.manualLabel || defaultManualLabel.value,
  set: (value) => {
    store.manualLabel = typeof value === 'string' ? value : '';
  },
});

const parseLocalInputValue = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toLocalInputValue = (date) => {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
};

const initializeEstimateWindow = () => {
  if (estimateWindow.startLocal && estimateWindow.endLocal) {
    return;
  }

  const now = new Date();
  const nextMorning = new Date(now);
  nextMorning.setDate(nextMorning.getDate() + 1);
  nextMorning.setHours(8, 0, 0, 0);

  estimateWindow.startLocal = toLocalInputValue(now);
  estimateWindow.endLocal = toLocalInputValue(nextMorning);
};

const formatDate = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return t('plugins.pinsAllSky.common.notAvailable');
  }

  return parsed.toLocaleString();
};

const formatInterval = (seconds) => {
  if (!Number.isFinite(seconds)) {
    return t('plugins.pinsAllSky.common.notAvailable');
  }

  return `${seconds}s`;
};

const formatExposureValue = (shutterMicroseconds) => {
  if (!Number.isFinite(shutterMicroseconds) || shutterMicroseconds <= 0) {
    return t('plugins.pinsAllSky.common.notAvailable');
  }

  const exposureSeconds = shutterMicroseconds / 1000000;
  if (exposureSeconds >= 1) {
    return `${exposureSeconds.toFixed(exposureSeconds >= 10 ? 0 : 1)}s`;
  }

  return `${exposureSeconds.toFixed(exposureSeconds >= 0.1 ? 2 : 3)}s`;
};

const formatExposure = (camera, session = null) => {
  if (!camera) {
    return t('plugins.pinsAllSky.common.notAvailable');
  }

  const actualExposure = Number(session?.lastExposureMicroseconds || 0);
  if (actualExposure > 0) {
    return camera.useManualExposure
      ? formatExposureValue(actualExposure)
      : `${formatExposureValue(actualExposure)} (${t('plugins.pinsAllSky.common.auto')})`;
  }

  if (!camera.useManualExposure) {
    return t('plugins.pinsAllSky.common.auto');
  }

  return formatExposureValue(Number(camera.shutterMicroseconds || 0));
};

const formatGainValue = (gain) => {
  if (!Number.isFinite(gain) || gain <= 0) {
    return t('plugins.pinsAllSky.common.notAvailable');
  }

  return gain >= 10 ? gain.toFixed(0) : gain.toFixed(1).replace(/\.0$/, '');
};

const formatGain = (camera, session = null) => {
  if (!camera) {
    return t('plugins.pinsAllSky.common.notAvailable');
  }

  const actualGain = Number(session?.lastAnalogGain || 0);
  if (actualGain > 0) {
    return camera.useManualGain
      ? formatGainValue(actualGain)
      : `${formatGainValue(actualGain)} (${t('plugins.pinsAllSky.common.auto')})`;
  }

  if (!camera.useManualGain) {
    return t('plugins.pinsAllSky.common.auto');
  }

  return formatGainValue(Number(camera.analogGain || 0));
};

const formatCount = (value) => {
  if (!Number.isFinite(value)) {
    return t('plugins.pinsAllSky.common.notAvailable');
  }

  return new Intl.NumberFormat().format(value);
};

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return t('plugins.pinsAllSky.common.notAvailable');
  }

  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
};

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) {
    return t('plugins.pinsAllSky.common.notAvailable');
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
};

const describeArtifact = (artifact) => {
  if (!artifact) {
    return t('plugins.pinsAllSky.common.notGenerated');
  }

  return `${formatDate(artifact.generatedAtUtc)} • ${formatSize(artifact.sizeBytes)}`;
};

onMounted(async () => {
  initializeEstimateWindow();
  await refreshAll();
  store.startPolling();
});

onBeforeUnmount(() => {
  store.stopPolling();
});
</script>
