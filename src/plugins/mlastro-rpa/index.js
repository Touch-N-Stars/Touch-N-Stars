import { markRaw } from 'vue';
import { SparklesIcon } from '@heroicons/vue/24/outline';
import { usePluginStore } from '@/store/pluginStore';
import { withNinaPluginGate } from '@/components/ninaPlugins/withNinaPluginGate';
import metadata from './plugin.json';
import MlastroView from './views/MlastroView.vue';

export default {
  metadata,
  install(app, { router }) {
    const plugins = usePluginStore();
    const entry = plugins.plugins.find((plugin) => plugin.id === metadata.id);
    if (!entry) return;
    router.addRoute({
      path: entry.pluginPath,
      component: withNinaPluginGate(MlastroView, metadata),
      meta: { requiresSetup: true },
    });
    if (entry.enabled) {
      plugins.addPluginNavigationItem(metadata.id, {
        path: entry.pluginPath,
        icon: markRaw(SparklesIcon),
        title: metadata.name,
      });
    }
  },
};
