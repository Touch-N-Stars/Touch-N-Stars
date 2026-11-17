<template>
  <div class="bg-surface-2/50 rounded-lg p-2 relative h-40">
    <canvas ref="canvasRef"></canvas>

    <!-- One strip in the top right corner: the values sit next to the button
         instead of in a second band further down over the curves. -->
    <div class="absolute top-1 right-1 z-10 flex min-h-touch items-center gap-1">
      <span
        v-if="showMoon && moonInfoText"
        class="pointer-events-none rounded-control bg-surface-1/80 px-1.5 py-0.5 text-[10px] leading-tight text-content-muted"
      >
        {{ moonInfoText }}
      </span>

      <button
        type="button"
        class="flex min-h-touch min-w-touch items-center justify-center"
        :aria-pressed="showMoon"
        :aria-label="t('components.framing.skyChart.toggleMoon')"
        :title="t('components.framing.skyChart.toggleMoon')"
        @click="showMoon = !showMoon"
      >
        <span
          class="rounded-control bg-surface-1/80 p-1.5 transition-colors"
          :class="showMoon ? 'text-status-warn' : 'text-content-muted'"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M21.75 15a9.75 9.75 0 01-3.75.75A9.75 9.75 0 018.25 6c0-1.33.27-2.6.75-3.75A9.75 9.75 0 003 11.25 9.75 9.75 0 0012.75 21 9.75 9.75 0 0021.75 15z"
            />
          </svg>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Chart, registerables } from 'chart.js';
import apiService from '@/services/apiService';
import { timeSync } from '@/utils/timeSync';
import { useSettingsStore } from '@/store/settingsStore';
import {
  equatorialToAltAz,
  getMoonDataForTarget,
  getMoonEquatorial,
  getSunAltitudeDeg,
} from '@/utils/astronomy';

Chart.register(...registerables);

const { t } = useI18n();
const settingsStore = useSettingsStore();

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
  // UTC milliseconds the chart is drawn for. Null (the default) means server
  // time, refreshed every 15 minutes; the Atlas passes its own clock instead.
  time: {
    type: Number,
    default: null,
  },
});

const canvasRef = ref(null);
let chartInstance = null;
let timeUpdateInterval = null;

const STEP_MS = 15 * 60 * 1000;
const STEPS = 96; // 24 h in 15 minute samples
const MIDNIGHT_STEP = STEPS / 2;

const showMoon = computed({
  get: () => settingsStore.skyChart.showMoon,
  set: (value) => (settingsStore.skyChart.showMoon = value),
});

const serverNow = ref(new Date(timeSync.getServerTime()));
const now = computed(() => (props.time !== null ? new Date(props.time) : serverNow.value));

// The chart always shows one whole night: it starts at local noon and runs for
// 24 h, so midnight sits exactly in the middle (sample 48). The start is a
// calendar time, the steps are a fixed 15 minutes - that keeps every label on
// the quarter hour. DST switches happen at night, i.e. after midnight, so they
// only move the far end of the window to 11:00 or 13:00.
const windowStart = computed(() => {
  const start = new Date(now.value);
  if (start.getHours() < 12) start.setDate(start.getDate() - 1);
  start.setHours(12, 0, 0, 0);
  return start;
});

const sampleTimes = computed(() => {
  const start = windowStart.value.getTime();
  const times = [];

  for (let i = 0; i <= STEPS; i++) {
    times.push(new Date(start + i * STEP_MS));
  }

  return times;
});

const labels = computed(() =>
  sampleTimes.value.map(
    (time) => `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`
  )
);

// Fractional sample index of the current time, or null while it is outside the
// window: right before the 15-minute refresh catches up at noon, and on the
// morning after a DST fall-back, when the fixed 24 h end at 11:00 local.
const nowIndex = computed(() => {
  const offset = now.value.getTime() - windowStart.value.getTime();
  const index = offset / STEP_MS;
  if (index < 0 || index > STEPS) return null;
  return index;
});

const hasTarget = computed(() => props.target?.RA != null && props.target?.Dec != null);

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
  if (!hasTarget.value) return [];

  return sampleTimes.value.map(
    (time) =>
      equatorialToAltAz(
        props.target.RA,
        props.target.Dec,
        time,
        props.coordinates.latitude,
        props.coordinates.longitude
      ).altDeg
  );
});

const horizonAltitudes = computed(() => {
  if (!hasTarget.value || horizonData.value.length === 0) return [];

  return sampleTimes.value.map((time) =>
    interpolateHorizon(
      equatorialToAltAz(
        props.target.RA,
        props.target.Dec,
        time,
        props.coordinates.latitude,
        props.coordinates.longitude
      ).azDeg
    )
  );
});

