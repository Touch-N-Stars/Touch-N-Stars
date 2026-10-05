<template>
  <section class="tns-card space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-base font-semibold text-content">{{ $t('plugins.aapa.assist.title') }}</h2>
      <button class="tns-btn-ghost px-2! text-xs!" @click="openSettings">
        <Cog6ToothIcon class="w-5 h-5" />
        <span>{{ $t('plugins.aapa.assist.tppaSettings') }}</span>
      </button>
    </div>
    <p class="text-xs text-content-faint">{{ $t('plugins.aapa.assist.hint') }}</p>

    <div class="flex gap-2">
      <button class="tns-btn-primary" :disabled="!canStart" @click="store.startAssist()">
        {{ startLabel }}
      </button>
      <!-- Stop stays enabled whenever the socket is open: the running state is only
           derived from log lines and may be unknown after a reconnect. -->
      <button class="tns-btn-danger" :disabled="!store.isWsOpen" @click="store.stopAssist()">
        {{ $t('plugins.aapa.assist.stop') }}
      </button>
    </div>

    <p v-if="!api.isTnsPluginConnected" class="text-xs text-status-warn">
      {{ $t('plugins.aapa.assist.tnsPluginRequired') }}
    </p>
    <p v-if="store.assistError" class="text-sm text-status-danger">
      {{ $t(`plugins.aapa.assist.errors.${store.assistError}`) }}
    </p>

    <div v-if="store.assistActive" class="grid grid-cols-2 gap-2">
      <div class="tns-stat-tile col-span-2">
        <span class="tns-stat-label">{{ $t('plugins.aapa.assist.phaseLabel') }}</span>
        <span class="tns-stat-value">{{ phaseText }}</span>
      </div>
      <template v-if="store.lastTppaReading">
        <div class="tns-stat-tile">
          <span class="tns-stat-label">{{ $t('plugins.aapa.assist.azError') }}</span>
          <span class="tns-stat-value">{{ formatDeg(store.lastTppaReading.azDeg) }}</span>
        </div>
        <div class="tns-stat-tile">
          <span class="tns-stat-label">{{ $t('plugins.aapa.assist.altError') }}</span>
          <span class="tns-stat-value">{{ formatDeg(store.lastTppaReading.altDeg) }}</span>
        </div>
      </template>
    </div>

    <Modal :show="showSettings" @close="closeSettings">
      <template #header>
        <h2 class="text-xl font-bold">{{ $t('plugins.aapa.assist.tppaSettings') }}</h2>
      </template>
      <template #body>
        <PinsTppaSettings v-if="api.isPINS" />
        <TppaSettings v-else />
      </template>
    </Modal>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Cog6ToothIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import TppaSettings from '@/components/tppa/TppaSettings.vue';
import PinsTppaSettings from '@/components/tppa/PinsTppaSettings.vue';
import { apiStore } from '@/store/store';
import { useTppaStore } from '@/store/tppaStore';
import { useAapaStore } from '../store/aapaStore';

const { t } = useI18n();
const store = useAapaStore();
const api = apiStore();
const tppaStore = useTppaStore();
const showSettings = ref(false);

const canStart = computed(
  () =>
    store.deviceConnected &&
    api.isTnsPluginConnected &&
    !store.assistActive &&
    !store.server?.isBusy &&
    !store.runState.autoPilotRunning &&
    !store.runState.calibrationRunning
);

const startLabel = computed(() =>
  store.assistActive ? t('plugins.aapa.assist.running') : t('plugins.aapa.assist.start')
);

const phaseText = computed(() => {
  if (store.assist === 'running' && store.runState.autoPilotIteration) {
    return t('plugins.aapa.status.iteration', { n: store.runState.autoPilotIteration });
  }
  if (store.assist === 'running' && store.tppaStatus) return store.tppaStatus;
  return t(`plugins.aapa.assist.phase.${store.assist}`);
});

function formatDeg(value) {
  if (!Number.isFinite(value)) return '–';
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}°`;
}

function openSettings() {
  // The rig-shared settings normally load with the connection; retry if that failed.
  if (!tppaStore.settingsReady) tppaStore.loadTppaSettings();
  showSettings.value = true;
}

function closeSettings() {
  showSettings.value = false;
  // The TPPA page saves through its own watcher, which does not run here.
  if (tppaStore.settingsReady) tppaStore.saveSettings();
}
</script>
