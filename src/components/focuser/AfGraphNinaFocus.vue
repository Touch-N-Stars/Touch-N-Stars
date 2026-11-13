<template>
  <!-- Chart -->
  <div class="h-72 w-full">
    <canvas ref="chartRef"></canvas>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useLogStore } from '@/store/logStore';
import { Chart, registerables } from 'chart.js';
import { apiStore } from '@/store/store';

const store = apiStore();

Chart.register(...registerables);

const chartRef = ref(null);
let chartInstance = null;

const logStore = useLogStore();
let lastProcessedTimestamp = null;
let lastKnownPosition = null; // Hier merken wir uns die letzte gesetzte Position
let lastPositionTimestamp = null;

// Funktion zum Zeichnen/Updaten des Charts
function updateChart() {
  const hfrData = store.afCurveData
    .filter((entry) => entry.hfr !== null && entry.position !== null)
    .map((entry) => ({
      x: entry.position,
      y: entry.hfr,
    }));

  if (!chartInstance) {
    chartInstance = new Chart(chartRef.value, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'AF-Graph_NINA',
            data: hfrData,
            tension: 0.3,
            cubicInterpolationMode: 'default',
            pointRadius: 4,
            pointStyle: 'circle',
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgb(59, 130, 246)',
            pointBackgroundColor: 'rgb(59, 130, 246)',
            pointBorderColor: 'rgb(59, 130, 246)',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: {
              color: '#f3f4f6',
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Position',
              color: '#f3f4f6',
            },
            ticks: {
              color: '#f3f4f6',
            },
            grid: {
              color: 'rgba(243, 244, 246, 0.2)',
            },
          },
          y: {
            title: {
              display: true,
              text: 'HFR',
              color: '#f3f4f6',
            },
            ticks: {
              color: '#f3f4f6',
            },
            grid: {
              color: 'rgba(243, 244, 246, 0.2)',
            },
          },
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
      },
    });
  } else {
    chartInstance.data.datasets[0].data = hfrData;
    chartInstance.update();
  }
}

function processLogs(newLogs) {
  if (!newLogs || newLogs.length === 0) return;

  const sortedLogs = [...newLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  for (const entry of sortedLogs) {
    if (lastProcessedTimestamp && new Date(entry.timestamp) <= new Date(lastProcessedTimestamp)) {
      continue;
    }

    const positionMatch = entry.message.match(/Moving Focuser to position (\d+)/);
    let hfrMatch = entry.message.match(/Average HFR: ([\d.]+), HFR σ: ([\d.]+)/);
    if (!hfrMatch) {
      hfrMatch = entry.message.match(/Average HFR: ([\d.]+), HFR MAD: ([\d.]+)/);
    }

    // Focuser wurde bewegt → Position merken
    if (positionMatch && !lastKnownPosition) {
      lastKnownPosition = parseInt(positionMatch[1], 10);
      console.log('lastKnownPosition', lastKnownPosition, entry.timestamp);
      lastPositionTimestamp = new Date(entry.timestamp);
    }

    // HFR erkannt → letzte bekannte Position mit speichern
    if (hfrMatch && lastPositionTimestamp) {
      const hfr = parseFloat(hfrMatch[1]);
      const hfrMad = parseFloat(hfrMatch[2]);
      const entryTimestamp = new Date(entry.timestamp);
      const timeDiff = (entryTimestamp - lastPositionTimestamp) / 1000;
      if (timeDiff > 2) {
        // A replay after a remount pairs the same lines again; the pairing state is
        // still consumed, only the duplicate point is not stored.
        if (!store.afCurveData.some((p) => p.timestamp === entry.timestamp)) {
          store.afCurveData.push({
            timestamp: entry.timestamp,
            position: lastKnownPosition, // letzte bekannte Position anhängen
            hfr,
            hfrMad,
          });
        }
        lastKnownPosition = null;
        lastPositionTimestamp = null;
      }
    }
    // Optional: Liste kürzen
    if (store.afCurveData.length > 50) {
      store.afCurveData.shift();
    }
    lastProcessedTimestamp = entry.timestamp;
  }
  store.afCurveData.sort((a, b) => a.position - b.position);
  updateChart(); // immer aktualisieren, wenn neue Logs da sind
}

watch(() => logStore.LogsInfo.logs, processLogs, { deep: true });

onMounted(() => {
  // afCurveData lives in the store and survives a remount (the reconnect splash
  // unmounts the page on every resume), while the cursor below starts over. The
  // current window is therefore replayed right away so the chart is not blank
  // until the next log change; the timestamp check in processLogs keeps the
  // replay from adding points that are already there.
  lastProcessedTimestamp = store.afTimestampLastStart;
  processLogs(logStore.LogsInfo.logs);
  updateChart();
});

onBeforeUnmount(() => {
  chartInstance?.destroy();
  chartInstance = null;
});
</script>

<style scoped></style>
