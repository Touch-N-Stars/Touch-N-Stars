<template>
  <div class="relative inline-block">
    <button
      class="flex items-center justify-center p-1 w-10 h-10 rounded-full mr-2 bg-gray-600 text-white border border-gray-400 z-top"
      @click="showConfiguration = !showConfiguration"
    >
      <Cog6ToothIcon class="w-6 h-6" />
    </button>

    <!-- Above the control bar (z-50) -->
    <Modal :show="showConfiguration" z-index="z-[60]" @close="showConfiguration = false">
      <template #header>
        <h2 class="text-xl font-bold">{{ t('plugins.livestack.configuration_title') }}</h2>
      </template>

      <template #body>
        <div class="flex flex-col gap-4 w-full">
          <!-- The modal body scrolls; long tabs (calibration) must not push the tabs out of view -->
          <div v-if="tabs.length > 1" class="sticky top-0 z-10">
            <SegmentTabs v-model="activeTab" :tabs="tabs" />
          </div>

          <section v-if="activeTab === 'display'" class="tns-card flex flex-col gap-3">
            <div class="flex items-center justify-between gap-3 min-h-touch">
              <label for="toggle_osc_components" class="text-sm font-medium text-content">
                {{ t('plugins.livestack.show_rgb_only') }}
              </label>
              <toggleButton
                id="toggle_osc_components"
                :status-value="!store.showFilters"
                @click="store.toogleShowFilters()"
              />
            </div>
            <div class="flex items-center justify-between gap-3 min-h-touch">
              <label for="toggle_tracking_stacks" class="text-sm font-medium text-content">
                {{ t('plugins.livestack.track_stack_updates') }}
              </label>
              <toggleButton
                id="toggle_tracking_stacks"
                :status-value="store.isTrackingStacks"
                @click="store.setTrackingStacks(!store.isTrackingStacks)"
              />
            </div>
          </section>

          <LivestackRgbCombination v-if="activeTab === 'rgb'" />

          <!-- The Livestack plugin's own options. Only on PINS - on Windows NINA they are on
               the plugin's options page. Stays mounted across its tabs so a pending number
               edit is still stored when the tab changes. -->
          <LivestackPluginSettings
            v-if="apiState.isPINS"
            v-show="PLUGIN_SECTIONS.includes(activeTab)"
            :section="activeTab"
          />
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { Cog6ToothIcon } from '@heroicons/vue/24/outline';
import toggleButton from '@/components/helpers/toggleButton.vue';
import Modal from '@/components/helpers/Modal.vue';
import SegmentTabs from '@/components/helpers/SegmentTabs.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useLivestackStore } from '../store/livestackStore.js';
import LivestackPluginSettings from './LivestackPluginSettings.vue';
import LivestackRgbCombination from './LivestackRgbCombination.vue';

const PLUGIN_SECTIONS = ['storage', 'calibration', 'output', 'defaults'];

const showConfiguration = ref(false);
const activeTab = ref('display');
const store = useLivestackStore();
const apiState = apiStore();
const { t } = useI18n();

const tabs = computed(() => {
  const list = [{ value: 'display', label: t('plugins.livestack.settings.tabs.display') }];
  if (apiState.isPINS) {
    list.push(
      { value: 'rgb', label: t('plugins.livestack.rgb.title') },
      { value: 'storage', label: t('plugins.livestack.settings.storage.title') },
      { value: 'calibration', label: t('plugins.livestack.settings.calibration.title') },
      { value: 'output', label: t('plugins.livestack.settings.output.title') },
      { value: 'defaults', label: t('plugins.livestack.settings.tabs.defaults') }
    );
  }
  return list;
});

// A runtime-mode change can drop the active tab
watch(tabs, (list) => {
  if (!list.some((tab) => tab.value === activeTab.value)) {
    activeTab.value = list[0].value;
  }
});
</script>
