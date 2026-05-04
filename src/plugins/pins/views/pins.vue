<template>
  <div class="min-h-screen bg-gray-900">
    <SubNav v-if="store.isPINS" :items="pinsNavItems" v-model:activeItem="activeTab" class="z-20" />

    <div
      class="container py-8 sm:py-16 flex items-center justify-center px-4"
      :class="{ 'pt-24 sm:pt-28': store.isPINS }"
    >
      <div class="container max-w-4xl p-0 sm:p-4 w-full">
        <h5
          class="text-2xl text-center font-bold text-white mb-2 flex items-center justify-center gap-3"
        >
          <span>{{ $t('plugins.pins.title') }}</span>
        </h5>

        <!-- Control Panel -->
        <div v-if="store.isPINS" class="flex flex-col space-y-6 animate-fade-in-up">
          <template v-if="activeTab === 'network'">
            <PinsNetworkTab
              :stationary-mode="stationaryMode"
              :allow-concurrent-mode="allowConcurrentWifiAndHotspot"
              :is-scanning="isScanning"
              :wifi-list="wifiList"
              :selected-ssid="selectedSsid"
              :wifi-password="wifiPassword"
              :selected-band="selectedBand"
              :auto-connect="autoConnect"
              :wifi-adapters="wifiAdapters"
              :interfaces-loading="isWifiAdaptersLoading"
              :interfaces-saving="isWifiInterfacesSaving"
              :selected-client-interface="selectedClientInterface"
              :selected-hotspot-interface="selectedHotspotInterface"
              :hotspot-configured="hotspotConfigured"
              :hotspot-password="hotspotPassword"
              :hotspot-loading="isHotspotLoading"
              :hotspot-saving="isHotspotSaving"
              :disabled="status === 'Running'"
              :dhcp-clients="dhcpClients"
              :dhcp-clients-loading="isDhcpClientsLoading"
              @toggle-stationary="handleStationaryToggle"
              @scan-wifi="scanWifi"
              @refresh-interfaces="loadWifiInterfaceConfig"
              @save-interfaces="saveWifiInterfaces"
              @connect-wifi="connectWifi"
              @disconnect-wifi="requestDisableWifi"
              @update:selected-ssid="selectedSsid = $event"
              @update:wifi-password="wifiPassword = $event"
              @update:selected-band="selectedBand = $event"
              @update:auto-connect="autoConnect = $event"
              @update:selected-client-interface="selectedClientInterface = $event"
              @update:selected-hotspot-interface="selectedHotspotInterface = $event"
              @update:hotspot-password="hotspotPassword = $event"
              @load-hotspot="loadHotspotPasswordConfig"
              @save-hotspot="saveHotspotPassword"
              @refresh-dhcp="loadDhcpClients"
            />
          </template>

          <template v-if="activeTab === 'services'">
            <PinsServicesTab
              :samba-enabled="sambaEnabled"
              :phd2-enabled="phd2Enabled"
              :phd2-running="phd2Running"
              :disabled="status === 'Running'"
              @toggle-samba="handleSambaToggle"
              @toggle-phd2="handlePhd2Toggle"
            />
          </template>

          <template v-if="activeTab === 'software'">
            <PinsSoftwareTab
              :available-update-count="availableUpdatePackages.length"
              :drivers="indi3rdpartyDrivers"
              :loading="isIndi3rdpartyLoading"
              :installing="isIndi3rdpartyInstalling"
              :search-query="indi3rdpartyQuery"
              :selected-asset="selectedIndi3rdpartyAsset"
              :plugins="pinsPlugins"
              :plugins-loading="isPinsPluginsLoading"
              :plugins-checked-at="pinsPluginsCheckedAt"
              :plugins-busy-package="pinsPluginsBusyPackage"
              :disabled="status === 'Running'"
              @open-updates="showUpdatesModal = true"
              @refresh="loadIndi3rdpartyDrivers"
              @search="loadIndi3rdpartyDrivers"
              @install="openIndi3rdpartyInstallModal"
              @plugins-refresh="loadPinsPlugins"
              @plugin-install="installPinsPlugin"
              @plugin-uninstall="uninstallPinsPlugin"
              @update:search-query="indi3rdpartyQuery = $event"
              @update:selected-asset="selectedIndi3rdpartyAsset = $event"
            />
          </template>

          <PinsIndiInstallConfirmModal
            :show="showIndi3rdpartyInstallModal"
            :selected-item="selectedIndi3rdpartyDriver"
            :installing="isIndi3rdpartyInstalling"
            :error-message="indi3rdpartyInstallError"
            @close="closeIndi3rdpartyInstallModal"
            @confirm="installIndi3rdpartyDriver"
          />

          <template v-if="activeTab === 'upgrade'">
            <PinsUpgradeTab
              :status="status"
              :active-operation="activeOperation"
              :upgrade-exit-code="upgradeExitCode"
              :logs="logs"
              @start-upgrade="startUpgrade"
              @clear-logs="pinsStore.clearTerminalLogs()"
            />
          </template>

          <Modal
            :show="showDisconnectWifiModal"
            @close="showDisconnectWifiModal = false"
            maxWidth="max-w-md"
          >
            <template #header>
              <h2 class="text-xl font-bold text-white">
                {{ $t('plugins.pins.disconnectConfirmTitle') }}
              </h2>
            </template>

            <template #body>
              <div class="w-full">
                <p class="text-gray-300 text-sm leading-relaxed mb-6">
                  {{ $t('plugins.pins.disconnectConfirmMessage') }}
                </p>
                <div class="flex justify-end gap-3">
                  <button @click="showDisconnectWifiModal = false" class="default-button-gray">
                    {{ $t('common.cancel') }}
                  </button>
                  <button @click="confirmDisableWifi" class="default-button-red">
                    {{ $t('common.confirm') }}
                  </button>
                </div>
              </div>
            </template>
          </Modal>

          <Modal :show="showUpdatesModal" @close="showUpdatesModal = false" maxWidth="max-w-2xl">
            <template #header>
              <h2 class="text-xl font-bold text-white">
                {{ $t('plugins.pins.updatesModalTitle') }}
              </h2>
            </template>

            <template #body>
              <div class="w-full flex flex-col gap-4">
                <div class="flex items-center justify-between gap-2 text-sm text-gray-400">
                  <span>
                    {{ $t('plugins.pins.updatesCheckedAt') }}:
                    {{
                      updatesCheckResult?.checkedAt
                        ? new Date(updatesCheckResult.checkedAt).toLocaleString()
                        : '-'
                    }}
                  </span>
                  <button
                    @click="checkUpdates()"
                    class="text-blue-400 hover:text-white transition-colors disabled:opacity-50"
                    :disabled="isCheckingUpdates"
                  >
                    {{
                      isCheckingUpdates
                        ? $t('plugins.pins.checkingUpdates')
                        : $t('plugins.pins.checkUpdates')
                    }}
                  </button>
                </div>

                <div
                  v-if="availableUpdatePackages.length === 0"
                  class="text-gray-300 text-sm py-6 text-center"
                >
                  {{ $t('plugins.pins.noUpdatesAvailable') }}
                </div>

                <div v-else class="max-h-80 overflow-y-auto border border-gray-700 rounded-lg">
                  <table class="w-full text-left text-sm">
                    <thead class="bg-gray-900 text-gray-300 sticky top-0">
                      <tr>
                        <th class="px-4 py-3">{{ $t('plugins.pins.updatesPackage') }}</th>
                        <th class="px-4 py-3">{{ $t('plugins.pins.updatesInstalled') }}</th>
                        <th class="px-4 py-3">{{ $t('plugins.pins.updatesLatest') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="pkg in availableUpdatePackages"
                        :key="pkg.name"
                        class="border-t border-gray-700 text-gray-200"
                      >
                        <td class="px-4 py-3 font-medium">{{ pkg.name }}</td>
                        <td class="px-4 py-3">{{ pkg.installedVersion || '-' }}</td>
                        <td class="px-4 py-3">{{ pkg.latestVersion || '-' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="flex justify-end">
                  <button @click="showUpdatesModal = false" class="default-button-gray">
                    {{ $t('common.cancel') }}
                  </button>
                </div>
              </div>
            </template>
          </Modal>
        </div>

        <!-- Unavailable State -->
        <div
          v-else
          class="border border-red-900/50 bg-red-900/20 rounded-lg p-8 text-center animate-fade-in-up"
        >
          <svg
            class="w-16 h-16 text-red-500 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 class="text-xl font-bold text-red-400 mb-2">{{ $t('plugins.pins.title') }}</h3>
          <p class="text-gray-400">{{ $t('plugins.pins.notAvailable') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { usePinsStore } from '../store/pinsStore';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import axios from 'axios';
import SubNav from '@/components/SubNav.vue';
import Modal from '@/components/helpers/Modal.vue';
import PinsNetworkTab from '../components/tabs/PinsNetworkTab.vue';
import PinsServicesTab from '../components/tabs/PinsServicesTab.vue';
import PinsSoftwareTab from '../components/tabs/PinsSoftwareTab.vue';
import PinsUpgradeTab from '../components/tabs/PinsUpgradeTab.vue';
import PinsIndiInstallConfirmModal from '../components/PinsIndiInstallConfirmModal.vue';
import { usePinsWifiInterfaces } from '../composables/usePinsWifiInterfaces';
import { usePinsUpgradeTracker } from '../composables/usePinsUpgradeTracker';
import {
  buildIndiInstallPayload,
  extractIndiInstallErrorDetail,
  parseIndiInstallJobId,
} from '../composables/indiInstallUtils';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const store = apiStore();
const pinsStore = usePinsStore();
const toastStore = useToastStore();

const sambaEnabled = ref(false);
const phd2Enabled = ref(false);
const phd2Running = ref(false);
const hotspotPassword = ref('');
const hotspotConfigured = ref(false);
const isHotspotLoading = ref(false);
const isHotspotSaving = ref(false);
const showDisconnectWifiModal = ref(false);
const showUpdatesModal = ref(false);
const isCheckingUpdates = ref(false);
const updatesCheckResult = ref(null);
const indi3rdpartyDrivers = ref([]);
const isIndi3rdpartyLoading = ref(false);
const isIndi3rdpartyInstalling = ref(false);
const indi3rdpartyQuery = ref('');
const pinsPlugins = ref([]);
const isPinsPluginsLoading = ref(false);
const pinsPluginsCheckedAt = ref('');
const pinsPluginsBusyPackage = ref('');
const dhcpClients = ref([]);
const isDhcpClientsLoading = ref(false);
const selectedIndi3rdpartyAsset = ref('');
const showIndi3rdpartyInstallModal = ref(false);
const indi3rdpartyInstallError = ref('');
const activeTab = ref('network');
const {
  stationaryMode,
  wifiList,
  selectedSsid,
  wifiPassword,
  selectedBand,
  autoConnect,
  isScanning,
  wifiConnected,
  terminalLogs: logs,
  terminalStatus: status,
  activeOperation,
  currentJobId: jobId,
} = storeToRefs(pinsStore);
let ws = null;
let isComponentUnmounting = false;

const PORT = 8000;
const TOKEN = 'zZDqJ3IKeFaIZqG2JIFvsxzA5E48GC2gyGVagHFZqC0OMtgoupUDZCPhQDYKm35d';

const availableUpdatePackages = computed(() => {
  const packages = updatesCheckResult.value?.packages || [];
  return packages.filter((pkg) => pkg.updateAvailable);
});

const selectedIndi3rdpartyDriver = computed(() => {
  return (
    indi3rdpartyDrivers.value.find((pkg) => pkg.assetName === selectedIndi3rdpartyAsset.value) ||
    null
  );
});

const pinsNavItems = computed(() => [
  { name: t('plugins.pins.tabs.network'), value: 'network' },
  { name: t('plugins.pins.tabs.services'), value: 'services' },
  { name: t('plugins.pins.tabs.software'), value: 'software' },
  { name: t('plugins.pins.tabs.upgrade'), value: 'upgrade' },
]);

watch(selectedSsid, (newSsid) => {
  if (newSsid) {
    selectedBand.value = 'auto';
    const savedPassword = pinsStore.getPassword(newSsid);
    if (savedPassword) {
      wifiPassword.value = savedPassword;
    } else {
      wifiPassword.value = '';
    }
  }
});

function appendLog(message) {
  pinsStore.appendTerminalLog(message);
}

const {
  wifiAdapters,
  isWifiAdaptersLoading,
  isWifiInterfacesSaving,
  selectedClientInterface,
  selectedHotspotInterface,
  loadWifiInterfaceConfig,
  saveWifiInterfaces,
} = usePinsWifiInterfaces({
  t,
  appendLog,
  getIp,
  PORT,
  TOKEN,
  status,
});

const allowConcurrentWifiAndHotspot = computed(() => {
  const hasMultipleAdapters = wifiAdapters.value.length >= 2;
  const hasDedicatedClientInterface = Boolean(selectedClientInterface.value);
  const hasDedicatedHotspotInterface = Boolean(selectedHotspotInterface.value);
  const usesDifferentInterfaces = selectedClientInterface.value !== selectedHotspotInterface.value;

  return (
    hasMultipleAdapters &&
    hasDedicatedClientInterface &&
    hasDedicatedHotspotInterface &&
    usesDifferentInterfaces
  );
});

const {
  upgradeExitCode,
  stopUpgradePolling,
  restoreUpgradeState,
  beginUpgradeTrackingFromStart,
  handleUpgradeWsClosed,
  resetUpgradeForNewRun,
} = usePinsUpgradeTracker({
  t,
  appendLog,
  pinsStore,
  status,
  jobId,
  activeOperation,
  getIp,
  PORT,
  TOKEN,
  shouldWaitForApiRecovery: () => !store.isBackendReachable,
});

watch(
  () => store.isPINS,
  (newValue) => {
    if (newValue) {
      checkSambaStatus();
      checkPhd2Status();
      loadHotspotPasswordConfig();
      loadWifiInterfaceConfig();
      checkUpdates();
      loadIndi3rdpartyDrivers();
      loadPinsPlugins();
      loadDhcpClients();
      restoreUpgradeState();
    } else {
      // Keep polling while an upgrade lifecycle is active, even if PINS detection
      // temporarily drops during service restart.
      if (!pinsStore.shouldShowUpgradeOverlay) {
        stopUpgradePolling();
      }
    }
  },
  { immediate: true }
);

async function loadIndi3rdpartyDrivers() {
  const ip = getIp();
  if (!ip || isIndi3rdpartyLoading.value) return;

  isIndi3rdpartyLoading.value = true;
  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.get(`http://${ip}:${PORT}/packages/indi3rdparty`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      params: {
        onlyNotInstalled: true,
        ...(indi3rdpartyQuery.value?.trim() ? { q: indi3rdpartyQuery.value.trim() } : {}),
      },
      timeout: 15000,
    });

    const packages = response.data?.packages || [];
    indi3rdpartyDrivers.value = packages;

    if (!packages.some((pkg) => pkg.assetName === selectedIndi3rdpartyAsset.value)) {
      selectedIndi3rdpartyAsset.value = packages[0]?.assetName || '';
    }
  } catch (error) {
    console.error(error);
    appendLog(t('plugins.pins.logs.indi3rdpartyLoadFailed', { message: error.message }));
  } finally {
    isIndi3rdpartyLoading.value = false;
  }
}

function openIndi3rdpartyInstallModal() {
  if (
    status.value === 'Running' ||
    isIndi3rdpartyInstalling.value ||
    !selectedIndi3rdpartyAsset.value ||
    !selectedIndi3rdpartyDriver.value
  ) {
    return;
  }

  indi3rdpartyInstallError.value = '';
  showIndi3rdpartyInstallModal.value = true;
}

function closeIndi3rdpartyInstallModal() {
  if (isIndi3rdpartyInstalling.value) {
    return;
  }

  showIndi3rdpartyInstallModal.value = false;
  indi3rdpartyInstallError.value = '';
}

async function installIndi3rdpartyDriver(formInput) {
  if (
    status.value === 'Running' ||
    isIndi3rdpartyInstalling.value ||
    !selectedIndi3rdpartyAsset.value ||
    !selectedIndi3rdpartyDriver.value
  ) {
    return;
  }

  let payload;
  try {
    payload = buildIndiInstallPayload(selectedIndi3rdpartyDriver.value, formInput || {});
  } catch (error) {
    indi3rdpartyInstallError.value = error.message;
    return;
  }

  const ip = getIp();
  if (!ip) {
    appendLog(t('plugins.pins.logs.noIp'));
    return;
  }

  status.value = 'Running';
  pinsStore.setActiveOperation('indi3rdparty');
  pinsStore.clearTerminalLogs();
  appendLog(t('plugins.pins.logs.init', { ip }));
  appendLog(
    t('plugins.pins.logs.indi3rdpartyInstallStart', {
      assetName: payload.assetName,
    })
  );

  indi3rdpartyInstallError.value = '';
  isIndi3rdpartyInstalling.value = true;
  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.post(
      `http://${ip}:${PORT}/packages/indi3rdparty/install`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const data = response.data;
    const returnedJobId = parseIndiInstallJobId(data);

    closeIndi3rdpartyInstallModal();
    toastStore.showToast({
      type: 'success',
      title: t('plugins.pins.indiInstallModalTitle'),
      message: returnedJobId
        ? t('plugins.pins.indiInstallModalSuccessStarted', { label: payload.label })
        : t('plugins.pins.indiInstallModalSuccessCompleted', { label: payload.label }),
      autoClose: true,
    });

    if (returnedJobId) {
      jobId.value = returnedJobId;
      appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
      connectWebSocket(ip, returnedJobId);
    } else {
      appendLog(
        t('plugins.pins.logs.indi3rdpartyInstallSuccess', {
          message: data?.message || JSON.stringify(data),
        })
      );
      status.value = 'Success';
    }

    await loadIndi3rdpartyDrivers();
  } catch (error) {
    console.error(error);
    const errorDetail = extractIndiInstallErrorDetail(error);
    indi3rdpartyInstallError.value = errorDetail;
    status.value = 'Failed';
    appendLog(t('plugins.pins.logs.indi3rdpartyInstallFailed', { message: errorDetail }));

    if (error.response) {
      appendLog(
        t('plugins.pins.logs.serverError', {
          status: error.response.status,
          data: JSON.stringify(error.response.data),
        })
      );
    }
  } finally {
    isIndi3rdpartyInstalling.value = false;
  }
}

async function loadPinsPlugins() {
  const ip = getIp();
  if (!ip || isPinsPluginsLoading.value) return;

  isPinsPluginsLoading.value = true;
  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.get(`http://${ip}:${PORT}/plugins`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      timeout: 15000,
    });

    const payload = response.data || {};
    pinsPluginsCheckedAt.value = payload.checkedAt || '';
    const apiPlugins = Array.isArray(payload.plugins) ? payload.plugins : [];
    pinsPlugins.value = apiPlugins
      .filter((plugin) => plugin?.packageName)
      .map((plugin) => ({
        packageName: plugin.packageName,
        installed: Boolean(plugin.installed),
        installedVersion: plugin.installedVersion || null,
        availableVersion: plugin.availableVersion || null,
      }));
  } catch (error) {
    console.error(error);
    if (error.response?.status === 502) {
      appendLog(t('plugins.pins.logs.pluginsLoadMetadataFailed'));
    } else {
      appendLog(t('plugins.pins.logs.pluginsLoadFailed', { message: error.message }));
    }
  } finally {
    isPinsPluginsLoading.value = false;
  }
}

function parseJobIdFromResponse(data) {
  if (data && typeof data === 'object' && data.jobId) {
    return data.jobId;
  }
  if (typeof data === 'string' || typeof data === 'number') {
    return data;
  }
  return null;
}

function isJobSuccess(result) {
  const statusValue = String(result?.status || '').toLowerCase();
  return (
    statusValue === 'success' ||
    statusValue === 'completed' ||
    result?.exit_code === 0 ||
    result?.exitCode === 0 ||
    result?.success === true
  );
}

function isJobFailed(result) {
  const statusValue = String(result?.status || '').toLowerCase();
  return (
    statusValue === 'failed' ||
    (typeof result?.exit_code === 'number' && result.exit_code !== 0) ||
    (typeof result?.exitCode === 'number' && result.exitCode !== 0) ||
    result?.success === false
  );
}

async function pollJobUntilFinished(ip, id, { intervalMs = 2000, maxAttempts = 120 } = {}) {
  let lastStatus = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.get(`http://${ip}:${PORT}/jobs/${id}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      timeout: 8000,
    });

    const result = response.data || {};
    const currentStatus = String(result.status || '').toLowerCase();

    if (currentStatus && currentStatus !== lastStatus) {
      appendLog(t('plugins.pins.logs.jobStatus', { status: currentStatus }));
      lastStatus = currentStatus;
    }

    if (isJobSuccess(result)) {
      return { success: true, result };
    }

    if (isJobFailed(result)) {
      return { success: false, result };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { success: false, result: { status: 'timeout' } };
}

async function runPinsPluginAction(action, packageName) {
  if (status.value === 'Running' || pinsPluginsBusyPackage.value) return;

  const ip = getIp();
  if (!ip) {
    appendLog(t('plugins.pins.logs.noIp'));
    return;
  }

  const endpoint = action === 'install' ? 'install' : 'uninstall';
  const startMessageKey =
    action === 'install'
      ? 'plugins.pins.logs.pluginInstallStart'
      : 'plugins.pins.logs.pluginUninstallStart';

  status.value = 'Running';
  pinsStore.setActiveOperation('pins-plugin');
  pinsStore.clearTerminalLogs();
  pinsPluginsBusyPackage.value = packageName;
  appendLog(t('plugins.pins.logs.init', { ip }));
  appendLog(t(startMessageKey, { packageName }));

  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.post(
      `http://${ip}:${PORT}/plugins/${endpoint}`,
      { packageName },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    const returnedJobId = parseJobIdFromResponse(data);

    if (!returnedJobId) {
      appendLog(t('plugins.pins.logs.error', { message: 'No valid jobId returned.' }));
      status.value = 'Failed';
      return;
    }

    appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));

    const pollResult = await pollJobUntilFinished(ip, returnedJobId);
    if (pollResult.success) {
      status.value = 'Success';
      appendLog(t('plugins.pins.logs.pluginActionSuccess', { packageName }));
    } else {
      status.value = 'Failed';
      appendLog(
        t('plugins.pins.logs.pluginActionFailed', {
          packageName,
          status: pollResult.result?.status || 'unknown',
        })
      );
    }
  } catch (error) {
    console.error(error);
    status.value = 'Failed';
    appendLog(t('plugins.pins.logs.error', { message: error.message }));

    if (error.response) {
      appendLog(
        t('plugins.pins.logs.serverError', {
          status: error.response.status,
          data: JSON.stringify(error.response.data),
        })
      );
    }
  } finally {
    await loadPinsPlugins();
    pinsPluginsBusyPackage.value = '';
  }
}

