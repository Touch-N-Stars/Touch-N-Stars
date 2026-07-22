<template>
  <div
    class="focus-page min-h-screen"
    :style="
      (imageStore.imageData && store.focuserAfInfo.autofocus_running) || !delayShowGraph
        ? `background-image: url(${imageStore.imageData}); background-size: cover; background-position: center; background-repeat: no-repeat;`
        : ''
    "
  >
    <SubNav
      :items="[
        { name: t('components.focuser.title'), value: 'showFocus' },
        { name: t('components.focuser.settings.title'), value: 'showSettings' },
      ]"
      v-model:activeItem="currentTab"
    >
      <template #icon-showFocus>
        <EyeIcon class="w-4 h-4" />
      </template>
      <template #icon-showSettings>
        <Cog6ToothIcon class="w-4 h-4" />
      </template>
    </SubNav>

    <div class="text-left mb-2">
      <h1 class="text-xl text-center font-bold">{{ $t('components.focuser.title') }}</h1>
    </div>
    <div
      v-if="!store.focuserInfo.Connected"
      class="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
    >
      <p class="text-red-400 font-medium text-center">
        {{ $t('components.focuser.please_connect_focuser') }}
      </p>
    </div>
    <div v-else class="container flex items-center justify-center">
      <div class="container max-w-md landscape:max-w-xl">
        <!-- Focus Tab -->
        <Transition name="slide-in" mode="out-in">
          <div v-if="currentTab === 'showFocus'" class="mt-4" key="focus">
            <infoFocuser
              v-model="store.focuserInfo.Connected"
              compact
              class="p-3 bg-surface-1 rounded-card border border-line"
            />
            <div class="mt-4">
              <FocusMainPanel />
            </div>
          </div>
        </Transition>

        <!-- Settings Tab -->
        <Transition name="slide-in" mode="out-in">
          <div v-if="currentTab === 'showSettings'" class="mt-4" key="settings">
            <FocusSettingsPanel />
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { EyeIcon, Cog6ToothIcon } from '@heroicons/vue/24/outline';
import infoFocuser from '@/components/focuser/infoFocuser.vue';
import FocusMainPanel from '@/components/focuser/FocusMainPanel.vue';
import FocusSettingsPanel from '@/components/focuser/FocusSettingsPanel.vue';
import SubNav from '@/components/SubNav.vue';
import { apiStore } from '@/store/store';
import { useImagetStore } from '@/store/imageStore';
import { useFocuserStore } from '@/store/focuserStore';
import { usePolling } from '@/composables/usePolling';

const { t } = useI18n();
const store = apiStore();
const imageStore = useImagetStore();
const focuserStore = useFocuserStore();
const currentTab = ref('showFocus');
const delayShowGraph = ref(false);

usePolling(() => focuserStore.readSettings(), 2000);
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
