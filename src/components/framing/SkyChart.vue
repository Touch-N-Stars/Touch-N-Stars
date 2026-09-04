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
import { toJulian, calculateSunAltitude } from '@/utils/utils';

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
  // Opt-in, defaults false so every other existing consumer of this shared component (target
  // search, sequence item previews, observationplaner) keeps its current "now always sits at
  // the chart's own center" behavior unless it deliberately asks for this instead. Real hardware
  // feedback: a blind +/-12h-from-now window pushes the dark region hard against one edge (or
  // splits it across both) whenever "now" isn't already near the middle of the night -- which is
  // most of the time, since most sessions with this open aren't started at local midnight. NINA's
  // own convention (and most planning tools') windows around the night itself instead, so the
  // dark period stays intact and readable regardless of what time it currently is.
  centerOnNight: {
    type: Boolean,
    default: false,
  },
});

// The highest point on the same +/-12h curve this chart already draws -- emitted rather than
// duplicated, so a caller (e.g. Perihelion's own altitude card) can show "currently low, but
// climbing to X" instead of just the instantaneous altitude, without re-deriving the curve
// itself a second time. rise-set is the horizon-crossing counterpart -- see riseSetPoint's own
// comment.
const emit = defineEmits(['peak-altitude', 'rise-set', 'darkness-changed']);

const canvasRef = ref(null);
let chartInstance = null;
let timeUpdateInterval = null;

// The actual, throttled clock -- refreshed on the same 15-minute interval the chart itself has
// always redrawn on, but now a distinct value from baseTime below, which is a DISPLAY anchor
// that can differ from "now" in centerOnNight mode. peakAltitudePoint/riseSetPoint read this
// directly rather than reconstructing "now" from baseTime the way they used to (baseTime + 12h
// only ever equaled real "now" back when the window was always +/-12h-from-now specifically --
// centerOnNight breaks that equivalence entirely, so those computeds need their own real anchor
// now, not a value that means something different depending on this prop).
const liveNow = ref(new Date(timeSync.getServerTime()));

// Midnight nearest to `date` in wall-clock terms -- whichever of "today's own midnight" (the
// night that started yesterday evening and is ending this morning) or "tomorrow's midnight"
// (the night starting this evening) is closer in absolute time. This is what centerOnNight
// actually centers the display window on: close enough to the true middle of whichever
// astronomical night is most relevant right now, without needing a real sun-altitude scan just
// to find dusk/dawn -- local clock midnight is a fine approximation for windowing purposes (the
// darkness shading itself is still computed properly via calculateSunAltitude regardless).
function nearestMidnight(date) {
  const startOfToday = new Date(date);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const sinceToday = date.getTime() - startOfToday.getTime();
  const untilTomorrow = startOfTomorrow.getTime() - date.getTime();
  return sinceToday <= untilTomorrow ? startOfToday : startOfTomorrow;
}

const baseTime = computed(() => {
  const anchor = props.centerOnNight ? nearestMidnight(liveNow.value) : liveNow.value;
  return new Date(anchor.getTime() - 12 * 60 * 60 * 1000);
});

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

// Where "now" actually falls within the displayed window, as a step index (0..96) -- used to
// draw the vertical "now" marker. Used to be hardcoded to the array's own midpoint, which was
// only ever correct because the window itself was always exactly +/-12h-from-now; centerOnNight
// can put "now" anywhere in the window (e.g. near an edge at local midday), so this has to be
// computed from where the two actually are relative to each other, not assumed.
const nowIndexInWindow = computed(() => {
  const stepMs = 15 * 60 * 1000;
  const idx = Math.round((liveNow.value.getTime() - baseTime.value.getTime()) / stepMs);
  return Math.max(0, Math.min(96, idx));
});

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
  // "now" -> emit again, forever. liveNow is deliberately throttled to the same 15-minute cadence
  // the chart itself already refreshes on, idempotent across any number of re-renders within that
  // window -- which is what makes the dedup guard actually work. Reads liveNow directly rather
  // than reconstructing "now" from baseTime (baseTime + 12h) the way this used to -- that
  // reconstruction only worked because the window used to always BE +/-12h-from-now; centerOnNight
  // breaks that equivalence, so this needs its own real anchor regardless of that prop.
  const now = liveNow.value;
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
// Two real bugs found on real hardware, both fixed by this guard:
// (1) the parent passes :target/:coordinates as inline object literals, handing down a brand-new
//     object reference on every one of its own re-renders even when RA/Dec/lat/lon haven't
//     actually changed. Emitting unconditionally on every recompute was an unbounded reactive
//     loop: computed -> emit -> parent state update -> re-render -> new object reference again ->
//     recompute -> emit again -- pegs the CPU and makes the whole page unresponsive, not a crash.
// (2) comparing only the OUTPUT (altitude+label) against the last emission -- without the target
//     identity below -- meant that if a genuinely different object's true peak ever happened to
//     numerically match whatever was last emitted for a PREVIOUS object, the guard wrongly called
//     it "unchanged" and never re-emitted, leaving the displayed peak stuck on the old object's
//     value even though peakAltitudePoint itself had recomputed correctly. Folding the target's
//     RA/Dec into the key guarantees a real object change always forces a fresh emit, regardless
//     of whether two objects' peak values happen to coincide.
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

