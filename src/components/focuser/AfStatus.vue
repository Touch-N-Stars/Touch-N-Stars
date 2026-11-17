<template>
  <div class="text-base text-content-muted pb-2">{{ $t('components.tppa.last_messages') }}:</div>
  <ul>
    <li
      v-for="(msg, index) in lastMessages"
      :key="`${msg.timestamp}-${index}`"
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
import { computed } from 'vue';
import { useLogStore } from '@/store/logStore';
import { useI18n } from 'vue-i18n';
import { formatTime } from '@/utils/utils';
import { selectAfStatusEntries } from '@/utils/afStatusLog';
import Spinner from '@/components/helpers/Spinner.vue';

const { t } = useI18n();
const logStore = useLogStore();

const KIND_COLORS = {
  complete: 'var(--color-status-ok)',
  failed: 'var(--color-status-warn)',
};

// Derived from the store's log window instead of collected in the component, so
// a remount (the reconnect splash after every resume unmounts the page) shows the
// current run right away. Newest first.
const lastMessages = computed(() =>
  selectAfStatusEntries(logStore.LogsInfo.logs)
    .reverse()
    .map((entry) => ({
      timestamp: entry.timestamp,
      message: entry.kind === 'exposure' ? t('components.tppa.capture_running') : entry.message,
      color: KIND_COLORS[entry.kind] ?? 'inherit',
    }))
);
</script>
