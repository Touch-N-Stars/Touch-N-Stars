import { markRaw } from 'vue';
import { VideoCameraIcon } from '@heroicons/vue/24/outline';
import { usePluginStore } from '@/store/pluginStore';
import LuckyCapture from './views/LuckyCapture.vue';
import metadata from './plugin.json';
import { withNinaPluginGate } from '@/components/ninaPlugins/withNinaPluginGate';

export default {
  metadata,
  install(app, { router }) {
    const store = usePluginStore();
    const plugin = store.plugins.find((entry) => entry.id === metadata.id);
    if (!plugin?.pluginPath) return;
    router.addRoute({
      path: plugin.pluginPath,
      component: withNinaPluginGate(LuckyCapture, metadata),
      meta: { requiresSetup: true },
    });
    if (plugin.enabled)
      store.addNavigationItem({
        pluginId: metadata.id,
        path: plugin.pluginPath,
        icon: markRaw(VideoCameraIcon),
        title: metadata.name,
      });
  },
};
