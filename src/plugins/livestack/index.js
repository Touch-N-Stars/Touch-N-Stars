// Import your icon component here
// import YourPluginIcon from './components/YourPluginIcon.vue';
import { h, markRaw, computed } from 'vue';
import PluginView from './views/LiveStack.vue';
import { usePluginStore } from '@/store/pluginStore';
import { useLivestackStore } from './store/livestackStore';
import metadata from './plugin.json';
import { withNinaPluginGate } from '@/components/ninaPlugins/withNinaPluginGate';

export default {
  metadata,
  install(app, options) {
    const pluginStore = usePluginStore();
    const livestackStore = useLivestackStore();
    const router = options.router;

    // Get current plugin state from store
    const currentPlugin = pluginStore.plugins.find((p) => p.id === metadata.id);
    const pluginPath = currentPlugin ? currentPlugin.pluginPath : '/plugin2';

    // Foreground color changes based on livestack running status
    const strokeColor = computed(() =>
      livestackStore.status === 'running' ? 'var(--color-green-500, #10b981)' : 'currentColor'
    );

    // Register route with generic plugin path
    router.addRoute({
      path: pluginPath,
      component: withNinaPluginGate(PluginView, metadata),
      meta: { requiresSetup: true },
    });

    // Add navigation item if the plugin is enabled in the store
    if (currentPlugin && currentPlugin.enabled) {
      pluginStore.addNavigationItem({
        pluginId: metadata.id,
        path: pluginPath,
        // Livestack icon - three stacked images in heroicons style
        icon: markRaw({
          render() {
            return h(
              'svg',
              {
                xmlns: 'http://www.w3.org/2000/svg',
                fill: 'none',
                viewBox: '0 0 24 24',
                'stroke-width': '1.5',
                stroke: strokeColor.value,
              },
              [
                // Back image
                h('rect', {
                  x: 8,
                  y: 8,
                  width: 12,
                  height: 9,
                  rx: 2,
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                }),
                // Middle image
                h('rect', {
                  x: 6,
                  y: 6,
                  width: 12,
                  height: 9,
                  rx: 2,
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                }),
                // Front image with background to hide overlapped lines
                h('rect', {
                  x: 4,
                  y: 4,
                  width: 12,
                  height: 9,
                  rx: 2,
                  fill: 'var(--color-gray-800, #1f2937)',
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                }),
                // Front image stroke
                h('rect', {
                  x: 4,
                  y: 4,
                  width: 12,
                  height: 9,
                  rx: 2,
                  fill: 'none',
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                }),
              ]
            );
          },
        }),
        title: metadata.name,
      });
    }
  },
};
