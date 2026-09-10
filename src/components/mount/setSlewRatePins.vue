<template>
  <div class="flex flex-col w-full gap-1">
    <div class="flex items-baseline justify-between">
      <p class="text-xs sm:text-sm min-w-24 sm:min-w-32 font-medium text-gray-500">
        {{ $t('components.mount.control.slewRate') }}
      </p>
      <p
        v-if="kind !== 'none' && currentLabel"
        class="text-xs sm:text-sm text-cyan-400 font-medium"
      >
        {{ currentLabel }}
      </p>
    </div>

    <!-- Discrete: driver-provided named steps (e.g. Guide / Center / Find / Max) -->
    <div v-if="kind === 'discrete'" class="relative pt-3 pb-5">
      <div
        class="absolute top-1/2 left-0 right-0 h-1 bg-gray-700 rounded-full -translate-y-1/2"
      ></div>
      <div
        class="absolute top-1/2 left-0 h-1 bg-cyan-800 rounded-full -translate-y-1/2 pointer-events-none"
        :style="{ width: `${trackFillPercent}%` }"
      ></div>
      <div
        v-for="i in options.length"
        :key="`tick-${i}`"
        class="absolute top-1/2 w-px h-2 bg-gray-500 -translate-y-1/2 pointer-events-none"
        :style="{ left: `${ratioPercent(i - 1)}%` }"
      ></div>
      <div
        class="absolute top-1/2 w-2 h-6 rounded-md bg-cyan-500 -translate-y-1/2 -translate-x-1/2 pointer-events-none shadow-lg"
        :style="{ left: `${trackFillPercent}%` }"
      ></div>
      <input
        type="range"
        min="0"
        :max="Math.max(0, options.length - 1)"
        step="1"
        :value="discreteIndex"
        @input="onDiscreteInput"
        class="absolute w-full top-1/2 -translate-y-1/2 h-8 appearance-none bg-transparent cursor-pointer slider-input"
      />
    </div>

    <!-- Continuous: numeric °/s range provided by the driver -->
    <div v-else-if="kind === 'continuous'" class="relative pt-3 pb-5">
      <div
        class="absolute top-1/2 left-0 right-0 h-1 bg-gray-700 rounded-full -translate-y-1/2"
      ></div>
      <div
        class="absolute top-1/2 left-0 h-1 bg-cyan-800 rounded-full -translate-y-1/2 pointer-events-none"
        :style="{ width: `${trackFillPercent}%` }"
      ></div>
      <div
        class="absolute top-1/2 w-2 h-6 rounded-md bg-cyan-500 -translate-y-1/2 -translate-x-1/2 pointer-events-none shadow-lg"
        :style="{ left: `${trackFillPercent}%` }"
      ></div>
      <input
        type="range"
        :min="capability.Min"
        :max="capability.Max"
        :step="continuousStep"
        :value="continuousValue"
        @input="onContinuousInput"
        class="absolute w-full top-1/2 -translate-y-1/2 h-8 appearance-none bg-transparent cursor-pointer slider-input"
      />
    </div>

    <!-- No rate control exposed by the driver, or no mount connected -->
    <p v-else class="text-xs text-gray-500 italic py-2">
      {{
        kind === 'none'
          ? $t('components.mount.control.slewRateDriverControlled')
          : $t('components.mount.control.slewRateUnavailable')
      }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useSettingsStore } from '@/store/settingsStore';
import { useMountStore } from '@/store/mountStore';
import apiService from '@/services/apiService';

const settingsStore = useSettingsStore();
const mountStore = useMountStore();

// 'none' until the capability is fetched; renders the "unavailable" hint meanwhile.
const kind = ref('none');
const capability = ref({ Kind: 'None', Options: [], Min: 0, Max: 0, Step: 0, Unit: '°/s' });
const discreteIndex = ref(0);
const continuousValue = ref(0);

let postTimer = null;
// Guards the capability GET against a slider input that lands while it is in flight:
// loadCapability() drops its own response once activeLoad no longer matches its id.
let loadSeq = 0;
let activeLoad = 0;

const options = computed(() => capability.value?.Options ?? []);
const continuousStep = computed(() => capability.value?.Step || 0.1);

function normalizeKind(k) {
  // Tolerate both numeric (Swan enum) and string serialization.
  if (k === 1 || k === 'Discrete') return 'discrete';
  if (k === 2 || k === 'Continuous') return 'continuous';
  return 'none';
}

