<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs font-medium text-white truncate max-w-[120px]">
        {{ orbData?.name ?? item.Name }}
      </span>
      <span :class="typeBadgeClass" class="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium">
        {{ typeBadgeLabel }}
      </span>
      <span class="text-xs text-slate-400 font-mono">{{ displayRa }} {{ displayDec }}</span>
    </template>

    <template #editor>
      <!-- Current position + drift -->
      <div class="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 space-y-1">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-medium text-white truncate">{{ orbData?.name ?? item.Name }}</p>
          <button
            @click="recalculate"
            :disabled="!orbData?.orbObj || recalculating"
            class="shrink-0 rounded border border-cyan-700 bg-cyan-900/40 px-2 py-0.5 text-xs text-cyan-300 hover:bg-cyan-800/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg v-if="recalculating" class="inline w-3 h-3 animate-spin mr-1" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Recalculate
          </button>
        </div>
        <p class="text-xs text-gray-400 font-mono">RA {{ displayRa }} · Dec {{ displayDec }}</p>
        <p v-if="computedAt" class="text-xs text-gray-500">as of {{ computedAt }}</p>
        <p v-if="driftRaStr || driftDecStr" class="text-xs text-gray-500">
          Drift RA {{ driftRaStr }}″/min · Dec {{ driftDecStr }}″/min
        </p>
        <p v-if="shiftStatus" :class="shiftError ? 'text-yellow-400' : 'text-green-400'" class="text-xs">{{ shiftStatus }}</p>
        <p v-if="calcError" class="text-xs text-red-400">{{ calcError }}</p>
      </div>

      <!-- Change object -->
      <p class="text-xs text-slate-400 pt-1">Change object:</p>
      <OrbitalTargetSearch @target-selected="onTargetChanged" />
    </template>
  </ItemShell>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import ItemShell from './ItemShell.vue';
import OrbitalTargetSearch from '@/plugins/sequence-creator/components/OrbitalTargetSearch.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { calcRaDec } from '@/plugins/orbitals/utils/orbital-mechanics.js';
import apiService from '@/services/apiService';

const props = defineProps({
  item: { type: Object, required: true },
});

const store = useSequenceV2Store();
const recalculating = ref(false);
const calcError = ref('');
const shiftStatus = ref('');
const shiftError = ref(false);
const computedAt = ref('');
const driftRaStr = ref('');
const driftDecStr = ref('');

// Local computed RA/Dec (degrees) — set after each calculation
const localRaDeg = ref(null);
const localDecDeg = ref(null);

const orbData = computed(() => store.orbitalItems[props.item.Id] ?? null);

const typeBadgeLabel = computed(() => {
  const t = orbData.value?.orbType;
  if (t === 1) return 'Comet';
  return 'Asteroid';
});

const typeBadgeClass = computed(() => {
  const t = orbData.value?.orbType;
  if (t === 1) return 'bg-blue-900/50 text-blue-300';
  return 'bg-amber-900/50 text-amber-300';
});

// ── RA/Dec display ────────────────────────────────────────────────────────────
// Prefer locally computed values; fall back to NINA's Target string.

function fmtRA(deg) {
  const h = (((deg % 360) + 360) % 360) / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = Math.min(59, Math.round(((h - hh) * 60 - mm) * 60));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function fmtDec(deg) {
  const sign = deg < 0 ? '-' : '+';
  const abs = Math.abs(deg);
  const dd = Math.floor(abs);
  const dm = Math.floor((abs - dd) * 60);
  const ds = Math.min(59, Math.round(((abs - dd) * 60 - dm) * 60));
  return `${sign}${String(dd).padStart(2, '0')}°${String(dm).padStart(2, '0')}'${String(ds).padStart(2, '0')}"`;
}

const ninaRaStr = computed(() => {
  const t = props.item.Target;
  if (!t || typeof t !== 'string') return '';
  const m = t.match(/RA:\s*(\d+:\d+:[\d.]+)/);
  return m ? m[1].replace(/\.\d+$/, '') : '';
});

const ninaDecStr = computed(() => {
  const t = props.item.Target;
  if (!t || typeof t !== 'string') return '';
  const m = t.match(/Dec:\s*(-?\d+°\s*\d+'\s*[\d.]+")/);
  return m ? m[1].replace(/\.\d+"$/, '"') : '';
});

const displayRa = computed(() =>
  localRaDeg.value !== null ? fmtRA(localRaDeg.value) : ninaRaStr.value
);
const displayDec = computed(() =>
  localDecDeg.value !== null ? fmtDec(localDecDeg.value) : ninaDecStr.value
);

// ── Drift ─────────────────────────────────────────────────────────────────────
function computeDrift(obj, raDeg, decDeg) {
  const t2 = new Date(Date.now() + 60000);
  const p2 = calcRaDec(obj, t2);
  if (!p2) return;
  const cosDec = Math.cos((decDeg * Math.PI) / 180);
  const dRa = ((p2.ra - raDeg + 540) % 360 - 180) * 3600 * cosDec;
  const dDec = (p2.dec - decDeg) * 3600;
  driftRaStr.value = dRa.toFixed(1);
  driftDecStr.value = dDec.toFixed(1);
}

// ── Core compute ──────────────────────────────────────────────────────────────
async function computeAndApply(obj, name) {
  calcError.value = '';
  shiftStatus.value = '';
  shiftError.value = false;
  const now = new Date();
  const pos = calcRaDec(obj, now);
  if (!pos) {
    calcError.value = 'Could not compute position — orbital elements may be incomplete.';
    return;
  }
  localRaDeg.value = pos.ra;
  localDecDeg.value = pos.dec;
  computedAt.value = now.toLocaleTimeString();
  computeDrift(obj, pos.ra, pos.dec);

  // Raw coordinate rates in deg/hr for guider and mount APIs
  const p2 = calcRaDec(obj, new Date(now.getTime() + 60000));
  if (p2) {
    const raRateDegPerHr = ((p2.ra - pos.ra + 540) % 360 - 180) * 60;
    const decRateDegPerHr = (p2.dec - pos.dec) * 60;
    const results = await Promise.allSettled([
      apiService.setGuiderShiftRate(raRateDegPerHr, decRateDegPerHr),
      apiService.setMountTrackingRate(raRateDegPerHr, decRateDegPerHr),
    ]);
    const failed = results.filter(r => r.status === 'rejected' || r.value?.success === false);
    if (failed.length === 0) {
      shiftStatus.value = 'Shift rate applied';
    } else if (failed.length < results.length) {
      shiftStatus.value = 'Shift rate partially applied';
      shiftError.value = true;
    } else {
      shiftStatus.value = 'Shift rate not applied — guider/mount not connected';
      shiftError.value = true;
    }
  }

  await store.setDsoTarget(props.item.Id, name, pos.ra, pos.dec, 0);
}

async function recalculate() {
  const od = orbData.value;
  if (!od?.orbObj) return;
  recalculating.value = true;
  try {
    await computeAndApply(od.orbObj, od.name);
  } finally {
    recalculating.value = false;
  }
}

async function onTargetChanged(data) {
  recalculating.value = true;
  calcError.value = '';
  try {
    store.setOrbitalItem(props.item.Id, { name: data.name, orbType: data.orbType, orbObj: data.orbObj });
    await computeAndApply(data.orbObj, data.name);
  } finally {
    recalculating.value = false;
  }
}

onMounted(() => {
  const od = orbData.value;
  if (od?.orbObj) recalculate();
});
</script>
