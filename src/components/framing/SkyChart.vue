<template>
  <div class="bg-gray-800/50 rounded-lg p-2 relative h-40">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue';
import { Chart, registerables } from 'chart.js';
import apiService from '@/services/apiService';
import { timeSync } from '@/utils/timeSync';

Chart.register(...registerables);

const horizonData = ref([]);

const props = defineProps({
  target: {
    type: Object, // { RA: in degrees, Dec: in degrees }
    required: true,
  },
  coordinates: {
    type: Object, // { latitude, longitude }
    required: true,
  },
});

const canvasRef = ref(null);
let chartInstance = null;

const baseTime = computed(() => {
  const now = new Date(timeSync.getServerTime());
  return new Date(now.getTime() - 12 * 60 * 60 * 1000); // Startzeit = 12h vor jetzt
});

// UTC-basiertes Julianisches Datum
function toJulian(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function calculateAltitude(raDeg, decDeg, observerLat, observerLon, date) {
  const latRad = (observerLat * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;
  const JD = toJulian(date);
  const GMST = 18.697374558 + 24.06570982441908 * (JD - 2451545.0);
  let LMST = (GMST + observerLon / 15) % 24;
  if (LMST < 0) LMST += 24;

  const hourAngle = LMST * 15 - raDeg;
  const haRad = (hourAngle * Math.PI) / 180;

  const altRad = Math.asin(
    Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad)
  );

  return (altRad * 180) / Math.PI;
}

function calculateAzimuth(raDeg, decDeg, observerLat, observerLon, date) {
  const latRad = (observerLat * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;
  const JD = toJulian(date);
  const GMST = 18.697374558 + 24.06570982441908 * (JD - 2451545.0);
  let LMST = (GMST + observerLon / 15) % 24;
  if (LMST < 0) LMST += 24;

  const hourAngle = LMST * 15 - raDeg;
  const haRad = (hourAngle * Math.PI) / 180;

  const altRad = Math.asin(
    Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad)
  );

  const cosA =
    (Math.sin(decRad) - Math.sin(altRad) * Math.sin(latRad)) /
    (Math.cos(altRad) * Math.cos(latRad));
  const sinA = (-Math.cos(decRad) * Math.sin(haRad)) / Math.cos(altRad);

  let azRad = Math.atan2(sinA, cosA);
  if (azRad < 0) azRad += 2 * Math.PI;

  return (azRad * 180) / Math.PI;
}

function interpolateHorizon(azimuth) {
  const sorted = [...horizonData.value].sort((a, b) => a.azimuth - b.azimuth);

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (azimuth >= a.azimuth && azimuth <= b.azimuth) {
      const t = (azimuth - a.azimuth) / (b.azimuth - a.azimuth);
      return a.altitude + t * (b.altitude - a.altitude);
    }
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (azimuth >= last.azimuth || azimuth <= first.azimuth) {
    const span = first.azimuth + 360 - last.azimuth;
    const t = ((azimuth - last.azimuth + 360) % 360) / span;
    return last.altitude + t * (first.altitude - last.altitude);
  }

  return 0;
}

const altitudeData = computed(() => {
  if (props.target?.RA == null || props.target?.Dec == null) return [];

  const points = [];
  const steps = 96; // 24h * 4 (alle 15 Minuten)

  for (let i = 0; i <= steps; i++) {
    const time = new Date(baseTime.value.getTime() + i * 15 * 60 * 1000);
    const alt = calculateAltitude(
      props.target.RA,
      props.target.Dec,
      props.coordinates.latitude,
      props.coordinates.longitude,
      time
    );
    points.push({
      label: `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`,
      altitude: alt,
    });
  }

  return points;
});

const horizonAltitudes = computed(() => {
  if (!props.target?.RA || !props.target?.Dec || horizonData.value.length === 0) return [];

  const points = [];
  const steps = 96;

  for (let i = 0; i <= steps; i++) {
    const time = new Date(baseTime.value.getTime() + i * 15 * 60 * 1000);
    const az = calculateAzimuth(
      props.target.RA,
      props.target.Dec,
      props.coordinates.latitude,
      props.coordinates.longitude,
      time
    );
    points.push(interpolateHorizon(az));
  }

  return points;
});

function createChart() {
  if (!canvasRef.value || altitudeData.value.length === 0) return;
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(canvasRef.value, {
    type: 'line',
    data: {
      labels: altitudeData.value.map((p) => p.label),
      datasets: [
        {
          label: 'Altitude (°)',
          data: altitudeData.value.map((p) => p.altitude),
          borderColor: 'rgb(6, 182, 212)',
          backgroundColor: 'rgba(6, 182, 212, 0.2)',
          pointRadius: 0,
          tension: 0.3,
          order: -10,
        },
        {
          label: 'Horizontprofil',
          data: horizonAltitudes.value,
          borderColor: 'rgba(128,128,128,1)',
          backgroundColor: 'rgba(128,128,128,0.3)',
          pointRadius: 0,
          tension: 0,
          fill: 'start',
          order: 1,
        },
        {
          label: 'Daemmerung',
          data: getDarknessFill(-12),
          borderColor: 'rgba(100, 0, 0, 0)',
          backgroundColor: 'rgba(10, 10, 10, 0.4)',
          pointRadius: 0,
          tension: 0,
          fill: 'start',
          order: -2,
        },
        {
          label: 'Astronomische Nacht',
          data: getDarknessFill(-18),
          borderColor: 'rgba(100, 0, 0, 0)',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          tension: 0,
          fill: 'start',
          order: -1,
        },
        {
          type: 'bar',
          data: altitudeData.value.map((_, i) => {
            const mid = Math.floor(altitudeData.value.length / 2);
            return i === mid ? 90 : 0;
          }),
          backgroundColor: 'rgba(6, 182, 212,1)',
          borderWidth: 0,
          barPercentage: 0.1,
          categoryPercentage: 1.0,
          order: -9,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        y: {
          min: 0,
          max: 90,
          ticks: { color: '#ccc' },
          grid: { color: 'rgba(255,255,255,0.1)' },
        },
        x: {
          ticks: { color: '#ccc' },
          grid: { display: false, color: 'rgba(255,255,255,0.05)' },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function updateChart() {
  if (!chartInstance || altitudeData.value.length === 0) return;

  chartInstance.data.labels = altitudeData.value.map((p) => p.label);
  chartInstance.data.datasets[0].data = altitudeData.value.map((p) => p.altitude);
  chartInstance.data.datasets[1].data = horizonAltitudes.value;
  chartInstance.data.datasets[2].data = getDarknessFill(-12);
  chartInstance.data.datasets[3].data = getDarknessFill(-18);
  chartInstance.data.datasets[4].data = altitudeData.value.map((_, i) => {
    const mid = Math.floor(altitudeData.value.length / 2);
    return i === mid ? 90 : 0;
  });

  chartInstance.update();
}

async function loadCustomHorizont() {
  try {
    const response = await apiService.profileAction('horizon');

    if (response.StatusCode !== 200 || !response.Response) {
      console.warn('Horizon data not found or invalid:', response);
      return;
    }

    const { Azimuths, Altitudes } = response.Response;

    if (
      !Array.isArray(Azimuths) ||
      !Array.isArray(Altitudes) ||
      Azimuths.length !== Altitudes.length
    ) {
      console.warn('Invalid horizon data structure:', response.Response);
      return;
    }

    horizonData.value = Azimuths.map((azimuth, i) => ({
      azimuth,
      altitude: Altitudes[i],
    }));
  } catch (error) {
    console.error('Error loading horizon data:', error);
  }
}

function calculateSunAltitude(observerLat, observerLon, date) {
  const daysSinceJ2000 = toJulian(date) - 2451545.0;
  const meanLongitude = (280.46 + 0.9856474 * daysSinceJ2000) % 360;
  const meanAnomaly = (357.528 + 0.9856003 * daysSinceJ2000) % 360;

  const eclipticLongitude =
    meanLongitude +
    1.915 * Math.sin((meanAnomaly * Math.PI) / 180) +
    0.02 * Math.sin((2 * meanAnomaly * Math.PI) / 180);
  const epsilon = 23.439 - 0.0000004 * daysSinceJ2000;
  const ra =
    (Math.atan2(
      Math.cos((epsilon * Math.PI) / 180) * Math.sin((eclipticLongitude * Math.PI) / 180),
      Math.cos((eclipticLongitude * Math.PI) / 180)
    ) *
      180) /
    Math.PI;
  const dec =
    (Math.asin(
      Math.sin((epsilon * Math.PI) / 180) * Math.sin((eclipticLongitude * Math.PI) / 180)
    ) *
      180) /
    Math.PI;

  const GMST = 18.697374558 + 24.06570982441908 * daysSinceJ2000;
  let LMST = (GMST + observerLon / 15) % 24;
  if (LMST < 0) LMST += 24;
  const hourAngle = (LMST * 15 - ra + 360) % 360;

  const haRad = (hourAngle * Math.PI) / 180;
  const latRad = (observerLat * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;

  const alt = Math.asin(
    Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad)
  );
  return (alt * 180) / Math.PI;
}

function getDarknessFill(thresholdDeg = -18) {
  const fill = [];
  const steps = 96;

  for (let i = 0; i <= steps; i++) {
    const time = new Date(baseTime.value.getTime() + i * 15 * 60 * 1000);
    const sunAlt = calculateSunAltitude(
      props.coordinates.latitude,
      props.coordinates.longitude,
      time
    );
    fill.push(sunAlt < thresholdDeg ? 90 : NaN);
  }

  return fill;
}

onMounted(async () => {
  await loadCustomHorizont();
  createChart();
});

watch([altitudeData, horizonAltitudes], () => {
  if (chartInstance) {
    updateChart();
  } else {
    createChart(); // Erstes Mal erstellen
  }
});
</script>
