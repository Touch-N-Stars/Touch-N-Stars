// Simple mode: the best targets for the current night, computed from the profile's site and the
// ObservationPlaner catalogue. Recomputed on demand (`refresh`) and when the site changes, so no
// poller is needed.
import { computed, ref, watch } from 'vue';
import { apiStore } from '@/store/store';
import seedCatalog from '@/plugins/observationplaner/components/astro_targets_seed.json';
import {
  SIMPLE_MIN_ALT_DEG,
  findNightWindow,
  normalizeCatalogTargets,
  rankTonightPicks,
} from '@/utils/tonightPicks';

const MAX_PICKS = 8;
const catalogTargets = normalizeCatalogTargets(seedCatalog?.default ?? seedCatalog);

export function useTonightPicks() {
  const store = apiStore();

  const site = computed(() => {
    const s = store.profileInfo?.AstrometrySettings;
    const lat = Number(s?.Latitude);
    const lon = Number(s?.Longitude);
    // 0°/0° is the profile default, not a real site.
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
    return { lat, lon };
  });

  const picks = ref([]);
  const nightWindow = ref(null);

  function refresh() {
    nightWindow.value = null;
    picks.value = [];
    if (!site.value) return;
    const win = findNightWindow(new Date(), site.value.lat, site.value.lon);
    nightWindow.value = win;
    if (!win) return;
    picks.value = rankTonightPicks(catalogTargets, {
      start: win.start,
      end: win.end,
      latDeg: site.value.lat,
      lonDeg: site.value.lon,
      limit: MAX_PICKS,
      minAltDeg: SIMPLE_MIN_ALT_DEG,
    });
  }

  watch(site, refresh, { immediate: true });

  return {
    picks,
    nightWindow,
    hasSite: computed(() => site.value !== null),
    refresh,
  };
}
