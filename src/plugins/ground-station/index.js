import { markRaw } from 'vue';
import GroundStationView from './views/GroundStationView.vue';
import { usePluginStore } from '@/store/pluginStore';
import metadata from './plugin.json';
import { withNinaPluginGate } from '@/components/ninaPlugins/withNinaPluginGate';
import GroundStationIcon from './components/GroundStationIcon.vue';

export default {
  metadata,
  install(app, options) {
    const pluginStore = usePluginStore();
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

    router.addRoute({
      path: pluginPath,
      component: withNinaPluginGate(GroundStationView, metadata),
      meta: { requiresSetup: true },
    });

    if (currentPlugin && currentPlugin.enabled) {
      pluginStore.addNavigationItem({
        pluginId: metadata.id,
        path: pluginPath,
        icon: markRaw(GroundStationIcon),
        title: metadata.name,
      });
    }
  },
};
