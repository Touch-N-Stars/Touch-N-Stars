<template>
  <div class="filterwheel-page">
    <SubNav
      :items="[
        { name: t('components.filterwheel.title'), value: 'showFilterwheel' },
        { name: t('components.filterwheel.settings.title'), value: 'showSettings' },
      ]"
      v-model:activeItem="currentTab"
    />
    <div class="container py-4 flex items-center justify-center">
      <div class="container max-w-3xl">
        <h5 class="text-xl text-center font-bold text-white mb-4">
          {{ $t('components.filterwheel.title') }}
        </h5>
        <DeviceNotConnected
          v-if="!store.filterInfo.Connected && currentTab === 'showFilterwheel'"
          messageKey="components.filterwheel.please_connect_filterwheel"
        />

        <Transition name="slide-in" mode="out-in">
          <div
            v-if="currentTab === 'showFilterwheel' && store.filterInfo.Connected"
            key="filterwheel-tab"
          >
            <div>
              <InfoFilterwheel
                compact
                class="mt-4 p-3 bg-surface-1 rounded-card border border-line"
              />
            </div>

            <div class="mt-4 tns-card">
              <strong>{{ $t('components.filterwheel.filter') }}</strong>
              <changeFilter />
              <PinsSettingToggle
                v-if="store.isPINS"
                class="mt-2"
                device="filter"
                settingName="Unidirectional"
                labelKey="components.filterwheel.Unidirectional"
              />
            </div>
          </div>
        </Transition>

        <Transition name="slide-in" mode="out-in">
          <div v-if="currentTab === 'showSettings'" key="settings-tab">
            <div class="mt-4 tns-card p-0!">
              <div class="container pl-5 pb-5 pr-5">
                <div class="mt-5">
                  <FilterSettings />
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
<script setup>
import DeviceNotConnected from '@/components/helpers/DeviceNotConnected.vue';
import { ref } from 'vue';
import changeFilter from '@/components/filterwheel/changeFilter.vue';
import InfoFilterwheel from '@/components/filterwheel/InfoFilterwheel.vue';
import FilterSettings from '@/components/filterwheel/settings/FilterSettings.vue';
import PinsSettingToggle from '@/components/helpers/settings/PinsSettingToggle.vue';
import SubNav from '@/components/SubNav.vue';
import { apiStore } from '@/store/store';
import { useFilterStore } from '@/store/filterStore';
import { useI18n } from 'vue-i18n';
import { usePolling } from '@/composables/usePolling';

const { t } = useI18n();
const store = apiStore();
const filterStore = useFilterStore();
const currentTab = ref('showFilterwheel');

usePolling(() => filterStore.readSettings(), 2000);
</script>

<style scoped>
.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-in-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-in-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.slide-in-enter-to,
.slide-in-leave-from {
  opacity: 1;
  transform: translateX(0);
}
</style>
