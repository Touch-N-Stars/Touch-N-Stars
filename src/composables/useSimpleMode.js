// Whether the PINS simple mode is available and switched on. The mode is PINS-only: a stored
// "on" has no effect while the app talks to N.I.N.A. on Windows.
import { computed } from 'vue';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';

export function useSimpleMode() {
  const store = apiStore();
  const settingsStore = useSettingsStore();

  const available = computed(() => store.isPINS);
  const enabled = computed(() => settingsStore.simpleMode?.enabled === true);
  const active = computed(() => available.value && enabled.value);

  return { available, enabled, active };
}