function installPinsPlugin(packageName) {
  return runPinsPluginAction('install', packageName);
}

function uninstallPinsPlugin(packageName) {
  return runPinsPluginAction('uninstall', packageName);
}

async function checkUpdates() {
  const ip = getIp();
  if (!ip || isCheckingUpdates.value) return;

  isCheckingUpdates.value = true;
  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.get(`http://${ip}:${PORT}/updates/check`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      timeout: 10000,
    });

    updatesCheckResult.value = response.data || null;
  } catch (error) {
    console.error(error);
    appendLog(t('plugins.pins.logs.updateCheckFailed', { message: error.message }));
  } finally {
    isCheckingUpdates.value = false;
  }
}

async function loadHotspotPasswordConfig() {
  const ip = getIp();
  if (!ip) {
    appendLog(t('plugins.pins.logs.noIp'));
    return;
  }

  isHotspotLoading.value = true;
  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.get(`http://${ip}:${PORT}/wifi/hotspot/password`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      timeout: 5000,
    });

    const data = response.data || {};
    hotspotConfigured.value = Boolean(data.configured);
    if (!hotspotConfigured.value) {
      hotspotPassword.value = '';
    }

    appendLog(
      t('plugins.pins.logs.hotspotFetched', {
        configured: hotspotConfigured.value ? 'true' : 'false',
        source: data.source || 'unknown',
      })
    );
  } catch (error) {
    console.error(error);
    appendLog(
      t('plugins.pins.logs.error', { message: 'Hotspot password fetch failed: ' + error.message })
    );
  } finally {
    isHotspotLoading.value = false;
  }
}

