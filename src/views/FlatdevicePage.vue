<template>
  <div>
    <SubNav
      :items="[
        { name: $t('components.flat.title'), value: 'showFlat' },
        { name: $t('components.flat.settings.title'), value: 'showSettings' },
      ]"
      v-model:activeItem="currentTab"
    >
      <template #icon-showFlat>
        <EyeIcon class="w-4 h-4" />
      </template>
      <template #icon-showSettings>
        <Cog6ToothIcon class="w-4 h-4" />
      </template>
    </SubNav>

    <DeviceNotConnected
      v-if="!store.flatdeviceInfo.Connected"
      messageKey="components.flat.please_connect_flatDevice"
    />
    <div v-else class="container flex items-center justify-center pt-4">
      <div class="container max-w-3xl">
        <!-- Flat Tab -->
        <Transition name="slide-in" mode="out-in">
          <div v-if="currentTab === 'showFlat'" class="mt-4" key="flat">
            <div>
              <InfoFlatdevice compact class="p-3 bg-surface-1 rounded-card border border-line" />
            </div>
            <div class="mt-4 tns-card">
              <controlFlatdevice class="w-full" />
            </div>
          </div>
        </Transition>

        <!-- Settings Tab -->
        <Transition name="slide-in" mode="out-in">
          <div v-if="currentTab === 'showSettings'" class="mt-4" key="settings">
            <FlatdeviceSettingsPanel />
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import DeviceNotConnected from '@/components/helpers/DeviceNotConnected.vue';
import { ref } from 'vue';
import { EyeIcon, Cog6ToothIcon } from '@heroicons/vue/24/outline';
import InfoFlatdevice from '@/components/flatdevice/InfoFlatdevice.vue';
import controlFlatdevice from '@/components/flatdevice/controlFlatdevice.vue';
import FlatdeviceSettingsPanel from '@/components/flatdevice/FlatdeviceSettingsPanel.vue';
import SubNav from '@/components/SubNav.vue';
import { apiStore } from '@/store/store';

const store = apiStore();
const currentTab = ref('showFlat');
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
