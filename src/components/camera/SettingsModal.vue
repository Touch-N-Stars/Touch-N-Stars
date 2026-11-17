<template>
  <div>
    <!-- Tab-Leiste: nur anzeigen wenn mehr als ein Tab verfügbar -->
    <div
      v-if="visibleTabs.length > 1"
      class="sticky top-0 z-10 flex border-b border-line mb-2 bg-surface-1"
    >
      <button
        v-for="tab in visibleTabs"
        :key="tab.value"
        class="px-4 py-2 text-sm font-semibold transition"
        :class="
          activeTab === tab.value
            ? 'text-white border-b-2 border-accent'
            : 'text-content-muted hover:text-white'
        "
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <settingsCamera
      v-show="activeTab === 'camera'"
      class="p-4 bg-surface-2/50 rounded-lg border border-line/50"
    />
    <settingsCameraCooler
      v-if="store.cameraInfo.CanSetTemperature"
      v-show="activeTab === 'cooler'"
      class="p-4 bg-surface-2/50 rounded-lg border border-line/50"
    />
    <div v-if="store.filterInfo.Connected" v-show="activeTab === 'filter'">
      <changeFilter class="p-4 bg-surface-2/50 rounded-lg border border-line/50" />
    </div>
    <div
      v-show="activeTab === 'snapshot'"
      class="p-4 bg-surface-2/50 rounded-lg border border-line/50 flex flex-col gap-2"
    >
      <setSolve />
      <setSaveSnapshot />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import settingsCameraCooler from './settingsCameraCooler.vue';
import changeFilter from '../filterwheel/changeFilter.vue';
import settingsCamera from './settingsCamera.vue';
import setSolve from './setSolve.vue';
import setSaveSnapshot from './setSaveSnapshot.vue';

const { t } = useI18n();
const store = apiStore();
const activeTab = ref('camera');

const visibleTabs = computed(() => {
  const tabs = [{ value: 'camera', label: t('components.camera.tab_camera') }];
  if (store.cameraInfo.CanSetTemperature) {
    tabs.push({ value: 'cooler', label: t('components.camera.tab_cooler') });
  }
  if (store.filterInfo.Connected) {
    tabs.push({ value: 'filter', label: t('components.camera.tab_filter') });
  }
  tabs.push({ value: 'snapshot', label: t('components.camera.tab_snapshot') });
  return tabs;
});
</script>
