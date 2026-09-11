<template>
  <CustomizationList
    :title="$t('components.settings.statusBarCustomization.title')"
    :hint="$t('components.settings.statusBarCustomization.hint')"
    :items="orderedItems"
    :hiddenIds="settingsStore.statusbar?.hiddenItems ?? []"
    @reorder="settingsStore.setStatusBarOrder($event)"
    @toggle="settingsStore.toggleStatusBarItem($event)"
  />
</template>

<script setup>
import { computed } from 'vue';
import { useSettingsStore } from '@/store/settingsStore';
import CustomizationList from './CustomizationList.vue';

const settingsStore = useSettingsStore();

// Ids match the chips in StatusBar.vue. Chips only appear in the bar when their
// device is connected; they stay listed here so they can be pre-configured.
const STATUS_BAR_ITEMS = [
  { id: 'screenlock', labelKey: 'components.statusBar.labels.screenlock' },
  { id: 'camera', labelKey: 'components.statusBar.labels.camera' },
  { id: 'guider', labelKey: 'components.statusBar.labels.guiding' },
  { id: 'mount', labelKey: 'components.statusBar.labels.mount' },
  { id: 'filter', labelKey: 'components.statusBar.labels.filter' },
  { id: 'switch', labelKey: 'components.statusBar.labels.switch' },
  { id: 'weather', labelKey: 'components.statusBar.labels.weather' },
  { id: 'safety', labelKey: 'components.statusBar.labels.safety' },
  { id: 'progress', labelKey: 'components.statusBar.labels.progress' },
  { id: 'log', labelKey: 'components.statusBar.labels.log' },
  { id: 'instance', labelKey: 'components.statusBar.labels.instance' },
];

const orderedItems = computed(() => {
  const order = settingsStore.statusbar?.itemOrder ?? STATUS_BAR_ITEMS.map((i) => i.id);
  const inOrder = order.map((id) => STATUS_BAR_ITEMS.find((i) => i.id === id)).filter(Boolean);
  const remaining = STATUS_BAR_ITEMS.filter((i) => !order.includes(i.id));
  return [...inOrder, ...remaining];
});
</script>
