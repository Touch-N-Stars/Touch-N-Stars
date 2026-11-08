<template>
  <div class="min-h-screen">
    <SubNav v-if="store.isPINS" :items="pinsNavItems" v-model:activeItem="activeTab" class="z-20" />

    <div class="p-4 max-w-4xl mx-auto space-y-6">
      <div class="p-0 sm:p-4 w-full">
        <h5
          class="text-2xl text-center font-bold text-content mb-2 flex items-center justify-center gap-3"
        >
          <span>{{ $t('plugins.pins.title') }}</span>
        </h5>

        <button
          v-if="store.isPINS"
          class="tns-btn-secondary mb-4"
          @click="settingsStore.resetSetupWizard()"
        >
          {{ $t('components.setupWizard.restart') }}
        </button>

        <!--
          The tabs stay mounted (v-show) so a running job keeps its log stream when the user
          switches tabs, and so upgrade tracking survives the service restart that briefly
          drops PINS detection.
        -->
        <div v-show="store.isPINS" class="flex flex-col space-y-6 animate-fade-in-up">
          <PinsNetworkTab v-show="activeTab === 'network'" />
          <PinsServicesTab v-show="activeTab === 'services'" />
          <PinsSystemTab v-show="activeTab === 'system'" />
          <PinsIndiTab v-show="activeTab === 'indi'" />
          <PinsSoftwareTab v-show="activeTab === 'software'" />
          <PinsUpgradeTab v-show="activeTab === 'upgrade'" />
        </div>

        <div
          v-if="!store.isPINS"
          class="border border-status-danger/40 bg-status-danger/10 rounded-card p-8 text-center animate-fade-in-up"
        >
          <svg
            class="w-16 h-16 text-status-danger mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 class="text-xl font-bold text-status-danger mb-2">{{ $t('plugins.pins.title') }}</h3>
          <p class="text-content-muted">{{ $t('plugins.pins.notDetected') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import SubNav from '@/components/SubNav.vue';
import PinsNetworkTab from '@/components/pins/tabs/PinsNetworkTab.vue';
import PinsServicesTab from '@/components/pins/tabs/PinsServicesTab.vue';
import PinsSystemTab from '@/components/pins/tabs/PinsSystemTab.vue';
import PinsIndiTab from '@/components/pins/tabs/PinsIndiTab.vue';
import PinsSoftwareTab from '@/components/pins/tabs/PinsSoftwareTab.vue';
import PinsUpgradeTab from '@/components/pins/tabs/PinsUpgradeTab.vue';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const store = apiStore();

const activeTab = ref('network');

const pinsNavItems = computed(() => [
  { name: t('plugins.pins.tabs.network'), value: 'network' },
  { name: t('plugins.pins.tabs.services'), value: 'services' },
  { name: t('plugins.pins.tabs.system'), value: 'system' },
  { name: t('plugins.pins.tabs.indi'), value: 'indi' },
  { name: t('plugins.pins.tabs.software'), value: 'software' },
  { name: t('plugins.pins.tabs.upgrade'), value: 'upgrade' },
]);
</script>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.5s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
