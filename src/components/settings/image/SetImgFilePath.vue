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
          >{{ path || $t('components.settings.imageSavePath.placeholder') }}</span
        >
      </div>
      <button
        class="tns-btn-secondary w-auto! shrink-0"
        @click="showBrowser = true"
        :title="$t('components.settings.imageSavePath.selectTitle')"
      >
        ...
      </button>
    </div>

    <!-- Status feedback -->
    <p v-if="statusMsg" class="text-xs text-status-danger">{{ statusMsg }}</p>

    <!-- FileBrowser Dialog -->
    <FileBrowser v-model="showBrowser" :initial-path="path" @select="onPathSelected" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import FileBrowser from '../../helpers/fileBrowser.vue';

const { t } = useI18n();
const store = apiStore();
const toast = useToastStore();

const path = ref('');
const showBrowser = ref(false);
const saveSuccess = ref(false);
const statusMsg = ref('');

onMounted(() => {
  path.value = store.imageSavePath || '';
});

async function onPathSelected(selectedPath) {
  path.value = selectedPath;
  statusMsg.value = '';
  try {
    await store.setImageSavePath(selectedPath);
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
