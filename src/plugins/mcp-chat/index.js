import { markRaw } from 'vue';
import { ChatBubbleLeftRightIcon } from '@heroicons/vue/24/outline';
import { usePluginStore } from '@/store/pluginStore';
import metadata from './plugin.json';

export default {
  metadata,
  install(app, { router }) {
    const store = usePluginStore();
    const current = store.plugins.find((plugin) => plugin.id === metadata.id);
    const paths = new Set(store.plugins.map((plugin) => plugin.pluginPath));
    let number = 1;
    while (paths.has(`/plugin${number}`)) number++;
    const path = current?.pluginPath || `/plugin${number}`;
    router.addRoute({
      path,
      component: () => import('./views/McpChat.vue'),
      meta: { requiresSetup: true },
    });
    if (current?.enabled)
      store.addNavigationItem({
        pluginId: metadata.id,
        path,
        icon: markRaw(ChatBubbleLeftRightIcon),
        title: metadata.name,
      });
  },
};
