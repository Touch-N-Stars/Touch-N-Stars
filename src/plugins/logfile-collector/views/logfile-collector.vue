<template>
  <div class="p-4 space-y-4">
    <h5 class="text-2xl font-bold text-white">{{ $t('plugins.logfileCollector.title') }}</h5>

    <div
      class="border border-gray-700 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg p-5 space-y-4"
    >
      <p class="text-gray-300">
        {{ $t('plugins.logfileCollector.intro') }}
      </p>

      <div class="space-y-2">
        <label class="block text-sm text-gray-300" for="desc">
          {{ $t('plugins.logfileCollector.descriptionLabel') }}
        </label>
        <textarea
          id="desc"
          v-model="description"
          required
          rows="4"
          :aria-invalid="descriptionTouched && !descriptionIsValid"
          aria-describedby="description-required"
          class="w-full text-sm rounded-md bg-gray-900 border p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          :class="descriptionTouched && !descriptionIsValid ? 'border-red-500' : 'border-gray-700'"
          :placeholder="$t('plugins.logfileCollector.descriptionPlaceholder')"
          @blur="descriptionTouched = true"
        ></textarea>
        <p
          v-if="descriptionTouched && !descriptionIsValid"
          id="description-required"
          class="text-xs text-red-400"
        >
          {{ $t('plugins.logfileCollector.descriptionRequired') }}
        </p>
      </div>

      <!-- PINS: the same "Collect & Upload" action below also collects system diagnostics
           automatically - this panel only offers optional, advanced narrowing of what's
           collected. There is no separate action/button for it. -->
      <div
        v-if="apiState.isPINS"
        class="space-y-3 rounded border border-gray-700 bg-gray-900/40 p-3"
      >
        <h6 class="text-sm font-semibold text-white">
          {{ $t('plugins.logfileCollector.diagnostics.title') }}
        </h6>
        <p class="text-gray-300 text-sm">{{ $t('plugins.logfileCollector.diagnostics.intro') }}</p>

        <button
          type="button"
          class="flex w-auto! items-center gap-1 text-sm text-gray-300 hover:text-white"
          @click="diagnosticsExpertMode = !diagnosticsExpertMode"
        >
          <span>{{ $t('plugins.logfileCollector.diagnostics.expertMode') }}</span>
          <svg
            class="w-4 h-4 transition-transform"
            :class="{ 'rotate-180': diagnosticsExpertMode }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <div v-if="diagnosticsExpertMode" class="space-y-3">
          <div class="space-y-2">
            <h6 class="text-sm font-semibold text-gray-300">
              {{ $t('plugins.logfileCollector.diagnostics.sectionsTitle') }}
            </h6>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                class="flex items-center gap-2 rounded border border-gray-700 bg-gray-900/40 p-2 text-sm text-gray-200"
              >
                <input v-model="includeNinaLogs" type="checkbox" class="accent-cyan-500" />
                <span>{{ $t('plugins.logfileCollector.diagnostics.ninaLogs') }}</span>
              </label>
              <label
                v-for="section in diagnosticsSections"
                :key="section.key"
                class="flex items-center gap-2 rounded border border-gray-700 bg-gray-900/40 p-2 text-sm text-gray-200"
              >
                <input v-model="section.enabled" type="checkbox" class="accent-cyan-500" />
                <span>{{ section.label }}</span>
              </label>
            </div>
            <p v-if="diagnosticsValidationErrors.sections" class="text-xs text-red-400">
              {{ diagnosticsValidationErrors.sections }}
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="block text-sm text-gray-300" for="journalLines">
                {{ $t('plugins.logfileCollector.diagnostics.journalLines') }}
              </label>
              <input
                id="journalLines"
                v-model.number="diagnosticsJournalLines"
                type="number"
                min="100"
                max="50000"
                class="w-full text-sm rounded-md bg-gray-900 border border-gray-700 p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p v-if="diagnosticsValidationErrors.journalLines" class="text-xs text-red-400">
                {{ diagnosticsValidationErrors.journalLines }}
              </p>
            </div>

            <div class="space-y-1">
              <label class="block text-sm text-gray-300" for="dmesgLines">
                {{ $t('plugins.logfileCollector.diagnostics.dmesgLines') }}
              </label>
              <input
                id="dmesgLines"
                v-model.number="diagnosticsDmesgLines"
                type="number"
                min="100"
                max="50000"
                class="w-full text-sm rounded-md bg-gray-900 border border-gray-700 p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p v-if="diagnosticsValidationErrors.dmesgLines" class="text-xs text-red-400">
                {{ diagnosticsValidationErrors.dmesgLines }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="diagnosticsUiState.kind !== 'idle'"
          class="rounded border border-gray-700 bg-gray-900/60 p-3 space-y-1 text-sm"
        >
          <p class="text-gray-300">
            {{ $t('plugins.logfileCollector.diagnostics.statusLabel') }}:
            <span
              class="font-semibold"
              :class="
                diagnosticsUiState.kind === 'success'
                  ? 'text-green-400'
                  : diagnosticsUiState.kind === 'failed'
                    ? 'text-red-400'
                    : diagnosticsUiState.kind === 'running'
                      ? 'text-yellow-400'
                      : 'text-gray-300'
              "
            >
              {{ diagnosticsStatusText }}
            </span>
          </p>
          <p v-if="logCollectorStore.diagnosticsRun.archiveId" class="text-gray-400">
            {{ $t('plugins.logfileCollector.diagnostics.archiveId') }}:
            <code class="text-cyan-400">{{ logCollectorStore.diagnosticsRun.archiveId }}</code>
          </p>
          <p v-if="logCollectorStore.diagnosticsRun.error" class="text-red-400">
            {{ logCollectorStore.diagnosticsRun.error }}
          </p>
          <p v-if="logCollectorStore.diagnosticsRun.lastMessage" class="text-gray-400">
            {{ logCollectorStore.diagnosticsRun.lastMessage }}
          </p>
        </div>
      </div>

      <p class="text-sm text-gray-400">
        {{ $t('plugins.logfileCollector.actions.hint') }}
      </p>

      <div class="flex flex-wrap items-center gap-3">
        <button
          @click="collectAndUpload"
          :disabled="busy || !descriptionIsValid"
          class="tns-btn-primary w-auto! px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="busy && activeAction === 'upload'" class="inline-flex items-center gap-2">
            <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2" opacity=".25" />
              <path d="M4 12a8 8 0 0 1 8-8" stroke-width="2" stroke-linecap="round" />
            </svg>
            {{ progressMessage || $t('plugins.logfileCollector.actions.uploading') }}
          </span>
          <span v-else>{{ $t('plugins.logfileCollector.actions.collectUpload') }}</span>
        </button>

        <button
          @click="collectAndSave"
          :disabled="busy || !descriptionIsValid"
          class="tns-btn-secondary w-auto! px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="busy && activeAction === 'save'" class="inline-flex items-center gap-2">
            <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2" opacity=".25" />
              <path d="M4 12a8 8 0 0 1 8-8" stroke-width="2" stroke-linecap="round" />
            </svg>
            {{ progressMessage || $t('plugins.logfileCollector.actions.saving') }}
          </span>
          <span v-else>{{ $t('plugins.logfileCollector.actions.collectSave') }}</span>
        </button>

        <span
          v-if="resultMsg"
          :class="resultOk ? 'text-green-400' : 'text-red-400'"
          class="text-sm"
        >
          {{ resultMsg }}
        </span>
      </div>

      <div
        v-if="busy && progressPhase"
        class="h-1.5 w-full overflow-hidden rounded-full bg-gray-700"
      >
        <div
          class="h-full rounded-full bg-cyan-500 transition-all duration-300 ease-out"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>

      <!-- Archives kept inside the app by "Collect & Save" (e.g. collected earlier without an
           internet connection). Only these can be uploaded - there is deliberately no free
           file picker, so the support endpoint only ever receives app-generated archives. -->
      <div class="space-y-2 rounded border border-gray-700 bg-gray-900/40 p-3">
        <h6 class="text-sm font-semibold text-gray-300">
          {{ $t('plugins.logfileCollector.savedArchives.title') }}
        </h6>
        <p class="text-gray-400 text-xs">
          {{ $t('plugins.logfileCollector.savedArchives.intro') }}
        </p>
        <p v-if="logCollectorStore.savedArchives.length === 0" class="text-gray-500 text-sm">
          {{ $t('plugins.logfileCollector.savedArchives.empty') }}
        </p>
        <div
          v-for="archive in logCollectorStore.savedArchives"
          :key="archive.id"
          class="space-y-2 rounded border border-gray-600 bg-gray-800 p-3"
        >
          <div class="text-sm text-gray-300">
            {{ formatDate(archive.createdAt) }} · {{ archive.filename }} ·
            {{ formatSize(archive.size) }}
          </div>
          <p class="truncate text-xs text-gray-400" :title="archive.description">
            {{ archive.description }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              @click="uploadSavedArchive(archive)"
              :disabled="busy"
              class="tns-btn-primary w-auto! px-2! text-xs! disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span
                v-if="activeArchiveId === archive.id && activeArchiveAction === 'upload'"
                class="inline-flex items-center gap-2"
              >
                <svg
                  class="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="12" cy="12" r="10" stroke-width="2" opacity=".25" />
                  <path d="M4 12a8 8 0 0 1 8-8" stroke-width="2" stroke-linecap="round" />
                </svg>
                {{ $t('plugins.logfileCollector.actions.uploading') }}
              </span>
              <span v-else>{{ $t('plugins.logfileCollector.savedArchives.upload') }}</span>
            </button>
            <button
              @click="downloadSavedArchive(archive)"
              :disabled="busy"
              class="tns-btn-secondary w-auto! px-2! text-xs! disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span
                v-if="activeArchiveId === archive.id && activeArchiveAction === 'download'"
                class="inline-flex items-center gap-2"
              >
                <svg
                  class="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="12" cy="12" r="10" stroke-width="2" opacity=".25" />
                  <path d="M4 12a8 8 0 0 1 8-8" stroke-width="2" stroke-linecap="round" />
                </svg>
                {{ $t('plugins.logfileCollector.actions.saving') }}
              </span>
              <span v-else>{{ $t('plugins.logfileCollector.savedArchives.download') }}</span>
            </button>
            <button
              @click="deleteSavedArchive(archive)"
              :disabled="busy"
              class="tns-btn-danger w-auto! px-2! text-xs! disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ $t('plugins.logfileCollector.savedArchives.delete') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Generated Token Display -->
      <div v-if="lastGeneratedToken" class="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
        <h6 class="text-sm font-semibold text-gray-300 mb-2">
          {{ $t('plugins.logfileCollector.lastToken') }}
        </h6>
        <div class="flex items-center justify-between">
          <code class="text-xs text-cyan-400 font-mono">{{ lastGeneratedToken }}</code>
          <button
            @click="copyTokenToClipboard(lastGeneratedToken)"
            class="ml-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          >
            {{ $t('plugins.logfileCollector.actions.copyToken') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Submission History -->
    <div
      v-if="logCollectorStore.getAllSubmissions.length > 0"
      class="border border-gray-700 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg p-5 space-y-4"
    >
      <h6 class="text-lg font-semibold text-white">
        {{ $t('plugins.logfileCollector.submissionHistory') }}
      </h6>

      <div class="space-y-2 max-h-64 overflow-y-auto">
        <div
          v-for="submission in logCollectorStore.getAllSubmissions"
          :key="submission.id"
          class="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-600"
        >
          <div class="flex-1">
            <div class="text-sm text-gray-300">
              <strong>{{ $t('plugins.logfileCollector.submissionFields.date') }}:</strong>
              {{ formatDate(submission.date) }}
            </div>
            <div class="text-sm text-gray-300">
              <strong>{{ $t('plugins.logfileCollector.submissionFields.filename') }}:</strong>
              {{ submission.filename }}
            </div>
            <div class="text-sm text-gray-400">
              <strong>{{ $t('plugins.logfileCollector.submissionFields.token') }}:</strong>
              <code class="text-xs text-cyan-400 font-mono">{{ submission.token }}</code>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              @click="copyTokenToClipboard(submission.token)"
              class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            >
              {{ $t('plugins.logfileCollector.actions.copyToken') }}
            </button>
            <button
              @click="removeSubmission(submission.id)"
              class="px-2 py-1 text-xs bg-red-700 hover:bg-red-600 rounded"
            >
              {{ $t('plugins.logfileCollector.actions.remove') }}
            </button>
          </div>
        </div>
      </div>

      <div class="flex justify-end">
        <button
          @click="clearAllSubmissions"
          class="px-3 py-1 text-sm bg-red-700 hover:bg-red-600 rounded"
        >
          {{ $t('plugins.logfileCollector.actions.clearAll') }}
        </button>
      </div>
    </div>

    <Modal
      :show="showSuccessModal"
      max-width="max-w-lg"
      z-index="z-[90]"
      @close="showSuccessModal = false"
    >
      <template #header>
        <h2 class="pr-2 text-lg font-bold text-green-400 sm:text-xl">
          {{ $t('plugins.logfileCollector.successDialog.title') }}
        </h2>
      </template>
      <template #body>
        <div class="w-full min-w-0 space-y-4">
          <p class="text-gray-200">
            {{ $t('plugins.logfileCollector.successDialog.message') }}
          </p>
          <p class="text-gray-300">
            {{ $t('plugins.logfileCollector.successDialog.supportPrompt') }}
          </p>

          <div class="min-w-0 space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-3">
            <p class="mb-2 text-xs text-gray-400">
              {{ $t('plugins.logfileCollector.successDialog.tokenHint') }}
            </p>
            <code
              class="block w-full min-w-0 break-all rounded-md border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-sm leading-relaxed text-cyan-400"
            >
              {{ lastGeneratedToken }}
            </code>
            <button
              class="tns-btn-secondary rounded px-3 py-2 text-xs"
              @click="copyTokenToClipboard(lastGeneratedToken)"
            >
              {{ $t('plugins.logfileCollector.actions.copyToken') }}
            </button>
          </div>

          <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              class="tns-btn-primary rounded px-4 py-3 text-center"
              href="https://github.com/Touch-N-Stars/Touch-N-Stars/issues/new/choose"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ $t('plugins.logfileCollector.successDialog.github') }}
            </a>
            <a
              class="tns-btn-secondary rounded px-4 py-3 text-center"
              href="https://discord.com/invite/4gZJEMWFcN"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ $t('plugins.logfileCollector.successDialog.discord') }}
            </a>
          </div>

          <button
            class="w-full rounded bg-gray-700 px-4 py-3 text-white hover:bg-gray-600"
            @click="showSuccessModal = false"
          >
            {{ $t('common.close') }}
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import Modal from '@/components/helpers/Modal.vue';
import { useI18n } from 'vue-i18n';
import { useLogStore } from '@/store/logStore';
import { useLogCollectorStore } from '../store/logCollectorStore';
import { generateTimestampLogToken } from '../utils/tokenGenerator';
import pluginMeta from '../plugin.json';
import axios from 'axios';
import JSZip from 'jszip';
import { Capacitor } from '@capacitor/core';
import apiService from '@/services/apiService';
import apiPinsService from '@/services/apiPinsService';
import { ensureConsolePatched, consoleLogs } from '@/utils/consoleCapture';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import appVersion from '@/version';
import { createDiagnosticsApi } from '../utils/diagnosticsApi';
import { downloadBlob } from '@/utils/blobDownloader';
import {
  DIAGNOSTICS_DEFAULTS,
  DIAGNOSTICS_STATUS,
  PINS_NINA_LOG_PATH,
  buildDiagnosticsPayload,
  getDiagnosticsUiStatus,
  normalizeDiagnosticsOptions,
  validateDiagnosticsConfig,
} from '../utils/diagnosticsSupport';
import { buildLogManifest, MANIFEST_DIAGNOSTICS_VALIDATION_FAILED } from '../utils/manifestBuilder';
import { PINS_PORT as PORT, DEFAULT_PINS_DAEMON_API_TOKEN as TOKEN } from '@/services/pinsConfig';
import { copyText } from '@/utils/clipboard';

