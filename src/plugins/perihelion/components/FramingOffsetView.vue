<template>
  <div class="flex flex-col gap-2">
    <div class="relative rounded-chip overflow-hidden bg-surface-2 h-72 md:h-96 lg:h-[570px]">
      <div ref="viewerContainer" class="absolute inset-0" />
      <p v-if="errorMessage" class="absolute inset-0 flex items-center justify-center p-4 text-xs text-content-faint text-center">
        {{ errorMessage }}
      </p>
      <div v-else-if="!ready" class="absolute inset-0 flex items-center justify-center text-xs text-content-faint">
        Loading sky view…
      </div>
      <template v-else>
        <span class="absolute top-2 left-2 px-2 py-1 rounded-chip text-[10px] bg-black/50 text-white/80">
          Pan to frame
        </span>
        <div class="absolute top-2 right-2 px-2 py-1 rounded-chip text-[10px] bg-black/50 text-white/80 text-right tabular-nums">
          <div>RA {{ formatRaHours(currentCenter.raHours) }}</div>
          <div>Dec {{ formatDecDeg(currentCenter.decDeg) }}</div>
        </div>
      </template>
    </div>

    <div v-if="ready" class="flex items-center gap-2">
      <span class="text-[11px] text-content-faint shrink-0">Rotation</span>
      <input
        v-model.number="framingStore.rotationAngle"
        type="range"
        min="0"
        max="360"
        step="1"
        class="flex-1 accent-accent"
      />
      <span class="text-[11px] tabular-nums text-content-muted w-10 text-right shrink-0">{{ framingStore.rotationAngle }}°</span>
    </div>
    <getImageRotation v-if="ready" />

    <div v-if="ready" class="flex gap-2">
      <button class="tns-btn-primary flex-1" @click="captureFraming">Use this Framing</button>
      <button v-if="hasOffset" class="tns-btn-secondary flex-1" @click="resetFraming">Reset</button>
    </div>
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
import { useFramingStore } from '@/store/framingStore';
import { ninaObserverToAtlas } from '@/integrations/celestiaAtlas/contracts';
import { ATLAS_POSITION_ANGLE_CONVENTION } from '@/integrations/celestiaAtlas/positionAngle';
import { createDssSkySurveySource, resolveCelestiaAtlasDataBaseUrl } from '@/integrations/celestiaAtlas/offlineSkySurvey';
// Reused as-is, not reimplemented -- already does exactly what's needed: reads gain/exposure
// straight from the profile's own PlateSolveSettings, runs a real exposure + plate solve, and
// writes the result to framingStore.rotationAngle (the same shared field this view's own
// rotation slider reads/writes, and the one CelestiaAtlasView.vue's own FOV overlay already
// uses -- sharing it is deliberate: it represents the camera's real physical rotation, a fact
// about the rig, not a per-view preference).
import getImageRotation from '@/components/framing/getImageRotation.vue';

const props = defineProps({
  raHours: { type: Number, required: true },
  decDeg: { type: Number, required: true },
  targetName: { type: String, required: true },
});
const emit = defineEmits(['offset']);

const store = apiStore();
const settingsStore = useSettingsStore();
const framingStore = useFramingStore();

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
// Wherever the view is currently centered -- updated live via onViewChange (an event, not
// polling) so the RA/Dec overlay tracks panning in real time. Starts at the object's own true
// position, matching where centerOnTarget() points the view before any panning happens.
const currentCenter = ref({ raHours: props.raHours, decDeg: props.decDeg });
let viewer = null;

