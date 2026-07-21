<template>
  <div class="flex flex-col gap-2 pt-1 border-t border-gray-700/60">
    <div class="flex items-center justify-between gap-3">
      <span class="flex items-center gap-1">
        <span class="text-sm font-medium text-gray-300">
          {{ $t('components.settings.plate_solver.astapDatabaseTitle') }}
        </span>
        <InfoModal
          :title="$t('components.settings.plate_solver.astapDatabaseTitle')"
          :message="$t('components.settings.plate_solver.astapDatabaseDescription')"
          size="w-4 h-4"
        />
      </span>

      <button
        @click="loadPackages"
        :disabled="isLoading || isInstalling"
        class="tns-btn-secondary px-3 text-xs"
      >
        {{ isLoading ? $t('common.loading') : $t('common.refresh') }}
      </button>
    </div>

    <div class="flex items-center gap-2">
      <select
        v-model="selectedDatabaseId"
        class="tns-select w-full"
        :disabled="isLoading || isInstalling || isJobActive || !packages.length"
      >
        <option value="">
          {{
            packages.length
              ? $t('components.settings.plate_solver.astapDatabaseSelectPlaceholder')
              : $t('components.settings.plate_solver.astapDatabaseNoInstallable')
          }}
        </option>
        <option v-for="pkg in packages" :key="pkg.databaseId" :value="pkg.databaseId">
          {{ pkg.label || pkg.databaseId }} - {{ pkg.description || pkg.databaseId }}
        </option>
      </select>

      <button
        @click="installSelectedDatabase"
        class="tns-btn-primary px-3 text-xs whitespace-nowrap"
        :disabled="
          !selectedDatabaseId || isLoading || isInstalling || isJobActive || !packages.length
        "
      >
        {{ installButtonLabel }}
      </button>
    </div>

    <div v-if="checkedAt" class="text-xs text-gray-500">
      {{
        $t('components.settings.plate_solver.astapDatabaseLastChecked', {
          value: formatCheckedAt(checkedAt),
        })
      }}
    </div>

    <div v-if="jobId" class="text-xs text-cyan-400">
      {{
        $t('components.settings.plate_solver.astapDatabaseJobStatus', {
          jobId,
          status: jobStatus || $t('components.settings.plate_solver.astapDatabaseJobStarted'),
        })
      }}
    </div>

    <div v-if="feedbackMessage" :class="feedbackClass" class="text-xs">
      {{ feedbackMessage }}
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiPinsService from '@/services/apiPinsService';
import InfoModal from '@/components/helpers/infoModal.vue';

const { t } = useI18n();

const packages = ref([]);
const selectedDatabaseId = ref('');
const checkedAt = ref('');

const isLoading = ref(false);
const isInstalling = ref(false);
const jobId = ref('');
const jobStatus = ref('');

const feedbackMessage = ref('');
const feedbackTone = ref('info');

let pollTimer = null;
let isDestroyed = false;

const isJobActive = computed(() => {
  const status = normalizeStatus(jobStatus.value);
  return status === 'started' || status === 'running';
});

const installButtonLabel = computed(() => {
  if (isJobActive.value) {
    return t('components.settings.plate_solver.astapDatabaseInstalling');
  }
  if (isInstalling.value) {
    return t('components.settings.plate_solver.astapDatabaseStarting');
  }
  return t('components.settings.plate_solver.astapDatabaseInstall');
});

const feedbackClass = computed(() => {
  if (feedbackTone.value === 'success') {
    return 'text-green-400';
  }
  if (feedbackTone.value === 'error') {
    return 'text-red-400';
  }
  return 'text-gray-300';
});

function normalizeStatus(value) {
  return String(value || '').toLowerCase();
}

function setFeedback(message, tone = 'info') {
  if (isDestroyed) {
    return;
  }
  feedbackMessage.value = message;
  feedbackTone.value = tone;
}

function clearPollTimer() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function scheduleJobPoll(delayMs = 1500) {
  clearPollTimer();
  if (!jobId.value || !isJobActive.value || isDestroyed) {
    return;
  }

  pollTimer = setTimeout(() => {
    pollJobStatus();
  }, delayMs);
}

function extractErrorDetail(error) {
  const details = error?.response?.data;
  if (typeof details === 'string' && details.trim()) {
    return details.trim();
  }
  if (details && typeof details.detail === 'string' && details.detail.trim()) {
    return details.detail.trim();
  }
  if (details && typeof details.message === 'string' && details.message.trim()) {
    return details.message.trim();
  }
  return error?.message || t('components.settings.plate_solver.astapDatabaseUnknownError');
}