const logStore = useLogStore();
const logCollectorStore = useLogCollectorStore();
const apiState = apiStore();
const settingsStore = useSettingsStore();
const busy = ref(false);
const resultMsg = ref('');
const resultOk = ref(false);
const description = ref('');
const descriptionTouched = ref(false);
const progressMessage = ref('');
// Named phase mirroring progressMessage, used only to size the progress bar below the
// buttons - kept separate from progressMessage so its (translated) text stays untouched.
const progressPhase = ref(null); // 'collectingLogs' | 'collectingNinaLogs' | 'diagnostics' | 'buildingArchive' | 'finalAction' | null
const showSuccessModal = ref(false);
const lastGeneratedToken = ref('');
const diagnosticsSections = ref([]);
const diagnosticsExpertMode = ref(false);
const includeNinaLogs = ref(true);
const diagnosticsJournalLines = ref(DIAGNOSTICS_DEFAULTS.journalLines);
const diagnosticsDmesgLines = ref(DIAGNOSTICS_DEFAULTS.dmesgLines);
const diagnosticsOptionsLoading = ref(false);
const diagnosticsValidationErrors = ref({});
const activeAction = ref(null); // 'upload' | 'save' | null - which action is currently busy
const activeArchiveId = ref(null);
const activeArchiveAction = ref(null); // 'upload' | 'download' | null - per-row spinner
const { t } = useI18n();