// Only the part above the horizon is drawn, so the ends of the curve mark
// moonrise and moonset.
const moonAltitudes = computed(() => {
  if (!showMoon.value) return [];

  return sampleTimes.value.map((time) => {
    const moon = getMoonEquatorial(time);
    const { altDeg } = equatorialToAltAz(
      moon.raDeg,
      moon.decDeg,
      time,
      props.coordinates.latitude,
      props.coordinates.longitude
    );
    return altDeg > 0 ? altDeg : NaN;
  });
});

// Evaluated at midnight, the middle of the window, so the numbers describe the
// night that is on screen.
const moonInfo = computed(() => {
  if (!showMoon.value) return null;

  return getMoonDataForTarget(
    hasTarget.value ? props.target.RA : null,
    hasTarget.value ? props.target.Dec : null,
    sampleTimes.value[MIDNIGHT_STEP]
  );
});

const moonInfoText = computed(() => {
  const info = moonInfo.value;
  if (!info) return '';

  const parts = [];
  if (Number.isFinite(info.illumination)) {
    parts.push(
      t('components.framing.skyChart.moonIlluminationFmt', {
        pct: Math.round(info.illumination * 100),
      })
    );
  }
  if (Number.isFinite(info.separationDeg)) {
    parts.push(
      t('components.framing.skyChart.moonSeparationFmt', {
        deg: Math.round(info.separationDeg),
      })
    );
  }

  return parts.join(' · ');
});

function getDarknessFill(thresholdDeg = -18) {
  return sampleTimes.value.map((time) =>
    getSunAltitudeDeg(time, props.coordinates.latitude, props.coordinates.longitude) < thresholdDeg
      ? 90
      : NaN
  );
}

// Vertical "now" line. A dataset cannot do this: it would be pinned to a sample
// index, while the marker has to sit at the real time between two samples.
const nowMarkerPlugin = {
  id: 'nowMarker',
  afterDatasetsDraw(chart, _args, options) {
    const index = options?.index;
    if (!Number.isFinite(index)) return;

    const x = chart.scales.x?.getPixelForValue(index);
    if (!Number.isFinite(x)) return;

    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(6, 182, 212)';
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

function createChart() {
  if (!canvasRef.value || altitudeData.value.length === 0) return;
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(canvasRef.value, {
    type: 'line',
    plugins: [nowMarkerPlugin],
    data: {
      labels: labels.value,
      datasets: [
        {
          label: t('components.framing.skyChart.altitude'),
          data: altitudeData.value,
          borderColor: 'rgb(6, 182, 212)',
          backgroundColor: 'rgba(6, 182, 212, 0.2)',
          pointRadius: 0,
          tension: 0.3,
          order: -10,
        },
        {
          label: t('components.framing.skyChart.horizonProfile'),
          data: horizonAltitudes.value,
          borderColor: 'rgba(128,128,128,1)',
          backgroundColor: 'rgba(128,128,128,0.3)',
          pointRadius: 0,
          tension: 0,
          fill: 'start',
          order: 1,
        },
        {
          label: t('components.framing.skyChart.twilight'),
          data: getDarknessFill(-12),
          borderColor: 'rgba(100, 0, 0, 0)',
          backgroundColor: 'rgba(10, 10, 10, 0.4)',
          pointRadius: 0,
          tension: 0,
          fill: 'start',
          order: -2,
        },
        {
          label: t('components.framing.skyChart.astronomicalNight'),
          data: getDarknessFill(-18),
          borderColor: 'rgba(100, 0, 0, 0)',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          tension: 0,
          fill: 'start',
          order: -1,
        },
        {
          label: t('components.framing.skyChart.moon'),
          data: moonAltitudes.value,
          borderColor: 'rgb(251, 191, 36)',
          backgroundColor: 'rgba(251, 191, 36, 0.15)',
          pointRadius: 0,
          tension: 0.3,
          spanGaps: false,
          order: -8,
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
      plugins: {
        legend: { display: false },
        nowMarker: { index: nowIndex.value },
      },
    },
  });
}

function updateChart() {
  if (!chartInstance || altitudeData.value.length === 0) return;

  chartInstance.data.labels = labels.value;
  chartInstance.data.datasets[0].data = altitudeData.value;
  chartInstance.data.datasets[1].data = horizonAltitudes.value;
  chartInstance.data.datasets[2].data = getDarknessFill(-12);
  chartInstance.data.datasets[3].data = getDarknessFill(-18);
  chartInstance.data.datasets[4].data = moonAltitudes.value;
  chartInstance.options.plugins.nowMarker.index = nowIndex.value;

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

onMounted(async () => {
  await loadCustomHorizont();
  createChart();
  timeUpdateInterval = setInterval(
    () => {
      serverNow.value = new Date(timeSync.getServerTime());
    },
    15 * 60 * 1000
  );
});

onUnmounted(() => {
  clearInterval(timeUpdateInterval);
  chartInstance?.destroy();
  chartInstance = null;
});

watch([altitudeData, horizonAltitudes, moonAltitudes, nowIndex], () => {
  if (chartInstance) {
    updateChart();
  } else {
    createChart(); // first run
  }
});
</script>
