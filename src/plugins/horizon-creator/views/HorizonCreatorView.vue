<template>
  <div class="horizon-creator flex flex-col h-full bg-gray-900 text-white p-3 gap-3 overflow-auto">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-cyan-400">Horizon Creator</h1>
      <div class="flex gap-2">
        <label class="cursor-pointer px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded border border-gray-600">
          Load .hrz
          <input type="file" accept=".hrz,.txt" class="hidden" @change="onLoadHrz" />
        </label>
        <button
          class="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded border border-gray-600 disabled:opacity-40"
          :disabled="horizonStore.points.length === 0"
          @click="saveHrz"
        >
          Save .hrz
        </button>
      </div>
    </div>

    <!-- Mount not connected warning -->
    <div v-if="!mountConnected" class="text-yellow-400 text-sm bg-yellow-900/30 border border-yellow-700 rounded px-3 py-2">
      Mount not connected — connect your mount to add points or use the D-pad.
    </div>

    <!-- Main content -->
    <div class="flex flex-col lg:flex-row gap-3 flex-1">

      <!-- Left: point list + action buttons -->
      <div class="flex flex-col gap-2 lg:w-56">
        <div class="flex gap-2">
          <button
            class="flex-1 py-2 text-sm font-medium bg-cyan-700 hover:bg-cyan-600 rounded disabled:opacity-40"
            :disabled="!mountConnected || mountAlt == null"
            @click="addPoint"
          >
            Add Point
          </button>
          <button
            class="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-40"
            :disabled="horizonStore.points.length === 0"
            @click="horizonStore.removeLastPoint()"
            title="Undo last point"
          >
            ←
          </button>
          <button
            class="px-3 py-2 text-sm bg-red-900 hover:bg-red-800 rounded disabled:opacity-40"
            :disabled="horizonStore.points.length === 0"
            @click="horizonStore.clearPoints()"
            title="Clear all points"
          >
            ✕
          </button>
        </div>

        <!-- Point list -->
        <div class="flex-1 overflow-y-auto rounded border border-gray-700 bg-gray-800 min-h-32 max-h-64 lg:max-h-none">
          <div v-if="horizonStore.points.length === 0" class="p-3 text-gray-500 text-sm text-center">
            No points yet.<br />Slew to the horizon and click Add Point.
          </div>
          <table v-else class="w-full text-xs">
            <thead class="sticky top-0 bg-gray-700 text-gray-300">
              <tr>
                <th class="py-1 px-2 text-left">#</th>
                <th class="py-1 px-2 text-right">Az</th>
                <th class="py-1 px-2 text-right">Alt</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(p, i) in sortedPoints"
                :key="i"
                class="border-t border-gray-700 hover:bg-gray-700/50"
              >
                <td class="py-1 px-2 text-gray-500">{{ i + 1 }}</td>
                <td class="py-1 px-2 text-right font-mono">{{ p.az.toFixed(1) }}°</td>
                <td class="py-1 px-2 text-right font-mono">{{ p.alt.toFixed(1) }}°</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Point count -->
        <div class="text-xs text-gray-500 text-center">
          {{ horizonStore.points.length }} point{{ horizonStore.points.length !== 1 ? 's' : '' }}
        </div>
      </div>

      <!-- Right: polar chart + D-pad -->
      <div class="flex flex-col items-center gap-3 flex-1">

        <!-- Polar chart -->
        <div class="relative">
          <svg :viewBox="`0 0 ${SVG_SIZE} ${SVG_SIZE}`" :width="chartSize" :height="chartSize" class="block">
            <!-- Altitude rings -->
            <circle v-for="alt in [0, 30, 60]" :key="alt"
              :cx="CX" :cy="CY" :r="altToR(alt)"
              fill="none" stroke="#334155" stroke-width="1"
            />
            <!-- Azimuth spokes -->
            <line v-for="az in [0, 45, 90, 135, 180, 225, 270, 315]" :key="az"
              :x1="CX" :y1="CY"
              :x2="CX + MAX_R * Math.sin(az * D2R)"
              :y2="CY - MAX_R * Math.cos(az * D2R)"
              stroke="#334155" stroke-width="1"
            />
            <!-- Cardinal labels -->
            <text :x="CX" :y="CY - MAX_R - 6" text-anchor="middle" fill="#64748b" font-size="11">N</text>
            <text :x="CX + MAX_R + 6" :y="CY + 4" text-anchor="start" fill="#64748b" font-size="11">E</text>
            <text :x="CX" :y="CY + MAX_R + 14" text-anchor="middle" fill="#64748b" font-size="11">S</text>
            <text :x="CX - MAX_R - 6" :y="CY + 4" text-anchor="end" fill="#64748b" font-size="11">W</text>
            <!-- Altitude labels -->
            <text :x="CX + 4" :y="CY - altToR(30) + 4" fill="#475569" font-size="9">30°</text>
            <text :x="CX + 4" :y="CY - altToR(60) + 4" fill="#475569" font-size="9">60°</text>

            <!-- Horizon line -->
            <path v-if="horizonPath" :d="horizonPath"
              fill="none" stroke="#f97316" stroke-width="2" stroke-linejoin="round"
            />

            <!-- Explicit points (dots) -->
            <circle v-for="(p, i) in sortedPoints" :key="`pt-${i}`"
              :cx="azAltToSvgX(p.az, p.alt)"
              :cy="azAltToSvgY(p.az, p.alt)"
              r="3" fill="#f97316"
            />

            <!-- Mount position crosshair -->
            <g v-if="mountConnected && mountAlt != null">
              <line
                :x1="azAltToSvgX(mountAz, mountAlt) - 7" :y1="azAltToSvgY(mountAz, mountAlt)"
                :x2="azAltToSvgX(mountAz, mountAlt) + 7" :y2="azAltToSvgY(mountAz, mountAlt)"
                stroke="#22d3ee" stroke-width="1.5"
              />
              <line
                :x1="azAltToSvgX(mountAz, mountAlt)" :y1="azAltToSvgY(mountAz, mountAlt) - 7"
                :x2="azAltToSvgX(mountAz, mountAlt)" :y2="azAltToSvgY(mountAz, mountAlt) + 7"
                stroke="#22d3ee" stroke-width="1.5"
              />
            </g>

            <!-- Horizon circle (alt=0) label -->
            <text :x="CX + MAX_R + 4" :y="CY + 4" fill="#475569" font-size="9">0°</text>
          </svg>
        </div>

        <!-- Altitude profile chart -->
        <div class="w-full px-1">
          <svg viewBox="0 0 400 110" class="w-full block" style="height:110px">
            <!-- Horizontal grid lines + Y labels -->
            <line v-for="g in altGridLines" :key="`hg-${g.alt}`"
              :x1="PROF_L" :y1="g.y" :x2="PROF_L + PROF_W" :y2="g.y"
              stroke="#1e293b" stroke-width="1"
            />
            <text v-for="g in altGridLines" :key="`yl-${g.alt}`"
              :x="PROF_L - 3" :y="g.y + 3" text-anchor="end" fill="#475569" font-size="8"
            >{{ g.alt }}°</text>
            <!-- Zero line dashed -->
            <line
              :x1="PROF_L" :y1="profY(0)" :x2="PROF_L + PROF_W" :y2="profY(0)"
              stroke="#334155" stroke-width="1" stroke-dasharray="4,2"
            />
            <!-- Vertical grid lines at cardinal azimuths -->
            <line v-for="az in [0, 90, 180, 270, 360]" :key="`vg-${az}`"
              :x1="profX(az)" :y1="PROF_T" :x2="profX(az)" :y2="PROF_B"
              stroke="#1e293b" stroke-width="1"
            />
            <!-- Filled area below horizon -->
            <path v-if="profileArea" :d="profileArea"
              fill="#f97316" fill-opacity="0.15" stroke="none"
            />
            <!-- Horizon line -->
            <path v-if="profileLine" :d="profileLine"
              fill="none" stroke="#f97316" stroke-width="1.5" stroke-linejoin="round"
            />
            <!-- Recorded points -->
            <circle v-for="(p, i) in sortedPoints" :key="`ap-${i}`"
              :cx="profX(p.az)" :cy="profY(p.alt)" r="2.5" fill="#f97316"
            />
            <!-- Mount position vertical line + dot -->
            <line v-if="mountConnected && mountAlt != null"
              :x1="profX(mountAz)" :y1="PROF_T"
              :x2="profX(mountAz)" :y2="PROF_B"
              stroke="#22d3ee" stroke-width="1" stroke-dasharray="3,2"
            />
            <circle v-if="mountConnected && mountAlt != null"
              :cx="profX(mountAz)" :cy="profY(mountAlt)" r="3" fill="#22d3ee"
            />
            <!-- X-axis labels -->
            <text v-for="[az, label] in [[0,'N'],[90,'E'],[180,'S'],[270,'W'],[360,'N']]" :key="`xl-${az}`"
              :x="profX(az)" :y="PROF_B + 13" text-anchor="middle" fill="#64748b" font-size="9"
            >{{ label }}</text>
            <!-- Border -->
            <rect :x="PROF_L" :y="PROF_T" :width="PROF_W" :height="PROF_H"
              fill="none" stroke="#334155" stroke-width="1"
            />
          </svg>
        </div>

        <!-- Jog D-pad -->
        <div
          class="grid grid-cols-3 gap-1.5"
          style="user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation"
        >
          <div />
          <button
            @mousedown="startJog('north')" @mouseup="stopJog" @mouseleave="stopJog"
            @touchstart.prevent="startJog('north')" @touchend.prevent="stopJog" @touchcancel.prevent="stopJog"
            :disabled="!mountConnected || !wsConnected" class="dpad-btn"
            :class="jogging === 'north' ? 'bg-cyan-700' : ''"
          >▲</button>
          <div />
          <button
            @mousedown="startJog('west')" @mouseup="stopJog" @mouseleave="stopJog"
            @touchstart.prevent="startJog('west')" @touchend.prevent="stopJog" @touchcancel.prevent="stopJog"
            :disabled="!mountConnected || !wsConnected" class="dpad-btn"
            :class="jogging === 'west' ? 'bg-cyan-700' : ''"
          >◄</button>
          <button @click="stopJog" :disabled="!wsConnected"
            class="w-12 h-12 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 disabled:opacity-40"
          >■</button>
          <button
            @mousedown="startJog('east')" @mouseup="stopJog" @mouseleave="stopJog"
            @touchstart.prevent="startJog('east')" @touchend.prevent="stopJog" @touchcancel.prevent="stopJog"
            :disabled="!mountConnected || !wsConnected" class="dpad-btn"
            :class="jogging === 'east' ? 'bg-cyan-700' : ''"
          >►</button>
          <div />
          <button
            @mousedown="startJog('south')" @mouseup="stopJog" @mouseleave="stopJog"
            @touchstart.prevent="startJog('south')" @touchend.prevent="stopJog" @touchcancel.prevent="stopJog"
            :disabled="!mountConnected || !wsConnected" class="dpad-btn"
            :class="jogging === 'south' ? 'bg-cyan-700' : ''"
          >▼</button>
          <div />
        </div>
        <div class="text-xs text-gray-500 text-center">N/S = altitude · E/W = azimuth</div>

        <!-- Slew rate -->
        <div class="w-full px-1">
          <setSlewRatePins />
        </div>

        <!-- Save to NINA -->
        <button
          class="w-full py-2 text-sm font-medium bg-indigo-700 hover:bg-indigo-600 rounded disabled:opacity-40"
          :disabled="horizonStore.points.length < 2 || savingToNina"
          @click="saveToNina"
        >
          {{ savingToNina ? 'Saving…' : 'Save to NINA' }}
        </button>
        <div v-if="ninaSaveStatus" class="text-xs text-center" :class="ninaSaveOk ? 'text-green-400' : 'text-red-400'">
          {{ ninaSaveStatus }}
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { apiStore } from '@/store/store';
import { useMountStore } from '@/store/mountStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useHorizonStore } from '../store/horizonStore';
import { interpolateHorizon } from '../utils/horizon-utils';
import apiService from '@/services/apiService';
import websocketMountControl from '@/services/websocketMountControl';
import setSlewRatePins from '@/components/mount/setSlewRatePins.vue';

