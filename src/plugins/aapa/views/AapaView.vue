<template>
  <div class="container mx-auto p-2 sm:p-4 max-w-3xl space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-xl sm:text-2xl font-bold text-content">{{ $t('plugins.aapa.title') }}</h1>
      <span class="flex items-center gap-2 text-sm text-content-muted">
        <span class="tns-dot" :class="wsDotClass"></span>
        {{ $t(`plugins.aapa.ws.${store.wsStatus}`) }}
      </span>
    </div>

    <section v-if="!store.isWsOpen" class="tns-card space-y-3">
      <p v-if="store.wsStatus === 'closed'" class="text-sm text-status-warn">
        {{ $t('plugins.aapa.ws.unreachable', { url: store.wsUrl }) }}
      </p>
      <ul class="text-xs text-content-faint list-disc pl-5 space-y-1">
        <li>{{ $t('plugins.aapa.ws.checkPlugin') }}</li>
        <li>{{ $t('plugins.aapa.ws.checkEnabled') }}</li>
        <li>{{ $t('plugins.aapa.ws.checkFirewall') }}</li>
      </ul>
      <AapaWsPortField />
    </section>

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
        @click="activeTab = tab"
      >
        {{ $t(`plugins.aapa.tabs.${tab}`) }}
      </button>
    </nav>

    <template v-if="activeTab === 'control'">
      <AapaConnectionCard />
      <AapaStatusCard v-if="store.deviceConnected" />
      <AapaAutoPilotCard />
      <AapaManualCard />
    </template>
    <AapaCalibrationCard v-else-if="activeTab === 'calibration'" />
    <template v-else-if="activeTab === 'settings'">
      <AapaSettingsCard />
      <section v-if="store.isWsOpen" class="tns-card">
        <AapaWsPortField />
      </section>
    </template>
    <AapaLogCard v-else />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useAapaStore } from '../store/aapaStore';
import AapaConnectionCard from '../components/AapaConnectionCard.vue';
import AapaStatusCard from '../components/AapaStatusCard.vue';
import AapaAutoPilotCard from '../components/AapaAutoPilotCard.vue';
import AapaManualCard from '../components/AapaManualCard.vue';
import AapaCalibrationCard from '../components/AapaCalibrationCard.vue';
import AapaSettingsCard from '../components/AapaSettingsCard.vue';
import AapaLogCard from '../components/AapaLogCard.vue';
import AapaWsPortField from '../components/AapaWsPortField.vue';

const TABS = ['control', 'calibration', 'settings', 'log'];

const store = useAapaStore();
const activeTab = ref('control');

const wsDotClass = computed(() => {
  if (store.wsStatus === 'open') return 'bg-status-ok';
  if (store.wsStatus === 'closed') return 'bg-status-danger';
  return 'bg-status-warn';
});

// The socket only lives while this page is shown, so the plugin costs nothing
// in the background.
onMounted(() => store.start());
onUnmounted(() => store.stop());
</script>