const diagnosticsApi = createDiagnosticsApi({
  getIp,
  port: PORT,
  token: TOKEN,
});

const diagnosticsUiState = computed(() => getDiagnosticsUiStatus(logCollectorStore.diagnosticsRun));
const descriptionIsValid = computed(() => description.value.trim().length > 0);
// Ordered phases for the current run, used to size the progress bar. Not persisted -
// recomputed live from the same flags collectLogFiles() itself branches on.
const progressStepOrder = computed(() => {
  const steps = ['collectingLogs'];
  if (apiState.isPINS) {
    if (includeNinaLogs.value) steps.push('collectingNinaLogs');
    steps.push('diagnostics');
  }
  steps.push('buildingArchive', 'finalAction');
  return steps;
});
const progressPercent = computed(() => {
  const stepIndex = progressStepOrder.value.indexOf(progressPhase.value);
  if (stepIndex < 0) return 0;
  return Math.round(((stepIndex + 1) / progressStepOrder.value.length) * 100);
});
const diagnosticsStatusText = computed(() => {
  const status = logCollectorStore.diagnosticsRun.status;
  if (status === DIAGNOSTICS_STATUS.QUEUED)
    return t('plugins.logfileCollector.diagnostics.statusQueued');
  if (status === DIAGNOSTICS_STATUS.RUNNING)
    return t('plugins.logfileCollector.diagnostics.statusRunning');
  if (status === DIAGNOSTICS_STATUS.SUCCESS)
    return t('plugins.logfileCollector.diagnostics.statusSuccess');
  if (status === DIAGNOSTICS_STATUS.FAILED)
    return t('plugins.logfileCollector.diagnostics.statusFailed');
  if (status === DIAGNOSTICS_STATUS.TIMEOUT)
    return t('plugins.logfileCollector.diagnostics.statusTimeout');
  return t('plugins.logfileCollector.diagnostics.statusIdle');
});

