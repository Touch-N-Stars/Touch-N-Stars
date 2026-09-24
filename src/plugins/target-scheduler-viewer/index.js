import { h, markRaw } from 'vue';
import i18n from '@/i18n';
import TargetSchedulerViewerView from './views/TargetSchedulerViewerView.vue';
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
        .map((path) => parseInt(path.replace('/plugin', ''), 10))
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
      component: TargetSchedulerViewerView,
      meta: { requiresSetup: true },
    });

    if (currentPlugin && currentPlugin.enabled) {
      pluginStore.addNavigationItem({
        pluginId: metadata.id,
        path: pluginPath,
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
                'stroke-linecap': 'round',
              },
              [
                h('circle', {
                  cx: '12',
                  cy: '12',
                  r: '9.5',
                  'stroke-dasharray': '50 10',
                  transform: 'rotate(-15 12 12)',
                }),
                h('circle', {
                  cx: '12',
                  cy: '12',
                  r: '6.7',
                  'stroke-dasharray': '34 8',
                  transform: 'rotate(165 12 12)',
                }),
                h('path', {
                  d: 'M14.7 9.6a3.5 3.5 0 10-1.3 6.24',
                }),
              ]
            );
          },
        }),
        title: i18n.global.t('plugins.targetSchedulerViewer.title'),
      });
    }
  },
};
