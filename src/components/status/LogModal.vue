<template>
  <Modal show zIndex="z-top" @close="$emit('close')">
    <template #header>
      <div class="flex items-center gap-2">
        <h2 class="text-xl font-bold">LOG</h2>
        <button
          @click="downloadLogs"
          class="p-2 hover:bg-surface-3 rounded-lg"
          :title="$t('components.lastLogs.download')"
        >
          <!-- Success indicator -->
          <div
            v-if="showSuccess"
            class="absolute z-10 w-6 h-6 bg-status-ok rounded-full flex items-center justify-center animate-fade-out opacity-0 pointer-events-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-content"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <ArrowDownTrayIcon class="w-6 h-6" />
        </button>
      </div>
    </template>
    <template #body>
      <div class="w-full">
        <!-- Level Filter -->
        <div class="flex flex-wrap gap-1 pb-3">
          <button
            v-for="lvl in ['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR']"
            :key="lvl"
            @click="toggleLevel(lvl)"
            class="px-2 py-0.5 rounded text-xs font-medium transition-colors"
            :class="
              isLevelActive(lvl)
                ? activeLevelClass(lvl)
                : 'bg-surface-3 text-content hover:bg-surface-2'
            "
          >
            {{ lvl }}
          </button>
        </div>
        <!-- Tabelle anzeigen, wenn Daten verfügbar sind -->
        <div class="w-full max-h-[50vh] overflow-y-auto relative scrollbar-thin">
          <table class="w-full table-fixed border-collapse border border-line text-content text-sm">
            <thead class="sticky top-0 bg-surface-2 z-10">
              <tr class="bg-surface-2">
                <th class="border border-line px-2 py-2 text-left w-[30%]">
                  {{ $t('components.lastLogs.timestamp') }}
                </th>
                <th class="border border-line px-2 py-2 text-left w-[18%]">
                  {{ $t('components.lastLogs.level') }}
                </th>
                <th class="border border-line px-2 py-2 text-left w-[52%]">
                  {{ $t('components.lastLogs.message') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(entry, index) in filteredLogs"
                :key="index"
                class="odd:bg-surface-1 even:bg-surface-2"
              >
                <td class="border border-line px-2 py-2 align-top">
                  {{ formatTimestamp(entry.timestamp) }}
                </td>
                <td
                  class="border border-line px-2 py-2 align-top whitespace-nowrap"
                  :class="{
                    'text-status-ok': entry.level === 'INFO',
                    'text-status-danger': entry.level === 'ERROR',
                    'text-status-warn': entry.level === 'WARNING',
                  }"
                >
                  {{ entry.level }}
                </td>
                <td class="border border-line px-2 py-2 align-top break-words">
                  {{ entry.message }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, ref } from 'vue';
import Modal from '@/components/helpers/Modal.vue';
import { useLogStore } from '@/store/logStore';
import { downloadLogs as downloadLogsHelper } from '@/utils/logDownloader';
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline';

const logStore = useLogStore();
defineEmits(['close']);
const showSuccess = ref(false);
const selectedLevels = ref(new Set(['ALL']));

function toggleLevel(lvl) {
  if (lvl === 'ALL') {
    selectedLevels.value = new Set(['ALL']);
    return;
  }
  const s = new Set(selectedLevels.value);
  s.delete('ALL');
  if (s.has(lvl)) {
    s.delete(lvl);
    if (s.size === 0) s.add('ALL');
  } else {
    s.add(lvl);
  }
  selectedLevels.value = s;
}

function isLevelActive(lvl) {
  return selectedLevels.value.has(lvl);
}

function activeLevelClass(lvl) {
  const map = {
    ALL: 'bg-content-muted text-ground',
    DEBUG: 'bg-surface-3 text-content',
    INFO: 'bg-status-ok/20 text-status-ok',
    WARNING: 'bg-status-warn/20 text-status-warn',
    ERROR: 'bg-status-danger/20 text-status-danger',
  };
  return map[lvl] ?? 'bg-surface-3 text-content';
}

// Funktion zum Formatieren des Timestamps (optional)
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

const filteredLogs = computed(() =>
  logStore.LogsInfo.logs.filter(
    (entry) =>
      !entry.message.includes('EDS_ERR_INVALID_PARAMETER') &&
      (selectedLevels.value.has('ALL') || selectedLevels.value.has(entry.level))
  )
);

async function downloadLogs() {
  const success = await downloadLogsHelper(filteredLogs.value, formatTimestamp);

  if (success) {
    showSuccess.value = true;
    setTimeout(() => (showSuccess.value = false), 2000);
  }
}
</script>

<style scoped>
/* Smooth scroll behavior */
.scrollbar-thin {
  scrollbar-width: thin;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: #4a5568;
  border-radius: 20px;
}

@keyframes fade-out {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
.animate-fade-out {
  animation: fade-out 1s ease-in forwards;
}
</style>