async function saveHotspotPassword() {
  if (status.value === 'Running' || isHotspotSaving.value) return;

  const ip = getIp();
  if (!ip) {
    appendLog(t('plugins.pins.logs.noIp'));
    return;
  }

  if (!hotspotPassword.value || hotspotPassword.value.length < 8) {
    appendLog(t('plugins.pins.logs.hotspotPasswordTooShort'));
    return;
  }

  isHotspotSaving.value = true;
  appendLog(t('plugins.pins.logs.hotspotSaving'));

  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.post(
      `http://${ip}:${PORT}/wifi/hotspot/password`,
      {
        password: hotspotPassword.value,
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const data = response.data || {};
    hotspotConfigured.value = Boolean(data.configured);
    appendLog(
      t('plugins.pins.logs.hotspotSaved', {
        message: data.message || 'OK',
      })
    );

    // Refresh status/source after update.
    await loadHotspotPasswordConfig();
  } catch (error) {
    console.error(error);
    appendLog(
      t('plugins.pins.logs.error', { message: 'Hotspot password save failed: ' + error.message })
    );

    if (error.response) {
      appendLog(
        t('plugins.pins.logs.serverError', {
          status: error.response.status,
          data: JSON.stringify(error.response.data),
        })
      );
    }
  } finally {
    isHotspotSaving.value = false;
  }
}

async function checkSambaStatus() {
  const ip = getIp();
  if (!ip) return;

  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.get(`http://${ip}:${PORT}/samba`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      timeout: 5000,
    });

    if (response.data && typeof response.data.enabled !== 'undefined') {
      sambaEnabled.value = response.data.enabled;
    }
  } catch (error) {
    console.error('Failed to check Samba status:', error);
  }
}

