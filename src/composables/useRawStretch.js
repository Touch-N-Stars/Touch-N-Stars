import { computed, onBeforeUnmount, toValue, watch } from 'vue';
import { useHistogramStore } from '@/store/histogramStore';

/**
 * Wires a view that shows an image to the raw-data histogram and stretch.
 *
 * @param {() => string|null} imageUrl  URL of the image the view shows (the store key)
 * @param {() => object|null} source    raw-data source, see histogramStore fetchRaw();
 *                                      null when the image has none (e.g. TPPA, focus)
 * @param {() => boolean} active        load only while the histogram panel is open, so the
 *                                      raw download never rides along with every new frame
 * @param {{ releaseOnChange?: boolean, releaseOnUnmount?: boolean }} options
 *        release entries the caller owns; images managed by imageStore are released there
 */
export function useRawStretch(imageUrl, source, active, options = {}) {
  const histogramStore = useHistogramStore();
  const { releaseOnChange = false, releaseOnUnmount = false } = options;

  watch(
    [() => toValue(imageUrl), () => JSON.stringify(toValue(source) ?? null), () => toValue(active)],
    ([url, sourceKey, isActive]) => {
      if (!url || !isActive || sourceKey === 'null') return;
      histogramStore.requestRaw(url, JSON.parse(sourceKey));
    },
    { immediate: true }
  );

  if (releaseOnChange) {
    watch(
      () => toValue(imageUrl),
      (url, oldUrl) => {
        if (oldUrl && oldUrl !== url) histogramStore.clearImageCache(oldUrl);
      }
    );
  }

  if (releaseOnUnmount) {
    onBeforeUnmount(() => histogramStore.clearImageCache(toValue(imageUrl)));
  }

  const displayUrl = computed(() => {
    const url = toValue(imageUrl);
    return histogramStore.displayUrl(url) || url;
  });

  // Only a running stretch render, not the raw download: the original image stays usable
  // while the histogram panel shows its own loading state.
  const rendering = computed(() => !!histogramStore.getEntry(toValue(imageUrl))?.rendering);

  return { displayUrl, rendering };
}
