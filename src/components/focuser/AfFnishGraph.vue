<template>
  <div class="flex flex-col">
    <!-- HocusFocus ran the newest auto-focus: show it the way its own AF panel does -->
    <div v-if="hfRun" class="flex flex-col gap-3">
      <HfAfChart :run="hfRun" />
      <HfAfDetails :run="hfRun" />
    </div>
    <!-- Kept mounted (v-show) because the chart is created once on this canvas -->
    <div v-show="!hfRun">
      <canvas ref="chartCanvas" class="w-full h-72 md:h-96 xl:h-[600px]"></canvas>
    </div>
    <div v-show="!hfRun && timestamp.length > 0" class="text-center mt-4 space-y-1">
      <p>{{ timestamp }}</p>
      <p v-show="temperature != null">{{ temperature }}°C</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { usePolling } from '@/composables/usePolling';
import { useI18n } from 'vue-i18n';
import { Chart, registerables } from 'chart.js';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import HfAfChart from '@/components/focuser/HfAfChart.vue';
import HfAfDetails from '@/components/focuser/HfAfDetails.vue';

// Registriere alle Chart.js Komponenten
Chart.register(...registerables);

const { t } = useI18n();
const chartCanvas = ref(null);
const timestamp = ref(''); // Timestamp für die Anzeige
const temperature = ref();
const hfRun = ref(null); // HocusFocus' last run, while HocusFocus is the auto-focuser
const store = apiStore();
let chartInstance = null;
// Periodically reload the last autofocus run
usePolling(() => fetchLastAf(), 15000, { immediate: false });

// Funktion, um die Größe des Charts beim Fenster-Resize anzupassen
const resizeChart = () => {
  if (chartInstance) {
    chartInstance.resize();
  }
};

// Funktion zum Parsen der Quadratischen Fitting-Formel
function parseQuadraticFormula(formula) {
  // Normalisiere die Formel, um "+ -" zu "-"
  const normalizedFormula = formula.replace(/\+\s*-/g, '- ').replace(/-\s*-/g, '+ ');

  //console.log('Normalisierte Quadratische Formel:', normalizedFormula); // Debugging

  // Neuer Regex für Exponentialnotation
  const regex =
    /y\s*=\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*\*\s*x\^2\s*([+-]?\s*\d*\.?\d+(?:[eE][+-]?\d+)?)\s*\*\s*x\s*([+-]?\s*\d*\.?\d+(?:[eE][+-]?\d+)?)/i;
  const match = normalizedFormula.match(regex);
  if (match) {
    const a = parseFloat(match[1]);
    const b = parseFloat(match[2].replace(/\s+/g, ''));
    const c = parseFloat(match[3].replace(/\s+/g, ''));
    return { a, b, c };
  }
  return null;
}

// Funktion zum Parsen der Hyperbolischen Fitting-Formel
function parseHyperbolicFormula(formula) {
  //console.log('Hyperbolic Fitting Formel:', formula); // Debugging

  // Neuer Regex für Exponentialnotation und Hyperbolische Funktion
  const regex =
    /y\s*=\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*\*\s*cosh\s*\(\s*asinh\s*\(\s*\(\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*-\s*x\s*\)\s*\/\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*\)\s*\)/i;
  const match = formula.match(regex);
  if (match) {
    const A = parseFloat(match[1]);
    const B = parseFloat(match[2]);
    const C = parseFloat(match[3]);
    return { A, B, C };
  }
  return null;
}

