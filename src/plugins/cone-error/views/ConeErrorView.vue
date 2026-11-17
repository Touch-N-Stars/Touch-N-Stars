<template>
  <div class="container mx-auto p-2 sm:p-4 max-w-3xl space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-xl sm:text-2xl font-bold text-content">
        {{ $t('plugins.coneError.title') }}
      </h1>
      <button
        class="tns-btn-secondary w-auto! min-h-touch"
        :disabled="store.loading"
        @click="store.loadAll()"
      >
        <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': store.loading }" />
        <span class="sr-only">{{ $t('plugins.coneError.refresh') }}</span>
      </button>
    </div>

    <nav class="grid grid-cols-4 gap-1 rounded-control bg-surface-1 border border-line p-1">
      <button
        v-for="tab in TABS"
        :key="tab"
        class="min-h-touch rounded-chip px-1 text-sm font-semibold transition-colors"
        :class="
          activeTab === tab
            ? 'bg-accent-action text-white'
            : 'text-content-muted hover:bg-surface-2'
        "
        :disabled="tabLocked(tab)"
        @click="activeTab = tab"
      >
        {{ $t(`plugins.coneError.tabs.${tab}`) }}
      </button>
    </nav>

    <p
      v-if="store.error"
      class="rounded-control border border-status-danger/50 bg-status-danger/10 p-3 text-sm text-status-danger"
    >
      {{ store.error.message }}
    </p>

    <section v-if="store.preconditions?.restorePending && !store.active" class="tns-card space-y-2">
      <p class="text-sm text-status-warn">{{ $t('plugins.coneError.checks.restorePending') }}</p>
      <button class="tns-btn-primary" :disabled="store.pending" @click="restore">
        {{ $t('plugins.coneError.checks.restore') }}
      </button>
    </section>

    <AutoWizard v-if="activeTab === 'auto'" />
    <ManualFlip v-else-if="activeTab === 'manual'" />
    <ConeHistory v-else-if="activeTab === 'history'" />
    <ConeSettings v-else />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import { useConeErrorStore } from '../store/coneErrorStore';
import AutoWizard from '../components/AutoWizard.vue';
import ManualFlip from '../components/ManualFlip.vue';
import ConeHistory from '../components/ConeHistory.vue';
import ConeSettings from '../components/ConeSettings.vue';

const TABS = ['auto', 'manual', 'history', 'settings'];

const store = useConeErrorStore();
const activeTab = ref('auto');

// A running session locks only the other mode's tab; history and settings stay reachable.
function tabLocked(tab) {
  if (tab === 'auto') return store.manualActive;
  if (tab === 'manual') return store.autoRunning;
  return false;
}

// The store polls the status every 2 s while the panel is open and, during a session, also after
// it is closed (the daytime check's deadman on the backend stops a move when the polls stop).
onMounted(async () => {
  store.attachView();
  await store.loadAll();
  if (store.manualActive) activeTab.value = 'manual';
  if (store.autoRunning) activeTab.value = 'auto';
});

onUnmounted(() => store.detachView());

// A session that just finished: refresh preconditions and history.
watch(
  () => store.active,
  (active, was) => {
    if (was && !active) {
      store.loadPreconditions();
      store.loadResults();
    }
  }
);

async function restore() {
  try {
    await store.restore();
  } catch {
    // shown through store.error
  }
}
</script>
