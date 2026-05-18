<template>
  <div class="space-y-3">

    <!-- Restoring from IDB -->
    <div v-if="restoring" class="flex items-center gap-2 text-xs text-cyan-400">
      <svg class="h-3 w-3 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
      Restoring orbital catalog from cache…
    </div>

    <!-- No catalog loaded at all -->
    <div v-else-if="!hasCatalog" class="rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
      No orbital catalog loaded. Open the Orbitals plugin to fetch data first.
    </div>

    <!-- Search input -->
    <div class="relative">
      <input
        v-model="query"
        @input="onInput"
        @focus="showDrop = query.length >= 2"
        @blur="onBlur"
        type="search"
        placeholder="Search comet or asteroid…"
        :disabled="!hasCatalog"
        class="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
      />

      <!-- Dropdown -->
      <div v-if="showDrop && results.length"
           class="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
        <button
          v-for="r in results" :key="r.obj.name + r.orbType"
          @mousedown.prevent="select(r)"
          class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-gray-800"
        >
          <span class="min-w-0 flex-1 truncate text-white">{{ r.obj.name }}</span>
          <span :class="typeClass(r.obj)" class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
            {{ typeLabel(r.obj) }}
          </span>
        </button>
      </div>

      <div v-else-if="showDrop && query.length >= 2 && !results.length"
           class="absolute top-full z-50 mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-500 shadow-xl">
        No results
      </div>
    </div>

    <!-- Selected object summary + recalculate -->
    <div v-if="selectedName" class="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 space-y-1">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-medium text-white truncate">{{ selectedName }}</p>
        <button @click="recalculate"
          class="shrink-0 rounded border border-cyan-700 bg-cyan-900/40 px-2 py-0.5 text-xs text-cyan-300 hover:bg-cyan-800/50 transition">
          Recalculate
        </button>
      </div>
      <p class="text-xs text-gray-500">
        RA {{ currentRA }} · Dec {{ currentDec }}
        <span v-if="computedAt"> · as of {{ computedAt }}</span>
      </p>
      <p v-if="calcError" class="text-xs text-red-400">{{ calcError }}</p>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { asteroidsNum, asteroidsUnnum } from '@/plugins/orbitals/utils/asteroid-index.js';
import { loadAsteroidRaw } from '@/plugins/orbitals/utils/idb-cache.js';
import { calcRaDec } from '@/plugins/orbitals/utils/orbital-mechanics.js';
import { useOrbitalsStore } from '@/plugins/orbitals/store/orbitalsStore.js';

const emit = defineEmits(['target-selected']);

const store = useOrbitalsStore();

const query       = ref('');
const results     = ref([]);
const showDrop    = ref(false);
const restoring   = ref(false);
const selectedName = ref('');
const currentRA   = ref('');
const currentDec  = ref('');
const computedAt  = ref('');
const calcError   = ref('');

let searchTimer = null;
let _selectedObj = null;
let _selectedOrbType = 1;

const hasCatalog = computed(
  () => store.comets.length > 0 || asteroidsNum.value.length > 0 || asteroidsUnnum.value.length > 0
);

// ── IDB restore ─────────────────────────────────────────────────────────────
function parseInWorker(source, buf) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('@/plugins/orbitals/utils/asteroid-worker.js', import.meta.url)
    );
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.ok) resolve(data.parsed);
      else reject(new Error(data.error));
    };
    worker.onerror = (e) => { worker.terminate(); reject(e); };
    worker.postMessage({ source, buf }, [buf]);
  });
}

onMounted(() => {
  let pending = 0;
  for (const source of ['JPL-num', 'JPL-unnum']) {
    const already = source === 'JPL-num' ? asteroidsNum.value.length > 0 : asteroidsUnnum.value.length > 0;
    if (already) continue;
    pending++;
    restoring.value = true;
    loadAsteroidRaw(source)
      .then(async (cached) => {
        if (!cached) return;
        const parsed = await parseInWorker(cached.source, cached.buf);
        if (source === 'JPL-num') asteroidsNum.value = parsed;
        else asteroidsUnnum.value = parsed;
      })
      .catch(() => {})
      .finally(() => {
        pending--;
        if (pending === 0) restoring.value = false;
      });
  }
});

// ── Search ───────────────────────────────────────────────────────────────────
function onInput() {
  showDrop.value = true;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 250);
}

function onBlur() {
  setTimeout(() => { showDrop.value = false; }, 150);
}

function runSearch() {
  const q = query.value.trim().toLowerCase();
  if (q.length < 2) { results.value = []; return; }
  const out = [];
  const sources = [
    { arr: store.comets,          orbType: 1 },
    { arr: asteroidsNum.value,    orbType: 2 },
    { arr: asteroidsUnnum.value,  orbType: 3 },
  ];
  for (const { arr, orbType } of sources) {
    for (const o of arr) {
      if (o.name.toLowerCase().includes(q)) {
        out.push({ obj: o, orbType });
        if (out.length >= 20) break;
      }
    }
    if (out.length >= 20) break;
  }
  results.value = out;
}

// ── Selection ────────────────────────────────────────────────────────────────
function select({ obj, orbType }) {
  _selectedObj = obj;
  _selectedOrbType = orbType;
  query.value  = obj.name;
  showDrop.value = false;
  results.value  = [];
  selectedName.value = obj.name;
  computeAndEmit(obj, orbType);
}

function recalculate() {
  if (_selectedObj) computeAndEmit(_selectedObj, _selectedOrbType);
}

function computeAndEmit(obj, orbType) {
  calcError.value = '';
  const now = new Date();
  const pos = calcRaDec(obj, now);
  if (!pos) {
    calcError.value = 'Could not compute position — orbital elements may be incomplete.';
    return;
  }
  const ra  = fmtRA(pos.ra);
  const dec = fmtDec(pos.dec);
  currentRA.value  = ra;
  currentDec.value = dec;
  computedAt.value = now.toLocaleTimeString();
  emit('target-selected', { name: obj.name, ra, dec, raDeg: pos.ra, decDeg: pos.dec, positionAngle: 0, orbType, orbObj: obj });
}

// ── Formatting ───────────────────────────────────────────────────────────────
// Produce "HH:MM:SS" expected by sequenceStore's NINA JSON builder.
function fmtRA(deg) {
  const h  = (((deg % 360) + 360) % 360) / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = Math.round(((h - hh) * 60 - mm) * 60);
  const s  = ss < 60 ? ss : 59;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Produce "±DD:MM:SS" expected by sequenceStore's NINA JSON builder.
function fmtDec(deg) {
  const sign = deg < 0 ? '-' : '+';
  const abs  = Math.abs(deg);
  const dd   = Math.floor(abs);
  const mm   = Math.floor((abs - dd) * 60);
  const ss   = Math.round(((abs - dd) * 60 - mm) * 60);
  const s    = ss < 60 ? ss : 59;
  return `${sign}${String(dd).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function typeLabel(row) {
  if (row.type === 'asteroid') return 'A';
  const map = { P: 'P/', C: 'C/', D: 'D/', J: 'JPL' };
  return map[row.orbitType] ?? row.orbitType ?? '?';
}

function typeClass(row) {
  if (row.type === 'asteroid') return 'bg-amber-900/50 text-amber-300';
  const map = { P: 'bg-cyan-900/50 text-cyan-300', C: 'bg-blue-900/50 text-blue-300' };
  return map[row.orbitType] ?? 'bg-gray-700/50 text-gray-300';
}
</script>
