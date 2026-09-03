<template>
  <div class="bg-gray-800/50 rounded-lg p-2 relative h-40">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Chart, registerables } from 'chart.js';
import apiService from '@/services/apiService';
import { timeSync } from '@/utils/timeSync';

Chart.register(...registerables);

const { t } = useI18n();

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

// The highest point on the same +/-12h curve this chart already draws -- emitted rather than
// duplicated, so a caller (e.g. Perihelion's own altitude card) can show "currently low, but
// climbing to X" instead of just the instantaneous altitude, without re-deriving the curve
// itself a second time.
const emit = defineEmits(['peak-altitude']);

const canvasRef = ref(null);
let chartInstance = null;
let timeUpdateInterval = null;

function computeBaseTime() {
  const now = new Date(timeSync.getServerTime());
  return new Date(now.getTime() - 12 * 60 * 60 * 1000);
}

const baseTime = ref(computeBaseTime());

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

// Real bug: the max over the WHOLE +/-12h curve routinely lands in broad daylight, which is
// useless for "when should I actually image this" -- a "peak" the object reaches at noon isn't
// reachable at all. Constrained to astronomical night (sun below -18deg, the same threshold the
// chart's own darkest shaded band already uses) and to genuinely above the horizon; if nothing
// in the window qualifies (never rises during any dark period in range, or there's no
// astronomical night at all in this +/-12h span -- e.g. far-north summer), there's no real peak
// to report, and the caller shows "no peak in dark window" rather than a misleading number.
// TEMPORARY debug instrumentation (2026-09-03) -- a real, reproducible-even-in-incognito bug
// report showed an altitude reading exceeding the hard 90-|lat-dec| geometric ceiling for the
// object/site combination, which every standalone reproduction of this exact formula fails to
// reproduce. Capturing the raw inputs and the unconstrained max alongside the dark-window max so
// the next real report shows exactly what this component is actually working with, instead of
// guessing further. Remove once the real cause is found.
const peakDebugInfo = computed(() => {
  if (props.target?.RA == null || props.target?.Dec == null) return null;
  const steps = 96;
  let unconstrainedBest = null;
  for (let i = 0; i <= steps; i++) {
    const time = new Date(baseTime.value.getTime() + i * 15 * 60 * 1000);
    const alt = calculateAltitude(
      props.target.RA,
      props.target.Dec,
      props.coordinates.latitude,
      props.coordinates.longitude,
      time
    );
    if (!unconstrainedBest || alt > unconstrainedBest.altitude) {
      unconstrainedBest = { altitude: alt, label: `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}` };
    }
  }
  return {
    lat: props.coordinates.latitude,
    lon: props.coordinates.longitude,
    ra: props.target.RA,
    dec: props.target.Dec,
    baseTime: baseTime.value.toISOString(),
    geometricCeiling: 90 - Math.abs(props.coordinates.latitude - props.target.Dec),
    unconstrainedMax: unconstrainedBest,
  };
});

