<template>
  <div class="relative rounded-chip overflow-hidden bg-surface-2" style="height: 440px">
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
 * mount.
 *
 * Uses the same createDssSkySurveySource(atlasDataBaseUrl()) as CelestiaAtlasView.vue, not the
 * library's own online default. First version of this component omitted skySurveySource
 * entirely on the theory that the online source (higher resolution) would just work -- it
 * rendered nothing at all, even with internet confirmed available. Nothing else in this app has
 * ever actually exercised that path (CelestiaAtlasView.vue always explicitly overrides it with
 * this same offline-bundled source), so it's untested in this app's real deployment environment
 * for reasons never diagnosed -- rather than debug an unproven path further, using the one this
 * app already demonstrably renders with is the safer choice, even at lower resolution (HiPS
 * order 3-4).
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { createCelestiaAtlasViewer, calculateCameraFieldOfView } from '@acocalypso/celestia-atlas';
import { Capacitor } from '@capacitor/core';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { ninaObserverToAtlas } from '@/integrations/celestiaAtlas/contracts';
import { ATLAS_POSITION_ANGLE_CONVENTION } from '@/integrations/celestiaAtlas/positionAngle';
import { createDssSkySurveySource, resolveCelestiaAtlasDataBaseUrl } from '@/integrations/celestiaAtlas/offlineSkySurvey';

const props = defineProps({
  raHours: { type: Number, required: true },
  decDeg: { type: Number, required: true },
  targetName: { type: String, required: true },
});
const emit = defineEmits(['offset']);

const store = apiStore();
const settingsStore = useSettingsStore();

// Same pattern as CelestiaAtlasView.vue's own atlasDataBaseUrl() -- deliberately NOT the
// library's online default (unlike this component's first version): nothing in this app has
// ever actually exercised that path, since the main Celestia Atlas view always explicitly
// overrides it with this same offline-bundled source. Lower resolution (HiPS order 3-4), but
// proven to actually render in this app's real deployment environment.
function atlasDataBaseUrl() {
  return resolveCelestiaAtlasDataBaseUrl({
    native: Capacitor.isNativePlatform(),
    protocol: settingsStore.backendProtocol || 'http',
    host: settingsStore.connection.ip,
    port: settingsStore.connection.port,
  });
}
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
    // rotationConvention is required by setFieldOfView's own validation -- matches
    // CelestiaAtlasView.vue's own identical FOV overlay call.
    return { widthDeg: fov.widthDeg, heightDeg: fov.heightDeg, rotationDeg: 0, rotationConvention: ATLAS_POSITION_ANGLE_CONVENTION };
  } catch {
    return null;
  }
}

function centerOnTarget() {
  if (!viewer) return;
  // frame is required -- setView's own coordinate validation (toAtlasCoordinates) throws
  // without one. J2000 matches how the rest of this app treats NINA-sourced RA/Dec (e.g.
  // atlasSelectionToFraming's own coordinateFrame: 'J2000'), and Perihelion's own values are
  // J2000 too (NINA.Astrometry.InputCoordinates).
  viewer.setView({ center: { raDeg: props.raHours * 15, decDeg: props.decDeg, frame: 'J2000' }, fovDeg: 1.5 });
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

onMounted(async () => {
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
    // CelestiaAtlasView.vue's own onMounted awaits a tick before constructing its viewer, for
    // the same reason this needs to too: this component mounts as part of a tab switch, so the
    // container can still be zero-sized (no layout pass done yet) at the instant onMounted
    // fires. A canvas/WebGL renderer measuring a zero-sized container doesn't throw -- it just
    // renders nothing, which is exactly what showed up here (ready with no error, blank canvas).
    await nextTick();
    viewer = createCelestiaAtlasViewer({
      container: viewerContainer.value,
      observer: ninaObserverToAtlas(settings),
      utcMs: Date.now(),
      skySurveySource: createDssSkySurveySource(atlasDataBaseUrl()),
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
    viewer.resize();
    // CelestiaAtlasView.vue always calls this as part of its own startup sequence (inside
    // updateVisibility()) -- a freshly constructed viewer apparently starts paused, and nothing
    // else in this component's own code was ever un-pausing it, which fully explains "ready"
    // with no error but nothing ever actually rendering.
    viewer.resume();
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
  viewer?.pause();
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
