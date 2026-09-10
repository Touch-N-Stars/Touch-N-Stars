<template>
  <div>
    <div v-show="isLoading" class="flex items-center justify-center">
      <span
        class="w-12 h-12 border-4 border-blue-500 border-t-transparent border-solid rounded-full animate-spin"
      ></span>
    </div>
    <div v-show="!isLoading" class="w-full h-[25vh] min-h-40 relative">
      <canvas ref="rmsGraph"></canvas>
      <button
        v-if="store.isPINS"
        @click="clearGraph"
        :disabled="isClearing"
        :title="$t('components.guider.clearGraph')"
        :aria-label="$t('components.guider.clearGraph')"
        class="absolute top-0 right-7 p-1 text-gray-400 hover:text-white disabled:opacity-50"
      >
        <TrashIcon class="w-5 h-5" />
      </button>
      <button
        v-if="store.isPINS"
        @click="showSettings = !showSettings"
        class="absolute top-0 right-0 p-1 text-gray-400 hover:text-white"
      >
        <Cog6ToothIcon class="w-5 h-5" />
      </button>
    </div>
    <div v-if="store.isPINS" v-show="showSettings" class="mt-2 p-3 bg-gray-800 rounded-lg">
      <Phd2GraphSettings />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import Chart from 'chart.js/auto';
import { useGuiderStore } from '@/store/guiderStore';
import { useI18n } from 'vue-i18n';
import { useToastStore } from '@/store/toastStore';
import { apiStore } from '@/store/store';
import Phd2GraphSettings from './PHD2/pins/Phd2GraphSettings.vue';
import { Cog6ToothIcon, TrashIcon } from '@heroicons/vue/24/outline';

const { t } = useI18n();
const guiderStore = useGuiderStore();
const toastStore = useToastStore();
const store = apiStore();
const isLoading = ref(true);
const rmsGraph = ref(null);
const showSettings = ref(false);
const isClearing = ref(false);
let chart = null;

async function clearGraph() {
  const confirmed = await toastStore.showConfirmation(
    t('components.guider.clearGraph'),
    t('components.guider.clearGraphConfirm'),
    t('components.guider.clearGraph'),
    t('common.cancel')
  );
  if (!confirmed) return;

  isClearing.value = true;
  try {
    await guiderStore.clearGraph();
  } catch {
    toastStore.showToast({
      type: 'error',
      title: t('components.guider.clearGraph'),
      message: t('components.guider.clearGraphError'),
    });
  } finally {
    isClearing.value = false;
  }
}

const initGraph = () => {
  const size = guiderStore.chartInfo.HistorySize;
  const ctx = rmsGraph.value.getContext('2d');

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array(size).fill(''),
      datasets: [
        {
          type: 'line',
          label: 'RA "',
          borderColor: 'rgba(70, 130, 180, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0,
          pointRadius: 0,
          data: Array(size).fill(null),
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line',
          label: 'Dec "',
          borderColor: 'rgba(220, 20, 60, 1)',
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          tension: 0,
          pointRadius: 0,
          data: Array(size).fill(null),
          yAxisID: 'y',
          order: 3,
        },
        {
          type: 'bar',
          label: 'RA Duration',
          backgroundColor: 'rgba(70, 130, 180, 0.4)',
          data: Array(size).fill(null),
          yAxisID: 'y1',
          order: 4,
        },
        {
          type: 'bar',
          label: 'Dec Duration',
          backgroundColor: 'rgba(220, 20, 60, 0.4)',
          data: Array(size).fill(null),
          yAxisID: 'y1',
          order: 5,
        },
        {
          type: 'scatter',
          label: 'Dither',
          data: Array(size).fill(null),
          yAxisID: 'y',
          showLine: false,
          pointRadius: 6,
          pointStyle: 'triangle',
          backgroundColor: 'rgba(255, 165, 0, 1)',
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#CCCCCC',
          },
        },
        tooltip: {
          enabled: false,
        },
      },
      animation: {
        duration: 0,
      },
      scales: {
        x: {
          display: false,
        },
        y: {
          position: 'left',
          min: guiderStore.chartInfo.MinY,
          max: guiderStore.chartInfo.MaxY,
          grid: {
            color: 'rgba(248, 248, 255, 0.1)',
          },
          title: {
            display: true,
            color: '#CCCCCC',
            text: 'RA/Dec',
          },
          ticks: {
            color: '#e5e7eb', // <- Zahlen-Beschriftung auf Y-Achse
          },
        },
        y1: {
          position: 'right',
          stacked: false,
          grid: {
            drawOnChartArea: false,
          },
          title: {
            display: true,
            color: '#CCCCCC',
            text: 'Duration (ms)',
          },
          ticks: {
            color: '#e5e7eb', // <- Zahlen-Beschriftung auf Y-Achse
          },
        },
      },
    },
  });
};

