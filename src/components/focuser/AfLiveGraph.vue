<template>
  <!-- Chart -->
  <div class="h-72 w-full">
    <canvas ref="chartRef"></canvas>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useAutofocusStore } from '@/store/autofocusStore';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const chartRef = ref(null);
let chartInstance = null;

const autofocusStore = useAutofocusStore();

function updateChart() {
  // Convert autofocus points directly to chart data
  const hfrData = autofocusStore.points
    .filter((point) => point.HFR !== null && point.HFR !== undefined && point.Position !== null)
    .map((point) => ({
      x: point.Position,
      y: point.HFR,
    }))
    .sort((a, b) => a.x - b.x);

  if (!chartInstance) {
    chartInstance = new Chart(chartRef.value, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Autofocus Graph',
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
              text: 'Focuser Position',
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
              text: 'HFR (Half Flux Radius)',
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

// Watch autofocus points for real-time updates
watch(
  () => autofocusStore.points,
  () => {
    updateChart();
  },
  { deep: true }
);

// Watch for autofocus start to clear chart
watch(
  () => autofocusStore.isRunning,
  (isRunning) => {
    if (isRunning) {
      console.log('[AfLiveGraph] Autofocus started, clearing chart');
      if (chartInstance) {
        chartInstance.data.datasets[0].data = [];
        chartInstance.update();
      }
    }
  }
);

onMounted(() => {
  updateChart();
  console.log('[AfLiveGraph] Livechart mounted');
});

onBeforeUnmount(() => {
  chartInstance?.destroy();
  chartInstance = null;
});
</script>
