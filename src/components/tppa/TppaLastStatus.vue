<template>
  <div
    v-if="tppaStore.isRunning && (statusText || progressPercent !== null)"
    class="border border-line-strong rounded-card"
  >
    <p>{{ statusText }}</p>
    <p v-if="progressPercent !== null">{{ progressPercent }}%</p>
  </div>
</template>
<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTppaStore } from '@/store/tppaStore';
import { tppaStatusKey } from '@/utils/tppaStatus';

const { t } = useI18n();
const tppaStore = useTppaStore();

// The plugin speaks English; the known lines are translated, new ones shown as they come.
const statusText = computed(() => {
  const status = tppaStore.currentMessage?.message?.Response?.Status;
  if (!status) return;
  const key = tppaStatusKey(status);
  return key ? t(`components.tppa.status.${key}`) : status;
});

const progressPercent = computed(() => {
  if (
    !tppaStore.currentMessage?.message?.Response?.Progress ||
    tppaStore.currentMessage.message.Response.Progress === -1
  )
    return null;
  return Math.round(tppaStore.currentMessage.message.Response.Progress * 100);
});
</script>