async function checkPhd2Status() {
  const ip = getIp();
  if (!ip) return;

  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.get(`http://${ip}:${PORT}/phd2`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      timeout: 5000,
    });

    if (response.data) {
      if (typeof response.data.enabled !== 'undefined') {
        phd2Enabled.value = response.data.enabled;
      }
      if (typeof response.data.running !== 'undefined') {
        phd2Running.value = response.data.running;
      }
    }
  } catch (error) {
    console.error('Failed to check PHD2 status:', error);
  }
}

async function loadDhcpClients() {
  const ip = getIp();
  if (!ip) return;

  isDhcpClientsLoading.value = true;
  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.get(`http://${ip}:${PORT}/wifi/clients`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      timeout: 5000,
    });
    dhcpClients.value = response.data?.clients || [];
  } catch (error) {
    console.error('Failed to load DHCP clients:', error);
    dhcpClients.value = [];
  } finally {
    isDhcpClientsLoading.value = false;
  }
}

async function handlePhd2Toggle(newValue) {
  if (status.value === 'Running') return;

  const ip = getIp();
  if (!ip) {
    appendLog(t('plugins.pins.logs.noIp'));
    return;
  }

  // Update logic: Set specific operation
  status.value = 'Running';
  pinsStore.setActiveOperation('phd2');
  pinsStore.clearTerminalLogs();

  phd2Enabled.value = newValue; // Optimistic update
  appendLog(t('plugins.pins.logs.init', { ip }));
  const actionKey = newValue ? 'plugins.pins.logs.phd2Enabling' : 'plugins.pins.logs.phd2Disabling';
  appendLog(
    t('plugins.pins.logs.phd2Action', {
      action: t(actionKey),
    })
  );

  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.post(
      `http://${ip}:${PORT}/phd2`,
      { enable: newValue },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // Increased timeout for systemctl
      }
    );

    // Check for Job ID pattern just in case
    const data = response.data;
    let returnedJobId;

    if (data && typeof data === 'object' && data.jobId) {
      returnedJobId = data.jobId;
    } else if (typeof data === 'string' || typeof data === 'number') {
      returnedJobId = data;
    }

    if (returnedJobId) {
      jobId.value = returnedJobId;
      appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
      connectWebSocket(ip, returnedJobId);
    } else {
      appendLog(t('plugins.pins.logs.phd2Success'));
      status.value = 'Success';

      // Update running state immediately if successful
      if (newValue) {
        phd2Running.value = true;
      } else {
        phd2Running.value = false;
      }

      // Double check status after delay
      setTimeout(checkPhd2Status, 2000);
    }
  } catch (error) {
    status.value = 'Failed';
    phd2Enabled.value = !newValue; // Revert
    console.error(error);
    appendLog(t('plugins.pins.logs.phd2Failed', { message: error.message }));

    if (error.response) {
      appendLog(
        t('plugins.pins.logs.serverError', {
          status: error.response.status,
          data: JSON.stringify(error.response.data),
        })
      );
    }
  }
}