const store = apiStore();
const mountStore = useMountStore();
const settingsStore = useSettingsStore();
const horizonStore = useHorizonStore();

// Chart geometry constants
const SVG_SIZE = 300;
const CX = 150;
const CY = 150;
const MAX_R = 130;
const D2R = Math.PI / 180;

const jogging = ref('');
const savingToNina = ref(false);
const ninaSaveStatus = ref('');
const ninaSaveOk = ref(true);

// Responsive chart size
const chartSize = 280;

const mountConnected = computed(() => store.mountInfo?.Connected);
const wsConnected = computed(() => mountStore.wsIsConnected);
const mountAlt = computed(() => store.mountInfo?.Altitude ?? null);
const mountAz = computed(() => store.mountInfo?.Azimuth ?? 0);

const sortedPoints = computed(() => [...horizonStore.points].sort((a, b) => a.az - b.az));

// Altitude profile chart constants (viewBox 400×110)
const PROF_L = 28;  // left margin (room for Y labels)
const PROF_T = 6;   // top margin
const PROF_W = 360; // 1 px per degree of azimuth
const PROF_H = 80;  // chart height in px
const PROF_B = PROF_T + PROF_H;

const altRange = computed(() => {
  if (horizonStore.points.length === 0) return { min: 0, max: 40 };
  const alts = horizonStore.points.map((p) => p.alt);
  return {
    min: Math.floor(Math.min(0, ...alts) / 10) * 10,
    max: Math.ceil(Math.max(30, ...alts) / 10) * 10 + 10,
  };
});

