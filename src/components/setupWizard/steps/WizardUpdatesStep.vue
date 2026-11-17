<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.updates.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.updates.description') }}
      </p>
    </div>

    <div v-if="isChecking" class="text-sm text-content-muted">
      {{ t('components.setupWizard.updates.checking') }}
    </div>

    <template v-else-if="hasResult">
      <div
        v-if="!availablePackages.length"
        class="flex items-start gap-3 rounded-control border border-status-ok/40 bg-status-ok/10 p-3"
      >
        <span class="tns-dot bg-status-ok mt-1.5"></span>
        <p class="text-sm text-content">{{ t('components.setupWizard.updates.upToDate') }}</p>
      </div>

      <template v-else>
        <p class="text-sm text-content">
          {{ t('components.setupWizard.updates.available', { count: availablePackages.length }) }}
        </p>
        <ul class="flex flex-col gap-1 max-h-48 overflow-y-auto scrollbar-thin">
          <li
            v-for="pkg in availablePackages"
            :key="pkg.name"
            class="flex items-center justify-between gap-2 rounded-control bg-surface-2 px-3 py-2"
          >
            <span class="text-sm text-content truncate">{{ pkg.name }}</span>
            <span class="text-xs text-content-muted font-mono shrink-0">
              {{ pkg.installedVersion || '—' }} → {{ pkg.latestVersion || '—' }}
            </span>
          </li>
        </ul>
        <button class="tns-btn-primary" :disabled="isUpgradeBusy" @click="startUpgrade">
          {{ t('components.setupWizard.updates.startUpgrade') }}
        </button>
        <p class="text-xs text-content-faint">
          {{ t('components.setupWizard.updates.upgradeHint') }}
        </p>
      </template>
    </template>

    <button class="tns-btn-secondary" :disabled="isChecking || isUpgradeBusy" @click="checkUpdates">
      <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': isChecking }" />
      {{ t('components.setupWizard.updates.recheck') }}
    </button>

    <p v-if="errorMessage" class="text-sm text-status-danger break-words">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import apiPinsService from '@/services/apiPinsService';
import { useSettingsStore } from '@/store/settingsStore';
import { usePinsStore } from '@/store/pinsStore';
import { apiStore } from '@/store/store';
import { usePinsUpgradeTracker } from '@/components/pins/composables/usePinsUpgradeTracker';
import { parseJobIdFromResponse } from '@/components/pins/composables/pinsJobPolling';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const pinsStore = usePinsStore();
const store = apiStore();

const { terminalStatus: status, activeOperation, currentJobId: jobId } = storeToRefs(pinsStore);

const updatesResult = ref(null);
const isChecking = ref(false);
const errorMessage = ref('');

const hasResult = computed(() => updatesResult.value !== null);
const availablePackages = computed(() =>
  (updatesResult.value?.packages || []).filter((pkg) => pkg.updateAvailable)
);
const isUpgradeBusy = computed(
  () => activeOperation.value === 'upgrade' && status.value === 'Running'
);

function getIp() {
  return settingsStore.connection.ip || window.location.hostname;
}

function appendLog(message) {
  pinsStore.appendTerminalLog(message);
}

const {
  beginUpgradeTrackingFromStart,
  adoptRunningUpgrade,
  resetUpgradeForNewRun,
  restoreUpgradeState,
} = usePinsUpgradeTracker({
  t,
  appendLog,
  pinsStore,
  status,
  jobId,
  activeOperation,
  getIp,
  shouldWaitForApiRecovery: () => !store.isBackendReachable,
});

async function checkUpdates() {
  if (isChecking.value) return;
  isChecking.value = true;
  errorMessage.value = '';
  try {
    updatesResult.value = (await apiPinsService.getPinsUpdatesCheck()) || null;
  } catch (error) {
    console.error('[PinsWizard] Update check failed:', error);
    errorMessage.value = t('components.setupWizard.updates.checkFailed', {
      message: error.message,
    });
  } finally {
    isChecking.value = false;
  }
}

async function startUpgrade() {
  // The PINS page may already be tracking the same job; don't start a second run.
  if (isUpgradeBusy.value) return;

  const ip = getIp();
  if (!ip) return;

  errorMessage.value = '';
  status.value = 'Running';
  pinsStore.setActiveOperation('upgrade');
  pinsStore.clearTerminalLogs();
  resetUpgradeForNewRun();
  appendLog(t('plugins.pins.logs.init', { ip }));

  try {
    const data = await apiPinsService.startPinsUpgrade({ dryRun: false });
    const returnedJobId = parseJobIdFromResponse(data);

    if (!returnedJobId) {
      throw new Error('No valid Job ID returned.');
    }

    appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));
    // The tracker polls /jobs/{id} and persists it, so the upgrade survives the
    // daemon restart. The global overlay in App.vue renders the progress.
    beginUpgradeTrackingFromStart(ip, returnedJobId, data);
  } catch (error) {
    if (adoptRunningUpgrade(ip, error)) return;
    console.error('[PinsWizard] Upgrade start failed:', error);
    status.value = error?.response ? 'Failed' : 'Unknown';
    errorMessage.value = t('components.setupWizard.updates.upgradeFailed', {
      message: error.message,
    });
  }
}

onMounted(() => {
  // If the app was reloaded mid-upgrade without ever opening the PINS page,
  // nothing else would resurrect the tracker and its blocking overlay.
  restoreUpgradeState();
  checkUpdates();
});
</script>
