<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono truncate">
        {{ item.FilePath || $t('components.sequence.items.saveSequence.notSet') }}
      </span>
    </template>

    <template #editor="{ save }">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <select
            class="tns-select flex-1 text-xs"
            :value="item.FilePath ?? ''"
            :disabled="filesLoading"
            @change="onSelect($event, save)"
          >
            <option value="">{{ $t('components.sequence.choose_sequence') }}</option>
            <option v-for="file in files" :key="file.FilePath" :value="file.FilePath">
              {{ file.FileName }}
            </option>
          </select>
          <button
            class="shrink-0 p-1.5 rounded border border-line-strong bg-surface-3 text-content hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            :disabled="filesLoading"
            v-tooltip="'Refresh available files'"
            @click="fetchFiles"
          >
            <ArrowPathIcon :class="['w-3.5 h-3.5', filesLoading ? 'animate-spin' : '']" />
          </button>
        </div>

        <div class="flex items-center gap-2">
          <input
            v-model="newFileName"
            type="text"
            :placeholder="$t('components.sequence.sequenceFileName')"
            class="tns-input flex-1 text-xs"
            @keydown.enter="applyNewFileName(save)"
          />
          <button
            class="shrink-0 text-xs text-accent px-2 py-1.5 rounded border border-accent/40 hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!newFileName.trim()"
            @click="applyNewFileName(save)"
          >
            {{ $t('components.sequence.items.saveSequence.applyFileName') }}
          </button>
        </div>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import ItemShell from './ItemShell.vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';

defineProps({
  item: { type: Object, required: true },
});

const store = apiStore();
const files = ref([]);
const filesLoading = ref(false);
const newFileName = ref('');

async function fetchFiles() {
  filesLoading.value = true;
  try {
    const defaultFolder = store.profileInfo?.SequenceSettings?.DefaultSequenceFolder;
    const result = await apiService.sequenceFetchFiles(defaultFolder);
    files.value = result?.Sequences ?? [];
  } catch (e) {
    files.value = [];
  } finally {
    filesLoading.value = false;
  }
}

function onSelect(event, save) {
  const filePath = event.target.value;
  if (!filePath) return;
  save('FilePath', filePath);
}

// Mirrors controlSequence.vue's buildFilePath — joins the profile's default sequence
// folder with a bare filename using the folder's own path separator.
function buildFilePath(name) {
  const defaultFolder = store.profileInfo?.SequenceSettings?.DefaultSequenceFolder ?? '';
  const sep =
    defaultFolder.endsWith('\\') || defaultFolder.endsWith('/')
      ? ''
      : defaultFolder.includes('/')
        ? '/'
        : '\\';
  const fileName = name.endsWith('.json') ? name : name + '.json';
  return defaultFolder ? defaultFolder + sep + fileName : fileName;
}

function applyNewFileName(save) {
  if (!newFileName.value.trim()) return;
  save('FilePath', buildFilePath(newFileName.value.trim()));
  newFileName.value = '';
}

onMounted(fetchFiles);
</script>
