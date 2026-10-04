import { markRaw } from 'vue';
import { usePluginStore } from '@/store/pluginStore';
import metadata from './plugin.json';
import AapaView from './views/AapaView.vue';
import AapaIcon from './components/AapaIcon.vue';

export default {
  metadata,
  install(app, options) {
    const pluginStore = usePluginStore();
    const router = options.router;
    const currentPlugin = pluginStore.plugins.find((plugin) => plugin.id === metadata.id);
    if (!currentPlugin) return;

    router.addRoute({
      path: currentPlugin.pluginPath,
      component: AapaView,
      meta: { requiresSetup: true },
    });

    if (currentPlugin.enabled) {
      pluginStore.addPluginNavigationItem(metadata.id, {
        path: currentPlugin.pluginPath,
        icon: markRaw(AapaIcon),
        title: metadata.name,
      });
    }
  },
};