// Überwachung der Store-Daten
watch(
  () => guiderStore.chartInfo.GuideSteps,
  (steps) => {
    if (!chart) return;
    if (!steps || !Array.isArray(steps)) return; // Guard gegen undefined/null

    const size = guiderStore.chartInfo.HistorySize;
    const raDist = Array(size).fill(null);
    const decDist = Array(size).fill(null);
    const raDur = Array(size).fill(null);
    const decDur = Array(size).fill(null);
    const dither = [];
    const labels = Array(size).fill('');

    let maxDuration = 0;

    steps.slice(-size).forEach((step, i) => {
      const ra = step.RADuration ?? 0;
      const dec = step.DECDuration ?? 0;

      raDist[i] = step.RADistanceRawDisplay ?? null;
      decDist[i] = step.DECDistanceRawDisplay ?? null;
      raDur[i] = ra;
      decDur[i] = dec;

      labels[i] = step.Id.toString();

      if (step.Dither && step.Dither !== 'NaN') {
        dither.push({ x: step.Id.toString(), y: 0 });
      }

      maxDuration = Math.max(maxDuration, Math.abs(ra), Math.abs(dec));
    });

    // Dynamische Skalierung der Y1-Achse (symmetrisch)
    const maxAbs = Math.max(maxDuration, 100); // fallback auf 100 falls alles null

    chart.options.scales.y1.suggestedMin = -maxAbs;
    chart.options.scales.y1.suggestedMax = maxAbs;

    // Y-Achse (RA/Dec) aus Store aktualisieren
    chart.options.scales.y.min = guiderStore.chartInfo.MinY;
    chart.options.scales.y.max = guiderStore.chartInfo.MaxY;

    chart.data.datasets[0].data = raDist;
    chart.data.datasets[1].data = decDist;
    chart.data.datasets[2].data = raDur;
    chart.data.datasets[3].data = decDur;
    chart.data.datasets[4].data = dither;
    chart.data.labels = labels;

    chart.update();
    isLoading.value = false;
  },
  { immediate: true }
);

watch(
  () => guiderStore.phd2StarLost,
  (newValue, oldValue) => {
    if (oldValue === undefined) return; // skip first run

    if (newValue === true && oldValue === false) {
      // Debounce: wait 1.5s before showing toast to avoid false positives when
      // PHD2 briefly emits StarLost immediately before GuidingStopped on a normal stop.
      setTimeout(() => {
        if (guiderStore.phd2StarLost) {
          toastStore.showToast({
            type: 'error',
            title: t('components.guider.phd2.error.title'),
            message: t('components.guider.phd2.error.star-lost-message'),
          });
        }
      }, 1500);
    }
  }
);

// The poller skips the graph fetch while the flyout is closed (the component
// stays mounted via v-show); refresh immediately when it opens so the chart
// does not show stale data until the next poll tick.
watch(
  () => guiderStore.showGuiderGraph,
  (visible) => {
    if (visible) {
      guiderStore.fetchGraphInfos(t);
    }
  }
);

// Restart the graph poller when the backend comes back while this view is
// mounted: a transient connection loss runs clearAllStates(), which stops the
// poller without this view ever unmounting.
watch(
  () => store.isBackendReachable,
  (reachable) => {
    if (reachable && !guiderStore.isFetchingGraph()) {
      guiderStore.fetchGraphInfos(t);
      guiderStore.startFetching(t);
    }
  }
);

onMounted(async () => {
  await guiderStore.fetchGraphInfos(t);
  guiderStore.startFetching(t);
  initGraph();
});

onBeforeUnmount(() => {
  guiderStore.stopFetching();
  if (chart) {
    chart.destroy();
  }
});
</script>

<style scoped></style>
