import { defineComponent, h, markRaw } from 'vue';
import NinaPluginGate from './NinaPluginGate.vue';
import { getNinaPluginRequirement } from '@/utils/ninaPluginRequirement';

/**
 * Wraps a plugin's route view so it only mounts once NINA has loaded the NINA plugin
 * named in the plugin's metadata. The view's own onMounted logic then runs against a
 * plugin that is actually there.
 */
export function withNinaPluginGate(view, metadata) {
  const requirement = getNinaPluginRequirement(metadata);
  if (!requirement) return view;

  return markRaw(
    defineComponent({
      name: `${view.name || view.__name || 'Plugin'}NinaGate`,
      setup() {
        return () =>
          h(NinaPluginGate, { requirement, pluginName: metadata.name }, { default: () => h(view) });
      },
    })
  );
}