onMounted(() => {
  logCollectorStore.loadSavedArchives();
  // Make sure we have recent logs
  try {
    logStore.fetchLogInfos?.();
  } catch (e) {
    // ignore
  }
  // Ensure console capture is active
  try {
    ensureConsolePatched();
  } catch (e) {
    /* ignore */
  }

  if (apiState.isPINS) {
    loadDiagnosticsOptions();
  }
});

watch(
  () => apiState.isPINS,
  (isPins) => {
    if (isPins && diagnosticsSections.value.length === 0) {
      loadDiagnosticsOptions();
    }
  }
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildZip(filesMap) {
  const zip = new JSZip();
  for (const [path, data] of filesMap) {
    zip.file(path, data);
  }
  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

const NINA_LOG_FILE_COUNT = 10;

async function addRecentNinaLogFiles(filesMap) {
  try {
    const listing = await apiService.browseFilesystem(PINS_NINA_LOG_PATH);
    const files = Array.isArray(listing?.files) ? listing.files : [];
    const recentFiles = [...files]
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      .slice(0, NINA_LOG_FILE_COUNT);

    for (const file of recentFiles) {
      try {
        const buffer = await apiService.fetchFilesystemFileBuffer(file.path);
        filesMap.set(`nina-logs/${file.name}`, buffer);
      } catch (fileError) {
        console.warn(`Failed to read NINA log file "${file.path}":`, fileError);
      }
    }
  } catch (error) {
    console.warn('Failed to list NINA log files from PINS:', error);
  }
}

// Collects everything (TNS/console logs, PINS-only: recent NINA logs + system diagnostics)
// into a single filesMap, plus a manifest.json recording app version, platform, NINA/PINS
// mode and (PINS-only) the diagnostics configuration actually used - so support can tell
// what a given upload contains without asking. Shared by "Collect & Upload" and
// "Collect & Save" so both produce the exact same content and differ only in what happens
// to the resulting ZIP.
async function collectLogFiles({ description = '', logToken = null } = {}) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filesMap = new Map();

  progressMessage.value = t('plugins.logfileCollector.progress.collectingLogs');
  progressPhase.value = 'collectingLogs';

  // General logs (last 5000 entries)
  const generalLogs = await apiService.getLastLogs('5000');
  const generalText = (generalLogs || [])
    .map((e) => `[${new Date(e.timestamp).toISOString()}] ${e.level}: ${e.message}`)
    .join('\n');
  filesMap.set(`tns/tns-logs-${dateStr}.log`, generalText);

  // Debug logs from console capture (last 5000 entries)
  const captured = Array.isArray(consoleLogs.value) ? consoleLogs.value : [];
  const recentConsole = captured.slice(-5000);
  const consoleText = recentConsole
    .map(
      (e) =>
        `[${new Date(e.ts || Date.now()).toISOString()}] ${e.type?.toUpperCase?.() || 'LOG'}: ${e.message}`
    )
    .join('\n');
  filesMap.set(`tns/tns-debug-${dateStr}.log`, consoleText);

  // PINS-only: the log path is a stable constant there (fixed system user "pi"), unlike
  // NINA/Windows where %LOCALAPPDATA% varies per user account and can't be resolved from
  // the frontend (see PINS_NINA_LOG_PATH). Never let a failure here block collection.
  // System diagnostics are collected as part of this same action too - there is no
  // separate "start diagnostics" step, everything ends up in one ZIP.
  // apiState.currentPinsVersion is only the bare "3.3.0.1057" reported by /v2/api - the
  // PINS daemon's own updates/check endpoint additionally carries the build/commit suffix
  // (e.g. "3.3.0.1057-nightly+1788375849"), which support needs to pin down the exact build.
  // Never let a failure here block collection - fall back to the bare version.
  let pinsVersionForManifest = apiState.currentPinsVersion || '';
  let diagnosticsManifestSection = null;
  if (apiState.isPINS) {
    try {
      const updatesCheck = await apiPinsService.getPinsUpdatesCheck();
      const pinsPackage = (updatesCheck?.packages || []).find((pkg) => pkg.name === 'pins');
      if (pinsPackage?.installedVersion) {
        pinsVersionForManifest = pinsPackage.installedVersion;
      }
    } catch (error) {
      console.warn('Failed to fetch PINS build number:', error);
    }

    const requestedDiagnosticsConfig = {
      ...buildDiagnosticsPayload({
        sections: diagnosticsSections.value,
        journalLines: diagnosticsJournalLines.value,
        dmesgLines: diagnosticsDmesgLines.value,
      }),
      includeNinaLogs: includeNinaLogs.value,
    };

    if (includeNinaLogs.value) {
      progressMessage.value = t('plugins.logfileCollector.progress.collectingNinaLogs');
      progressPhase.value = 'collectingNinaLogs';
      await addRecentNinaLogFiles(filesMap);
    }

    await runPinsDiagnostics(filesMap);

    const hasValidationErrors = Object.keys(diagnosticsValidationErrors.value).length > 0;
    const run = logCollectorStore.diagnosticsRun;
    diagnosticsManifestSection = {
      requested: requestedDiagnosticsConfig,
      outcome: hasValidationErrors
        ? {
            status: MANIFEST_DIAGNOSTICS_VALIDATION_FAILED,
            archiveId: null,
            error: null,
            startedAt: null,
            finishedAt: null,
            errors: { ...diagnosticsValidationErrors.value },
          }
        : {
            status: run.status,
            archiveId: run.archiveId || null,
            error: run.error || null,
            startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : null,
            finishedAt: run.finishedAt ? new Date(run.finishedAt).toISOString() : null,
          },
    };
  }

  const manifest = buildLogManifest({
    generatedAt: new Date().toISOString(),
    description,
    logToken,
    app: {
      tnsVersion: appVersion,
      platform: Capacitor.getPlatform(),
      mode: apiState.isPINS ? 'pins' : 'nina',
      locale: settingsStore.getLanguage?.() || apiState.currentLanguage || 'en',
    },
    versions: {
      api: apiState.currentApiVersion || '',
      pins: pinsVersionForManifest,
      tnsPlugin: apiState.currentTnsPluginVersion || '',
    },
    diagnostics: diagnosticsManifestSection,
  });
  filesMap.set('manifest.json', JSON.stringify(manifest, null, 2));

  return filesMap;
}

async function collectAndUpload() {
  descriptionTouched.value = true;
  if (!descriptionIsValid.value) {
    resultOk.value = false;
    resultMsg.value = t('plugins.logfileCollector.descriptionRequired');
    return;
  }

  busy.value = true;
  activeAction.value = 'upload';
  resultMsg.value = '';
  resultOk.value = false;
  progressMessage.value = '';
  progressPhase.value = null;
  try {
    const logToken = generateTimestampLogToken();
    lastGeneratedToken.value = logToken;

    const filesMap = await collectLogFiles({ description: description.value, logToken });
    progressMessage.value = t('plugins.logfileCollector.progress.buildingArchive');
    progressPhase.value = 'buildingArchive';
    const zipBlob = await buildZip(filesMap);
    progressMessage.value = ''; // let the "Uploading…" fallback show during the actual network call
    progressPhase.value = 'finalAction';
    const zipFileName = `tns-logs-${Date.now()}.zip`;
    const res = await uploadZipBlob(zipBlob, zipFileName, description.value, logToken);

    resultOk.value = res.status >= 200 && res.status < 300;

    if (resultOk.value) {
      resultMsg.value = t('plugins.logfileCollector.result.success');

      // Clear description after successful upload
      description.value = '';
      descriptionTouched.value = false;
    } else {
      resultMsg.value = t('plugins.logfileCollector.result.failedWithStatus', {
        status: res.status,
      });
    }
  } catch (err) {
    console.error('Log upload failed', err);
    resultOk.value = false;
    resultMsg.value = t('plugins.logfileCollector.result.failed');
    lastGeneratedToken.value = ''; // Clear token on failure
  } finally {
    busy.value = false;
    activeAction.value = null;
    progressMessage.value = '';
    progressPhase.value = null;
  }
}

// Offline counterpart to collectAndUpload(): same collected content, but kept inside the app
// (IndexedDB) for a later upload instead of sent right away - no network call, works offline
// (the PINS diagnostics collection itself only talks to the local PINS daemon, not the internet).
// The token is generated here already so the manifest inside the ZIP matches the later upload.
async function collectAndSave() {
  descriptionTouched.value = true;
  if (!descriptionIsValid.value) {
    resultOk.value = false;
    resultMsg.value = t('plugins.logfileCollector.descriptionRequired');
    return;
  }

  busy.value = true;
  activeAction.value = 'save';
  resultMsg.value = '';
  resultOk.value = false;
  progressMessage.value = '';
  progressPhase.value = null;
  try {
    const logToken = generateTimestampLogToken();
    lastGeneratedToken.value = logToken;

    const filesMap = await collectLogFiles({ description: description.value, logToken });
    progressMessage.value = t('plugins.logfileCollector.progress.buildingArchive');
    progressPhase.value = 'buildingArchive';
    const zipBlob = await buildZip(filesMap);
    progressMessage.value = ''; // let the "Saving…" fallback show during the IndexedDB write
    progressPhase.value = 'finalAction';
    const zipFileName = `tns-logs-${Date.now()}.zip`;

    await logCollectorStore.saveArchive({
      filename: zipFileName,
      description: description.value,
      token: logToken,
      blob: zipBlob,
    });

    resultOk.value = true;
    resultMsg.value = t('plugins.logfileCollector.result.savedInApp', { filename: zipFileName });
    // The description now travels with the archive and is reused on upload.
    description.value = '';
    descriptionTouched.value = false;
  } catch (err) {
    console.error('Saving log archive in the app failed', err);
    resultOk.value = false;
    resultMsg.value = t('plugins.logfileCollector.result.saveFailed');
    lastGeneratedToken.value = '';
  } finally {
    busy.value = false;
    activeAction.value = null;
    progressMessage.value = '';
    progressPhase.value = null;
  }
}

async function loadSavedArchiveBlob(archive) {
  const blob = await logCollectorStore.getSavedArchiveBlob(archive.id);
  if (!blob) {
    resultOk.value = false;
    resultMsg.value = t('plugins.logfileCollector.result.archiveMissing');
    await logCollectorStore.loadSavedArchives();
  }
  return blob;
}

// Uploads an archive kept by collectAndSave(); goes through the same uploadZipBlob() as the
// live-collection path and reuses the token and description stored with the archive.
async function uploadSavedArchive(archive) {
  busy.value = true;
  activeArchiveId.value = archive.id;
  activeArchiveAction.value = 'upload';
  resultMsg.value = '';
  resultOk.value = false;
  try {
    const blob = await loadSavedArchiveBlob(archive);
    if (!blob) return;

    lastGeneratedToken.value = archive.token;
    const res = await uploadZipBlob(blob, archive.filename, archive.description, archive.token);
    resultOk.value = res.status >= 200 && res.status < 300;

    if (resultOk.value) {
      resultMsg.value = t('plugins.logfileCollector.result.success');
      await logCollectorStore.removeSavedArchive(archive.id);
    } else {
      resultMsg.value = t('plugins.logfileCollector.result.failedWithStatus', {
        status: res.status,
      });
    }
  } catch (err) {
    console.error('Log upload failed', err);
    resultOk.value = false;
    resultMsg.value = t('plugins.logfileCollector.result.failed');
  } finally {
    busy.value = false;
    activeArchiveId.value = null;
    activeArchiveAction.value = null;
  }
}

async function downloadSavedArchive(archive) {
  busy.value = true;
  activeArchiveId.value = archive.id;
  activeArchiveAction.value = 'download';
  resultMsg.value = '';
  resultOk.value = false;
  try {
    const blob = await loadSavedArchiveBlob(archive);
    if (!blob) return;

    const saveResult = await downloadBlob(blob, archive.filename, { folderName: 'TNS-Logs' });
    resultOk.value = true;
    resultMsg.value = t('plugins.logfileCollector.result.savedLocally', {
      filename: saveResult.filename,
    });
  } catch (err) {
    console.error('Exporting log archive to the device failed', err);
    resultOk.value = false;
    resultMsg.value = t('plugins.logfileCollector.result.saveFailed');
  } finally {
    busy.value = false;
    activeArchiveId.value = null;
    activeArchiveAction.value = null;
  }
}

async function deleteSavedArchive(archive) {
  try {
    await logCollectorStore.removeSavedArchive(archive.id);
  } catch (err) {
    console.error('Deleting saved log archive failed', err);
  }
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getIp() {
  return settingsStore.connection.ip || window.location.hostname;
}

function getDefaultDiagnosticsSections() {
  return [
    { key: 'includePinsJournal', label: 'PINS Journal', enabled: true },
    { key: 'includeApiJournal', label: 'API Journal', enabled: true },
    { key: 'includeUsb', label: 'USB', enabled: true },
    { key: 'includeDmesg', label: 'dmesg', enabled: true },
    { key: 'includeSystemInfo', label: 'System Info', enabled: true },
    { key: 'includeNetworkInfo', label: 'Network Info', enabled: true },
    { key: 'includeKernelModules', label: 'Kernel Modules', enabled: true },
  ];
}

async function loadDiagnosticsOptions() {
  if (!apiState.isPINS) {
    return;
  }

  diagnosticsOptionsLoading.value = true;
  diagnosticsValidationErrors.value = {};
  try {
    const raw = await diagnosticsApi.fetchDiagnosticsOptions();
    const normalized = normalizeDiagnosticsOptions(raw);
    diagnosticsSections.value =
      normalized.sections.length > 0 ? normalized.sections : getDefaultDiagnosticsSections();
    diagnosticsJournalLines.value = normalized.journalLines;
    diagnosticsDmesgLines.value = normalized.dmesgLines;
    logCollectorStore.setDiagnosticsLastMessage(
      t('plugins.logfileCollector.diagnostics.optionsLoaded')
    );
  } catch (error) {
    console.error('Failed to load diagnostics options:', error);
    diagnosticsSections.value = getDefaultDiagnosticsSections();
    logCollectorStore.setDiagnosticsLastMessage(
      t('plugins.logfileCollector.diagnostics.optionsLoadFailed')
    );
  } finally {
    diagnosticsOptionsLoading.value = false;
  }
}

// Runs the PINS system-diagnostics job to completion and merges its files into filesMap,
// so it ends up in the same upload as the basic logs - there is no separate upload step for
// it. Never throws: any failure here is recorded on the store for display and just means the
// diagnostics files are missing from the final ZIP, not that the whole upload is aborted.
async function runPinsDiagnostics(filesMap) {
  const validation = validateDiagnosticsConfig({
    sections: diagnosticsSections.value,
    journalLines: diagnosticsJournalLines.value,
    dmesgLines: diagnosticsDmesgLines.value,
  });
  diagnosticsValidationErrors.value = validation.errors;
  if (!validation.isValid) {
    return;
  }

  logCollectorStore.resetDiagnosticsRun();
  progressMessage.value = t('plugins.logfileCollector.diagnostics.collecting');
  progressPhase.value = 'diagnostics';

  try {
    const payload = buildDiagnosticsPayload({
      sections: diagnosticsSections.value,
      journalLines: diagnosticsJournalLines.value,
      dmesgLines: diagnosticsDmesgLines.value,
    });

    const startResponse = await diagnosticsApi.startDiagnosticsArchive(payload);
    logCollectorStore.beginDiagnosticsRun(startResponse);
    logCollectorStore.setDiagnosticsLastMessage(t('plugins.logfileCollector.diagnostics.started'));

    const archiveId = logCollectorStore.diagnosticsRun.archiveId;
    if (!archiveId) {
      return;
    }

    const succeeded = await pollDiagnosticsArchive(archiveId);
    if (!succeeded) {
      return;
    }

    // The diagnostics archive itself is not saved separately - its contents are merged
    // straight into the outer filesMap below, so it ends up in the one ZIP produced by
    // collectAndUpload()/collectAndSave() instead of downloading as a second file.
    const { blob } = await downloadDiagnosticsZipWithRetry(archiveId);

    const diagnosticsZip = await JSZip.loadAsync(blob);
    const entryPromises = [];
    diagnosticsZip.forEach((relativePath, entry) => {
      if (entry.dir) return;
      entryPromises.push(
        entry.async('uint8array').then((content) => {
          filesMap.set(`diagnostics/${relativePath}`, content);
        })
      );
    });
    await Promise.all(entryPromises);
  } catch (error) {
    console.error('PINS diagnostics collection failed:', error);
    logCollectorStore.setDiagnosticsError(
      extractErrorMessage(error, t('plugins.logfileCollector.diagnostics.startFailed'))
    );
  } finally {
    progressMessage.value = '';
  }
}

// Polls until the archive job reaches a terminal state. Transient poll errors are logged but
// don't abort the loop - only running out of time or a definitive failed/timeout status does.
async function pollDiagnosticsArchive(archiveId) {
  const deadline = Date.now() + DIAGNOSTICS_DEFAULTS.maxPollingDurationMs;
  while (Date.now() < deadline) {
    await sleep(DIAGNOSTICS_DEFAULTS.pollIntervalMs);
    try {
      const statusResponse = await diagnosticsApi.getDiagnosticsArchiveStatus(archiveId);
      logCollectorStore.setDiagnosticsStatusResponse(statusResponse, {
        maxDurationMs: DIAGNOSTICS_DEFAULTS.maxPollingDurationMs,
      });
    } catch (error) {
      logCollectorStore.setDiagnosticsLastMessage(
        extractErrorMessage(error, t('plugins.logfileCollector.diagnostics.pollFailed'))
      );
      continue;
    }

    const status = logCollectorStore.diagnosticsRun.status;
    if (status === DIAGNOSTICS_STATUS.SUCCESS) {
      return true;
    }
    if (status === DIAGNOSTICS_STATUS.FAILED || status === DIAGNOSTICS_STATUS.TIMEOUT) {
      return false;
    }
  }

  logCollectorStore.setDiagnosticsError(t('plugins.logfileCollector.diagnostics.pollFailed'));
  return false;
}

// The backend can briefly answer 409 right after the job reports success while it finishes
// writing the archive file - retry a few times before giving up.
async function downloadDiagnosticsZipWithRetry(archiveId, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await diagnosticsApi.downloadDiagnosticsArchive(archiveId);
    } catch (error) {
      if (error?.httpStatus === 409 && attempt < maxAttempts) {
        logCollectorStore.setDiagnosticsLastMessage(
          t('plugins.logfileCollector.diagnostics.stillPreparing')
        );
        await sleep(2000);
        continue;
      }
      throw new Error(
        extractErrorMessage(error, t('plugins.logfileCollector.diagnostics.downloadFailed'))
      );
    }
  }
}

