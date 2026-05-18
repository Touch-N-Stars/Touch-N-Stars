// Inspired by HorizonCreator by Christian Palm (MPL 2.0). No code copied.

import { markRaw, h } from 'vue';
import HorizonCreatorView from './views/HorizonCreatorView.vue';
import { usePluginStore } from '@/store/pluginStore';
import metadata from './plugin.json';

const HorizonCreatorIcon = markRaw({
  render() {
    return h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1.6',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      [
        h('path', { d: 'M3 17 L7 11 L11 14 L15 8 L19 12 L21 10' }),
        h('line', { x1: '2', y1: '17', x2: '22', y2: '17' }),
      ]
    );
  },
});

export default {
  metadata,
  install(app, options) {
    const pluginStore = usePluginStore();
    const router = options.router;

    const currentPlugin = pluginStore.plugins.find((p) => p.id === metadata.id);

    let pluginPath;
    if (currentPlugin?.pluginPath) {
      pluginPath = currentPlugin.pluginPath;
    } else {
      const existingNums = pluginStore.plugins
        .map((p) => p.pluginPath)
        .filter((path) => path?.match(/^\/plugin\d+$/))
        .map((path) => parseInt(path.replace('/plugin', '')))
        .sort((a, b) => a - b);
      let next = 1;
      for (const n of existingNums) {
        if (n === next) next++;
        else break;
      }
      pluginPath = `/plugin${next}`;
    }

    router.addRoute({ path: pluginPath, component: HorizonCreatorView, meta: { requiresSetup: true } });

    if (currentPlugin?.enabled) {
      pluginStore.addNavigationItem({
        pluginId: metadata.id,
        path: pluginPath,
        icon: HorizonCreatorIcon,
        title: metadata.name,
      });
    }
  },
};
