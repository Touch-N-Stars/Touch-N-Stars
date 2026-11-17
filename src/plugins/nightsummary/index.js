import { markRaw } from 'vue';
import NightSummaryView from './views/nightsummary.vue';
import { usePluginStore } from '@/store/pluginStore';
import { useNightSummaryStore } from './store/nightsummaryStore';
import metadata from './plugin.json';
import { withNinaPluginGate } from '@/components/ninaPlugins/withNinaPluginGate';
import NightSummaryIcon from './components/NightSummaryIcon.vue';

export default {
  metadata,
  install(app, options) {
    const pluginStore = usePluginStore();
    const nightSummaryStore = useNightSummaryStore();
    const router = options.router;

    const currentPlugin = pluginStore.plugins.find((p) => p.id === metadata.id);

    let pluginPath;
    if (currentPlugin && currentPlugin.pluginPath) {
      pluginPath = currentPlugin.pluginPath;
    } else {
      const existingPaths = pluginStore.plugins
        .map((p) => p.pluginPath)
        .filter((path) => path && path.match(/^\/plugin\d+$/))
        .map((path) => parseInt(path.replace('/plugin', '')))
        .sort((a, b) => a - b);

      let nextNumber = 1;
      for (const num of existingPaths) {
        if (num === nextNumber) {
          nextNumber++;
        } else {
          break;
        }
      }

      pluginPath = `/plugin${nextNumber}`;
    }

    nightSummaryStore.initialize();

    router.addRoute({
      path: pluginPath,
      component: withNinaPluginGate(markRaw(NightSummaryView), metadata),
      meta: { requiresSetup: true },
    });

    if (currentPlugin && currentPlugin.enabled) {
      pluginStore.addNavigationItem({
        pluginId: metadata.id,
        title: metadata.name,
        path: pluginPath,
        icon: markRaw(NightSummaryIcon),
      });
    }
  },
};
