<template>
  <div class="gap-2 grid grid-cols-1 sm:grid-cols-2 landscape:grid-cols-3">
    <div v-for="item in displayItems" :key="item.id" class="bg-surface-2 rounded-lg shadow p-2">
      <div class="text-sm font-semibold">{{ item.source }}</div>
      <div class="text-xs text-content-muted">{{ item.status }}</div>

      <div v-if="item.showProgress" class="mt-2">
        <div class="w-full bg-surface-3 rounded-full h-2">
          <div
            :class="item.color"
            class="h-2 rounded-full transition-all duration-300"
            :style="{ width: `${item.percentage}%` }"
          ></div>
        </div>
      </div>

      <div class="text-xs text-content-muted mt-2">
        {{ new Date(item.timestamp).toLocaleTimeString() }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useProgressStore } from '@/store/progressStore';
import { apiStore } from '@/store/store';
import signalRProgressService from '@/services/signalRprogressService';

const progressStore = useProgressStore();
const store = apiStore();
const { progresses } = storeToRefs(progressStore);

const displayItems = computed(() => {
  const items = [];

  Object.values(progresses.value).forEach((progress) => {
    // Slot 1 (blau) - status
    if (progress.status && progress.status !== '') {
      const percentage =
        progress.maxProgress > 0 ? (progress.progress / progress.maxProgress) * 100 : 0;
      const showProgress = progress.progress >= 0;
      items.push({
        id: `${progress.source}-slot1`,
        source: progress.source,
        status: progress.status,
        percentage: percentage,
        showProgress: showProgress,
        color: 'bg-blue-600',
        timestamp: progress.timestamp,
        progressType: progress.progressType,
      });
    }

    // Slot 2 (grün) - status2
    if (progress.status2 && progress.status2 !== '') {
      const percentage =
        progress.maxProgress2 > 0 ? (progress.progress2 / progress.maxProgress2) * 100 : 0;
      const showProgress = progress.progress2 >= 0;
      items.push({
        id: `${progress.source}-slot2`,
        source: progress.source,
        status: progress.status2,
        percentage: percentage,
        showProgress: showProgress,
        color: 'bg-green-600',
        timestamp: progress.timestamp,
        progressType: progress.progressType2,
      });
    }

    // Slot 3 (lila) - status3
    if (progress.status3 && progress.status3 !== '') {
      const percentage =
        progress.maxProgress3 > 0 ? (progress.progress3 / progress.maxProgress3) * 100 : 0;
      const showProgress = progress.progress3 >= 0;
      items.push({
        id: `${progress.source}-slot3`,
        source: progress.source,
        status: progress.status3,
        percentage: percentage,
        showProgress: showProgress,
        color: 'bg-purple-600',
        timestamp: progress.timestamp,
        progressType: progress.progressType3,
      });
    }
  });

  return items;
});

const handleReconnect = () => {
  console.log('[infoProgress] Clearing progress items on reconnect');
  progressStore.clearAll();
};

onMounted(() => {
  signalRProgressService.setReconnectCallback(handleReconnect);

  if (!signalRProgressService.isSignalRConnected()) {
    signalRProgressService.connect().catch((err) => {
      console.error('Failed to connect to progress service:', err);
    });
  }
});

// When the backend becomes reachable again (e.g. after an instance switch that
// disconnected all SignalR services), reconnect the progress service to the new IP.
watch(
  () => store.isBackendReachable,
  (reachable) => {
    if (reachable && !signalRProgressService.isSignalRConnected()) {
      console.log('[infoProgress] Backend reachable – reconnecting progress service');
      signalRProgressService.connect().catch((err) => {
        console.error('[infoProgress] Failed to reconnect progress service:', err);
      });
    }
  }
);

onUnmounted(() => {
  signalRProgressService.setReconnectCallback(null);
});
</script>
