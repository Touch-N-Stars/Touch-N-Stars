<template>
  <!-- No own background: on the settings page the stage provides the ground,
       in the splash settings modal the Modal component provides its surface. -->
  <div class="min-h-screen">
    <SubNav
      v-if="store.isBackendReachable"
      :items="subNavItems"
      :activeItem="activeTab"
      @update:activeItem="selectTab"
    />

    <div class="p-4 max-w-4xl mx-auto space-y-6">
      <!-- Connection & Location Tab -->
      <SettingsConnectionTab v-if="activeTab === 'connection'" />

      <!-- Interface Tab -->
      <SettingsInterfaceTab v-if="activeTab === 'interface'" />

      <!-- Equipment Tab -->
      <SettingsEquipmentTab v-if="activeTab === 'equipment'" />

      <!-- Plugins Tab -->
      <SettingsPluginsTab v-if="activeTab === 'plugins'" />

      <!-- Plate Solver Tab -->
      <SettingsPlateSolverTab v-if="activeTab === 'plateSolver'" />

      <!-- Image Tab -->
      <SettingsImageTab v-if="activeTab === 'image'" />

      <!-- Meridian Flip Tab -->
      <SettingsMeridianFlipTab v-if="activeTab === 'meridianFlip'" />

      <!-- System Tab -->
      <SettingsSystemTab
        v-if="activeTab === 'system'"
        @show-tutorial="showTutorial"
        @restart-system="restartSystem"
        @shutdown-system="shutdownSystem"
      />
    </div>
  </div>

  <!-- Tutorial Modal -->
  <TutorialModal v-if="showTutorialModal" :steps="tutorialSteps" @close="closeTutorial" />

  <!-- Restart / shutdown confirmation and progress -->
  <SystemPowerModal v-if="powerAction" :initialAction="powerAction" @close="powerAction = null" />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import TutorialModal from '@/components/TutorialModal.vue';
import SubNav from '@/components/SubNav.vue';
import SettingsConnectionTab from '@/components/settings/SettingsConnectionTab.vue';
import SettingsInterfaceTab from '@/components/settings/SettingsInterfaceTab.vue';
import SettingsSystemTab from '@/components/settings/SettingsSystemTab.vue';
import SettingsPluginsTab from '@/components/settings/SettingsPluginsTab.vue';
import SettingsPlateSolverTab from '@/components/settings/SettingsPlateSolverTab.vue';
import SettingsEquipmentTab from '@/components/settings/SettingsEquipmentTab.vue';
import SettingsImageTab from '@/components/settings/SettingsImageTab.vue';
import SettingsMeridianFlipTab from '@/components/settings/SettingsMeridianFlipTab.vue';
import { usePluginStore } from '@/store/pluginStore';
import SystemPowerModal from '@/components/system/SystemPowerModal.vue';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const store = apiStore();
const router = useRouter();
const pluginStore = usePluginStore();

const emit = defineEmits(['navigate']);

const activeTab = ref('connection');

const subNavItems = computed(() => [
  { name: t('components.settings.tabs.connection'), value: 'connection' },
  { name: t('components.settings.tabs.interface'), value: 'interface' },
  { name: t('components.settings.image.title'), value: 'image' },
  { name: t('components.settings.equipment.title'), value: 'equipment' },
  { name: t('components.settings.plugins.title'), value: 'plugins' },
  { name: t('components.settings.plate_solver.title'), value: 'plateSolver' },
  { name: t('components.mount.settings.meridian_flip_settings'), value: 'meridianFlip' },
  { name: t('components.settings.tabs.system'), value: 'system' },
  // The PINS device settings live on their own page; this entry only links there.
  ...(store.isPINS ? [{ name: t('nav.pins'), value: 'pins' }] : []),
]);

function selectTab(value) {
  if (value === 'pins') {
    router.push('/pins');
    // Lets the settings modal close itself instead of covering the PINS page.
    emit('navigate');
    return;
  }
  activeTab.value = value;
}

const showTutorialModal = ref(false);
const tutorialSteps = computed(() => settingsStore.tutorial.steps);
const powerAction = ref(null);

onMounted(async () => {
  await pluginStore.loadAndRegisterPlugins(true);
});

function showTutorial() {
  showTutorialModal.value = true;
  settingsStore.resetTutorial();
}

function closeTutorial() {
  showTutorialModal.value = false;
  settingsStore.completeTutorial();
}

function restartSystem() {
  powerAction.value = 'restart';
}

function shutdownSystem() {
  powerAction.value = 'shutdown';
}
</script>