// Whether it's currently astronomical night (same -18deg threshold peakAltitudePoint's own dark
// window already uses) -- doesn't depend on props.target at all, only site + the throttled
// liveNow, so a plain value dedup is enough here (no target-identity concern like the two
// watchers above: there's no "coincidentally matches a different object's stale value" hazard
// when the value was never target-specific to begin with).
const isCurrentlyDark = computed(
  () => calculateSunAltitude(props.coordinates.latitude, props.coordinates.longitude, liveNow.value) < -18
);
let lastEmittedDarkness = null;
watch(
  isCurrentlyDark,
  (dark) => {
    if (dark === lastEmittedDarkness) return;
    lastEmittedDarkness = dark;
    emit('darkness-changed', dark);
  },
  { immediate: true }
);

// Rise/set times -- same rolling 24h-from-now window as peakAltitudePoint above, and the same
// throttled liveNow rather than the live clock directly (see that computed's own comment for why
// calling the clock directly here defeated the emit-dedup guard and reopened an unbounded
// reactive loop -- exact same hazard applies to any computed a parent's own unstable prop
// references can re-trigger). Circumpolar/never-rises are reported explicitly rather than
// as null rise+set, since "no crossing found" is ambiguous between those two very different
// cases otherwise. Already-above-horizon deliberately doesn't look for the rise that already
// happened -- only the next set -- rather than chasing a second rise later in the same 24h
// window, which would be more than a simple status line needs.
const riseSetPoint = computed(() => {
  if (props.target?.RA == null || props.target?.Dec == null) return null;
  // liveNow directly, not baseTime + 12h -- see peakAltitudePoint's own comment on this same
  // change; that reconstruction only worked while the window was always +/-12h-from-now, and
  // centerOnNight breaks that equivalence.
  const now = liveNow.value;
  const steps = 96; // 24h from now, in 15-minute steps
  const stepMs = 15 * 60 * 1000;

  function altAt(i) {
    const time = new Date(now.getTime() + i * stepMs);
    return calculateAltitude(
      props.target.RA,
      props.target.Dec,
      props.coordinates.latitude,
      props.coordinates.longitude,
      time
    );
  }
  function labelAt(fractionalStep) {
    const time = new Date(now.getTime() + fractionalStep * stepMs);
    return `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
  }

  const alts = [];
  for (let i = 0; i <= steps; i++) alts.push(altAt(i));

  if (alts.every((a) => a >= 0)) return { circumpolar: true, neverRises: false, rise: null, set: null };
  if (alts.every((a) => a < 0)) return { circumpolar: false, neverRises: true, rise: null, set: null };

  const alreadyUp = alts[0] >= 0;
  let rise = null;
  let set = null;
  for (let i = 1; i <= steps; i++) {
    const prev = alts[i - 1];
    const curr = alts[i];
    if (!alreadyUp && rise == null && prev < 0 && curr >= 0) {
      // Linear-interpolate the actual crossing point between these two samples, rather than
      // just labeling whichever 15-minute sample happened to land on the right side of zero.
      const frac = -prev / (curr - prev);
      rise = labelAt(i - 1 + frac);
    }
    if ((alreadyUp || rise != null) && set == null && prev >= 0 && curr < 0) {
      const frac = prev / (prev - curr);
      set = labelAt(i - 1 + frac);
    }
    if (set != null && (alreadyUp || rise != null)) break;
  }
  return { circumpolar: false, neverRises: false, rise, set };
});
let lastEmittedRiseSetKey = null;
watch(
  riseSetPoint,
  (r) => {
    const key = `${props.target?.RA}|${props.target?.Dec}|${JSON.stringify(r)}`;
    if (key === lastEmittedRiseSetKey) return;
    lastEmittedRiseSetKey = key;
    emit('rise-set', r);
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
          data: altitudeData.value.map((_, i) => (i === nowIndexInWindow.value ? 90 : 0)),
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
  chartInstance.data.datasets[4].data = altitudeData.value.map((_, i) =>
    i === nowIndexInWindow.value ? 90 : 0
  );

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
      liveNow.value = new Date(timeSync.getServerTime());
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
