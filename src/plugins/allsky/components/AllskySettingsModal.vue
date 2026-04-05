<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black bg-opacity-50" @click="closeModal"></div>

    <!-- Modal -->
    <div
      class="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-lg w-full max-w-md mx-4 border border-gray-700"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 class="text-lg font-semibold text-white">{{ t('plugins.allsky.title') }}</h3>
        <button @click="closeModal" class="text-gray-400 hover:text-white">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="p-4 space-y-4">
        <!-- Snapshot URL -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">{{
            t('plugins.allsky.snapshotUrl')
          }}</label>
          <input
            v-model="allskyStore.snapshotUrl"
            type="url"
            placeholder="http://example.com/allsky/snapshot.jpg"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            @input="allskyStore.updateSnapshotUrl($event.target.value)"
          />
          <p class="text-xs text-gray-400 mt-1">
            {{ t('plugins.allsky.snapshotUrlDescription') }}
          </p>
          <p class="text-xs text-gray-400 mt-1">
            <strong>{{ t('plugins.allsky.snapshotUrlExamples') }}</strong
            ><br />
            • Local URL:
            <code class="bg-gray-600 px-1 rounded">http://192.168.1.100/allsky/current.jpg</code
            ><br />
            • Website URL:
            <code class="bg-gray-600 px-1 rounded">https://www.your-allsky-site.de/allsky.jpg</code>
          </p>
        </div>

        <!-- Refresh Interval -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            {{ t('plugins.allsky.refreshInterval') }} ({{ allskyStore.refreshIntervalMinutes }} min)
          </label>
          <input
            :value="allskyStore.refreshInterval"
            type="range"
            min="60000"
            max="600000"
            step="60000"
            class="w-full"
            @input="allskyStore.updateRefreshInterval(parseInt($event.target.value))"
          />
          <div class="flex justify-between text-xs text-gray-400 mt-1">
            <span>1 min</span>
            <span>10 min</span>
          </div>
        </div>

        <!-- Display Options -->
        <div class="space-y-3">
          <h4 class="text-sm font-medium text-gray-300">
            {{ t('plugins.allsky.displayOptions') }}
          </h4>

          <label class="flex items-center">
            <input
              v-model="allskyStore.autoRefresh"
              type="checkbox"
              class="mr-2 rounded"
              @change="allskyStore.updateDisplaySettings({ autoRefresh: $event.target.checked })"
            />
            <span class="text-gray-300">{{ t('plugins.allsky.autoRefresh') }}</span>
          </label>
        </div>

        <!-- Connection Status -->
        <div class="p-3 rounded-md" :class="statusClass">
          <p class="text-sm font-medium">
            {{ t('plugins.allsky.status') }}:
            {{
              allskyStore.isConnected
                ? t('plugins.allsky.connected')
                : t('plugins.allsky.disconnected')
            }}
          </p>
          <p v-if="allskyStore.errorMessage" class="text-sm mt-1">
            {{ t('plugins.allsky.error') }}: {{ allskyStore.errorMessage }}
          </p>
          <p v-if="allskyStore.lastUpdate" class="text-sm mt-1">
            {{ t('plugins.allsky.lastUpdate') }}: {{ formatTime(allskyStore.lastUpdate) }}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-2 p-4 border-t border-gray-700">
        <button @click="resetSettings" class="default-button-red">
          {{ t('plugins.allsky.reset') }}
        </button>
        <button @click="closeModal" class="default-button-blue">
          {{ t('plugins.allsky.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useallskyStore } from '../store/allskyStore.js';

defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['close']);

const { t } = useI18n();
const allskyStore = useallskyStore();

const statusClass = computed(() => {
  if (allskyStore.isConnected) {
    return 'bg-green-900 border border-green-700';
  } else if (allskyStore.errorMessage) {
    return 'bg-red-900 border border-red-700';
  } else {
    return 'bg-gray-700 border border-gray-600';
  }
});

const formatTime = (timeString) => {
  if (!timeString) return '';
  return new Date(timeString).toLocaleTimeString();
};

const closeModal = () => {
  emit('close');
};

const resetSettings = () => {
  if (confirm(t('plugins.allsky.resetConfirm'))) {
    allskyStore.resetSettings();
  }
};
</script>