function profY(alt) {
  const { min, max } = altRange.value;
  return PROF_T + PROF_H - ((alt - min) / (max - min)) * PROF_H;
}

function profX(az) {
  return PROF_L + az;
}

const altGridLines = computed(() => {
  const { min, max } = altRange.value;
  const lines = [];
  for (let alt = min; alt <= max; alt += 10) lines.push({ alt, y: profY(alt) });
  return lines;
});

const profileArea = computed(() => {
  if (horizonStore.points.length < 2) return null;
  const interp = interpolateHorizon(horizonStore.points, 1);
  if (interp.length === 0) return null;
  let d = `M ${profX(0)},${PROF_B}`;
  for (const p of interp) d += ` L ${profX(p.az)},${profY(p.alt).toFixed(1)}`;
  d += ` L ${profX(360)},${PROF_B} Z`;
  return d;
});

const profileLine = computed(() => {
  if (horizonStore.points.length < 2) return null;
  const interp = interpolateHorizon(horizonStore.points, 1);
  return 'M ' + interp.map((p) => `${profX(p.az)},${profY(p.alt).toFixed(1)}`).join(' L ');
});

function altToR(alt) {
  return MAX_R * (1 - Math.max(0, Math.min(90, alt)) / 90);
}

function azAltToSvgX(az, alt) {
  return CX + altToR(alt) * Math.sin(az * D2R);
}

