<template>
  <div class="flex flex-col gap-2 pt-1 border-t border-line">
    <div class="flex items-center justify-between gap-3">
      <span class="flex items-center gap-1">
        <span class="text-sm font-medium text-content">
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

    <!-- What is there already: plate solving fails within milliseconds without any database,
         and nothing else in the app says why. -->
    <p v-if="installed.length" class="flex items-center gap-2 text-xs text-status-ok">
      <span class="tns-dot bg-status-ok"></span>
      {{
        $t('components.settings.plate_solver.astapDatabaseInstalledList', {
          list: installed.map((pkg) => pkg.label || pkg.databaseId).join(', '),
        })
      }}
    </p>
    <p v-else-if="hasInstalled === false" class="text-xs text-status-warn">
      {{ $t('components.settings.plate_solver.astapDatabaseNoneInstalled') }}
    </p>

    <p v-if="recommendationText" class="text-xs text-content-muted">{{ recommendationText }}</p>

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
          {{ pkg.label || pkg.databaseId }} - {{ pkg.description || pkg.databaseId
          }}{{
            pkg.databaseId === recommendedId && !recommendationCovered
              ? ` (${$t('components.settings.plate_solver.astapDatabaseRecommendedTag')})`
              : ''
          }}
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

    <div v-if="checkedAt" class="text-xs text-content-faint">
      {{
        $t('components.settings.plate_solver.astapDatabaseLastChecked', {
          value: formatCheckedAt(checkedAt),
        })
      }}
    </div>

    <div v-if="isJobActive && progressPhase" class="flex flex-col gap-1" aria-live="polite">
      <div class="flex items-center justify-between gap-2 text-xs text-content">
        <span>{{ progressPhaseLabel }}</span>
        <span v-if="progressBytes > 0">
          <template v-if="hasDeterminateProgress">{{ progressPercent }}% · </template>
          {{ formatBytes(progressBytes) }}
          <template v-if="progressTotalBytes > 0">
            / {{ formatBytes(progressTotalBytes) }}</template
          >
        </span>
      </div>
      <div
        class="h-2 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        :aria-label="$t('components.settings.plate_solver.astapDatabaseTitle')"
        :aria-valuemin="0"
        :aria-valuemax="100"
        :aria-valuenow="hasDeterminateProgress ? progressPercent : undefined"
      >
        <div
          class="h-full rounded-full bg-accent transition-[width] duration-300"
          :class="{ 'animate-pulse': !hasDeterminateProgress }"
          :style="{ width: progressBarWidth }"
        ></div>
      </div>
      <div v-if="isProgressStalled" class="text-xs text-status-warn">
        {{ $t('components.settings.plate_solver.astapDatabaseProgressStalled') }}
      </div>
    </div>

    <div v-if="feedbackMessage" :class="feedbackClass" class="text-xs">
      {{ feedbackMessage }}
    </div>
    <!-- A failed install, seen live or found on opening the page, can be started again -->
    <button
      v-if="failedDatabaseId && !isJobActive && !isInstalling"
      type="button"
      class="tns-btn-secondary"
      :disabled="isLoading"
      @click="retryFailedInstall"
    >
      {{
        $t('components.settings.plate_solver.astapDatabaseRetry', { databaseId: failedDatabaseId })
      }}
    </button>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiPinsService from '@/services/apiPinsService';
import { isAppBackgrounded } from '@/utils/appLifecycle';
import InfoModal from '@/components/helpers/infoModal.vue';
import { useAstapDatabases } from '@/composables/useAstapDatabases';
import { astapJobDatabaseId } from '@/utils/astapDatabases';
import { apiStore } from '@/store/store';
import { localDecimal } from '@/utils/localeNumber';

const { t } = useI18n();

const astap = useAstapDatabases();
const { installed, hasInstalled, recommendedId, recommendationCovered, coveringId, fovDeg } = astap;
const store = apiStore();
// The select offers what can still be installed; installed ones are listed above it.
const packages = astap.installable;
const selectedDatabaseId = ref('');
const checkedAt = astap.checkedAt;

const isLoading = astap.loading;
const isInstalling = ref(false);
const jobId = ref('');
const jobStatus = ref('');
const progressPhase = ref('');
const progressPercent = ref(0);
const progressBytes = ref(0);
const progressTotalBytes = ref(0);
const progressUpdatedAt = ref(0);
const currentTime = ref(Date.now());

// The database of the last failed install, for the retry button
const failedDatabaseId = ref('');

const feedbackMessage = ref('');
const feedbackTone = ref('info');

let pollTimer = null;
let isDestroyed = false;
let lastProgressToken = '';

const isJobActive = computed(() => {
  const status = normalizeStatus(jobStatus.value);
  return status === 'started' || status === 'running';
});

const hasDeterminateProgress = computed(
  () => progressPhase.value === 'downloading' && progressTotalBytes.value > 0
);

const progressBarWidth = computed(() => {
  if (!hasDeterminateProgress.value) {
    return '35%';
  }
  return `${Math.max(1, Math.min(100, progressPercent.value))}%`;
});

const isProgressStalled = computed(
  () =>
    isJobActive.value &&
    progressPhase.value === 'downloading' &&
    progressUpdatedAt.value > 0 &&
    currentTime.value - progressUpdatedAt.value >= 30000
);

