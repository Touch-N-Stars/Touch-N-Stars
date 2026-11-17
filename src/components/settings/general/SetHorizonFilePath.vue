<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2 min-w-0">
      <div
        class="flex-1 flex items-center min-h-touch overflow-x-auto scrollbar-thin px-3 py-2 rounded-lg border border-line bg-surface-2 min-w-0"
        :class="{ 'glow-green': saveSuccess }"
      >
        <span
          class="text-sm font-mono whitespace-nowrap"
          :class="path ? 'text-content' : 'text-content-faint italic'"
          >{{ path || $t('components.settings.horizonFilePath.placeholder') }}</span
        >
      </div>
      <button
        v-if="path"
        class="p-2 text-content-faint hover:text-status-danger transition-colors shrink-0"
        @click="showConfirm = true"
        :title="$t('components.settings.horizonFilePath.clearTitle')"
      >
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
      <button
        class="tns-btn-secondary w-auto! shrink-0"
        @click="showBrowser = true"
        :title="$t('components.settings.horizonFilePath.placeholder')"
      >
        ...
      </button>
    </div>

    <!-- Status feedback -->
    <p v-if="statusMsg" class="text-xs text-status-danger">{{ statusMsg }}</p>

    <!-- FileBrowser Dialog -->
    <FileBrowser v-model="showBrowser" :initial-path="path" mode="file" @select="onPathSelected" />

    <!-- Confirm clear modal -->
    <Modal :show="showConfirm" @close="showConfirm = false" maxWidth="max-w-md">
      <template #header>
        <h2 class="text-lg font-bold text-status-danger">
          {{ $t('components.settings.horizonFilePath.confirmTitle') }}
        </h2>
      </template>
      <template #body>
        <div class="flex flex-col gap-4">
          <p class="text-content">
            {{ $t('components.settings.horizonFilePath.confirmMessage') }}
          </p>
          <div class="flex gap-3 justify-end">
            <button @click="showConfirm = false" class="tns-btn-secondary">
              {{ $t('common.cancel') }}
            </button>
            <button @click="clearPath" class="tns-btn-danger">
              {{ $t('common.delete') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import apiService from '@/services/apiService';
import FileBrowser from '../../helpers/fileBrowser.vue';
import Modal from '@/components/helpers/Modal.vue';

const { t } = useI18n();
const store = apiStore();
const toast = useToastStore();

const path = ref('');
const showBrowser = ref(false);
const showConfirm = ref(false);
const saveSuccess = ref(false);
const statusMsg = ref('');

onMounted(() => {
  path.value = store.profileInfo?.AstrometrySettings?.HorizonFilePath || '';
});

async function clearPath() {
  showConfirm.value = false;
  try {
    await apiService.setHorizonFilePath('');
    path.value = '';
    saveSuccess.value = true;
    setTimeout(() => (saveSuccess.value = false), 2000);
  } catch (e) {
    statusMsg.value = t('components.settings.imageSavePath.errorMsg');
  }
}

async function onPathSelected(selectedPath) {
  path.value = selectedPath;
  statusMsg.value = '';
  try {
    await apiService.setHorizonFilePath(selectedPath);
    saveSuccess.value = true;
    setTimeout(() => (saveSuccess.value = false), 2000);
  } catch (e) {
    statusMsg.value = t('components.settings.imageSavePath.errorMsg');
    toast.showToast({
      type: 'error',
      title: t('components.settings.imageSavePath.toastErrorTitle'),
      message: t('components.settings.imageSavePath.toastErrorMsg'),
      autoClose: false,
    });
  }
}
</script>
