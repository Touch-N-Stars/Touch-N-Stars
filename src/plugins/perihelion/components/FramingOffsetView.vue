<template>
  <div class="relative rounded-chip overflow-hidden bg-surface-2" style="height: 280px">
    <div ref="viewerContainer" class="absolute inset-0" />
    <p v-if="errorMessage" class="absolute inset-0 flex items-center justify-center p-4 text-xs text-content-faint text-center">
      {{ errorMessage }}
    </p>
    <div v-else-if="!ready" class="absolute inset-0 flex items-center justify-center text-xs text-content-faint">
      Loading sky view…
    </div>
    <template v-else>
      <button
        class="absolute bottom-2 right-2 px-2 py-1 rounded-chip text-[11px] font-semibold bg-accent text-white shadow"
        @click="captureFraming"
      >
        Use this framing
      </button>
      <button
        v-if="hasOffset"
        class="absolute bottom-2 left-2 px-2 py-1 rounded-chip text-[11px] font-semibold bg-surface-3 text-content-muted shadow"
        @click="resetFraming"
      >
        Reset
      </button>
      <span class="absolute top-2 left-2 px-2 py-1 rounded-chip text-[10px] bg-black/50 text-white/80">
        Pan to frame, then capture
      </span>
    </template>
  </div>
</template>

<script setup>
/**
 * A small, separately-scoped Celestia Atlas viewer instance for framing -- deliberately NOT the
 * app-wide fixed-position one (store.showSkyAtlas / CelestiaAtlasView.vue), which is a global
 * overlay unrelated to any one plugin's own panel. createCelestiaAtlasViewer() is a plain
 * factory taking a container element, so nothing stops a second, independent instance here.
 *
 * Centers on Perihelion's OWN computed RA/Dec (the raHours/decDeg props) rather than trusting
 * the viewer's own bundled comet catalog -- confirmed there's no way to register custom comet
 * elements with the viewer instance at all (getCometObjects() is a standalone utility, separate
 * from CelestiaAtlasViewer's own interface), so a moving object not already in that bundled
 * catalog would otherwise show up in the wrong place or not at all. Centering ourselves sidesteps
 * that gap entirely and is correct either way.
 *
 * Deliberately omits the star/DSO catalog data (unlike CelestiaAtlasView.vue, which dynamically
 * imports several large embedded datasets) -- this view only needs photographic imagery plus the
 * FOV overlay, not a browsable atlas, so skipping the heavy catalog imports keeps this cheap to
 * mount. Also deliberately does NOT pass skySurveySource: omitting it lets the library fall back
 * to its own default (the online DSS2 Color HiPS), rather than createDssSkySurveySource()'s own
 * offline-bundled variant (HiPS order 3-4 only -- coarse, chosen there for offline reliability),
 * since this framing preview is a convenience feature that's fine requiring a connection, not
 * something the core tracking math depends on.
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { createCelestiaAtlasViewer, calculateCameraFieldOfView } from '@acocalypso/celestia-atlas';
import { apiStore } from '@/store/store';
import { ninaObserverToAtlas } from '@/integrations/celestiaAtlas/contracts';

const props = defineProps({
  raHours: { type: Number, required: true },
  decDeg: { type: Number, required: true },
  targetName: { type: String, required: true },
});
const emit = defineEmits(['offset']);

const store = apiStore();
const viewerContainer = ref(null);
const ready = ref(false);
const hasOffset = ref(false);
const errorMessage = ref('');
let viewer = null;

function computeFovOverlay() {
  const profile = store.profileInfo;
  try {
    const fov = calculateCameraFieldOfView({
      pixelSizeMicrons: Number(profile?.CameraSettings?.PixelSize),
      focalLengthMm: Number(profile?.TelescopeSettings?.FocalLength),
      sensorWidthPx: Number(profile?.FramingAssistantSettings?.CameraWidth),
      sensorHeightPx: Number(profile?.FramingAssistantSettings?.CameraHeight),
    });
    return { widthDeg: fov.widthDeg, heightDeg: fov.heightDeg, rotationDeg: 0 };
  } catch {
    return null;
  }
}

function centerOnTarget() {
  if (!viewer) return;
  viewer.setView({ center: { raDeg: props.raHours * 15, decDeg: props.decDeg }, fovDeg: 1.5 });
  const fovOverlay = computeFovOverlay();
  if (fovOverlay) viewer.setFieldOfView(fovOverlay);
  hasOffset.value = false;

  // Bonus only, not required for correctness: if this object happens to already be in the
  // viewer's own bundled catalog, select/focus it for a native marker and label. A miss here
  // (new/uncommon object, or a name-format mismatch) is expected and harmless -- the view is
  // already correctly centered from Perihelion's own data regardless.
  try {
    const results = viewer.search(props.targetName);
    if (results?.[0]) viewer.select(results[0]);
  } catch {
    // Ignored -- see comment above.
  }
}

function captureFraming() {
  if (!viewer) return;
  const center = viewer.getView().center;
  emit('offset', { raDeg: center.raDeg, decDeg: center.decDeg });
  hasOffset.value = true;
}

function resetFraming() {
  centerOnTarget();
  emit('offset', null);
}

onMounted(() => {
  // ninaObserverToAtlas throws if AstrometrySettings isn't loaded/valid yet (same underlying
  // data PerihelionView.vue's own hasLocation guard already checks for the altitude card) --
  // check first with a clear message rather than letting that throw fall into the generic
  // catch below.
  const settings = store.profileInfo?.AstrometrySettings;
  if (![settings?.Latitude, settings?.Longitude].every(Number.isFinite)) {
    errorMessage.value = "No observer location set in this profile's Astrometry settings.";
    return;
  }

  try {
    viewer = createCelestiaAtlasViewer({
      container: viewerContainer.value,
      observer: ninaObserverToAtlas(settings),
      utcMs: Date.now(),
      onError: (error) => {
        console.warn('[Perihelion] Framing view sky-survey error:', error.message);
      },
    });
    viewer.setDisplayOptions({
      grid: false,
      azimuthalGrid: false,
      meridian: false,
      ecliptic: false,
      constellations: false,
      deepSkyObjects: false,
      labels: true,
      cardinals: false,
      skySurvey: true,
      comets: true,
    });
    centerOnTarget();
    ready.value = true;
  } catch (error) {
    // Surfaced directly in the UI (not just the console) -- this is a new, unproven component,
    // and showing the real message here means a real failure can be diagnosed from a screenshot
    // rather than needing someone to open devtools.
    errorMessage.value = `Sky view unavailable: ${error.message}`;
    console.warn('[Perihelion] Could not start framing view:', error);
  }
});

onBeforeUnmount(() => {
  viewer?.destroy();
  viewer = null;
});

watch(
  () => [props.raHours, props.decDeg, props.targetName],
  () => {
    if (ready.value) centerOnTarget();
  }
);
</script>