// Function to get the current connection IP
function getIp() {
  return settingsStore.connection.ip || window.location.hostname;
}

async function handleStationaryToggle(newValue) {
  if (status.value === 'Running') return;
  stationaryMode.value = newValue;
  if (newValue) {
    scanWifi();
  } else {
    wifiList.value = [];
    selectedSsid.value = '';
    wifiPassword.value = '';
  }
}

async function scanWifi() {
  const ip = getIp();
  if (!ip) {
    appendLog(t('plugins.pins.logs.noIp'));
    return;
  }

  isScanning.value = true;
  wifiList.value = [];

  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.get(`http://${ip}:${PORT}/wifi/scan`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      timeout: 15000,
    });

    let networks = response.data || [];
    // Deduplicate by SSID and filter empty SSIDs
    const seen = new Set();
    wifiList.value = networks
      .filter((n) => {
        if (!n.ssid) return false;
        if (seen.has(n.ssid)) return false;
        seen.add(n.ssid);
        return true;
      })
      .sort((a, b) => b.signal_strength - a.signal_strength);
  } catch (error) {
    console.error(error);
    appendLog(t('plugins.pins.logs.error', { message: 'Wifi Scan Failed: ' + error.message }));
  } finally {
    isScanning.value = false;
  }
}

async function connectWifi() {
  if (status.value === 'Running') return;

  const ip = getIp();
  if (!ip) {
    appendLog(t('plugins.pins.logs.noIp'));
    return;
  }

  status.value = 'Running';
  pinsStore.setActiveOperation('wifi');
  pinsStore.clearTerminalLogs();
  appendLog(t('plugins.pins.logs.init', { ip }));
  appendLog(t('plugins.pins.logs.connectingToWifi', { ssid: selectedSsid.value }));

  // Save password to store
  if (selectedSsid.value && wifiPassword.value) {
    pinsStore.savePassword(selectedSsid.value, wifiPassword.value);
  }

  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.post(
      `http://${ip}:${PORT}/wifi/connect`,
      {
        ssid: selectedSsid.value,
        password: wifiPassword.value,
        auto_connect: autoConnect.value,
        band: selectedBand.value === 'auto' ? null : selectedBand.value,
        client_interface: selectedClientInterface.value || null,
        hotspot_interface: selectedHotspotInterface.value || null,
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const data = response.data;
    let returnedJobId;

    if (data && typeof data === 'object' && data.jobId) {
      returnedJobId = data.jobId;
    } else if (typeof data === 'string' || typeof data === 'number') {
      returnedJobId = data;
    }

    if (returnedJobId) {
      jobId.value = returnedJobId;
      wifiConnected.value = true;
      appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
      connectWebSocket(ip, returnedJobId);
    } else {
      appendLog(t('plugins.pins.logs.wifiResponse', { response: JSON.stringify(data) }));
      wifiConnected.value = true;
      status.value = 'Success';
    }
  } catch (error) {
    console.error(error);
    status.value = 'Failed';
    appendLog(
      t('plugins.pins.logs.error', { message: 'Wifi Connection Failed: ' + error.message })
    );

    if (error.response) {
      appendLog(
        t('plugins.pins.logs.serverError', {
          status: error.response.status,
          data: JSON.stringify(error.response.data),
        })
      );
    }
  }
}

function requestDisableWifi() {
  if (status.value === 'Running') return;
  showDisconnectWifiModal.value = true;
}

function confirmDisableWifi() {
  showDisconnectWifiModal.value = false;
  disableWifi();
}

async function disableWifi() {
  if (status.value === 'Running') return;

  const ip = getIp();
  if (!ip) {
    appendLog(t('plugins.pins.logs.noIp'));
    return;
  }

  status.value = 'Running';
  pinsStore.setActiveOperation('wifi');
  pinsStore.clearTerminalLogs();
  appendLog(t('plugins.pins.logs.init', { ip }));
  appendLog(t('plugins.pins.logs.wifiDisabling'));

  try {
    const directAxios = axios.create({ headers: {} });
    const response = await directAxios.post(`http://${ip}:${PORT}/wifi/disable`, null, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      timeout: 30000,
    });

    const data = response.data;
    let returnedJobId;

    if (data && typeof data === 'object' && data.jobId) {
      returnedJobId = data.jobId;
    } else if (typeof data === 'string' || typeof data === 'number') {
      returnedJobId = data;
    }

    if (returnedJobId) {
      jobId.value = returnedJobId;
      wifiConnected.value = false;
      appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
      connectWebSocket(ip, returnedJobId);
    } else {
      appendLog(t('plugins.pins.logs.wifiDisabled'));
      wifiConnected.value = false;
      status.value = 'Success';
    }
  } catch (error) {
    console.error(error);
    status.value = 'Failed';
    appendLog(
      t('plugins.pins.logs.error', { message: 'Wifi Disconnect Failed: ' + error.message })
    );

    if (error.response) {
      appendLog(
        t('plugins.pins.logs.serverError', {
          status: error.response.status,
          data: JSON.stringify(error.response.data),
        })
      );
    }
  }
}

