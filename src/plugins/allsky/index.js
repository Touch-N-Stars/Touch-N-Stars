// Import your icon component here
// import YourPluginIcon from './components/YourPluginIcon.vue';
import { h, markRaw } from 'vue';
import DefaultPluginView from './views/allsky.vue';
import { usePluginStore } from '@/store/pluginStore';
import metadata from './plugin.json';

export default {
  metadata,
  install(app, options) {
    const pluginStore = usePluginStore();
    const router = options.router;

    // Get current plugin state from store
    const currentPlugin = pluginStore.plugins.find((p) => p.id === metadata.id);
    const pluginPath = currentPlugin ? currentPlugin.pluginPath : '/plugin1';

    // Register route with generic plugin path
    router.addRoute({
      path: pluginPath,
      component: DefaultPluginView,
      meta: { requiresSetup: true },
    });

    // Add navigation item if the plugin is enabled in the store
    if (currentPlugin && currentPlugin.enabled) {
      pluginStore.addNavigationItem({
        pluginId: metadata.id,
        path: pluginPath,
        // Cloud icon
        icon: markRaw({
          render() {
            return h(
              'svg',
              {
                xmlns: 'http://www.w3.org/2000/svg',
                fill: 'none',
                viewBox: '0 0 24 24',
                'stroke-width': '1.5',
                stroke: 'currentColor',
              },
              [
                // Dome/Hemisphere
                h('path', {
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                  d: 'M3 16a9 9 0 1118 0H3z',
                }),
                // Lens/Camera
                h('circle', {
                  cx: '12',
                  cy: '12',
                  r: '3',
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                }),
                // Small dot/reflection
                h('circle', {
                  cx: '13',
                  cy: '11',
                  r: '0.5',
                  fill: 'currentColor',
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