async function uploadZipBlob(zipBlob, zipFileName, uploadDescription, logToken) {
  const normalizedDescription = uploadDescription?.trim();
  if (!normalizedDescription) {
    throw new Error(t('plugins.logfileCollector.descriptionRequired'));
  }

  const form = new FormData();
  form.append('file', zipBlob, zipFileName);
  form.append('logtoken', logToken);
  form.append('description', normalizedDescription);

  const url = pluginMeta.config?.uploadUrl;
  const token = pluginMeta.config?.authToken;

  if (!url || !token) {
    throw new Error('Upload URL or token missing in plugin config');
  }

  const res = await axios.post(url, form, {
    headers: { Authorization: `Bearer ${token}` },
    maxBodyLength: 50 * 1024 * 1024,
  });

  if (res.status >= 200 && res.status < 300) {
    logCollectorStore.addSubmission({
      date: new Date().toISOString(),
      filename: zipFileName,
      token: logToken,
    });
    showSuccessModal.value = true;
    return res;
  }

  throw new Error(`Upload failed with status ${res.status}`);
}

function extractErrorMessage(error, fallback) {
  const responseData = error?.response?.data;
  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData;
  }
  if (responseData && typeof responseData.message === 'string' && responseData.message.trim()) {
    return responseData.message;
  }
  if (responseData && typeof responseData.error === 'string' && responseData.error.trim()) {
    return responseData.error;
  }
  return error?.message || fallback;
}

