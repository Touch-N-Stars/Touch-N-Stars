<template>
  <HfAfChart v-if="hfRun" :run="hfRun" />
  <AfLiveGraph v-else-if="store.checkVersionNewerOrEqual(store.currentApiVersion, '2.2.11.0')" />
  <AfGraphNinaFocus v-else-if="!isHocusFocus" />
  <AfGraphHocusFocus v-else />
</template>

<script setup>
import { ref, watch } from 'vue';
import AfGraphHocusFocus from '@/components/focuser/AfGraphHocusFocus.vue';
import AfGraphNinaFocus from '@/components/focuser/AfGraphNinaFocus.vue';
import HfAfChart from '@/components/focuser/HfAfChart.vue';
import AfLiveGraph from './AfLiveGraph.vue';
import apiService from '@/services/apiService';
import { usePolling } from '@/composables/usePolling';
import { useLogStore } from '@/store/logStore';
import { apiStore } from '@/store/store';

const logStore = useLogStore();
const store = apiStore();
const isHocusFocus = ref(false);

// While HocusFocus runs the auto-focus, draw its live chart: every measured point arrives with its
// error bar, the current fit and the outliers it rejects so far. Once seen, keep following that run to
// its end so the finished curve replaces the live one without switching back to the plain graph.
// PINS only: the chart reads HocusFocus v4 internals that a stock NINA's HocusFocus may not have.
const hfRun = ref(null);
usePolling(async () => {
  if (!store.isPINS) return;
  const data = await apiService.hocusfocus.getLastAutoFocusRun();
  if (data?.Success && data.IsActiveAutoFocuser && (data.InProgress || hfRun.value)) {
    hfRun.value = data;
  }
}, 2000);

watch(
  () => logStore.LogsInfo.logs,
  (newLogs) => {
    if (!newLogs || newLogs.length === 0) return;

    const sortedLogs = [...newLogs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const entry of sortedLogs) {
      const startMatch = entry.message.match(/Starting AutoFocus with initial position (\d+)/);
      if (startMatch) {
        isHocusFocus.value = true;
        //console.log('Hocus Focus running');
      }
    }
  },
  { deep: true }
);
</script>
