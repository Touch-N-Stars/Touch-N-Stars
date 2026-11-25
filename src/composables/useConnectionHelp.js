import { computed, ref, watch } from 'vue';
import { searchBackends } from '@/services/connectionSearch';
import { isRigRecoveryRunning, promoteEndpoint } from '@/services/rigConnectionSupervisor';
import { PINS_HOTSPOT_HOST } from '@/services/rigEndpointResolver';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useBackgroundAwarePolling } from '@/utils/appLifecycle';
import { backendKind, diagnoseConnection } from '@/utils/connectionDiagnosis';

const SEARCH_INTERVAL_MS = 6000;

// What the backend was while it still answered; covers a browser on the rig's own page, which
// has no saved instance to remember it.
const seenKind = ref('');

/** Remembers whether the connected backend is PINS or NINA. App.vue, once. */
export function useBackendKindMemory() {
  const store = apiStore();
  const settingsStore = useSettingsStore();
  watch(
    () => [store.isBackendReachable, store.pinsCheckResolvedOnce, store.isPINS],
    ([reachable, resolved, isPINS]) => {
      if (!reachable || !resolved) return;
      seenKind.value = isPINS ? 'pins' : 'nina';
      settingsStore.rememberBackendKind(seenKind.value);
    },
    { immediate: true }
  );
}

/**
 * The connection page: keeps searching while `active`, goes back to the selected rig on its own
 * when it turns up at another address, and says what is wrong meanwhile.
 *
 * @param {{ active: import('vue').Ref<boolean>, elapsed: import('vue').Ref<number> }} options
 */
export function useConnectionHelp({ active, elapsed }) {
  const store = apiStore();
  const settingsStore = useSettingsStore();

  const boxAnswers = ref(false);
  const found = ref([]);
  const refused = ref(false);
  const searching = ref(false);

  const instance = computed(() =>
    settingsStore.selectedInstanceId
      ? settingsStore.getInstance(settingsStore.selectedInstanceId) || null
      : null
  );
  const currentHost = computed(() => settingsStore.connection.ip || window.location.hostname);
  const kind = computed(() =>
    backendKind({
      instance: instance.value,
      seenKind: seenKind.value,
      host: currentHost.value,
      hotspotHost: PINS_HOTSPOT_HOST,
    })
  );
  const diagnosis = computed(() =>
    diagnoseConnection({
      issue: store.connectionIssue,
      kind: kind.value,
      elapsed: elapsed.value,
      boxAnswers: boxAnswers.value,
      found: found.value,
    })
  );

  async function search() {
    // Anything but silence means the backend was found, only not usable.
    const silent = !store.connectionIssue || store.connectionIssue.type === 'unreachable';
    if (searching.value || !silent || isRigRecoveryRunning()) return;
    const epoch = store.connectionEpoch;
    searching.value = true;
    try {
      const result = await searchBackends({
        kind: kind.value,
        instance: instance.value,
        currentHost: currentHost.value,
        currentPort: settingsStore.connection.port || window.location.port,
        pageHost: window.location.hostname,
      });
      // Connected meanwhile, page gone or another instance selected
      if (!active.value || store.isBackendReachable || store.connectionEpoch !== epoch) return;
      boxAnswers.value = result.boxAnswers;
      found.value = result.found;
      refused.value = result.refused;
      if (result.own && !isRigRecoveryRunning()) await promoteEndpoint(result.own);
    } catch (error) {
      console.warn('[ConnectionHelp] search failed:', error?.message || error);
    } finally {
      searching.value = false;
    }
  }

  useBackgroundAwarePolling(search, SEARCH_INTERVAL_MS, active, {
    immediate: true,
    immediateOnResume: true,
  });

  watch(active, (isActive) => {
    if (isActive) return;
    boxAnswers.value = false;
    found.value = [];
    refused.value = false;
  });

  /** The user picked a backend the search found. Reloads the app for the other instance. */
  function connect(entry) {
    const instances = settingsStore.connection.instances;
    const known = entry.rigId ? instances.find((saved) => saved.rigId === entry.rigId) : null;
    if (!known) {
      settingsStore.addInstance({
        name: entry.label,
        ip: entry.host,
        port: entry.port,
        rigId: entry.rigId,
        backendKind: entry.kind,
        candidateHosts: [entry.host],
      });
      return;
    }
    settingsStore.promoteInstanceEndpoint(known.id, { host: entry.host, rigId: entry.rigId });
    settingsStore.setSelectedInstanceId(known.id);
  }

  return { diagnosis, kind, instance, found, refused, searching, search, connect };
}
