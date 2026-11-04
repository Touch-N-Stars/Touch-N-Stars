<template>
  <CustomizationList
    :title="$t('components.settings.navbarCustomization.title')"
    :hint="$t('components.settings.navbarCustomization.hint')"
    :items="orderedItems"
    :hiddenIds="settingsStore.navbar?.hiddenItems ?? []"
    @reorder="onReorder"
    @toggle="settingsStore.toggleNavbarItem($event)"
  />
</template>

<script setup>
import { computed } from 'vue';
import { useSettingsStore } from '@/store/settingsStore';
import { usePluginStore } from '@/store/pluginStore';
import { apiStore } from '@/store/store';
import { isNavItemInMode, mergeSubsetOrder } from '@/utils/appMode';
import CustomizationList from './CustomizationList.vue';

const settingsStore = useSettingsStore();
const pluginStore = usePluginStore();
const store = apiStore();

const STATIC_NAV_ITEMS = [
  { id: 'equipment', labelKey: 'nav.equipment' },
  { id: 'camera', labelKey: 'nav.camera' },
  { id: 'autofocus', labelKey: 'nav.autofocus' },
  { id: 'mount', labelKey: 'nav.mount' },
  { id: 'dome', labelKey: 'nav.dome' },
  { id: 'flat', labelKey: 'nav.flatDevice' },
  { id: 'switch', labelKey: 'nav.switch' },
  { id: 'filter', labelKey: 'nav.filterWheel' },
  { id: 'rotator', labelKey: 'nav.rotator' },
  { id: 'guider', labelKey: 'nav.guider' },
  { id: 'sequence', labelKey: 'nav.sequence' },
  { id: 'monitoring', labelKey: 'nav.monitoring' },
  { id: 'flats', labelKey: 'nav.flatWizard' },
  { id: 'framing', labelKey: 'nav.framing' },
  { id: 'skyview', labelKey: 'nav.skyView' },
  { id: 'settings', labelKey: 'nav.settings', alwaysVisible: true },
  { id: 'about', labelKey: 'nav.about' },
];

const allNavItems = computed(() => {
  const pluginItems = pluginStore.navigationItems
    .filter((item) => {
      const plugin = pluginStore.plugins.find((p) => p.id === item.pluginId);
      if (!plugin?.enabled) return false;
      if (plugin.isPins) return store.isPINS;
      return true;
    })
    .map((item) => ({
      id: 'plugin-' + item.pluginId,
      label: item.title,
    }));
  const pinsItems = store.isPINS ? [{ id: 'pins', labelKey: 'nav.pins' }] : [];
  return [...STATIC_NAV_ITEMS, ...pinsItems, ...pluginItems].filter((item) =>
    isNavItemInMode(item.id, settingsStore.appMode)
  );
});

const orderedItems = computed(() => {
  const order = settingsStore.navbar?.itemOrder ?? STATIC_NAV_ITEMS.map((i) => i.id);
  const items = allNavItems.value;
  const inOrder = order.map((id) => items.find((i) => i.id === id)).filter(Boolean);
  // Append any items not yet in the stored order (e.g. newly loaded plugins)
  const remaining = items.filter((i) => !order.includes(i.id));
  return [...inOrder, ...remaining];
});

// The list can be a subset in easy mode; the entries it does not show must survive a reorder.
function onReorder(order) {
  settingsStore.setNavbarOrder(mergeSubsetOrder(settingsStore.navbar?.itemOrder ?? [], order));
}
</script>