function formatCheckedAt(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function extractJobId(data) {
  if (data && typeof data === 'object' && data.jobId) {
    return String(data.jobId);
  }
  if (typeof data === 'string' || typeof data === 'number') {
    return String(data);
  }
  return '';
}

async function loadPackages() {
  if (isDestroyed) {
    return;
  }

  isLoading.value = true;
  try {
    const payload = (await apiPinsService.getAstapStarDatabases()) || {};
    if (isDestroyed) {
      return;
    }

    const availablePackages = Array.isArray(payload.packages) ? payload.packages : [];
    packages.value = availablePackages;
    checkedAt.value = payload.checkedAt || '';

    if (!availablePackages.some((pkg) => pkg.databaseId === selectedDatabaseId.value)) {
      selectedDatabaseId.value = availablePackages[0]?.databaseId || '';
    }

    if (!availablePackages.length) {
      setFeedback(t('components.settings.plate_solver.astapDatabaseAllInstalled'), 'info');
    } else if (feedbackTone.value !== 'error') {
      setFeedback('');
    }
  } catch (error) {
    console.error('Failed to load ASTAP star databases:', error);
    setFeedback(
      t('components.settings.plate_solver.astapDatabaseLoadFailed', {
        detail: extractErrorDetail(error),
      }),
      'error'
    );
  } finally {
    if (!isDestroyed) {
      isLoading.value = false;
    }
  }
}

async function pollJobStatus() {
  if (!jobId.value || isDestroyed) {
    return;
  }

  try {
    const response = await apiPinsService.getPinsDaemonJob(jobId.value);
    if (isDestroyed) {
      return;
    }

    const currentStatus = normalizeStatus(response?.status);
    jobStatus.value = currentStatus || 'running';

    if (currentStatus === 'success') {
      isInstalling.value = false;
      setFeedback(
        t('components.settings.plate_solver.astapDatabaseInstallSuccess', {
          databaseId: selectedDatabaseId.value,
        }),
        'success'
      );
      await loadPackages();
      return;
    }

    if (currentStatus === 'failed') {
      isInstalling.value = false;
      const exitCode = response?.exitCode ?? response?.exit_code;
      setFeedback(
        t('components.settings.plate_solver.astapDatabaseInstallFailed', {
          exitCode: typeof exitCode === 'number' ? ` (${exitCode})` : '',
        }),
        'error'
      );
      await loadPackages();
      return;
    }

    scheduleJobPoll();
  } catch (error) {
    if (error?.response?.status === 401) {
      isInstalling.value = false;
      setFeedback(t('components.settings.plate_solver.astapDatabaseUnauthorizedStatus'), 'error');
      return;
    }

    // Keep polling for transient errors while the job may still be running.
    if (isDestroyed) {
      return;
    }

    setFeedback(
      t('components.settings.plate_solver.astapDatabaseStatusCheckFailedRetrying', {
        detail: extractErrorDetail(error),
      }),
      'info'
    );
    scheduleJobPoll(2500);
  }
}

async function installSelectedDatabase() {
  if (
    !selectedDatabaseId.value ||
    isLoading.value ||
    isInstalling.value ||
    isJobActive.value ||
    !packages.value.length ||
    isDestroyed
  ) {
    return;
  }

  isInstalling.value = true;
  setFeedback(
    t('components.settings.plate_solver.astapDatabaseStartInstall', {
      databaseId: selectedDatabaseId.value,
    }),
    'info'
  );

  try {
    const data = (await apiPinsService.installAstapStarDatabase(selectedDatabaseId.value)) || {};
    if (isDestroyed) {
      return;
    }

    const returnedJobId = extractJobId(data);
    if (!returnedJobId) {
      isInstalling.value = false;
      setFeedback(t('components.settings.plate_solver.astapDatabaseMissingJobId'), 'error');
      await loadPackages();
      return;
    }

    jobId.value = returnedJobId;
    jobStatus.value = normalizeStatus(data.status) || 'started';
    setFeedback(
      t('components.settings.plate_solver.astapDatabaseJobStartedMessage', {
        databaseId: selectedDatabaseId.value,
      }),
      'info'
    );
    scheduleJobPoll(0);
  } catch (error) {
    if (isDestroyed) {
      return;
    }

    isInstalling.value = false;

    if (error?.response?.status === 409) {
      setFeedback(extractErrorDetail(error), 'info');
      await loadPackages();
      return;
    }

    if (error?.response?.status === 401) {
      setFeedback(t('components.settings.plate_solver.astapDatabaseUnauthorizedStart'), 'error');
      return;
    }

    setFeedback(
      t('components.settings.plate_solver.astapDatabaseStartFailed', {
        detail: extractErrorDetail(error),
      }),
      'error'
    );
  }
}

onMounted(() => {
  loadPackages();
});

onBeforeUnmount(() => {
  isDestroyed = true;
  clearPollTimer();
});
</script>