function ratioPercent(idx) {
  const maxIdx = Math.max(1, options.value.length - 1);
  return (idx / maxIdx) * 100;
}

const trackFillPercent = computed(() => {
  if (kind.value === 'discrete') {
    return ratioPercent(discreteIndex.value);
  }
  if (kind.value === 'continuous') {
    const { Min, Max } = capability.value;
    if (Max <= Min) return 0;
    return ((continuousValue.value - Min) / (Max - Min)) * 100;
  }
  return 0;
});

const currentLabel = computed(() => {
  if (kind.value === 'discrete') {
    return options.value[discreteIndex.value]?.Label ?? '';
  }
  if (kind.value === 'continuous') {
    return `${Number(continuousValue.value).toFixed(2)} ${capability.value.Unit || '°/s'}`;
  }
  return '';
});

async function loadCapability() {
  const loadId = ++loadSeq;
  activeLoad = loadId;
  try {
    const data = await apiService.getMountSlewRates();
    // The user picked a rate while this GET was in flight (or a newer load started):
    // their choice owns the slider now, so the stale response must neither reset it
    // nor write the old rate back to the driver.
    if (activeLoad !== loadId) return;
    if (!data?.Success || !data.Response) {
      kind.value = 'none';
      return;
    }
    const cap = data.Response;
    capability.value = cap;
    kind.value = normalizeKind(cap.Kind);

    if (kind.value === 'discrete') {
      // Prefer the driver's current selection, fall back to the persisted choice.
      const selected = cap.Options.findIndex((o) => o.IsSelected);
      const stored = settingsStore.mount.slewRateIndex;
      const idx = selected >= 0 ? selected : stored;
      discreteIndex.value = Math.min(Math.max(0, idx ?? 0), Math.max(0, cap.Options.length - 1));
      assertRateOnDriver({ index: discreteIndex.value });
    } else if (kind.value === 'continuous') {
      const stored = settingsStore.mount.slewRate;
      const v = cap.CurrentValue ?? stored ?? cap.Min;
      continuousValue.value = Math.min(Math.max(cap.Min, v), cap.Max);
      assertRateOnDriver({ value: continuousValue.value });
    }
  } catch {
    if (activeLoad !== loadId) return;
    // 404 / network: mount not connected — show the unavailable hint.
    kind.value = 'none';
    capability.value = { Kind: 'None', Options: [], Min: 0, Max: 0, Step: 0, Unit: '°/s' };
  }
}

function onDiscreteInput(event) {
  const idx = parseInt(event.target.value, 10);
  discreteIndex.value = idx;
  settingsStore.mount.slewRateIndex = idx;
  settingsStore.saveMountSettings();
  postRate({ index: idx });
}

function onContinuousInput(event) {
  const value = parseFloat(event.target.value);
  continuousValue.value = value;
  settingsStore.mount.slewRate = value;
  settingsStore.saveMountSettings();
  postRate({ value });
}

// Some INDI drivers (confirmed: ZWO AM3/AM5) only push the rate to the mount once they
// receive a TELESCOPE_SLEW_RATE write. In PINS mode the move command carries the direction
// only, so without this the mount does not move until the user has touched the slider once.
// Re-asserting the rate the driver already reports is a no-op for every other driver.
function assertRateOnDriver(selection) {
  apiService
    .setMountSlewRate(selection)
    .catch((e) => console.error('setMountSlewRate (initial assert) failed', e));
}

function postRate(selection) {
  // A running capability GET must not overwrite what the user just selected.
  activeLoad = 0;
  // Debounce so dragging the slider doesn't flood the driver with switch changes.
  if (postTimer) clearTimeout(postTimer);
  postTimer = setTimeout(() => {
    apiService
      .setMountSlewRate(selection)
      .catch((e) => console.error('setMountSlewRate failed', e));
  }, 250);
}

onMounted(loadCapability);

// Re-fetch when the mount control socket (re)connects, e.g. after connecting the mount.
watch(
  () => mountStore.wsIsConnected,
  (connected) => {
    if (connected) loadCapability();
  }
);

onBeforeUnmount(() => {
  if (postTimer) clearTimeout(postTimer);
});
</script>

<style scoped>
.slider-input {
  -webkit-appearance: none;
  appearance: none;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.slider-input::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  border: none;
}

.slider-input::-webkit-slider-runnable-track {
  background: transparent;
  height: 8px;
  border: none;
}

.slider-input::-moz-range-track {
  background: transparent;
  border: none;
}
</style>