async function handleSambaToggle(newValue) {
  if (status.value === 'Running') return;

  const ip = getIp();
  if (!ip) {
    appendLog(t('plugins.pins.logs.noIp'));
    return;
  }

  sambaEnabled.value = newValue;
  status.value = 'Running';
  pinsStore.setActiveOperation('samba');
  pinsStore.clearTerminalLogs();
  appendLog(t('plugins.pins.logs.init', { ip }));

  const actionKey = newValue ? 'plugins.pins.logs.sambaEnable' : 'plugins.pins.logs.sambaDisable';
  appendLog(t('plugins.pins.logs.sambaAction', { action: t(actionKey) }));

  try {
    const directAxios = axios.create({ headers: {} });

    const response = await directAxios.post(
      `http://${ip}:${PORT}/samba`,
      { enable: newValue },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    const data = response.data;
    let returnedJobId;

    if (data && typeof data === 'object' && data.jobId) {
      returnedJobId = data.jobId;
    } else if (typeof data === 'string' || typeof data === 'number') {
      returnedJobId = data;
    }

    if (!returnedJobId) {
      throw new Error('No valid Job ID returned. server response: ' + JSON.stringify(data));
    }

    jobId.value = returnedJobId;
    appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));

    connectWebSocket(ip, returnedJobId);
  } catch (error) {
    console.error(error);
    status.value = 'Failed';
    sambaEnabled.value = !newValue; // Revert on failure
    appendLog(t('plugins.pins.logs.daemonCheck', { ip, port: PORT }));

    if (error.response) {
      appendLog(
        t('plugins.pins.logs.serverError', {
          status: error.response.status,
          data: JSON.stringify(error.response.data),
        })
      );
    } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      appendLog(t('plugins.pins.logs.networkError'));
    } else if (error.request) {
      appendLog(t('plugins.pins.logs.noResponse'));
    } else {
      appendLog(t('plugins.pins.logs.error', { message: error.message }));
    }
  }
}

