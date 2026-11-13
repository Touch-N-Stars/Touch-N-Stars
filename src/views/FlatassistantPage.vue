<template>
  <div>
    <!-- Titel -->
    <div class="text-left mb-2">
      <h1 class="text-xl text-center font-bold">{{ $t('components.flatassistant.title') }}</h1>
    </div>

    <SubNav
      v-if="multiModeAvailable"
      :items="[
        { name: t('components.flatassistant.single_mode'), value: 'single' },
        { name: t('components.flatassistant.multi_mode'), value: 'multi' },
      ]"
      v-model:activeItem="settingsStore.flats.activeMode"
    />

    <div class="flex flex-col items-center justify-center max-w-md p-2 mx-auto">
      <SlewToZenith />

      <setTargetName
        v-if="
          store.isPINS || store.checkVersionNewerOrEqual(store.currentTnsPluginVersion, '1.3.1.0')
        "
      />

      <!-- Single Mode: sub-type selector -->
      <select
        v-if="settingsStore.flats.activeMode === 'single'"
        v-model="settingsStore.flats.selectedOption"
        class="p-2 w-full border border-line-strong rounded-lg bg-surface-2 text-white"
      >
        <option value="AutoExposure">{{ $t('components.flatassistant.auto_exposure') }}</option>
        <option value="AutoBrightness">{{ $t('components.flatassistant.auto_brightness') }}</option>
        <option value="SkyFlat">{{ $t('components.flatassistant.skyflat') }}</option>
      </select>

      <!-- Single Mode content -->
      <component
        v-if="settingsStore.flats.activeMode === 'single'"
        :is="selectedComponent"
        class="mt-4"
      />

      <!-- Multi Mode content -->
      <MultiMode v-else />

      <div
        v-show="
          flatsStore.status.State === 'Running' ||
          flatsStore.status.State === 'Finished' ||
          flatsStore.lastRun !== null
        "
        class="flex flex-col w-full max-w-md space-y-2 mt-4 tns-card"
      >
        <getStatus />
        <LastImage />
      </div>
    </div>

    <div class="p-10"></div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import AutoExposure from '@/components/flatassistant/AutoExposure.vue';
import AutoBrightness from '@/components/flatassistant/AutoBrightness.vue';
import SkyFlat from '@/components/flatassistant/SkyFlat.vue';
import MultiMode from '@/components/flatassistant/MultiMode.vue';
import getStatus from '@/components/flatassistant/getStatus.vue';
import LastImage from '@/components/flatassistant/LastImage.vue';
import SlewToZenith from '@/components/flatassistant/SlewToZenith.vue';
import setTargetName from '@/components/flatassistant/setTargetName.vue';
import SubNav from '@/components/SubNav.vue';
import { useFlatassistantStore } from '@/store/flatassistantStore';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import { useI18n } from 'vue-i18n';

const flatsStore = useFlatassistantStore();
const settingsStore = useSettingsStore();
const store = apiStore();
const { t } = useI18n();

const selectedComponent = computed(() => {
  switch (settingsStore.flats.selectedOption) {
    case 'AutoBrightness':
      return AutoBrightness;
    case 'SkyFlat':
      return SkyFlat;
    default:
      return AutoExposure;
  }
});

// Multi mode runs in the plugin (NINA and PINS); with an older plugin only PINS has it,
// driven by the app's own per-filter loop.
const multiModeAvailable = computed(() => store.isPINS || flatsStore.serverWorkflow === true);

onMounted(async () => {
  await flatsStore.detectServerWorkflow();
  if (!multiModeAvailable.value) {
    settingsStore.flats.activeMode = 'single';
  }
});

let saveDebounce;
watch(
  () => settingsStore.flats,
  () => {
    clearTimeout(saveDebounce);
    saveDebounce = setTimeout(() => settingsStore.saveFlatsSettings(), 600);
  },
  { deep: true }
);

watch(
  () => store.profileInfo?.FlatWizardSettings,
  (flatSettings) => {
    if (!flatSettings) return;
    flatsStore.count = flatSettings.FlatCount ?? flatsStore.count;
    // Same condition as multi mode: dark flats need the plugin-side run or PINS.
    flatsStore.darkCount = multiModeAvailable.value ? (flatSettings.DarkFlatCount ?? 0) : 0;
  },
  { immediate: true }
);
</script>
