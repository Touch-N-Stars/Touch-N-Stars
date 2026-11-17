import { defineAsyncComponent, markRaw } from 'vue';
import { PresentationChartLineIcon } from '@heroicons/vue/24/outline';
import i18n from '@/i18n';
import { usePluginStore } from '@/store/pluginStore';
import metadata from './plugin.json';

// The viewer and its chart library load when it is first opened.
const GuideLogViewerView = defineAsyncComponent(() => import('./views/GuideLogViewerView.vue'));

export default {
  metadata,
  install(app, options) {
    const pluginStore = usePluginStore();
    const router = options.router;

    const currentPlugin = pluginStore.plugins.find((plugin) => plugin.id === metadata.id);
    if (!currentPlugin) return;

    router.addRoute({
      path: currentPlugin.pluginPath,
      component: GuideLogViewerView,
      meta: { requiresSetup: true },
    });

    if (currentPlugin.enabled) {
      pluginStore.addNavigationItem({
        pluginId: metadata.id,
        path: currentPlugin.pluginPath,
        icon: markRaw(PresentationChartLineIcon),
        title: i18n.global.t('plugins.guideLogViewer.navTitle'),
      });
    }
  },
};
