<template>
  <div v-if="result" class="tns-card flex flex-col gap-3">
    <h3 class="text-sm font-semibold text-content">{{ L('title') }}</h3>

    <p v-if="result.findings.length === 0" class="flex items-start gap-2 text-sm text-content">
      <span class="tns-dot bg-status-ok mt-1.5 shrink-0"></span>
      <span>{{ L('ok') }}</span>
    </p>

    <div v-for="f in shownFindings" :key="f.id" class="flex flex-col gap-2">
      <p class="flex items-start gap-2 text-sm text-content">
        <span class="tns-dot mt-1.5 shrink-0" :class="dotClass[f.severity]"></span>
        <span>{{ findingText(f) }}</span>
      </p>
      <template v-if="f.fix">
        <p v-if="applied[f.id] === 'done'" class="text-xs text-status-ok">{{ L('applied') }}</p>
        <button
          v-else
          class="tns-btn-secondary min-h-touch"
          :disabled="applied[f.id] === 'busy'"
          @click="apply(f)"
        >
          {{ fixLabel(f.fix) }}
        </button>
        <p v-if="applied[f.id] === 'error'" class="text-xs text-status-danger">
          {{ L('applyFailed') }}
        </p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useHocusFocusStore } from '@/store/hocusFocusStore';
import { evaluateRun, advisorSettings, fixLabelKey } from '@/utils/hocusFocusAdvisor';

// The diagnosis after a Hocus Focus run: the most important findings, each with a one-tap fix.
const props = defineProps({
  maxShown: { type: Number, default: 2 },
});

const { t } = useI18n();
const L = (key, params) => t(`components.focuser.hfAdvice.${key}`, params || {});
const store = apiStore();
const hfStore = useHocusFocusStore();

const dotClass = { error: 'bg-status-danger', warn: 'bg-status-warn', info: 'bg-content-muted' };

const result = computed(() =>
  hfStore.available
    ? evaluateRun(
        hfStore.lastRun,
        advisorSettings(store.profileInfo, hfStore.autoFocusOptions, hfStore.starDetectionOptions)
      )
    : null
);
const shownFindings = computed(() => (result.value?.findings || []).slice(0, props.maxShown));

// Fix state per finding id; reset whenever a new run arrives.
const applied = ref({});
watch(
  () => hfStore.lastRun?.Timestamp,
  () => {
    applied.value = {};
  }
);

function findingText(f) {
  if (f.id === 'fewStars' && f.params.narrowband) return L('findings.fewStarsNarrowband', f.params);
  if (f.id === 'notBracketed') return L(`findings.notBracketed_${f.params.side}`);
  return L(`findings.${f.id}`, f.params);
}

function fixLabel(fix) {
  return L(`fix.${fixLabelKey(fix)}`, { value: fix.value });
}

async function apply(f) {
  applied.value = { ...applied.value, [f.id]: 'busy' };
  try {
    await hfStore.applyFix(f.fix);
    applied.value = { ...applied.value, [f.id]: 'done' };
  } catch (err) {
    console.error('[HfRunAdvice] Error applying fix:', err);
    applied.value = { ...applied.value, [f.id]: 'error' };
  }
}

// One read when the card appears and one when an autofocus ends; the finished-AF chart keeps
// hfStore.lastRun current otherwise.
async function refresh() {
  if (!hfStore.available) return;
  try {
    await hfStore.loadLastRun();
    if (!hfStore.autoFocusOptions) await hfStore.loadAutoFocusOptions();
    if (!hfStore.starDetectionOptions) await hfStore.loadStarDetectionOptions();
  } catch (err) {
    console.error('[HfRunAdvice] Error loading Hocus Focus data:', err);
  }
}

onMounted(refresh);
watch(
  () => store.focuserAfInfo.autofocus_running,
  (running, wasRunning) => {
    if (wasRunning && !running) refresh();
  }
);
watch(() => hfStore.available, refresh);
</script>
