<template>
  <div class="flex flex-col gap-2">
    <!-- Input Row -->
    <div>
      <div class="flex items-center gap-2">
        <input
          v-model="path"
          type="text"
          readonly
          :placeholder="$t('components.settings.imageSavePath.placeholder')"
          class="flex-1 px-3 py-2 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500"
        />

        <button
          @click="showBrowser = true"
          class="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-sm text-gray-200 transition-colors"
          :title="$t('components.settings.imageSavePath.selectTitle')"
        >
          �
        </button>

        <button
          @click="savePath"
          :disabled="!path || saving"
          class="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm text-white transition-colors"
        >
          <span v-if="saving">{{ $t('components.settings.imageSavePath.saving') }}</span>
          <span v-else>{{ $t('components.settings.imageSavePath.save') }}</span>
        </button>
      </div>

      <p v-if="isDirty" class="text-xs text-amber-400 flex items-center gap-1 pt-2">
        <svg
          class="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
        </svg>
        {{ $t('components.settings.imageSavePath.dirtyHint') }}
      </p>
    </div>

    <!-- Status feedback -->
    <p v-if="statusMsg" class="text-xs" :class="statusOk ? 'text-green-400' : 'text-red-400'">
      {{ statusMsg }}
    </p>

    <!-- FileBrowser Dialog -->
    <FileBrowser v-model="showBrowser" :initial-path="path" @select="onPathSelected" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import FileBrowser from './fileBrowser.vue';

const { t } = useI18n();
const store = apiStore();
const toast = useToastStore();

const path = ref('');
const showBrowser = ref(false);
const saving = ref(false);
const statusMsg = ref('');
const statusOk = ref(true);

const originalPath = ref('');
const isDirty = ref(false);

onMounted(() => {
  path.value = store.imageSavePath || '';
  originalPath.value = path.value;
});

function onPathSelected(selectedPath) {
  path.value = selectedPath;
  isDirty.value = selectedPath !== originalPath.value;
  statusMsg.value = '';
}

async function savePath() {
  if (!path.value) return;
  saving.value = true;
  statusMsg.value = '';
  try {
    await store.setImageSavePath(path.value);
    originalPath.value = path.value;
    isDirty.value = false;
    statusOk.value = true;
    statusMsg.value = `${t('components.settings.imageSavePath.savedMsg')} ${path.value}`;
    toast.showToast({
      type: 'success',
      title: t('components.settings.imageSavePath.toastTitle'),
      message: path.value,
    });
  } catch (e) {
    statusOk.value = false;
    statusMsg.value = t('components.settings.imageSavePath.errorMsg');
    toast.showToast({
      type: 'error',
      title: t('components.settings.imageSavePath.toastErrorTitle'),
      message: t('components.settings.imageSavePath.toastErrorMsg'),
      autoClose: false,
    });
  } finally {
    saving.value = false;
  }
}
</script>