// Always says which database suits the rig, also when an installed one already serves it:
// the PINS image ships D80, which covers most telescopes, and a recommendation that only
// showed up when something was missing left users without any answer (field test).
const recommendationText = computed(() => {
  const id = recommendedId.value;
  const base = 'components.settings.plate_solver';
  if (!fovDeg.value) {
    if (recommendationCovered.value) return t(`${base}.astapDatabaseNeedsOptics`);
    if (!packages.value.some((pkg) => pkg.databaseId === id)) return '';
    return t(`${base}.astapDatabaseRecommendedDefault`, { id });
  }
  const values = {
    id,
    fov: localDecimal(fovDeg.value, 1),
    focal: Math.round(Number(store.profileInfo?.TelescopeSettings?.FocalLength)),
  };
  if (coveringId.value === id) return t(`${base}.astapDatabaseFitsInstalled`, values);
  if (coveringId.value) {
    return t(`${base}.astapDatabaseCoveredBy`, { ...values, installed: coveringId.value });
  }
  if (!packages.value.some((pkg) => pkg.databaseId === id)) return '';
  return t(`${base}.astapDatabaseRecommendedFocal`, values);
});

const KNOWN_PHASES = ['downloading', 'installing', 'finalizing', 'complete'];
// The daemon reports its phases in English; known ones are translated.
const progressPhaseLabel = computed(() =>
  KNOWN_PHASES.includes(progressPhase.value)
    ? t(`components.settings.plate_solver.astapDatabasePhase.${progressPhase.value}`)
    : progressPhase.value
);

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
    return 'text-status-ok';
  }
  if (feedbackTone.value === 'error') {
    return 'text-status-danger';
  }
  return 'text-content';
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
    if (isAppBackgrounded.value) scheduleJobPoll();
    else pollJobStatus();
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

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const scaled = bytes / 1024 ** unitIndex;
  return `${scaled.toFixed(unitIndex === 0 || scaled >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function updateProgress(response) {
  const phase = String(response?.progressPhase || '');
  const bytes = Number(response?.progressBytes);
  const totalBytes = Number(response?.progressTotalBytes);
  const percent = Number(response?.progressPercent);
  const updatedAt = Number(response?.progressUpdatedAt);

  progressPhase.value = phase;
  progressBytes.value = Number.isFinite(bytes) && bytes >= 0 ? bytes : 0;
  progressTotalBytes.value = Number.isFinite(totalBytes) && totalBytes >= 0 ? totalBytes : 0;
  progressPercent.value = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  const progressToken = `${phase}:${progressBytes.value}:${progressTotalBytes.value}:${progressPercent.value}:${updatedAt}`;
  if (phase && progressToken !== lastProgressToken) {
    lastProgressToken = progressToken;
    // Use the browser clock for stall detection so Pi/browser clock skew cannot
    // produce a false warning.
    progressUpdatedAt.value = Date.now();
  }
  currentTime.value = Date.now();
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

  try {
    await astap.refresh();
    if (isDestroyed) {
      return;
    }

    const availablePackages = packages.value;

    // Preselect the database that suits the rig; after an install the installed one leaves
    // the list and the selection empties instead of jumping to an unrelated database. Nothing
    // is preselected when an installed database already serves the rig's field of view.
    if (!availablePackages.some((pkg) => pkg.databaseId === selectedDatabaseId.value)) {
      selectedDatabaseId.value =
        !recommendationCovered.value &&
        availablePackages.some((pkg) => pkg.databaseId === recommendedId.value)
          ? recommendedId.value
          : '';
    }

    if (!availablePackages.length) {
      setFeedback(t('components.settings.plate_solver.astapDatabaseAllInstalled'), 'info');
    } else if (feedbackTone.value === 'info') {
      // An error and the success message of an install that just finished stay readable
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
    updateProgress(response);

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
      // The daemon's exit code means nothing to a user; the likely cause and the way out do.
      failedDatabaseId.value = astapJobDatabaseId(response) || selectedDatabaseId.value;
      setFeedback(
        t('components.settings.plate_solver.astapDatabaseDownloadFailed', {
          databaseId: failedDatabaseId.value,
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
  failedDatabaseId.value = '';
  progressPhase.value = '';
  progressPercent.value = 0;
  progressBytes.value = 0;
  progressTotalBytes.value = 0;
  progressUpdatedAt.value = Date.now();
  lastProgressToken = '';
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
    updateProgress(data);
    if (!progressUpdatedAt.value) {
      progressUpdatedAt.value = Date.now();
    }
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

function retryFailedInstall() {
  selectedDatabaseId.value = failedDatabaseId.value;
  return installSelectedDatabase();
}

/**
 * Picks up the rig's last star database job. One still running is shown and followed again,
 * one that failed is reported with a retry. Without this a download that failed - the normal
 * case at the field hotspot without internet - vanished as soon as the page was left, and the
 * page went on saying only what is installed.
 */
async function resumeLatestJob() {
  let job;
  try {
    job = await apiPinsService.getPinsDaemonLatestJob();
  } catch {
    return;
  }
  const databaseId = astapJobDatabaseId(job);
  if (isDestroyed || !databaseId || jobId.value) return;

  const status = normalizeStatus(job.status);
  if (status === 'started' || status === 'running') {
    jobId.value = String(job.jobId);
    jobStatus.value = status;
    selectedDatabaseId.value = databaseId;
    updateProgress(job);
    scheduleJobPoll(0);
  } else if (status === 'failed') {
    failedDatabaseId.value = databaseId;
    setFeedback(
      t('components.settings.plate_solver.astapDatabaseLastAttemptFailed', {
        databaseId,
        time: formatCheckedAt(Number(job.finishedAt) * 1000),
      }),
      'error'
    );
  }
}

onMounted(async () => {
  await loadPackages();
  await resumeLatestJob();
});

onBeforeUnmount(() => {
  isDestroyed = true;
  clearPollTimer();
});
</script>