// Utility functions for the new features
async function copyTokenToClipboard(token = lastGeneratedToken.value) {
  try {
    await copyText(token);
    resultMsg.value = t('plugins.logfileCollector.result.tokenCopied');
    resultOk.value = true;

    // Clear the message after 3 seconds
    setTimeout(() => {
      resultMsg.value = '';
    }, 3000);
  } catch (err) {
    console.error('Failed to copy token to clipboard:', err);
    resultMsg.value = t('plugins.logfileCollector.result.tokenCopyFailed');
    resultOk.value = false;
  }
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } catch (err) {
    return dateString;
  }
}

function removeSubmission(id) {
  const success = logCollectorStore.removeSubmission(id);
  if (success) {
    resultMsg.value = t('plugins.logfileCollector.result.submissionRemoved');
    resultOk.value = true;

    // Clear the message after 2 seconds
    setTimeout(() => {
      resultMsg.value = '';
    }, 2000);
  }
}

function clearAllSubmissions() {
  if (confirm(t('plugins.logfileCollector.confirmClearAll'))) {
    logCollectorStore.clearAllSubmissions();
    resultMsg.value = t('plugins.logfileCollector.result.allSubmissionsCleared');
    resultOk.value = true;

    // Clear the message after 2 seconds
    setTimeout(() => {
      resultMsg.value = '';
    }, 2000);
  }
}
</script>