function azAltToSvgY(az, alt) {
  return CY - altToR(alt) * Math.cos(az * D2R);
}

const horizonPath = computed(() => {
  if (horizonStore.points.length < 2) return null;
  const interp = interpolateHorizon(horizonStore.points, 3);
  if (interp.length === 0) return null;
  const pts = [...interp, interp[0]]; // close the loop
  return (
    'M ' +
    pts
      .map((p) => `${azAltToSvgX(p.az, p.alt).toFixed(1)},${azAltToSvgY(p.az, p.alt).toFixed(1)}`)
      .join(' L ')
  );
});

function addPoint() {
  const alt = mountAlt.value;
  const az = mountAz.value;
  if (alt == null) return;
  horizonStore.addPoint(alt, az);
}

let commandInterval = null;
let failsafeTimeout = null;

function startJog(direction) {
  if (!mountStore.wsIsConnected) return;
  if (commandInterval) clearInterval(commandInterval);
  jogging.value = direction;

  const send = () => {
    if (!websocketMountControl.socket || websocketMountControl.socket.readyState !== 1) {
      stopJog();
      return;
    }
    websocketMountControl.socket.send(
      JSON.stringify({ direction, rate: settingsStore.mount.slewRate })
    );
  };

  send();
  commandInterval = setInterval(send, 800);

  if (failsafeTimeout) clearTimeout(failsafeTimeout);
  failsafeTimeout = setTimeout(() => stopJog(), 30000);
}

function stopJog() {
  if (commandInterval) { clearInterval(commandInterval); commandInterval = null; }
  if (failsafeTimeout) { clearTimeout(failsafeTimeout); failsafeTimeout = null; }

  if (
    jogging.value &&
    websocketMountControl.socket &&
    websocketMountControl.socket.readyState === 1
  ) {
    websocketMountControl.socket.send(
      JSON.stringify({ direction: jogging.value, rate: 0 })
    );
  }
  jogging.value = '';
}

async function saveToNina() {
  if (horizonStore.points.length < 2) return;
  savingToNina.value = true;
  ninaSaveStatus.value = '';
  try {
    await apiService.postProfileHorizon(horizonStore.getHrz());
    ninaSaveOk.value = true;
    ninaSaveStatus.value = 'Horizon saved to active profile';
  } catch (e) {
    ninaSaveOk.value = false;
    ninaSaveStatus.value = 'Save failed: ' + (e?.response?.data?.Error?.Message ?? e.message);
  } finally {
    savingToNina.value = false;
  }
}

onMounted(() => {
  websocketMountControl.setStatusCallback((status) => {
    if (status === 'connected') mountStore.wsIsConnected = true;
  });
  websocketMountControl.connect();

  const emergencyStop = () => { if (jogging.value) stopJog(); };
  document.addEventListener('visibilitychange', emergencyStop);
  window.addEventListener('blur', emergencyStop);
});

onBeforeUnmount(() => {
  if (jogging.value) stopJog();
  if (commandInterval) clearInterval(commandInterval);
  if (failsafeTimeout) clearTimeout(failsafeTimeout);
  websocketMountControl.setStatusCallback(null);
  websocketMountControl.disconnect();
  mountStore.wsIsConnected = false;
});

function saveHrz() {
  const content = horizonStore.getHrz();
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'horizon.hrz';
  a.click();
  URL.revokeObjectURL(url);
}

function onLoadHrz(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const count = horizonStore.loadFromHrz(e.target.result);
    console.log(`Loaded ${count} horizon points from ${file.name}`);
  };
  reader.readAsText(file);
  event.target.value = '';
}
</script>

<style scoped>
.dpad-btn {
  @apply w-12 h-12 bg-gray-700 hover:bg-gray-600 active:bg-cyan-700 rounded text-lg font-bold
         disabled:opacity-40 disabled:cursor-not-allowed transition-colors;
}
</style>
