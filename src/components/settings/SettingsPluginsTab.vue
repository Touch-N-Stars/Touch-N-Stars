<template>
  <div class="space-y-6">
    <div v-if="store.isBackendReachable && true" class="tns-card flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">
        {{ $t('components.settings.plugins.title') }}
      </h3>
      <p class="text-content-muted text-sm mb-4">
        {{ $t('components.settings.plugins.description') }}
      </p>

      <!-- Empty State -->
      <div v-if="pluginStore.plugins.length === 0" class="text-center py-8">
        <svg
          class="mx-auto h-12 w-12 text-content-faint mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p class="text-content-muted text-sm">No plugins available</p>
      </div>

      <!-- Plugin List -->
      <div v-else class="space-y-3">
        <!-- General Plugins -->
        <div
          v-for="plugin in generalPlugins"
          :key="plugin.id"
          class="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-line"
        >
          <div class="flex-1 min-w-0">
            <h4 class="text-white font-medium">{{ plugin.name }}</h4>
            <p class="text-sm text-content-muted">{{ plugin.description }}</p>
            <p v-if="plugin.author" class="text-xs text-content-faint mt-1">
              {{ $t('components.settings.plugins.author') }}: {{ plugin.author }}
            </p>
          </div>
          <div class="flex items-center gap-3 ml-4">
            <span class="text-xs text-content-faint">v{{ plugin.version }}</span>
            <ToggleButton
              :statusValue="plugin.enabled"
              @update:statusValue="(value) => togglePlugin(plugin.id, value)"
            />
          </div>
        </div>

        <!-- PINS Plugins Divider & List -->
        <div v-if="pinsPlugins.length > 0" class="pt-4">
          <div class="flex items-center gap-3 mb-3">
            <div class="h-px bg-line-strong flex-1"></div>
            <span class="text-xs font-bold text-accent uppercase tracking-wider">PINS Plugins</span>
            <div class="h-px bg-line-strong flex-1"></div>
          </div>

          <div class="space-y-3">
            <div
              v-for="plugin in pinsPlugins"
              :key="plugin.id"
              class="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-line"
            >
              <div class="flex-1 min-w-0">
                <h4 class="text-white font-medium">{{ plugin.name }}</h4>
                <p class="text-sm text-content-muted">{{ plugin.description }}</p>
                <p v-if="plugin.author" class="text-xs text-content-faint mt-1">
                  {{ $t('components.settings.plugins.author') }}: {{ plugin.author }}
                </p>
              </div>
              <div class="flex items-center gap-3 ml-4">
                <span class="text-xs text-content-faint">v{{ plugin.version }}</span>
                <ToggleButton
                  :statusValue="plugin.enabled"
                  @update:statusValue="(value) => togglePlugin(plugin.id, value)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { apiStore } from '@/store/store';
import { usePluginStore } from '@/store/pluginStore';
import { useSettingsStore } from '@/store/settingsStore';
import ToggleButton from '@/components/helpers/toggleButton.vue';
import { fetchLoadedNinaPlugins, useNinaPluginInstallStore } from '@/store/ninaPluginInstallStore';
import { getNinaPluginRequirement, isNinaPluginLoaded } from '@/utils/ninaPluginRequirement';

const store = apiStore();
const pluginStore = usePluginStore();
const settingsStore = useSettingsStore();
const installStore = useNinaPluginInstallStore();

const generalPlugins = computed(() => {
  return pluginStore.plugins.filter((p) => !p.isPins);
});

const pinsPlugins = computed(() => {
  if (store.isPINS || settingsStore.isPINS) {
    return pluginStore.plugins.filter((p) => p.isPins);
  }
  return [];
});

onMounted(async () => {
  // Ensure plugins are loaded (force reload to catch metadata changes)
  await pluginStore.loadAndRegisterPlugins(true);
});

const togglePlugin = async (pluginId, enabled) => {
  try {
    await pluginStore.togglePlugin(pluginId, enabled);
  } catch (error) {
    console.error('Error toggling plugin:', error);
    return;
  }
  if (enabled) await offerMissingNinaPlugin(pluginId);
};

// On PINS, enabling a plugin whose NINA plugin is not loaded offers to install it right away.
async function offerMissingNinaPlugin(pluginId) {
  const plugin = pluginStore.plugins.find((p) => p.id === pluginId);
  const requirement = getNinaPluginRequirement(plugin);
  if (!store.isPINS || !requirement?.pinsPackage) return;

  const loaded = await fetchLoadedNinaPlugins();
  if (loaded === null || isNinaPluginLoaded(loaded, requirement)) return;
  installStore.offer({ pluginName: plugin.name, requirement });
}
</script>
