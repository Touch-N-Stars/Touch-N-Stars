import { markRaw } from 'vue';
import i18n from '@/i18n';
import { usePluginStore } from '@/store/pluginStore';
import metadata from './plugin.json';
import ConeErrorView from './views/ConeErrorView.vue';
import ConeErrorIcon from './components/ConeErrorIcon.vue';

export default {
  metadata,
  install(app, options) {
    const pluginStore = usePluginStore();
    const router = options.router;
    const currentPlugin = pluginStore.plugins.find((plugin) => plugin.id === metadata.id);
    if (!currentPlugin) return;

    router.addRoute({
      path: currentPlugin.pluginPath,
      component: ConeErrorView,
      meta: { requiresSetup: true },
    });

    if (currentPlugin.enabled) {
      pluginStore.addPluginNavigationItem(metadata.id, {
        path: currentPlugin.pluginPath,
        icon: markRaw(ConeErrorIcon),
        title: i18n.global.t('plugins.coneError.title'),
      });
    }
  },
};
