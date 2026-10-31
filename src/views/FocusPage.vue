<template>
  <div
    class="focus-page min-h-screen"
    :style="
      (imageStore.imageData && store.focuserAfInfo.autofocus_running) || !delayShowGraph
        ? `background-image: url(${imageStore.imageData}); background-size: cover; background-position: center; background-repeat: no-repeat;`
        : ''
    "
  >
    <SubNav :items="navItems" v-model:activeItem="currentTab">
      <template #icon-showFocus>
        <EyeIcon class="w-4 h-4" />
      </template>
      <template #icon-showSettings>
        <Cog6ToothIcon class="w-4 h-4" />
      </template>
    </SubNav>

    <!-- Hocus Focus tools: wide layout, their components check the equipment themselves. Each
         mounts only while its tab is active, so the inspector's polling stops elsewhere. -->
    <div v-if="isHfTab" class="container mt-4">
      <div class="max-w-7xl mx-auto">
        <HfInspectorPanel v-if="currentTab === 'showInspector'" />
        <HocusFocusTilterPanel v-else-if="currentTab === 'showTilter'" />
      </div>
    </div>

    <div v-else class="container flex items-center justify-center">
      <div class="w-full max-w-6xl mx-auto">
        <!-- Focus Tab: the only one that needs the focuser; the settings are profile values -->
        <div
          v-if="currentTab === 'showFocus' && !store.focuserInfo.Connected"
          class="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
        >
          <p class="text-red-400 font-medium text-center">
            {{ $t('components.focuser.please_connect_focuser') }}
          </p>
        </div>
        <Transition name="slide-in" mode="out-in">
          <div
            v-if="currentTab === 'showFocus' && store.focuserInfo.Connected"
            class="mt-4"
            key="focus"
          >
            <infoFocuser
              v-model="store.focuserInfo.Connected"
              compact
              class="p-3 bg-surface-1 rounded-card border border-line"
            />
            <HfRunAdvice v-if="hfStore.available" class="mt-4" />
            <div class="mt-4">
              <FocusMainPanel />
            </div>
          </div>
        </Transition>

        <!-- Settings Tab -->
        <Transition name="slide-in" mode="out-in">
          <div v-if="currentTab === 'showSettings'" class="mt-4" key="settings">
            <!-- One set of sub-tabs for NINA and PINS; with Hocus Focus its fields replace the
                 NINA values it duplicates. -->
            <FocusSettingsPanel @open-assistant="showAssistant = true" />
          </div>
        </Transition>
      </div>
    </div>

    <HfSetupAssistant
      v-if="hfStore.available"
      :show="showAssistant"
      @close="showAssistant = false"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
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
import { useHocusFocusStore } from '@/store/hocusFocusStore';
import HfRunAdvice from '@/components/focuser/hocus/HfRunAdvice.vue';
import HfSetupAssistant from '@/components/focuser/hocus/HfSetupAssistant.vue';
import HfInspectorPanel from '@/components/focuser/hocus/HfInspectorPanel.vue';
import HocusFocusTilterPanel from '@/components/focuser/hocus/HocusFocusTilterPanel.vue';

const { t } = useI18n();
const store = apiStore();
const imageStore = useImagetStore();
const focuserStore = useFocuserStore();
const hfStore = useHocusFocusStore();
// Without a focuser the focus tab has nothing to offer: start on the settings instead
const currentTab = ref(store.focuserInfo.Connected ? 'showFocus' : 'showSettings');
const delayShowGraph = ref(false);
const showAssistant = ref(false);

// Hocus Focus tools, each a tab of its own next to the shared settings
const HF_TABS = [
  { value: 'showInspector', labelKey: 'aberration' },
  { value: 'showTilter', labelKey: 'tilter' },
];

const navItems = computed(() => [
  { name: t('components.focuser.title'), value: 'showFocus' },
  { name: t('components.focuser.settings.title'), value: 'showSettings' },
  ...(hfStore.available
    ? HF_TABS.map((tab) => ({
        name: t(`components.focuser.hocus.tabs.${tab.labelKey}`),
        value: tab.value,
      }))
    : []),
]);
const isHfTab = computed(
  () => hfStore.available && HF_TABS.some((tab) => tab.value === currentTab.value)
);

// Re-probe on every (re)connect and once the PINS check resolved: an instance switch can land on
// a backend with or without Hocus Focus.
watch(
  () => [store.isPINS, store.connectionEpoch],
  () => hfStore.checkAvailability(),
  { immediate: true }
);
watch(
  () => hfStore.available,
  (available) => {
    if (!available && HF_TABS.some((tab) => tab.value === currentTab.value)) {
      currentTab.value = 'showFocus';
    }
  }
);

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
