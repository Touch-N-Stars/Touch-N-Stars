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
        // Lucide's own "orbit" glyph (i-lucide-orbit) -- the exact icon OryxAstro's own
        // OrbitalExportModal.vue and sky-events pages already use for comets/asteroids, not an
        // approximation of it. Path data pulled directly from @iconify-json/lucide's icons.json
        // rather than redrawn by hand, so it matches theirs exactly.
        icon: markRaw({
          render() {
            return h(
              'svg',
              {
                xmlns: 'http://www.w3.org/2000/svg',
                fill: 'none',
                viewBox: '0 0 24 24',
                'stroke-width': '2',
                stroke: 'currentColor',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
              },
              [
                h('path', { d: 'M20.341 6.484A10 10 0 0 1 10.266 21.85m-6.607-4.334A10 10 0 0 1 13.74 2.152' }),
                h('circle', { cx: 12, cy: 12, r: 3 }),
                h('circle', { cx: 19, cy: 5, r: 2 }),
                h('circle', { cx: 5, cy: 19, r: 2 }),
              ]
            );
          },
        }),
        title: metadata.name,
      });
    }
  },
};
