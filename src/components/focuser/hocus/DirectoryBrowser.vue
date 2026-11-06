<template>
  <div class="space-y-2">
    <label class="text-white mb-2 block">{{ label }}</label>

    <!-- Current Selection Display -->
    <div class="flex gap-2 items-end mb-2">
      <div class="flex-1">
        <input
          :value="modelValue"
          @input="$emit('update:modelValue', $event.target.value)"
          type="text"
          class="w-full bg-surface-3 text-white p-2 rounded"
          :disabled="disabled"
          :placeholder="placeholder || 'Enter or browse for directory path'"
        />
      </div>
      <button
        @click="toggleBrowser"
        :disabled="disabled || isLoading"
        class="px-4 py-2 bg-accent hover:bg-accent disabled:bg-surface-3 text-white rounded transition whitespace-nowrap"
      >
        {{ isLoading ? 'Loading...' : 'Browse...' }}
      </button>
    </div>

    <!-- Directory Browser Modal -->
    <Modal :show="showBrowser" zIndex="z-top" maxWidth="max-w-md" @close="showBrowser = false">
      <template #header>
        <h2 class="text-xl font-bold">Select Directory</h2>
      </template>
      <template #body>
        <div class="w-full flex flex-col">
          <!-- Breadcrumb Navigation -->
          <div
            v-if="currentPath"
            class="mb-4 p-3 bg-surface-3 rounded text-sm text-content break-words max-h-40 overflow-y-auto"
          >
            <div class="flex flex-wrap gap-1">
              <button
                v-for="(part, idx) in getBreadcrumbs()"
                :key="idx"
                @click="navigateToPath(part.path)"
                class="px-2 py-1 bg-surface-3 hover:bg-surface-2 rounded text-xs transition whitespace-nowrap"
              >
                {{ part.label }}
              </button>
            </div>
          </div>

          <!-- Error Message -->
          <div
            v-if="error"
            class="mb-4 p-2 bg-status-danger/10 border border-status-danger/40 rounded text-status-danger text-sm"
          >
            {{ error }}
          </div>

          <!-- Directory List -->
          <div class="max-h-[35vh] overflow-y-auto mb-4 border border-line rounded bg-ground">
            <div v-if="isLoading" class="p-4 text-content-muted text-center">Loading...</div>

            <div
              v-else-if="directories.length === 0"
              class="p-4 text-content-muted text-center text-sm"
            >
              No subdirectories
            </div>

            <div v-else class="space-y-1 p-2">
              <!-- Parent Directory Link -->
              <button
                v-if="parentPath"
                @click="navigateToPath(parentPath)"
                class="w-full text-left px-3 py-2 hover:bg-surface-3 rounded transition text-accent text-sm font-semibold mb-2 border-b border-line-strong"
              >
                ⬆️ Go to Parent Directory
              </button>

              <!-- Directory Items -->
              <button
                v-for="dir in directories"
                :key="dir.path"
                @click="navigateToPath(dir.path)"
                class="w-full text-left px-3 py-2 hover:bg-surface-3 rounded transition text-content text-sm hover:text-white"
              >
                📁 {{ dir.name }}
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2">
            <button @click="selectCurrentPath" class="tns-btn-primary flex-1">Select</button>
            <button @click="showBrowser = false" class="tns-btn-secondary flex-1">Cancel</button>
          </div>
        </div>
      </template>
    </Modal>

    <!-- Error Message -->
    <div v-if="error && !showBrowser" class="text-status-danger text-xs">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import apiService from '@/services/apiService';
import Modal from '@/components/helpers/Modal.vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    default: 'Directory Path',
  },
  placeholder: {
    type: String,
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue']);

const showBrowser = ref(false);
const currentPath = ref(null);
const parentPath = ref(null);
const directories = ref([]);
const error = ref('');
const isLoading = ref(false);

const toggleBrowser = async () => {
  if (showBrowser.value) {
    showBrowser.value = false;
  } else {
    showBrowser.value = true;
    // Load initial directory on open
    if (!currentPath.value) {
      console.log(
        '[DirectoryBrowser] Opening browser, initializing with path:',
        props.modelValue || 'null'
      );
      await loadDirectory(props.modelValue || null);
    }
  }
};

const loadDirectory = async (path) => {
  error.value = '';
  isLoading.value = true;
  try {
    console.log('[DirectoryBrowser] Loading directory:', path);
    const response = await apiService.hocusfocus.browseDirectories(path);
    console.log('[DirectoryBrowser] Response:', response);

    if (response && response.Success) {
      currentPath.value = response.currentPath;
      parentPath.value = response.parentPath;
      directories.value = response.directories || [];
      console.log(
        '[DirectoryBrowser] Loaded successfully. Current path:',
        currentPath.value,
        'Directories:',
        directories.value.length
      );
    } else {
      const errorMsg = response?.Error || 'Failed to load directory';
      console.error('[DirectoryBrowser] Response not successful:', errorMsg);

      // If the provided path is invalid (404), retry with default path
      if (path && !response.Success && errorMsg.includes('does not exist')) {
        console.log('[DirectoryBrowser] Path does not exist, retrying with default path');
        await loadDirectory(null);
        return;
      }

      error.value = errorMsg;
    }
  } catch (err) {
    console.error('[DirectoryBrowser] Exception caught:', err);

    // If path is invalid (404), retry with default path
    if (path && err.response?.status === 404) {
      console.log('[DirectoryBrowser] Got 404, retrying with default path');
      await loadDirectory(null);
      return;
    }

    const errorMsg = err.response?.data?.Error || err.message || 'Failed to load directory';
    console.error('[DirectoryBrowser] Final error message:', errorMsg);
    error.value = errorMsg;
  } finally {
    isLoading.value = false;
  }
};

const navigateToPath = async (path) => {
  await loadDirectory(path);
};

const selectCurrentPath = () => {
  if (currentPath.value) {
    emit('update:modelValue', currentPath.value);
    showBrowser.value = false;
  }
};

const getBreadcrumbs = () => {
  if (!currentPath.value) return [];

  const parts = currentPath.value.split(/[\/\\]/);
  const breadcrumbs = [];
  let path = '';

  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue; // Skip empty parts

    if (i === 0 && parts[i].length === 2 && parts[i][1] === ':') {
      // Windows drive letter
      path = parts[i] + '\\';
    } else {
      path = i === 0 ? parts[i] : path + '/' + parts[i];
    }

    breadcrumbs.push({
      label: parts[i] || (i === 0 ? '/' : '...'),
      path: path,
    });
  }

  return breadcrumbs;
};

onMounted(async () => {
  // Initialize with the current model value or default
  if (props.modelValue) {
    // Don't load yet, wait for user to click Browse
  }
});

// Manage body scroll when modal is open
watch(showBrowser, (isOpen) => {
  if (isOpen) {
    // Disable background scrolling
    document.body.style.overflow = 'hidden';
  } else {
    // Re-enable background scrolling
    document.body.style.overflow = '';
  }
});
</script>

<style scoped>
/* Ensure smooth transitions for button states */
button {
  transition: background-color 0.2s ease;
}
</style>