// Small local formatters rather than importing PerihelionView.vue's own versions -- those are
// plain local function declarations there, not exported, and duplicating two three-line
// formatters is cheaper than refactoring that file just to share them.
function formatRaHours(raHours) {
  const h = Math.floor(raHours);
  const m = (raHours - h) * 60;
  return `${h}h ${m.toFixed(1)}m`;
}
function formatDecDeg(decDeg) {
  const sign = decDeg < 0 ? '-' : '+';
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const m = (abs - d) * 60;
  return `${sign}${d}° ${m.toFixed(0)}′`;
}

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
    return { widthDeg: fov.widthDeg, heightDeg: fov.heightDeg, rotationDeg: Number(framingStore.rotationAngle ?? 0), rotationConvention: ATLAS_POSITION_ANGLE_CONVENTION };
  } catch {
    return null;
  }
}

// Rotation-only update -- deliberately does NOT call setView, so dragging the slider or running
// "Determine rotation from camera" doesn't also reset any pan offset the user has already made.
function updateFovRotation() {
  if (!viewer || !ready.value) return;
  const fovOverlay = computeFovOverlay();
  if (fovOverlay) viewer.setFieldOfView(fovOverlay);
}
watch(() => framingStore.rotationAngle, updateFovRotation);

function centerOnTarget() {
  if (!viewer) return;
  // The view's own zoom level has to scale with the camera's real FOV, not a fixed guess -- a
  // hardcoded 1.5deg view against a camera whose actual field is wider than that means the FOV
  // box ends up bigger than the whole visible view, so you're zoomed into the middle of it with
  // no edge ever in frame (exactly what happened before this fix). 3x the box's longer side
  // leaves comfortable margin to actually see and pan around it; 1.5deg is just the fallback
  // when no camera FOV is available at all (nothing connected yet).
  const fovOverlay = computeFovOverlay();
  const viewFovDeg = fovOverlay ? Math.max(fovOverlay.widthDeg, fovOverlay.heightDeg) * 3 : 1.5;

  // frame is required -- setView's own coordinate validation (toAtlasCoordinates) throws
  // without one. J2000 matches how the rest of this app treats NINA-sourced RA/Dec (e.g.
  // atlasSelectionToFraming's own coordinateFrame: 'J2000'), and Perihelion's own values are
  // J2000 too (NINA.Astrometry.InputCoordinates).
  viewer.setView({ center: { raDeg: props.raHours * 15, decDeg: props.decDeg, frame: 'J2000' }, fovDeg: viewFovDeg });
  if (fovOverlay) viewer.setFieldOfView(fovOverlay);
  hasOffset.value = false;
  // Explicit, not just relying on onViewChange firing for a programmatic setView -- the overlay
  // should read the true position immediately on (re)center, not whatever it happened to show
  // before.
  currentCenter.value = { raHours: props.raHours, decDeg: props.decDeg };

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
      onViewChange: (viewState) => {
        currentCenter.value = { raHours: viewState.center.raDeg / 15, decDeg: viewState.center.decDeg };
      },
      onError: (error) => {
        console.warn('[Perihelion] Framing view sky-survey error:', error.message);
      },
    });
    // Equatorial, not horizontal (unlike CelestiaAtlasView.vue's own choice, which is about
    // live Alt/Az sky-browsing from the observer's current location -- the right call there,
    // wrong one here). In horizontal mode "up" on screen tracks the local zenith, which rotates
    // relative to celestial north as sidereal time advances -- so a fixed rotationDeg (measured
    // "from celestial north", per FieldOfViewOverlay's own rotationConvention) would land at a
    // different screen angle depending on what time it happens to be, not a stable one. This is
    // almost certainly why 0 degrees still showed up tilted. Rotation for framing/rotator
    // purposes needs to be fixed relative to the sky, not the horizon.
    viewer.setCoordinateMode('equatorial');
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

<style scoped>
/* Matches CelestiaAtlasView.vue's own override -- the library renders this credit banner by
   default, but the app-wide view already hides it, so showing it only here would be an
   inconsistency rather than added compliance (wherever this app satisfies DSS/CDS attribution,
   it already does so consistently without this). */
:deep(.celestia-atlas-survey-credit) {
  display: none !important;
}
</style>