// Daten von der API abrufen und Chart aktualisieren
async function fetchLastAf() {
  try {
    // While HocusFocus is the auto-focuser, its last run is the newest AF: show it the way its own panel does.
    // PINS only: the view reads HocusFocus v4 internals that a stock NINA's HocusFocus may not have.
    const hfData = store.isPINS ? await apiService.hocusfocus.getLastAutoFocusRun() : null;
    hfRun.value =
      hfData?.Success && hfData.IsActiveAutoFocuser && !hfData.InProgress ? hfData : null;
    if (hfRun.value) return;

    const response = await apiService.focusAction('last-af');
    if (!response?.Response) return;
    const apiData = response.Response;
    //console.log('API Data for Last AF:', apiData);
    const dateLastAf = new Date(apiData.Timestamp);
    const dateProfilLastUsed = new Date(store.profileInfo.LastUsed);
    const temp = parseFloat(apiData?.Temperature);
    temperature.value = isNaN(temp) ? null : temp.toFixed(2);
    //console.log(dateLastAf, ' : ', dateProfilLastUsed);

    if (dateLastAf < dateProfilLastUsed) {
      return;
    }
    const measurePoints = apiData.MeasurePoints || [];

    // Neue Daten extrahieren
    const positions = measurePoints.map((point) => point.Position);
    const values = measurePoints.map((point) => parseFloat(point.Value.toFixed(2)));

    // Minima aus Intersections
    const hyperbolicMinimum = {
      position: apiData.Intersections?.HyperbolicMinimum?.Position,
      value: apiData.Intersections?.HyperbolicMinimum?.Value,
    };
    const quadraticMinimum = {
      position: apiData.Intersections?.QuadraticMinimum?.Position,
      value: apiData.Intersections?.QuadraticMinimum?.Value,
    };

    // Timestamp aus API speichern
    const dateObject = new Date(apiData.Timestamp);
    const dateTimeText = isNaN(dateObject.getTime())
      ? t('components.focuser.graph.invalidDate')
      : `${dateObject.toLocaleDateString()} ${dateObject.toLocaleTimeString()}`;
    timestamp.value = dateTimeText;

    // Fittings aus API extrahieren
    const fittings = apiData.Fittings || {};

    // Quadratisch parsen
    let quadraticTrendline = [];
    if (fittings.Quadratic) {
      const quadraticParams = parseQuadraticFormula(fittings.Quadratic);
      if (!quadraticParams) {
        console.warn('Quadratic fitting formula could not be parsed.');
      } else {
        // Falls parse erfolgreich, Trendline berechnen
        const quadraticFunction = (x) =>
          quadraticParams.a * Math.pow(x, 2) + quadraticParams.b * x + quadraticParams.c;
        quadraticTrendline = positions.map((x) => quadraticFunction(x));
      }
    } else {
      console.warn('No quadratic formula available. (fittings.Quadratic empty)');
    }

    // Hyperbolisch parsen
    let hyperbolicTrendline = [];
    if (fittings.Hyperbolic) {
      const hyperbolicParams = parseHyperbolicFormula(fittings.Hyperbolic);
      if (!hyperbolicParams) {
        console.warn('Hyperbolic fitting formula could not be parsed.');
      } else {
        // Falls parse erfolgreich, Trendline berechnen
        const hyperbolicFunction = (x) =>
          hyperbolicParams.A * Math.cosh(Math.asinh((hyperbolicParams.B - x) / hyperbolicParams.C));
        hyperbolicTrendline = positions.map((x) => hyperbolicFunction(x));
      }
    } else {
      console.warn('No hyperbolic formula available. (fittings.Hyperbolic empty)');
    }

    // Chart aktualisieren, falls vorhanden
    if (chartInstance) {
      chartInstance.data.labels = positions;
      // 0 = Measure Points
      chartInstance.data.datasets[0].data = values;
      // 1 = Quadratic Trendline
      chartInstance.data.datasets[1].data = quadraticTrendline;
      // 2 = Hyperbolic Trendline
      chartInstance.data.datasets[2].data = hyperbolicTrendline;
      // 3 = Quadratic Min (nur setzen, falls es Werte gibt)
      chartInstance.data.datasets[3].data =
        quadraticMinimum?.position !== undefined
          ? [{ x: quadraticMinimum.position, y: quadraticMinimum.value }]
          : [];
      // 4 = Hyperbolic Min (nur setzen, falls es Werte gibt)
      chartInstance.data.datasets[4].data =
        hyperbolicMinimum?.position !== undefined
          ? [{ x: hyperbolicMinimum.position, y: hyperbolicMinimum.value }]
          : [];

      chartInstance.update();
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

onMounted(async () => {
  const ctx = chartCanvas.value.getContext('2d');
  console.log('Loading graph');

  // Initialer Chart
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [], // Initial leer
      datasets: [
        {
          label: t('components.focuser.graph.measurePoints'),
          data: [],
          borderColor: 'blue',
          borderWidth: 2,
          fill: false,
          pointRadius: 5,
        },
        {
          label: t('components.focuser.graph.quadraticTrendline'),
          data: [],
          borderColor: 'red',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
        {
          label: t('components.focuser.graph.hyperbolicTrendline'),
          data: [],
          borderColor: 'green',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
        {
          label: t('components.focuser.graph.quadraticMin'),
          data: [],
          borderColor: 'red',
          backgroundColor: 'red',
          pointRadius: 6,
          pointStyle: 'circle',
          showLine: false,
        },
        {
          label: t('components.focuser.graph.hyperbolicMin'),
          data: [],
          borderColor: 'green',
          backgroundColor: 'green',
          pointRadius: 6,
          pointStyle: 'circle',
          showLine: false,
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
          mode: 'index',
          intersect: false,
        },
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'Position',
            color: '#CCCCCC',
          },
          ticks: {
            color: '#CCCCCC', // <- Zahlen-Beschriftung auf Y-Achse
          },
        },
        y: {
          title: {
            display: true,
            text: t('components.focuser.graph.value'),
            color: '#CCCCCC',
          },
          ticks: {
            color: '#CCCCCC', // <- Zahlen-Beschriftung auf Y-Achse
          },
        },
      },
    },
  });

  // Daten laden nach nextTick, um sicherzustellen, dass Chart vollständig initialisiert ist
  await nextTick();
  fetchLastAf();

  // Event Listener hinzufügen
  window.addEventListener('resize', resizeChart);
});

onUnmounted(() => {
  // Event Listener entfernen
  window.removeEventListener('resize', resizeChart);

  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>

<style scoped></style>
