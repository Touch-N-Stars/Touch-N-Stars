import { h, markRaw } from 'vue';
import PerihelionView from './views/PerihelionView.vue';
import { usePluginStore } from '@/store/pluginStore';
import metadata from './plugin.json';

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
      component: PerihelionView,
      meta: { requiresSetup: true },
    });

    if (currentPlugin && currentPlugin.enabled) {
      pluginStore.addNavigationItem({
        pluginId: metadata.id,
        path: pluginPath,
        // Comet-with-tail glyph, matching the violet accent used for comet iconography
        // throughout the panel (and OryxAstro's own "orbit" icon convention).
        icon: markRaw({
          render() {
            return h(
              'svg',
              {
                xmlns: 'http://www.w3.org/2000/svg',
                fill: 'none',
                viewBox: '0 0 24 24',
                'stroke-width': '1.8',
                stroke: 'currentColor',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
              },
              [
                h('circle', { cx: 9, cy: 9, r: 2.6 }),
                h('path', { d: 'M11 11l10 10' }),
                h('path', { d: 'M13.5 13.5l5-1.2' }),
                h('path', { d: 'M13.5 13.5l1.2 5' }),
              ]
            );
          },
        }),
        title: metadata.name,
      });
    }
  },
};
