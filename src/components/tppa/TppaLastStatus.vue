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
import { useTppaStore } from '@/store/tppaStore';

const tppaStore = useTppaStore();

const statusText = computed(() => {
  if (!tppaStore.currentMessage?.message?.Response?.Status) return;
  return tppaStore.currentMessage.message.Response.Status;
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