async function startUpgrade() {
  if (status.value === 'Running') return;

  const ip = getIp();
  if (!ip) {
    appendLog(t('plugins.pins.logs.noIp'));
    status.value = 'Failed';
    return;
  }

  status.value = 'Running';
  pinsStore.setActiveOperation('upgrade');
  pinsStore.clearTerminalLogs();
  resetUpgradeForNewRun();
  appendLog(t('plugins.pins.logs.init', { ip }));

  try {
    // Create a clean axios instance to avoid global interceptors
    const directAxios = axios.create({
      headers: {}, // Start with empty headers
    });

    const response = await directAxios.post(
      `http://${ip}:${PORT}/upgrade`,
      { dryRun: false },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    // Flexible handling of job ID
    const data = response.data;
    let returnedJobId;

    if (data && typeof data === 'object' && data.jobId) {
      returnedJobId = data.jobId;
    } else if (typeof data === 'string' || typeof data === 'number') {
      returnedJobId = data;
    }

    if (!returnedJobId) {
      throw new Error('No valid Job ID returned. server response: ' + JSON.stringify(data));
    }

    appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
    beginUpgradeTrackingFromStart(ip, returnedJobId, data);

    connectWebSocket(ip, returnedJobId);
  } catch (error) {
    console.error(error);
    status.value = 'Failed';
    appendLog(t('plugins.pins.logs.daemonCheck', { ip, port: PORT }));

    // Detailed error logging
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      appendLog(
        t('plugins.pins.logs.serverError', {
          status: error.response.status,
          data: JSON.stringify(error.response.data),
        })
      );
      if (error.response.status === 405) {
        appendLog(t('plugins.pins.logs.corsHint'));
      }
    } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      appendLog(t('plugins.pins.logs.networkError'));
    } else if (error.request) {
      // The request was made but no response was received
      appendLog(t('plugins.pins.logs.noResponse'));
    } else {
      // Something happened in setting up the request that triggered an Error
      appendLog(t('plugins.pins.logs.error', { message: error.message }));
    }
  }
}

