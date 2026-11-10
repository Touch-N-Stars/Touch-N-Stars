<template>
  <div>
    <SubNav
      :items="[
        { name: t('components.rotator.title'), value: 'showRotator' },
        { name: t('components.rotator.settings.title'), value: 'showSettings' },
      ]"
      v-model:activeItem="currentTab"
    >
      <template #icon-showRotator>
        <EyeIcon class="w-4 h-4" />
      </template>
      <template #icon-showSettings>
        <Cog6ToothIcon class="w-4 h-4" />
      </template>
    </SubNav>

    <DeviceNotConnected
      v-if="!store.rotatorInfo.Connected"
      messageKey="components.rotator.please_connect_rotator"
    />
    <div v-else class="container flex items-center justify-center pt-4">
      <div class="container max-w-3xl">
        <!-- Rotator Tab -->
        <Transition name="slide-in" mode="out-in">
          <div v-if="currentTab === 'showRotator'" class="mt-4" key="rotator">
            <div>
              <infoRotator compact class="p-3 bg-surface-1 rounded-card border border-line" />
            </div>
            <div class="mt-4 tns-card">
              <strong>{{ $t('components.rotator.control') }}</strong>
              <controlRotator />
            </div>
          </div>
        </Transition>

        <!-- Settings Tab -->
        <Transition name="slide-in" mode="out-in">
          <div v-if="currentTab === 'showSettings'" class="mt-4" key="settings">
            <RotatorSettingsPanel />
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
<script setup>
import DeviceNotConnected from '@/components/helpers/DeviceNotConnected.vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { EyeIcon, Cog6ToothIcon } from '@heroicons/vue/24/outline';
import controlRotator from '@/components/rotator/controlRotator.vue';
import infoRotator from '@/components/rotator/infoRotator.vue';
import RotatorSettingsPanel from '@/components/rotator/RotatorSettingsPanel.vue';
import SubNav from '@/components/SubNav.vue';
import { apiStore } from '@/store/store';

const { t } = useI18n();
const store = apiStore();
const currentTab = ref('showRotator');
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