const peakAltitudePoint = computed(() => {
  if (props.target?.RA == null || props.target?.Dec == null) return null;
  // This deliberately does NOT reuse the chart's own baseTime grid (a fixed +/-12h window
  // centered on "now"). Two bugs found here, both from that coupling:
  // (1) the forward half of a +/-12h window straddles last night's dark period (already over)
  //     as well as tonight's (still ahead) -- without excluding elapsed time, this happily
  //     reported last night's peak (e.g. "Peaks at 2:15" while it's already midday) whenever it
  //     was higher than tonight's.
  // (2) excluding elapsed time from that SAME fixed window then broke the opposite way: when
  //     "now" is in the morning, "now + 12h" lands in the early evening -- right around when
  //     astronomical twilight even starts -- so the window's future half never reaches deep
  //     enough into the coming night to find any of it, and EVERY object reported "not visible"
  //     even with an obviously-usable peak later that night.
  // A rolling 24h-from-now window, independent of the chart's own fixed display range, is the
  // only thing that guarantees the very next dark period is actually inside the search range
  // regardless of what time of day "now" happens to be.
  // Real bug found on real hardware, severe: this used to call timeSync.getServerTime() fresh
  // on every evaluation. Since real time keeps advancing, that made the computed altitude a
  // slightly different float on every single re-evaluation -- even ones triggered by nothing
  // more than the parent's own unstable inline :target/:coordinates object literals (harmless
  // on their own). That defeated the emit-dedup guard below entirely (the key never matched
  // twice) and reopened the exact unbounded reactive loop it exists to prevent: computed -> emit
  // -> parent state update -> re-render -> new prop objects -> recompute with a marginally newer
  // "now" -> emit again, forever. baseTime is deliberately "now" throttled to the same
  // 15-minute cadence the chart itself already refreshes on (baseTime = now - 12h, so + 12h
  // recovers "now" at that same throttled granularity) -- idempotent across any number of
  // re-renders within that window, which is what makes the dedup guard actually work.
  const now = new Date(baseTime.value.getTime() + 12 * 60 * 60 * 1000);
  const steps = 96; // 24h from now, in 15-minute steps
  let best = null;
  for (let i = 0; i <= steps; i++) {
    const time = new Date(now.getTime() + i * 15 * 60 * 1000);
    const sunAlt = calculateSunAltitude(props.coordinates.latitude, props.coordinates.longitude, time);
    if (sunAlt >= -18) continue;
    const alt = calculateAltitude(
      props.target.RA,
      props.target.Dec,
      props.coordinates.latitude,
      props.coordinates.longitude,
      time
    );
    if (alt < 0) continue;
    if (!best || alt > best.altitude) {
      best = { altitude: alt, label: `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}` };
    }
  }
  return best;
});
// Same unstable-prop-reference hazard as the peak-altitude watcher below: peakDebugInfo returns
// a brand-new object every time it re-evaluates, so emitting unconditionally on every change was
// itself an unbounded reactive loop (computed -> emit -> parent state update -> parent re-render
// -> new inline :target/:coordinates object literals -> computed re-evaluates -> emit again).
// Comparing the actual values before emitting breaks the cycle, same fix as below.
let lastEmittedDebugKey = null;
watch(
  peakDebugInfo,
  (d) => {
    const key = d
      ? `${d.lat}|${d.lon}|${d.ra}|${d.dec}|${d.baseTime}|${d.unconstrainedMax?.altitude}|${d.unconstrainedMax?.label}`
      : null;
    if (key === lastEmittedDebugKey) return;
    lastEmittedDebugKey = key;
    emit('peak-debug', d);
  },
  { immediate: true }
);
// Real bug caught on real hardware: the parent passes :target/:coordinates as inline object
// literals, so it hands down a brand-new object reference on every one of its own re-renders
// even when RA/Dec/lat/lon haven't actually changed. Without this guard, that alone was enough
// to re-trigger altitudeData -> peakAltitudePoint -> this watcher -> re-emit -> the parent
// setting state from the emit -> another parent re-render -> a new object reference again --
// an unbounded reactive loop that pegs the CPU and makes the whole page unresponsive, not a
// crash. Comparing against the last value actually emitted breaks the cycle at its source,
// without needing the parent to change its own (very common, otherwise harmless) prop pattern.
// Real bug found on real hardware, separate from the reactive-loop guard this comment used to
// describe alone: comparing only the OUTPUT (altitude+label) against the last emission means
// that if a genuinely different object's true peak ever happens to numerically match whatever
// was last emitted for a PREVIOUS object, this guard wrongly calls it "unchanged" and never
// re-emits -- leaving the displayed peak stuck on the old object's value even though
// peakAltitudePoint itself recomputed correctly. peakDebugInfo's own dedup key (above) already
// includes the target's RA/Dec for exactly this reason; folding the same target identity into
// this key guarantees a real object change always forces a fresh emit, regardless of whether the
// two objects' peak values happen to coincide.
let lastEmittedPeakKey = null;
watch(
  peakAltitudePoint,
  (p) => {
    const next = p ? { altitude: p.altitude, label: p.label } : null;
    const key = `${props.target?.RA}|${props.target?.Dec}|${next?.altitude}|${next?.label}`;
    if (key === lastEmittedPeakKey) return;
    lastEmittedPeakKey = key;
    emit('peak-altitude', next);
  },
  { immediate: true }
);

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
          label: t('components.framing.skyChart.altitude'),
          data: altitudeData.value.map((p) => p.altitude),
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
  timeUpdateInterval = setInterval(
    () => {
      baseTime.value = computeBaseTime();
    },
    15 * 60 * 1000
  );
});

onUnmounted(() => {
  clearInterval(timeUpdateInterval);
});

watch([altitudeData, horizonAltitudes], () => {
  if (chartInstance) {
    updateChart();
  } else {
    createChart(); // Erstes Mal erstellen
  }
});
</script>