function connectWebSocket(ip, id) {
  if (ws) {
    ws.close();
  }

  const wsUrl = `ws://${ip}:${PORT}/logs/${id}?token=${TOKEN}`;
  appendLog(t('plugins.pins.logs.wsConnecting', { wsUrl }));

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      appendLog(t('plugins.pins.logs.wsConnected'));
    };

    ws.onmessage = (event) => {
      if (event.data) {
        appendLog(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      appendLog(t('plugins.pins.logs.wsError'));
    };

    ws.onclose = (event) => {
      if (isComponentUnmounting) {
        return;
      }

      appendLog(t('plugins.pins.logs.wsClosed', { code: event.code }));
      ws = null;

      // Upgrade status resolution uses polling with /jobs/{id} and /jobs/latest fallback.
      if (handleUpgradeWsClosed(ip)) {
        return;
      }

      // Non-upgrade operations still use a single final status fetch.
      checkFinalStatus(ip, id);
    };
  } catch (e) {
    appendLog(t('plugins.pins.logs.wsCreationFailed', { message: e.message }));
    status.value = 'Failed';
  }
}

async function checkFinalStatus(ip, id) {
  appendLog(t('plugins.pins.logs.verifyingStatus'));
  try {
    const directAxios = axios.create();
    const response = await directAxios.get(`http://${ip}:${PORT}/jobs/${id}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      timeout: 5000,
    });

    const result = response.data;
    if (typeof result === 'object') {
      appendLog(t('plugins.pins.logs.jobReport', { report: JSON.stringify(result, null, 2) }));

      // Check for success indicators
      const isSuccess =
        result.status === 'success' ||
        result.status === 'completed' ||
        result.exit_code === 0 ||
        result.exitCode === 0 ||
        result.success === true;

      if (isSuccess) {
        status.value = 'Success';
        appendLog(t('plugins.pins.logs.upgradeSuccess'));
      } else {
        status.value = 'Failed';
        appendLog(t('plugins.pins.logs.upgradeFailed', { exitCode: result.exitCode ?? 'Unknown' }));
      }
    } else {
      appendLog(t('plugins.pins.logs.jobStatus', { status: result }));
      status.value = 'Idle'; // Ambiguous
    }
  } catch (e) {
    appendLog(t('plugins.pins.logs.statusFetchFailed', { message: e.message }));
    // If we can't verify, we leave it as Idle or keep last state?
    // Let's set to finish but unknown
    if (status.value === 'Running') status.value = 'Idle';
  }
}

onUnmounted(() => {
  isComponentUnmounting = true;
  stopUpgradePolling();
  if (ws) {
    ws.close();
    ws = null;
  }
});
</script>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.5s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Custom scrollbar for terminal */
::-webkit-scrollbar {
  width: 10px;
}
::-webkit-scrollbar-track {
  background: #111827;
}
::-webkit-scrollbar-thumb {
  background: #374151;
  border-radius: 5px;
  border: 2px solid #111827;
}
::-webkit-scrollbar-thumb:hover {
  background: #4b5563;
}
</style>
