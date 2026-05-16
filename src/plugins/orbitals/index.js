import { markRaw, h } from 'vue';
import OrbitalsView from './views/OrbitalsView.vue';
import { usePluginStore } from '@/store/pluginStore';
import metadata from './plugin.json';

// Icon: comet with tail
const OrbitalsIcon = markRaw({
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
        h('circle', { cx: '16', cy: '8', r: '3' }),
        h('path', { d: 'M13.5 10.5 3 20' }),
        h('path', { d: 'M12 6 4 4' }),
        h('path', { d: 'M18 12l2 8' }),
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

    router.addRoute({ path: pluginPath, component: OrbitalsView, meta: { requiresSetup: true } });

    if (currentPlugin?.enabled) {
      pluginStore.addNavigationItem({
        pluginId: metadata.id,
        path: pluginPath,
        icon: OrbitalsIcon,
        title: metadata.name,
      });
    }
  },
};
