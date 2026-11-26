import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { usePluginStore } from '@/store/pluginStore';

const LOG_COLLECTOR_ID = 'logfile-collector';

/**
 * The way to the log collector from pages that have no plugin navigation (the simple mode).
 * The plugin ships switched off; opening it here switches it on first, which registers its
 * route - so a beginner can send logs without finding the plugin settings.
 */
export function useLogCollector() {
  const router = useRouter();
  const pluginStore = usePluginStore();

  const findPlugin = () => pluginStore.plugins.find((p) => p.id === LOG_COLLECTOR_ID);
  const available = computed(() => Boolean(findPlugin()));

  async function openLogCollector() {
    if (!findPlugin()) return;
    if (!findPlugin().enabled) await pluginStore.togglePlugin(LOG_COLLECTOR_ID, true);
    const path = findPlugin()?.pluginPath;
    if (path && router.hasRoute(`plugin-${LOG_COLLECTOR_ID}`)) router.push(path);
  }

  return { available, openLogCollector };
}
