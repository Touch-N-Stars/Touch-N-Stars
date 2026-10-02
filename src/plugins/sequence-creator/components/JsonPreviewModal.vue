<template>
  <div class="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
    <div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-full flex flex-col"
    >
      <!-- Header -->
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            {{ t('plugins.sequenceCreator.exportModal.jsonPreview.sequenceJsonExport') }}
          </h2>
          <button
            @click="$emit('close')"
            class="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {{ t('plugins.sequenceCreator.exportModal.jsonPreview.previewDescription') }}
        </p>
      </div>

      <!-- Content -->
      <div class="flex-1 p-6 overflow-hidden flex flex-col">
        <!-- Stats -->
        <div class="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div class="text-xs text-blue-600 dark:text-blue-400 font-medium">
              {{ t('plugins.sequenceCreator.exportModal.jsonPreview.totalActions') }}
            </div>
            <div class="text-lg font-semibold text-blue-900 dark:text-blue-100">
              {{ sequenceStats.totalActions }}
            </div>
          </div>
          <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            <div class="text-xs text-green-600 dark:text-green-400 font-medium">
              {{ t('plugins.sequenceCreator.exportModal.jsonPreview.enabled') }}
            </div>
            <div class="text-lg font-semibold text-green-900 dark:text-green-100">
              {{ sequenceStats.enabledActions }}
            </div>
          </div>
          <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
            <div class="text-xs text-purple-600 dark:text-purple-400 font-medium">
              {{ t('plugins.sequenceCreator.exportModal.jsonPreview.categories') }}
            </div>
            <div class="text-lg font-semibold text-purple-900 dark:text-purple-100">
              {{ sequenceStats.categories }}
            </div>
          </div>
          <div class="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
            <div class="text-xs text-orange-600 dark:text-orange-400 font-medium">
              {{ t('plugins.sequenceCreator.exportModal.jsonPreview.estimatedDuration') }}
            </div>
            <div class="text-lg font-semibold text-orange-900 dark:text-orange-100">
              {{ sequenceStats.estimatedDuration }}
            </div>
          </div>
        </div>

        <!-- JSON Preview -->
        <div class="flex-1 min-h-0">
          <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 h-full overflow-auto">
            <pre
              class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono leading-relaxed select-text"
              >{{ formattedJson }}</pre>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center space-x-4">
            <label class="flex items-center space-x-2">
              <input
                v-model="customFilename"
                type="text"
                :placeholder="t('plugins.sequenceCreator.exportModal.jsonPreview.filenamePrompt')"
                class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span class="text-sm text-gray-600 dark:text-gray-400">.json</span>
            </label>
          </div>

          <div class="flex items-center space-x-3">
            <button
              @click="copyToClipboard"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              {{
                copyStatus === 'copied'
                  ? t('plugins.sequenceCreator.exportModal.jsonPreview.copied')
                  : t('plugins.sequenceCreator.exportModal.jsonPreview.copyJson')
              }}
            </button>
            <button
              @click="downloadSequence"
              class="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              {{ t('plugins.sequenceCreator.exportModal.jsonPreview.downloadJson') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { copyText } from '@/utils/clipboard';

const { t } = useI18n();

// Props
const props = defineProps({
  json: {
    type: String,
    required: true,
  },
});

// Emits
const emit = defineEmits(['close', 'save']);

// State
const customFilename = ref('sequence');
const copyStatus = ref('idle'); // 'idle' | 'copying' | 'copied'

// Computed
const formattedJson = computed(() => {
  try {
    const parsed = JSON.parse(props.json);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return props.json;
  }
});

const sequenceStats = computed(() => {
  try {
    const parsed = JSON.parse(props.json);
    const actions = parsed.actions || [];

    const totalActions = actions.length;
    const enabledActions = actions.filter((action) => action.enabled !== false).length;
    const categories = new Set(actions.map((action) => action.type?.split('-')[0] || 'unknown'))
      .size;

    // Estimate duration based on action types (very rough estimate)
    let estimatedMinutes = 0;
    actions.forEach((action) => {
      if (action.enabled === false) return;

      switch (action.type) {
        case 'take-exposure':
        case 'smart-exposure':
          const exposureTime =
            action.parameters?.exposureTime?.value ||
            action.parameters?.exposureTime?.default ||
            300;
          const count = action.parameters?.count?.value || action.parameters?.count?.default || 1;
          estimatedMinutes += (exposureTime * count) / 60;
          break;
        case 'auto-focus':
          estimatedMinutes += 2;
          break;
        case 'plate-solve':
          estimatedMinutes += 1;
          break;
        case 'dither':
          estimatedMinutes += 0.5;
          break;
        case 'slew-to-target':
          estimatedMinutes += 1;
          break;
        default:
          estimatedMinutes += 0.1;
      }
    });

    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = Math.round(estimatedMinutes % 60);
    const estimatedDuration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return {
      totalActions,
      enabledActions,
      categories,
      estimatedDuration,
    };
  } catch {
    return {
      totalActions: 0,
      enabledActions: 0,
      categories: 0,
      estimatedDuration: '0m',
    };
  }
});

// Methods
async function copyToClipboard() {
  try {
    copyStatus.value = 'copying';
    await copyText(formattedJson.value);
    copyStatus.value = 'copied';
    setTimeout(() => {
      copyStatus.value = 'idle';
    }, 2000);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    copyStatus.value = 'idle';
  }
}

function downloadSequence() {
  const filename = customFilename.value.trim() || 'sequence';
  const finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
  emit('save', finalFilename);
}

// Handle escape key
function handleKeydown(event) {
  if (event.key === 'Escape') {
    emit('close');
  }
}

// Setup event listener
document.addEventListener('keydown', handleKeydown);

// Cleanup on unmount
import { onUnmounted } from 'vue';
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
/* Scrollbar styling for JSON preview */
.overflow-auto::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.dark .overflow-auto::-webkit-scrollbar-track {
  background: #374151;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.dark .overflow-auto::-webkit-scrollbar-thumb {
  background: #6b7280;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.dark .overflow-auto::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Animation for modal */
@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.bg-white,
.dark .bg-gray-800 {
  animation: modalFadeIn 0.2s ease-out;
}
</style>
