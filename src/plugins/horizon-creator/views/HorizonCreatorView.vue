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
        >Save .hrz</button>
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
            @click="addMountPoint"
          >Add Mount Pos</button>
          <button class="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-40"
            :disabled="horizonStore.points.length === 0"
            @click="horizonStore.removeLastPoint()" title="Undo last point">←</button>
          <button class="px-3 py-2 text-sm bg-red-900 hover:bg-red-800 rounded disabled:opacity-40"
            :disabled="horizonStore.points.length === 0"
            @click="horizonStore.clearPoints()" title="Clear all points">✕</button>
        </div>

        <!-- Point list -->
        <div class="flex-1 overflow-y-auto rounded border border-gray-700 bg-gray-800 min-h-32 max-h-64 lg:max-h-none">
          <div v-if="horizonStore.points.length === 0" class="p-3 text-gray-500 text-sm text-center">
            No points yet.<br />Slew to horizon and click Add Mount Pos, or use the chart.
          </div>
          <table v-else class="w-full text-xs">
            <thead class="sticky top-0 bg-gray-700 text-gray-300">
              <tr>
                <th class="py-1 px-2 text-left">#</th>
                <th class="py-1 px-2 text-right">Az</th>
                <th class="py-1 px-2 text-right">Alt</th>
                <th class="py-1 px-1"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p, i) in sortedPoints" :key="i"
                class="border-t border-gray-700 hover:bg-gray-700/50 cursor-pointer"
                @click="pendingAz = p.az; pendingAlt = p.alt">
                <td class="py-1 px-2 text-gray-500">{{ i + 1 }}</td>
                <td class="py-1 px-2 text-right font-mono">{{ p.az.toFixed(1) }}°</td>
                <td class="py-1 px-2 text-right font-mono">{{ p.alt.toFixed(1) }}°</td>
                <td class="py-1 px-1 text-right">
                  <button @click.stop="horizonStore.removePoint(p)"
                    class="text-gray-600 hover:text-red-400 text-xs leading-none px-1" title="Remove point">✕</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-xs text-gray-500 text-center">
          {{ horizonStore.points.length }} point{{ horizonStore.points.length !== 1 ? 's' : '' }}
        </div>

        <!-- Manual text entry -->
        <div class="flex flex-col gap-1.5 pt-1 border-t border-gray-700">
          <div class="text-xs text-gray-400 font-medium">Add by typing:</div>
          <div class="flex gap-1.5 items-end">
            <div class="flex-1">
              <div class="text-xs text-gray-500 mb-0.5">Az</div>
              <input v-model="manualAz" type="number" min="0" max="360" step="0.1" placeholder="0–360"
                class="w-full bg-gray-700 rounded px-2 py-1.5 text-sm text-white border border-gray-600 focus:border-cyan-500 outline-none" />
            </div>
            <div class="flex-1">
              <div class="text-xs text-gray-500 mb-0.5">Alt</div>
              <input v-model="manualAlt" type="number" min="-30" max="90" step="0.1" placeholder="-30–90"
                class="w-full bg-gray-700 rounded px-2 py-1.5 text-sm text-white border border-gray-600 focus:border-cyan-500 outline-none" />
            </div>
            <button @click="addManualPoint" :disabled="manualAz === '' || manualAlt === ''"
              class="px-3 py-1.5 text-sm bg-cyan-700 hover:bg-cyan-600 rounded font-medium disabled:opacity-40">Add</button>
          </div>
        </div>
      </div>

      <!-- Right: charts + controls -->
      <div class="flex flex-col items-center gap-3 flex-1 min-w-0">

        <!-- Instructions -->
        <div class="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-xs text-gray-400 space-y-1">
          <p class="text-gray-200 font-medium">Define your local horizon</p>
          <p>Slew your mount to each obstruction point (rooftop, tree, wall) and click <span class="text-cyan-300">Add Mount Pos</span>. Repeat around the full 360°. When done, click <span class="text-indigo-300">Save to NINA</span> — NINA will restrict scheduling and meridian-flip logic to stay above your horizon.</p>
          <p class="text-gray-500">You can also click directly on the profile chart or type Az/Alt values manually in the list on the left.</p>
        </div>

        <!-- Polar chart -->
        <div class="relative">
          <svg :viewBox="`0 0 ${SVG_SIZE} ${SVG_SIZE}`" :width="chartSize" :height="chartSize" class="block">
            <circle v-for="alt in [0, 30, 60]" :key="alt"
              :cx="CX" :cy="CY" :r="altToR(alt)" fill="none" stroke="#334155" stroke-width="1" />
            <line v-for="az in [0, 45, 90, 135, 180, 225, 270, 315]" :key="az"
              :x1="CX" :y1="CY"
              :x2="CX + MAX_R * Math.sin(az * D2R)" :y2="CY - MAX_R * Math.cos(az * D2R)"
              stroke="#334155" stroke-width="1" />
            <text :x="CX" :y="CY - MAX_R - 6" text-anchor="middle" fill="#e2e8f0" font-size="11">N</text>
            <text :x="CX + MAX_R + 6" :y="CY + 4" text-anchor="start"  fill="#e2e8f0" font-size="11">E</text>
            <text :x="CX" :y="CY + MAX_R + 14" text-anchor="middle" fill="#e2e8f0" font-size="11">S</text>
            <text :x="CX - MAX_R - 6" :y="CY + 4" text-anchor="end"   fill="#e2e8f0" font-size="11">W</text>
            <text :x="CX + 4" :y="CY - altToR(30) + 4" fill="#e2e8f0" font-size="9">30°</text>
            <text :x="CX + 4" :y="CY - altToR(60) + 4" fill="#e2e8f0" font-size="9">60°</text>
            <path v-if="horizonPath" :d="horizonPath" fill="none" stroke="#f97316" stroke-width="2" stroke-linejoin="round" />
            <circle v-for="(p, i) in sortedPoints" :key="`pt-${i}`"
              :cx="azAltToSvgX(p.az, p.alt)" :cy="azAltToSvgY(p.az, p.alt)" r="3" fill="#f97316" />
            <!-- Pending marker -->
            <circle :cx="azAltToSvgX(pendingAz, pendingAlt)" :cy="azAltToSvgY(pendingAz, pendingAlt)"
              r="5" fill="none" stroke="#facc15" stroke-width="1.5" />
            <!-- Mount crosshair -->
            <g v-if="mountConnected && mountAlt != null">
              <line :x1="azAltToSvgX(mountAz, mountAlt) - 7" :y1="azAltToSvgY(mountAz, mountAlt)"
                    :x2="azAltToSvgX(mountAz, mountAlt) + 7" :y2="azAltToSvgY(mountAz, mountAlt)"
                    stroke="#22d3ee" stroke-width="1.5" />
              <line :x1="azAltToSvgX(mountAz, mountAlt)" :y1="azAltToSvgY(mountAz, mountAlt) - 7"
                    :x2="azAltToSvgX(mountAz, mountAlt)" :y2="azAltToSvgY(mountAz, mountAlt) + 7"
                    stroke="#22d3ee" stroke-width="1.5" />
            </g>
            <text :x="CX + MAX_R + 4" :y="CY + 4" fill="#e2e8f0" font-size="9">0°</text>
          </svg>
        </div>

        <!-- Profile chart area — all children share the same outer width -->
        <div class="w-full px-1">

        <!-- Panorama toolbar -->
        <div class="flex items-center gap-2 mb-1">
          <div class="flex-1" />
          <label class="cursor-pointer px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded border border-gray-600 whitespace-nowrap">
            {{ panoramaUrl ? '↺ Panorama' : '+ Panorama' }}
            <input type="file" accept="image/*" class="hidden" @change="onLoadPanorama" />
          </label>
          <button v-if="panoramaUrl" @click="panoramaUrl = null" class="text-red-400 hover:text-red-300 text-xs">✕</button>
        </div>

        <!-- Chart row: SVG fills remaining width, alt slider is fixed 40 px on the right -->
        <div class="flex items-start gap-0">
          <!-- viewBox matches element pixel width → 1:1, no scaling, no stretching -->
          <svg
            ref="chartWrapper"
            :viewBox="`0 0 ${chartWidth} ${SVG_CHART_H}`"
            :style="`flex:1;min-width:0;height:${SVG_CHART_H}px;cursor:crosshair;display:block`"
            @click="onProfileClick"
          >
            <defs>
              <clipPath id="horizonChartClip">
                <rect :x="PROF_L" :y="PROF_T" :width="chartW" :height="PROF_H" />
              </clipPath>
            </defs>

            <!-- Panorama image -->
            <image v-if="panoramaUrl"
              :href="panoramaUrl"
              :x="PROF_L"
              :y="Math.min(profY(panoramaTopAlt), profY(panoramaBottomAlt))"
              :width="chartW"
              :height="Math.abs(profY(panoramaBottomAlt) - profY(panoramaTopAlt))"
              :opacity="panoramaOpacity"
              clip-path="url(#horizonChartClip)"
              preserveAspectRatio="none"
            />

            <!-- Horizontal grid lines + Y labels -->
            <line v-for="g in altGridLines" :key="`hg-${g.alt}`"
              :x1="PROF_L" :y1="g.y" :x2="PROF_L + chartW" :y2="g.y"
              stroke="#1e293b" stroke-width="1" />
            <text v-for="g in altGridLines" :key="`yl-${g.alt}`"
              :x="PROF_L - 3" :y="g.y + 3" text-anchor="end" fill="#e2e8f0" font-size="8"
            >{{ g.alt }}°</text>

            <!-- Zero line -->
            <line :x1="PROF_L" :y1="profY(0)" :x2="PROF_L + chartW" :y2="profY(0)"
              stroke="#334155" stroke-width="1" stroke-dasharray="4,2" />

            <!-- Vertical grid lines at cardinals -->
            <line v-for="az in [0, 90, 180, 270, 360]" :key="`vg-${az}`"
              :x1="profX(az)" :y1="PROF_T" :x2="profX(az)" :y2="PROF_B"
              stroke="#1e293b" stroke-width="1" />

            <!-- Filled area + horizon line -->
            <path v-if="profileArea" :d="profileArea"
              fill="#f97316" fill-opacity="0.15" stroke="none" clip-path="url(#horizonChartClip)" />
            <path v-if="profileLine" :d="profileLine"
              fill="none" stroke="#f97316" stroke-width="1.5" stroke-linejoin="round"
              clip-path="url(#horizonChartClip)" />

            <!-- Recorded points -->
            <circle v-for="(p, i) in sortedPoints" :key="`ap-${i}`"
              :cx="profX(p.az)" :cy="profY(p.alt)" r="3" fill="#f97316"
              clip-path="url(#horizonChartClip)" />

            <!-- Mount position -->
            <line v-if="mountConnected && mountAlt != null"
              :x1="profX(mountAz)" :y1="PROF_T" :x2="profX(mountAz)" :y2="PROF_B"
              stroke="#22d3ee" stroke-width="1" stroke-dasharray="3,2" />
            <circle v-if="mountConnected && mountAlt != null"
              :cx="profX(mountAz)" :cy="profY(mountAlt)" r="3" fill="#22d3ee" />

            <!-- Pending position crosshair (yellow) -->
            <line :x1="profX(pendingAz)" :y1="PROF_T" :x2="profX(pendingAz)" :y2="PROF_B"
              stroke="#facc15" stroke-width="1" stroke-dasharray="3,2" />
            <line :x1="PROF_L" :y1="profY(pendingAlt)" :x2="PROF_L + chartW" :y2="profY(pendingAlt)"
              stroke="#facc15" stroke-width="1" stroke-dasharray="3,2" />
            <circle :cx="profX(pendingAz)" :cy="profY(pendingAlt)" r="4"
              fill="none" stroke="#facc15" stroke-width="1.5" />

            <!-- X-axis labels -->
            <text v-for="[az, label] in [[0,'N'],[90,'E'],[180,'S'],[270,'W'],[360,'N']]" :key="`xl-${az}`"
              :x="profX(az)" :y="PROF_B + 13" text-anchor="middle" fill="#e2e8f0" font-size="9"
            >{{ label }}</text>

            <!-- Border -->
            <rect :x="PROF_L" :y="PROF_T" :width="chartW" :height="PROF_H"
              fill="none" stroke="#334155" stroke-width="1" />
          </svg>

          <!-- Vertical alt slider — 40 px wide, same height as SVG -->
          <div class="flex-shrink-0 flex flex-col items-center"
            :style="`width:40px;height:${SVG_CHART_H}px;padding-top:${PROF_T}px;padding-bottom:${SVG_CHART_H - PROF_B}px`">
            <div class="flex-1 relative" style="width:28px">
              <input type="range" min="0" max="90" step="0.5"
                v-model.number="pendingAlt"
                :style="`position:absolute;left:50%;top:50%;width:${PROF_H}px;
                         transform:translate(-50%,-50%) rotate(-90deg);margin:0;cursor:pointer`" />
            </div>
            <span style="font-size:9px;color:#6b7280;line-height:1.2;text-align:center">Alt</span>
          </div>
        </div><!-- end chart row -->

        <!-- Panorama settings (only when loaded) — pad-right matches alt slider -->
        <div v-if="panoramaUrl" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mt-1" style="padding-right:40px">
          <span class="text-gray-400">Opacity</span>
          <input type="range" min="0" max="1" step="0.05" v-model.number="panoramaOpacity" class="w-24" />
          <span class="text-gray-400">Top</span>
          <input type="number" v-model.number="panoramaTopAlt" min="-30" max="90" step="5"
            class="w-14 bg-gray-700 rounded px-1 py-0.5 text-white border border-gray-600 outline-none text-center" />°
          <span class="text-gray-400">Bot</span>
          <input type="number" v-model.number="panoramaBottomAlt" min="-30" max="90" step="5"
            class="w-14 bg-gray-700 rounded px-1 py-0.5 text-white border border-gray-600 outline-none text-center" />°
        </div>

        <!-- Az slider + Alt readout -->
        <div class="flex items-center gap-2 mt-2" style="padding-right:40px">
          <span class="text-xs text-gray-400 w-6">Az</span>
          <input type="range" min="0" max="360" step="0.5" v-model.number="pendingAz" class="flex-1" />
          <span class="text-xs font-mono text-yellow-300 w-14 text-right">{{ pendingAz.toFixed(1) }}°</span>
          <span class="text-xs text-gray-400 ml-2">Alt</span>
          <span class="text-xs font-mono text-yellow-300 w-10 text-right">{{ pendingAlt.toFixed(1) }}°</span>
        </div>

        <!-- Add Point button — same width as SVG -->
        <div class="mt-2" style="padding-right:40px">
          <button @click="addFromSliders"
            class="w-full py-2 text-sm font-semibold bg-yellow-600 hover:bg-yellow-500 rounded text-gray-900">
            Add Point — Az {{ pendingAz.toFixed(1) }}°  Alt {{ pendingAlt.toFixed(1) }}°
          </button>
        </div>

        </div><!-- end profile chart area -->

        <!-- Mode toggle -->
        <div class="flex rounded overflow-hidden border border-gray-600 self-center text-sm">
          <button @click="mode = 'steps'" class="px-4 py-1.5 font-medium transition-colors"
            :class="mode === 'steps' ? 'bg-cyan-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'">Steps</button>
          <button @click="mode = 'jog'" class="px-4 py-1.5 font-medium transition-colors"
            :class="mode === 'jog' ? 'bg-cyan-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'">Jog</button>
        </div>

        <!-- Step size selector -->
        <div v-if="mode === 'steps'" class="flex gap-1.5 self-center">
          <button v-for="s in STEPS" :key="s" @click="selectedStep = s"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
            :class="selectedStep === s ? 'bg-cyan-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
          >{{ s }}°</button>
        </div>

        <!-- D-pad -->
        <div class="grid grid-cols-3 gap-1.5"
          style="user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation">
          <div />
          <button
            @mousedown="mode === 'jog' && startJog('north')" @mouseup="mode === 'jog' && stopJog()" @mouseleave="mode === 'jog' && stopJog()"
            @touchstart.prevent="mode === 'jog' && startJog('north')"
            @touchend.prevent="mode === 'steps' ? stepSlew('north') : stopJog()" @touchcancel.prevent="stopJog()"
            @click="mode === 'steps' && stepSlew('north')"
            :disabled="!mountConnected || (mode === 'steps' && slewBusy)" class="dpad-btn"
            :class="jogging === 'north' ? 'bg-cyan-700' : ''">▲</button>
          <div />
          <button
            @mousedown="mode === 'jog' && startJog('west')" @mouseup="mode === 'jog' && stopJog()" @mouseleave="mode === 'jog' && stopJog()"
            @touchstart.prevent="mode === 'jog' && startJog('west')"
            @touchend.prevent="mode === 'steps' ? stepSlew('west') : stopJog()" @touchcancel.prevent="stopJog()"
            @click="mode === 'steps' && stepSlew('west')"
            :disabled="!mountConnected || (mode === 'steps' && slewBusy)" class="dpad-btn"
            :class="jogging === 'west' ? 'bg-cyan-700' : ''">◄</button>
          <button @click="mode === 'jog' && stopJog()" :disabled="!mountConnected"
            class="w-12 h-12 bg-gray-800 hover:bg-gray-700 rounded text-xs disabled:opacity-40"
            :class="mode === 'steps' ? 'text-cyan-300 font-bold text-sm' : 'text-gray-400'"
          >{{ mode === 'steps' ? selectedStep + '°' : '■' }}</button>
          <button
            @mousedown="mode === 'jog' && startJog('east')" @mouseup="mode === 'jog' && stopJog()" @mouseleave="mode === 'jog' && stopJog()"
            @touchstart.prevent="mode === 'jog' && startJog('east')"
            @touchend.prevent="mode === 'steps' ? stepSlew('east') : stopJog()" @touchcancel.prevent="stopJog()"
            @click="mode === 'steps' && stepSlew('east')"
            :disabled="!mountConnected || (mode === 'steps' && slewBusy)" class="dpad-btn"
            :class="jogging === 'east' ? 'bg-cyan-700' : ''">►</button>
          <div />
          <button
            @mousedown="mode === 'jog' && startJog('south')" @mouseup="mode === 'jog' && stopJog()" @mouseleave="mode === 'jog' && stopJog()"
            @touchstart.prevent="mode === 'jog' && startJog('south')"
            @touchend.prevent="mode === 'steps' ? stepSlew('south') : stopJog()" @touchcancel.prevent="stopJog()"
            @click="mode === 'steps' && stepSlew('south')"
            :disabled="!mountConnected || (mode === 'steps' && slewBusy)" class="dpad-btn"
            :class="jogging === 'south' ? 'bg-cyan-700' : ''">▼</button>
          <div />
        </div>
        <div class="text-xs text-gray-500 text-center">N/S = altitude · E/W = azimuth</div>

        <!-- Rate slider (Jog mode only) -->
        <div v-if="mode === 'jog'" class="w-full px-1">
          <setSlewRatePins />
        </div>

        <!-- NINA profile buttons -->
        <div class="flex gap-2">
          <button class="flex-1 py-2 text-sm font-medium bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-40"
            :disabled="loadingFromNina"
            @click="loadFromNina">{{ loadingFromNina ? 'Loading…' : 'Load from NINA' }}</button>
          <button class="flex-1 py-2 text-sm font-medium bg-indigo-700 hover:bg-indigo-600 rounded disabled:opacity-40"
            :disabled="horizonStore.points.length < 2 || savingToNina"
            @click="saveToNina">{{ savingToNina ? 'Saving…' : 'Save to NINA' }}</button>
          <button class="shrink-0 py-2 px-3 text-sm font-medium bg-red-900 hover:bg-red-800 rounded disabled:opacity-40"
            :disabled="savingToNina"
            title="Reset NINA horizon to flat (no restriction)"
            @click="clearNinaHorizon">Clear</button>
        </div>
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
import { useSettingsStore } from '@/store/settingsStore';
import { useHorizonStore } from '../store/horizonStore';
import { altAzToRaDec, mjdToLST, interpolateHorizon, exportHrz } from '../utils/horizon-utils';
import apiService from '@/services/apiService';
import setSlewRatePins from '@/components/mount/setSlewRatePins.vue';

const store = apiStore();
const settingsStore = useSettingsStore();
const horizonStore = useHorizonStore();

// ── Polar chart ──────────────────────────────────────────────────────────────
const SVG_SIZE = 300;
const CX = 150;
const CY = 150;
const MAX_R = 130;
const D2R = Math.PI / 180;
const chartSize = 280;

// ── Profile chart ─────────────────────────────────────────────────────────────
const PROF_L = 28;   // left margin for Y labels
const PROF_T = 10;   // top margin
const PROF_H = 160;  // chart content height
const PROF_B = PROF_T + PROF_H;            // 170
const SVG_CHART_H = PROF_B + 20;           // 190 (room for X labels)

// chartWidth tracks the SVG element's actual pixel width via ResizeObserver.
// viewBox = "0 0 {chartWidth} {SVG_CHART_H}" → 1:1 mapping, no scaling, no stretching.
const chartWrapper = ref(null);
const chartWidth   = ref(800);
let resizeObs = null;
const chartW = computed(() => Math.max(100, chartWidth.value - PROF_L - 12));

function profX(az) { return PROF_L + az * (chartW.value / 360); }

// ── Reactive state ────────────────────────────────────────────────────────────
const pendingAz  = ref(180);
const pendingAlt = ref(0);

const jogging        = ref('');
const slewBusy       = ref(false);
const savingToNina   = ref(false);
const ninaSaveStatus = ref('');
const ninaSaveOk     = ref(true);
const loadingFromNina = ref(false);
const mode           = ref('steps');
const STEPS          = [1, 3, 5, 10];
const selectedStep   = ref(1);
const manualAz       = ref('');
const manualAlt      = ref('');

const panoramaUrl       = ref(null);
const panoramaOpacity   = ref(0.5);
const panoramaTopAlt    = ref(40);
const panoramaBottomAlt = ref(-10);

// ── Mount ─────────────────────────────────────────────────────────────────────
const mountConnected = computed(() => store.mountInfo?.Connected);
const mountAlt       = computed(() => store.mountInfo?.Altitude ?? null);
const mountAz        = computed(() => store.mountInfo?.Azimuth  ?? 0);

const sortedPoints = computed(() => [...horizonStore.points].sort((a, b) => a.az - b.az));

// ── Profile chart helpers ─────────────────────────────────────────────────────
const altRange = computed(() => {
  const alts = horizonStore.points.map((p) => p.alt);
  const minAlt = alts.length > 0 ? Math.min(0, ...alts) : 0;
  return { min: Math.floor(minAlt / 10) * 10, max: 90 };
});

function profY(alt) {
  const { min, max } = altRange.value;
  return PROF_T + PROF_H - ((alt - min) / (max - min)) * PROF_H;
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
  let d = `M ${profX(0).toFixed(1)},${PROF_B}`;
  for (const p of interp) d += ` L ${profX(p.az).toFixed(1)},${profY(p.alt).toFixed(1)}`;
  d += ` L ${profX(360).toFixed(1)},${PROF_B} Z`;
  return d;
});

const profileLine = computed(() => {
  if (horizonStore.points.length < 2) return null;
  const interp = interpolateHorizon(horizonStore.points, 1);
  return 'M ' + interp.map((p) => `${profX(p.az).toFixed(1)},${profY(p.alt).toFixed(1)}`).join(' L ');
});

// ── Polar chart helpers ────────────────────────────────────────────────────────
function altToR(alt)       { return MAX_R * (1 - Math.max(0, Math.min(90, alt)) / 90); }
function azAltToSvgX(az, alt) { return CX + altToR(alt) * Math.sin(az * D2R); }
function azAltToSvgY(az, alt) { return CY - altToR(alt) * Math.cos(az * D2R); }

const horizonPath = computed(() => {
  if (horizonStore.points.length < 2) return null;
  const interp = interpolateHorizon(horizonStore.points, 3);
  if (interp.length === 0) return null;
  const pts = [...interp, interp[0]];
  return 'M ' + pts.map((p) =>
    `${azAltToSvgX(p.az, p.alt).toFixed(1)},${azAltToSvgY(p.az, p.alt).toFixed(1)}`
  ).join(' L ');
});

// ── Chart click → sets pending position ──────────────────────────────────────
// viewBox = element pixel size → 1:1 mapping, client offset = viewBox coord directly.
function onProfileClick(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const vbX = event.clientX - rect.left;
  const vbY = event.clientY - rect.top;

  if (vbX < PROF_L || vbX > PROF_L + chartW.value) return;
  if (vbY < PROF_T || vbY > PROF_B) return;

  const az  = (vbX - PROF_L) / (chartW.value / 360);
  const { min, max } = altRange.value;
  const alt = max - ((vbY - PROF_T) / PROF_H) * (max - min);

  pendingAz.value  = Math.max(0,   Math.min(360, Math.round(az  * 10) / 10));
  pendingAlt.value = Math.max(-30, Math.min(90,  Math.round(alt * 10) / 10));
}

// ── Adding points ─────────────────────────────────────────────────────────────
function addMountPoint() {
  if (mountAlt.value == null) return;
  horizonStore.addPoint(mountAlt.value, mountAz.value);
}

function addFromSliders() {
  horizonStore.addPoint(pendingAlt.value, pendingAz.value);
}

function addManualPoint() {
  const az  = parseFloat(manualAz.value);
  const alt = parseFloat(manualAlt.value);
  if (isNaN(az)  || az  < 0   || az  > 360) return;
  if (isNaN(alt) || alt < -30 || alt > 90)  return;
  horizonStore.addPoint(alt, az);
  manualAz.value = ''; manualAlt.value = '';
}

function onLoadPanorama(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { panoramaUrl.value = e.target.result; };
  reader.readAsDataURL(file);
  event.target.value = '';
}

// ── Slewing ───────────────────────────────────────────────────────────────────
let commandInterval = null;
let failsafeTimeout = null;

function slewCoords(alt, az) {
  const latRad = (store.profileInfo?.AstrometrySettings?.Latitude  ?? 0) * D2R;
  const lonRad = (store.profileInfo?.AstrometrySettings?.Longitude ?? 0) * D2R;
  const nowJD  = Date.now() / 86400000 + 2440587.5;
  return altAzToRaDec(alt, az, latRad, mjdToLST(nowJD - 2400000.5, lonRad));
}

async function stepSlew(direction) {
  if (slewBusy.value || !mountConnected.value || mountAlt.value == null) return;
  let alt = mountAlt.value, az = mountAz.value;
  const step = selectedStep.value;
  switch (direction) {
    case 'north': alt = Math.min(89,  alt + step); break;
    case 'south': alt = Math.max(-30, alt - step); break;
    case 'east':  az  = (az + step + 360) % 360;  break;
    case 'west':  az  = (az - step + 360) % 360;  break;
  }
  const { raDeg, decDeg } = slewCoords(alt, az);
  slewBusy.value = true;
  try { await apiService.slewAndCenter(raDeg, decDeg, false, false, 0); }
  catch (e) { console.error('Horizon step-slew error:', e); }
  finally   { slewBusy.value = false; }
}

async function doJogStep(direction) {
  if (slewBusy.value || !mountConnected.value || mountAlt.value == null) return;
  let alt = mountAlt.value, az = mountAz.value;
  const step = settingsStore.mount.slewRate;
  switch (direction) {
    case 'north': alt = Math.min(89,  alt + step); break;
    case 'south': alt = Math.max(-30, alt - step); break;
    case 'east':  az  = (az + step + 360) % 360;  break;
    case 'west':  az  = (az - step + 360) % 360;  break;
  }
  const { raDeg, decDeg } = slewCoords(alt, az);
  slewBusy.value = true;
  try { await apiService.slewAndCenter(raDeg, decDeg, false, false, 0); }
  catch (e) { console.error('Horizon jog error:', e); }
  finally   { slewBusy.value = false; }
}

function startJog(direction) {
  if (!mountConnected.value) return;
  if (commandInterval) clearInterval(commandInterval);
  jogging.value = direction;
  doJogStep(direction);
  commandInterval = setInterval(() => doJogStep(direction), 800);
  if (failsafeTimeout) clearTimeout(failsafeTimeout);
  failsafeTimeout = setTimeout(() => stopJog(), 30000);
}

function stopJog() {
  if (commandInterval) { clearInterval(commandInterval); commandInterval = null; }
  if (failsafeTimeout) { clearTimeout(failsafeTimeout); failsafeTimeout = null; }
  jogging.value = ''; slewBusy.value = false;
}

async function loadFromNina() {
  loadingFromNina.value = true;
  ninaSaveStatus.value = '';
  try {
    const points = await apiService.getProfileHorizon();
    if (points.length > 0) {
      horizonStore.points = points;
      horizonStore._save();
      ninaSaveOk.value = true;
      ninaSaveStatus.value = `Loaded ${points.length} points from NINA profile`;
    } else {
      ninaSaveOk.value = true;
      ninaSaveStatus.value = 'No horizon set in NINA profile';
    }
  } catch (e) {
    ninaSaveOk.value = false;
    ninaSaveStatus.value = 'Load failed: ' + (e?.response?.data?.Error?.Message ?? e.message);
  } finally {
    loadingFromNina.value = false;
  }
}

async function saveToNina() {
  if (horizonStore.points.length < 2) return;
  savingToNina.value = true; ninaSaveStatus.value = '';
  try {
    await apiService.postProfileHorizon(horizonStore.getHrz());
    ninaSaveOk.value = true; ninaSaveStatus.value = 'Horizon saved to active profile';
  } catch (e) {
    ninaSaveOk.value = false;
    ninaSaveStatus.value = 'Save failed: ' + (e?.response?.data?.Error?.Message ?? e.message);
  } finally { savingToNina.value = false; }
}

async function clearNinaHorizon() {
  savingToNina.value = true; ninaSaveStatus.value = '';
  try {
    const flat = exportHrz([0, 45, 90, 135, 180, 225, 270, 315].map(az => ({ az, alt: 0 })));
    await apiService.postProfileHorizon(flat);
    ninaSaveOk.value = true; ninaSaveStatus.value = 'Horizon cleared in NINA profile';
  } catch (e) {
    ninaSaveOk.value = false;
    ninaSaveStatus.value = 'Clear failed: ' + (e?.response?.data?.Error?.Message ?? e.message);
  } finally { savingToNina.value = false; }
}

onMounted(() => {
  if (chartWrapper.value) {
    chartWidth.value = chartWrapper.value.clientWidth || 800;
    resizeObs = new ResizeObserver((entries) => {
      chartWidth.value = Math.round(entries[0].contentRect.width) || 800;
    });
    resizeObs.observe(chartWrapper.value);
  }
});

onBeforeUnmount(() => {
  stopJog();
  if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
});

function saveHrz() {
  const blob = new Blob([horizonStore.getHrz()], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'horizon.hrz'; a.click();
  URL.revokeObjectURL(url);
}

function onLoadHrz(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => horizonStore.loadFromHrz(e.target.result);
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
