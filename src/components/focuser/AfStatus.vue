<template>
  <div class="text-base text-content-muted pb-2">{{ $t('components.tppa.last_messages') }}:</div>
  <ul>
    <li
      v-for="(msg, index) in lastMessages.slice().reverse()"
      :key="index"
      :style="{ color: msg.color }"
    >
      <template v-if="index === 0">
        <Spinner size="sm" class="align-middle text-content-muted" />
      </template>
      <template v-else> {{ formatTime(msg.timestamp) }} - </template>
      {{ msg.message }}
    </li>
  </ul>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useLogStore } from '@/store/logStore';
import { useI18n } from 'vue-i18n';
import { formatTime } from '@/utils/utils';
import Spinner from '@/components/helpers/Spinner.vue';

const { t } = useI18n();
const logStore = useLogStore();
let lastProcessedTimestamp = new Date();
const lastMessages = ref([]);

// Beobachte Log-Änderungen:
watch(
  () => logStore.LogsInfo.logs,
  (newLogs) => {
    if (!newLogs || newLogs.length === 0) return;

    // Sortiere aufsteigend nach Timestamp:
    const sortedLogs = [...newLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (const entry of sortedLogs) {
      // Nur neue Einträge
      if (lastProcessedTimestamp && new Date(entry.timestamp) <= new Date(lastProcessedTimestamp)) {
        continue;
      }
      let message;
      let color = 'inherit';

      if (entry.message.includes('Moving Focuser to position')) {
        message = entry.message;
      } else if (entry.message.includes('Starting Exposure')) {
        message = t('components.tppa.capture_running');
      } else if (entry.message.includes('AutoFocus complete')) {
        message = entry.message;
        color = 'var(--color-status-ok)';
      } else if (entry.message.includes('AutoFocus did not complete successfully')) {
        message = entry.message;
        color = 'var(--color-status-warn)';
      } else {
        // Nicht relevante Logs überspringen
        continue;
      }
      // Speichere Einträge (max. 3)
      lastMessages.value.push({
        timestamp: entry.timestamp,
        message,
        line: entry.line,
        color,
      });

      if (lastMessages.value.length > 3) {
        lastMessages.value.shift();
      }
      lastProcessedTimestamp = entry.timestamp;
    }
  },
  { deep: true }
);
</script>
