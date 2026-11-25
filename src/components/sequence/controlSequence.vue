<template>
  <!-- A solid strip behind the buttons: without it the plan scrolled through the gaps between
       them and half-covered lines ("This sequence has no targets yet") were hard to read. -->
  <div
    :class="[
      'fixed flex flex-wrap gap-2 z-10 transition-[bottom] duration-300 p-1.5 rounded-card bg-ground/90 backdrop-blur-sm shadow-lg',
      isLandscape
        ? 'left-(--nav-offset) max-w-[calc(100vw-var(--nav-offset))]'
        : 'left-3 max-w-[calc(100vw-0.75rem)]',
    ]"
    style="bottom: calc(var(--above-statusbar) + var(--status-panel-height))"
  >
    <button
      :class="[
        'tns-btn-primary h-16 w-14 flex-col gap-0.5',
        { 'opacity-75 cursor-not-allowed': sequenceStore.sequenceRunning },
      ]"
      @click="startSequence"
      :disabled="sequenceStore.sequenceRunning"
    >
      <span v-if="sequenceStore.sequenceRunning" class="animate-spin text-lg">&#9696;</span>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        class="h-7 w-7"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="text-[9px] leading-none font-medium">{{ seqT('startSequence') }}</span>
    </button>

    <button
      v-if="sequenceStore.sequenceRunning"
      class="tns-btn-secondary h-16 w-14 flex-col gap-0.5"
      @click="stopSequence"
    >
      <PauseIcon class="h-7 w-7" />
      <span class="text-[9px] leading-none font-medium">{{
        $t('components.sequence.pauseSequence')
      }}</span>
    </button>

    <button
      v-if="sequenceStore.sequenceRunning"
      class="tns-btn-secondary h-16 w-14 flex-col gap-0.5"
      @click="skipCurrentItem"
    >
      <ForwardIcon class="h-6 w-6" />
      <span class="text-[9px] leading-none font-medium">{{
        $t('components.sequence.skipCurrentItem')
      }}</span>
    </button>

    <button
      v-if="sequenceStore.sequenceRunning"
      class="tns-btn-danger h-16 w-14 flex-col gap-0.5"
      @click="skipToEnd"
    >
      <FlagIcon class="h-6 w-6" />
      <span class="text-[9px] leading-none font-medium">{{
        $t('components.sequence.skipToEnd')
      }}</span>
    </button>

    <button
      class="h-16 w-14 flex-col gap-0.5"
      :class="
        sequenceStore.sequenceControlsLocked ? 'tns-btn-danger' : 'tns-btn-secondary border-accent'
      "
      :title="
        sequenceStore.sequenceControlsLocked
          ? $t('components.sequence.unlockControls')
          : $t('components.sequence.lockControls')
      "
      @click="toggleControlsLock"
    >
      <LockClosedIcon v-if="sequenceStore.sequenceControlsLocked" class="h-6 w-6" />
      <LockOpenIcon v-else class="h-6 w-6" />
      <span class="text-[9px] leading-none font-medium">{{
        sequenceStore.sequenceControlsLocked
          ? $t('components.sequence.unlockControls')
          : $t('components.sequence.lockControls')
      }}</span>
    </button>

    <button
      v-if="!sequenceStore.sequenceRunning"
      class="tns-btn-secondary h-16 w-14 flex-col gap-0.5"
      @click="showResetConfirmation = true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-7 w-7"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="text-[9px] leading-none font-medium">{{ seqT('resetSequence') }}</span>
    </button>

    <button
      v-if="!sequenceStore.sequenceRunning && store.sequenceEditorAvailable"
      class="tns-btn-danger h-16 w-14 flex-col gap-0.5"
      @click="clearSequence"
    >
      <TrashIcon class="h-7 w-7" />
      <span class="text-[9px] leading-none font-medium">{{
        $t('components.sequence.clearSequence')
      }}</span>
    </button>

    <button
      v-if="sequenceStore.lastSequenceFilePath && store.sequenceEditorAvailable"
      class="tns-btn-secondary h-16 w-14 flex-col gap-0.5"
      :disabled="saveLoading"
      @click="saveCurrentFile"
    >
      <svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.414L16.586 3H5zm9 0v5H8V3h6zm-6 9h8v7H8v-7zm2 1v5h4v-5h-4z"
        />
      </svg>
      <span class="text-[9px] leading-none font-medium">{{
        $t('components.sequence.sequenceSave')
      }}</span>
    </button>

    <button
      v-if="store.sequenceEditorAvailable"
      class="tns-btn-secondary h-16 w-14 flex-col gap-0.5"
      @click="openFileManager"
    >
      <FolderOpenIcon class="h-6 w-6" />
      <span class="text-[9px] leading-none font-medium">{{ seqT('manageSequences') }}</span>
    </button>

    <!-- File Manager Modal -->
    <Modal :show="showFileManager" max-width="max-w-lg" @close="showFileManager = false">
      <template #header>
        <h2 class="text-xl font-bold text-accent">
          {{ seqT('manageSequences') }}
        </h2>
      </template>
      <template #body>
        <div class="w-full flex flex-col gap-4">
          <!-- Sequence folder -->
          <div class="flex flex-col gap-2">
            <label class="tns-label">{{ seqT('sequenceFolder') }}</label>
            <div class="flex items-center gap-2 min-w-0">
              <div
                class="flex-1 flex items-center min-h-touch overflow-x-auto scrollbar-thin px-3 py-2 rounded-lg border border-line bg-surface-2 min-w-0"
                :class="folderGlowClass"
              >
                <span
                  class="text-sm font-mono whitespace-nowrap"
                  :class="sequenceFolder ? 'text-content' : 'text-content-faint italic'"
                  >{{ sequenceFolder || $t('components.sequence.sequenceFolderNotSet') }}</span
                >
              </div>
              <button
                class="tns-btn-secondary w-auto! shrink-0"
                :disabled="folderSaving"
                :title="$t('components.sequence.sequenceFolderChange')"
                :aria-label="$t('components.sequence.sequenceFolderChange')"
                @click="showFolderBrowser = true"
              >
                <FolderIcon class="h-5 w-5" />
              </button>
            </div>
            <p v-if="isRelativeFolder(sequenceFolder)" class="text-xs text-status-warn">
              {{ $t('components.sequence.sequenceFolderRelative') }}
            </p>
          </div>

          <!-- File list -->
          <div class="flex flex-col gap-1 max-h-64 overflow-y-auto">
            <div v-if="filesLoading" class="text-content-muted text-sm text-center py-4">
              {{ $t('components.sequence.sequenceLoading') }}
            </div>
            <div
              v-else-if="sequenceFiles.length === 0"
              class="text-content-faint text-sm text-center py-4"
            >
              {{ $t('components.sequence.sequenceNoFiles') }}
            </div>
            <div
              v-for="file in sequenceFiles"
              :key="file.FilePath"
              class="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-surface-3"
            >
              <span class="text-sm text-content truncate">{{ file.FileName }}</span>
              <div class="flex gap-1 shrink-0">
                <button
                  v-if="!sequenceStore.sequenceRunning"
                  class="text-xs text-accent px-2 py-1 rounded hover:bg-accent/10 transition-colors"
                  @click="loadFile(file.FilePath)"
                >
                  {{ $t('components.sequence.sequenceLoad') }}
                </button>
                <button
                  class="text-xs text-accent px-2 py-1 rounded hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="saveLoading"
                  :title="$t('components.sequence.sequenceSave')"
                  @click="overwriteFile(file.FilePath, file.FileName)"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.414L16.586 3H5zm9 0v5H8V3h6zm-6 9h8v7H8v-7zm2 1v5h4v-5h-4z"
                    />
                  </svg>
                </button>
                <button
                  class="text-xs text-status-danger px-2 py-1 rounded hover:bg-status-danger/10 transition-colors"
                  @click="deleteFile(file.FilePath, file.FileName)"
                >
                  <TrashIcon class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Save section -->
          <div class="border-t border-line pt-3 flex flex-col gap-2">
            <label class="tns-label">{{ seqT('saveSequenceAs') }}</label>
            <div class="flex gap-2">
              <input
                v-model="saveFileName"
                type="text"
                :placeholder="$t('components.sequence.sequenceFileName')"
                class="tns-input flex-1 text-sm"
                @keydown.enter="saveFile"
              />
              <button
                class="text-xs text-accent px-3 py-1.5 rounded border border-accent/40 hover:bg-accent/10 shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!saveFileName.trim() || saveLoading"
                @click="saveFile"
              >
                {{ saveLoading ? '...' : $t('components.sequence.sequenceSave') }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </Modal>

    <FileBrowser
      v-model="showFolderBrowser"
      mode="directory"
      :initial-path="sequenceFolder"
      :title="seqT('sequenceFolder')"
      @select="onFolderSelected"
    />

    <!-- Delete Confirmation Dialog -->
    <Modal
      :show="showDeleteConfirmation"
      max-width="max-w-md"
      @close="showDeleteConfirmation = false"
    >
      <template #header>
        <h2 class="text-xl font-bold">{{ $t('components.sequence.deleteConfirmationTitle') }}</h2>
      </template>
      <template #body>
        <div class="w-full flex flex-col gap-6">
          <p>
            {{ $t('components.sequence.deleteConfirmationMessage') }}
            <span class="text-content font-medium">{{ fileToDelete?.name }}</span
            >?
          </p>
          <div class="flex justify-end space-x-4">
            <button class="tns-btn-secondary" @click="showDeleteConfirmation = false">
              {{ $t('general.cancel') }}
            </button>
            <button class="tns-btn-danger" @click="confirmDeleteFile">
              {{ $t('general.confirm') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>

    <!-- Overwrite Confirmation Dialog -->
    <Modal
      :show="showOverwriteConfirmation"
      max-width="max-w-md"
      @close="showOverwriteConfirmation = false"
    >
      <template #header>
        <h2 class="text-xl font-bold">
          {{ $t('components.sequence.overwriteConfirmationTitle') }}
        </h2>
      </template>
      <template #body>
        <div class="w-full flex flex-col gap-6">
          <p>
            {{ $t('components.sequence.overwriteConfirmationMessage') }}
            <span class="text-content font-medium">{{ fileToOverwrite?.name }}</span
            >?
          </p>
          <div class="flex justify-end space-x-4">
            <button class="tns-btn-secondary" @click="showOverwriteConfirmation = false">
              {{ $t('general.cancel') }}
            </button>
            <button class="tns-btn-primary" @click="confirmOverwriteFile">
              {{ $t('general.confirm') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>

    <SequencePreflightDialog :warnings="preflightWarnings" @answer="answerPreflight" />

    <!-- Reset Confirmation Dialog -->
    <Modal
      :show="showResetConfirmation"
      max-width="max-w-md"
      @close="showResetConfirmation = false"
    >
      <template #header>
        <h2 class="text-xl font-bold">{{ $t('components.sequence.resetConfirmationTitle') }}</h2>
      </template>
      <template #body>
        <div class="w-full flex flex-col gap-6">
          <p>{{ seqT('resetConfirmationMessage') }}</p>
          <div class="flex justify-end space-x-4">
            <button class="tns-btn-secondary" @click="showResetConfirmation = false">
              {{ $t('general.cancel') }}
            </button>
            <button class="tns-btn-danger" @click="confirmReset">
              {{ $t('general.confirm') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { usePlanTerms } from '@/composables/usePlanTerms';
import { ref, computed } from 'vue';
import apiService from '@/services/apiService';
import { useSequenceStore } from '@/store/sequenceStore';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useOrientation } from '@/composables/useOrientation';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import { reportBackendRefusal, toastBackendError } from '@/utils/backendErrors';
import { useSimpleMode } from '@/composables/useSimpleMode';
import { useSequencePreflight } from '@/composables/useSequencePreflight';
import { useI18n } from 'vue-i18n';
import { useProfileSetting } from '@/composables/useProfileSetting';
import { joinSequenceFilePath, isRelativeFolder } from '@/utils/sequenceFilePath';
import {
  FolderIcon,
  FolderOpenIcon,
  FlagIcon,
  ForwardIcon,
  LockClosedIcon,
  LockOpenIcon,
  PauseIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import FileBrowser from '@/components/helpers/fileBrowser.vue';
import SequencePreflightDialog from '@/components/sequence/SequencePreflightDialog.vue';

const { seqT } = usePlanTerms();
const { active: simpleModeActive } = useSimpleMode();
const sequenceStore = useSequenceStore();
const sequenceV2Store = useSequenceV2Store();
const store = apiStore();
const toastStore = useToastStore();
const { t } = useI18n();
const showResetConfirmation = ref(false);
const isLoading = computed(() => sequenceStore.sequenceRunning);
const { isLandscape } = useOrientation();
const { preflightWarnings, answerPreflight, confirmPreflight } = useSequencePreflight();

// File manager state
const showFileManager = ref(false);
const sequenceFiles = ref([]);
const filesLoading = ref(false);
const saveFileName = ref('');
const saveLoading = ref(false);
const showDeleteConfirmation = ref(false);
const fileToDelete = ref(null);
const showOverwriteConfirmation = ref(false);
const fileToOverwrite = ref(null);
const showFolderBrowser = ref(false);

// Read through the composable rather than profileInfo, so a folder change applies to the
// file list right away instead of after the next profile poll.
const {
  value: sequenceFolder,
  save: saveSequenceFolder,
  saving: folderSaving,
  glowClass: folderGlowClass,
} = useProfileSetting('SequenceSettings-DefaultSequenceFolder', { fallback: '' });

async function refreshFiles() {
  const result = await apiService.sequenceFetchFiles(sequenceFolder.value || undefined);
  sequenceFiles.value = result?.Sequences ?? [];
}

async function onFolderSelected(path) {
  if (!path || path === sequenceFolder.value) return;
  const ok = await saveSequenceFolder(path);
  if (!ok) {
    toastStore.showToast({
      type: 'error',
      title: seqT('sequenceFolder'),
      message: seqT('sequenceFolderSaveError'),
    });
    return;
  }
  filesLoading.value = true;
  try {
    await refreshFiles();
  } catch (e) {
    sequenceFiles.value = [];
  } finally {
    filesLoading.value = false;
  }
}

async function skipToEnd() {
  try {
    await apiService.sequenceSkipToEnd();
  } catch (e) {
    console.error('Error skipping to end:', e);
  }
}

async function skipCurrentItem() {
  try {
    await apiService.sequenceSkipCurrentItem();
  } catch (e) {
    console.error('Error skipping current item:', e);
  }
}

function toggleControlsLock() {
  sequenceStore.setSequenceControlsLocked(!sequenceStore.sequenceControlsLocked);
}

async function openFileManager() {
  // pre-fill save name from last known file
  if (sequenceStore.lastSequenceFilePath && !saveFileName.value) {
    const parts = sequenceStore.lastSequenceFilePath.replace(/\\/g, '/').split('/');
    saveFileName.value = parts.at(-1)?.replace(/\.json$/i, '') ?? '';
  }
  showFileManager.value = true;
  filesLoading.value = true;
  try {
    await refreshFiles();
  } catch (e) {
    sequenceFiles.value = [];
  } finally {
    filesLoading.value = false;
  }
}

function deleteFile(filePath, fileName) {
  fileToDelete.value = { path: filePath, name: fileName };
  showDeleteConfirmation.value = true;
}

async function confirmDeleteFile() {
  if (!fileToDelete.value) return;
  showDeleteConfirmation.value = false;
  try {
    await apiService.sequenceDeleteFile(fileToDelete.value.path);
    await refreshFiles();
  } catch (e) {
    console.error('Error deleting sequence file:', e);
  } finally {
    fileToDelete.value = null;
  }
}

function overwriteFile(filePath, fileName) {
  fileToOverwrite.value = { path: filePath, name: fileName };
  showOverwriteConfirmation.value = true;
}

async function confirmOverwriteFile() {
  if (!fileToOverwrite.value) return;
  const { path, name } = fileToOverwrite.value;
  showOverwriteConfirmation.value = false;
  fileToOverwrite.value = null;
  saveLoading.value = true;
  try {
    await apiService.sequenceSaveFile(path);
    sequenceStore.setLastSequenceFilePath(path);
    toastStore.showToast({
      type: 'success',
      title: t('components.sequence.sequenceSave'),
      message: name,
    });
  } catch (e) {
    console.error('Error overwriting sequence file:', e);
    toastStore.showToast({
      type: 'error',
      title: t('components.sequence.sequenceSave'),
      message: String(e),
    });
  } finally {
    saveLoading.value = false;
  }
}

async function loadFile(filePath) {
  // Close the dialog right away and show the overlay instead — loading a sequence
  // (load + getSequenceInfo) can take several seconds.
  showFileManager.value = false;
  sequenceStore.setSequenceLoading(true);
  try {
    await apiService.sequenceLoadFile(filePath);
    sequenceStore.setLastSequenceFilePath(filePath);
    await sequenceStore.getSequenceInfo();
  } catch (e) {
    console.error('Error loading sequence file:', e);
    toastStore.showToast({
      type: 'error',
      title: t('components.sequence.error_loading_sequence'),
      message: String(e),
    });
  } finally {
    sequenceStore.setSequenceLoading(false);
  }
}

async function saveFile() {
  if (!saveFileName.value.trim()) return;
  saveLoading.value = true;
  try {
    const filePath = joinSequenceFilePath(
      sequenceFolder.value,
      saveFileName.value.trim(),
      store.isPINS
    );
    await apiService.sequenceSaveFile(filePath);
    sequenceStore.setLastSequenceFilePath(filePath);
    saveFileName.value = '';
    await refreshFiles();
  } catch (e) {
    console.error('Error saving sequence file:', e);
  } finally {
    saveLoading.value = false;
  }
}

async function saveCurrentFile() {
  if (!sequenceStore.lastSequenceFilePath) return;
  saveLoading.value = true;
  try {
    await apiService.sequenceSaveFile(sequenceStore.lastSequenceFilePath);
    const fileName = sequenceStore.lastSequenceFilePath.replace(/\\/g, '/').split('/').at(-1);
    toastStore.showToast({
      type: 'success',
      title: t('components.sequence.sequenceSave'),
      message: fileName,
    });
  } catch (e) {
    console.error('Error saving sequence file:', e);
    toastStore.showToast({
      type: 'error',
      title: t('components.sequence.sequenceSave'),
      message: String(e),
    });
  } finally {
    saveLoading.value = false;
  }
}

async function startSequence() {
  if (!(await confirmPreflight(sequenceStore.sequenceInfo))) return;
  // The simple mode's plan has to park again at the end of a second run
  if (simpleModeActive.value && !(await sequenceV2Store.rearmFinishedPlan())) {
    toastBackendError(null, 'components.backendErrors.sequenceStart');
    return;
  }
  console.log('Starting sequence');
  sequenceStore.setSequenceRunning(true);
  try {
    const data = await apiService.sequenceAction('start');
    console.log('Response:', data);
    // The status poll corrects the optimistic flag either way; reset it at once on a refusal.
    if (reportBackendRefusal(data, 'components.backendErrors.sequenceStart')) {
      sequenceStore.setSequenceRunning(false);
      return;
    }
    await sequenceStore.getSequenceInfo();
  } catch (error) {
    console.log('Error:', error);
    sequenceStore.setSequenceRunning(false);
    toastStore.showToast({
      type: 'error',
      title: t('components.rigChecks.startFailed'),
      message: String(error?.message || error),
    });
  }
}

async function stopSequence() {
  try {
    const data = await apiService.sequenceAction('stop');
    console.log('Response:', data);

    // Only stop if the API confirms success
    if (data.Success) {
      await sequenceStore.getSequenceInfo();
      sequenceStore.setSequenceRunning(false);
    } else {
      // The user believes the rig has stopped: say so loudly when it has not.
      console.error('Failed to stop sequence:', data.Error);
      toastStore.showToast({
        type: 'error',
        title: t('components.rigChecks.stopFailed'),
        message: data.Error || '',
        autoClose: false,
      });
    }
  } catch (error) {
    console.log('Error:', error);
    sequenceStore.setSequenceRunning(false);
  }
}

async function confirmReset() {
  isLoading.value = true;
  showResetConfirmation.value = false;
  try {
    const success = await sequenceStore.resetSequence();

    if (success) {
      await sequenceStore.getSequenceInfo();
      // The V2 poll only reloads the tree on a Status change. Items that were already
      // CREATED keep their status, so their reset loop counters would stay stale.
      if (sequenceV2Store.loaded) await sequenceV2Store.loadCurrent();
      isLoading.value = false;
    } else {
      console.error('Failed to reset sequence');
      isLoading.value = false;
    }
  } catch (error) {
    console.log('Error:', error);
    isLoading.value = false;
  }
}

async function clearSequence() {
  // Clearing removes every item from the sequence and cannot be undone.
  const confirmed = await toastStore.showConfirmation(
    t('components.sequence.clearConfirmationTitle'),
    seqT('clearConfirmationMessage'),
    t('components.sequence.clearSequence'),
    t('general.cancel')
  );
  if (!confirmed) return;

  try {
    const response = await apiService.sequenceClear();
    if (response) {
      await sequenceStore.getSequenceInfo();
    } else {
      console.error('Failed to clear sequence');
    }
  } catch (error) {
    console.error('Error clearing sequence:', error);
  }
}
</script>
