<template>
  <div class="celestia-atlas-container" :class="containerClasses">
    <div ref="viewerContainer" class="celestia-atlas-viewer" />
    <canvas ref="secondaryFovCanvas" class="celestia-atlas-secondary-fov" />
    <div v-if="ready" class="celestia-atlas-search">
      <input
        v-model="searchQuery"
        class="tns-input w-full"
        type="search"
        :placeholder="t('components.framing.search.placeholder')"
        @input="runSearch"
      />
      <ul v-if="searchResults.length" class="celestia-atlas-results tns-select">
        <li
          v-for="result in searchResults"
          :key="result.catalogId || result.id"
          class="p-2 cursor-pointer hover:bg-blue-700"
          @click="selectSearchResult(result)"
        >
          {{ result.displayName || result.name || result.id }}
        </li>
      </ul>
    </div>
    <div v-if="ready && store.mountInfo.Connected" class="celestia-atlas-mount-controls">
      <button
        class="celestia-atlas-icon-button bg-gray-700 border border-cyan-600 rounded-full"
        type="button"
        title="Center view on mount position"
        aria-label="Center view on mount position"
        @click="focusMount"
      >
        <ViewfinderCircleIcon class="h-7 w-7" />
      </button>
      <button
        class="celestia-atlas-icon-button border border-cyan-600 rounded-full"
        :class="mountFollow ? 'bg-cyan-600' : 'bg-gray-700'"
        type="button"
        title="Toggle auto-sync view with mount"
        aria-label="Toggle auto-sync view with mount"
        @click="toggleMountFollow"
      >
        <ArrowPathIcon class="h-7 w-7" />
      </button>
    </div>
    <AtlasFovRotation
      v-if="showFovControls"
      :get-view-center="getAtlasViewCenter"
      :active="store.showSkyAtlas"
      default-target-name="Celestia Atlas view"
    />
    <div v-if="ready" class="celestia-atlas-controls">
      <CelestiaAtlasAbout />
      <CelestiaAtlasSettings
        :catalog-object-types="catalogFacets.objectTypes"
        :catalogue-groups="catalogFacets.catalogueGroups"
        :star-catalogue-groups="catalogFacets.starCatalogueGroups"
        :comet-refresh-state="cometRefreshState"
        :comet-refresh-count="cometRefreshCount"
        :comet-refresh-error="cometRefreshError"
        @refresh-comets="refreshCometData"
      />
    </div>
    <div v-if="ready" class="celestia-atlas-clock">
      <div class="flex gap-1">
        <button
          class="celestia-atlas-icon-button bg-black/80 rounded-full"
          type="button"
          :title="clockPaused ? 'Play' : 'Pause'"
          :aria-label="clockPaused ? 'Play' : 'Pause'"
          @click="toggleClock"
        >
          <PlayIcon v-if="clockPaused" class="h-7 w-7" />
          <PauseIcon v-else class="h-7 w-7" />
        </button>
        <button
          class="bg-black/80 rounded-full px-2 py-2 font-mono text-sm"
          type="button"
          @click="toggleClockPanel"
        >
          {{ clockLabel }}
        </button>
      </div>
      <div v-if="clockPanelVisible" class="celestia-atlas-clock-panel">
        <label>
          {{ t('components.celestiaAtlas.datetime.date') }}
          <input v-model="clockDate" class="tns-input" type="date" @change="applyClockInput" />
        </label>
        <label>
          {{ t('components.celestiaAtlas.datetime.time') }}
          <input v-model="clockTime" class="tns-input" type="time" @change="applyClockInput" />
        </label>
        <label>
          {{ t('components.celestiaAtlas.datetime.speed') }}: {{ Math.pow(2, clockSpeedPower) }}×
          <input v-model.number="clockSpeedPower" type="range" min="-10" max="10" step="1" />
        </label>
        <button class="tns-btn-primary" type="button" @click="resetClockToServer">
          {{ t('components.celestiaAtlas.datetime.now') }}
        </button>
      </div>
    </div>
    <SelectedSkyObject
      v-if="selectedObjectCommand"
      :selected-object="selectedObjectCommand.names"
      :selected-object-ra="selectedObjectCommand.raString"
      :selected-object-dec="selectedObjectCommand.decString"
      :selected-object-ra-deg="selectedObjectCommand.raDeg"
      :selected-object-dec-deg="selectedObjectCommand.decDeg"
      :command-target="selectedObjectCommand.commandTarget"
      dismissible
      @dismiss="hideSelectedTargetDetails"
    />
    <div v-if="errorMessage" class="celestia-atlas-error" role="alert">
      {{ errorMessage }}
    </div>
    <div v-else-if="landscapeErrorMessage" class="celestia-atlas-landscape-error" role="status">
      {{ landscapeErrorMessage }}
    </div>
    <div v-else-if="!ready" class="celestia-atlas-loading">
      {{ t('components.celestiaAtlas.loading') }}
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { calculateCameraFieldOfView, createCelestiaAtlasViewer } from '@acocalypso/celestia-atlas';
import { Capacitor } from '@capacitor/core';
import { useI18n } from 'vue-i18n';
import { useOrientation } from '@/composables/useOrientation';
import { apiStore } from '@/store/store';
import { useFramingStore } from '@/store/framingStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  atlasSearchResultToTarget,
  ninaMountToAtlas,
  ninaObserverToAtlas,
  toNinaJ2000Coordinates,
} from '@/integrations/celestiaAtlas/contracts';
import { atlasSelectionToCommandModel } from '@/integrations/celestiaAtlas/selectionModel';
import { buildEmbeddedAtlasCatalog } from '@/integrations/celestiaAtlas/catalogLayers';
import {
  buildAtlasCatalogFacets,
  buildAtlasStarFacets,
  normalizeAtlasFacetSelection,
} from '@/integrations/celestiaAtlas/catalogFilters';
import { normalizeAtlasMagnitudeLimit } from '@/integrations/celestiaAtlas/magnitudeFilters';
import { ATLAS_POSITION_ANGLE_CONVENTION } from '@/integrations/celestiaAtlas/positionAngle';
import { computeSecondaryFieldOfViewFrame } from '@/integrations/celestiaAtlas/secondaryFieldOfView';
import {
  createDssSkySurveySource,
  resolveCelestiaAtlasDataBaseUrl,
} from '@/integrations/celestiaAtlas/offlineSkySurvey';
import { timeSync } from '@/utils/timeSync';
import { useHorizonStore } from '@/plugins/horizon-creator/store/horizonStore';
import { interpolateHorizon } from '@/plugins/horizon-creator/utils/horizon-utils';
import { isAppBackgrounded } from '@/utils/appLifecycle';
import { resolveLandscapeSource } from '@/store/utils/celestiaAtlasLandscapeSource';
import apiService from '@/services/apiService';
import {
  downloadLiveCometCatalog,
  loadCachedCometCatalog,
  saveCachedCometCatalog,
} from '@/integrations/celestiaAtlas/cometCatalog';
import AtlasFovRotation from '@/components/celestiaAtlas/AtlasFovRotation.vue';
import CelestiaAtlasSettings from '@/components/celestiaAtlas/CelestiaAtlasSettings.vue';
import CelestiaAtlasAbout from '@/components/celestiaAtlas/CelestiaAtlasAbout.vue';
import SelectedSkyObject from '@/components/celestiaAtlas/SelectedObject.vue';
import {
  ArrowPathIcon,
  PauseIcon,
  PlayIcon,
  ViewfinderCircleIcon,
} from '@heroicons/vue/24/outline';

const store = apiStore();
const framingStore = useFramingStore();
const settingsStore = useSettingsStore();
const horizonStore = useHorizonStore();
const { t } = useI18n();
const { isLandscape } = useOrientation();
const viewerContainer = ref(null);
const secondaryFovCanvas = ref(null);
const ready = ref(false);
const errorMessage = ref('');
const landscapeErrorMessage = ref('');
const searchQuery = ref('');
const searchResults = ref([]);
const selectedTarget = ref(null);
const catalogFacets = ref({ objectTypes: [], catalogueGroups: [], starCatalogueGroups: [] });
const mountFollow = ref(false);
const clockPaused = ref(false);
const clockLabel = ref('');
const clockPanelVisible = ref(false);
const clockDate = ref('');
const clockTime = ref('');
const clockSpeedPower = ref(0);
const cometRefreshState = ref('idle');
const cometRefreshCount = ref(0);
const cometRefreshError = ref('');
let viewer = null;
let viewSaveTimer = null;
let pendingViewState = null;
let clockDisplayTimer = null;
let searchTimer = null;
let secondaryFovTimer = null;
let disposed = false;
const VIEW_STATE_KEY = 'tns.celestia-atlas.view';
const SEARCH_DEBOUNCE_MS = 120;

const containerClasses = computed(() => ({
  'celestia-atlas-portrait': !isLandscape.value,
  'celestia-atlas-landscape': isLandscape.value,
}));
const showFovControls = computed(
  () =>
    ready.value &&
    Boolean(store.cameraInfo.Connected) &&
    Boolean(store.profileInfo?.TelescopeSettings?.FocalLength)
);
const selectedObjectCommand = computed(() => atlasSelectionToCommandModel(selectedTarget.value));

function getAtlasViewCenter() {
  const center = viewer?.getView().center;
  return center ? toNinaJ2000Coordinates(center) : null;
}

function updateObserver() {
  if (!viewer || !store.profileInfo?.AstrometrySettings) return;
  viewer.setObserver(ninaObserverToAtlas(store.profileInfo.AstrometrySettings));
}

function updateFieldOfView() {
  if (!viewer) return;
  const profile = store.profileInfo;
  const apertureMm = Number(profile?.TelescopeSettings?.Aperture);
  let fov;
  try {
    fov = calculateCameraFieldOfView({
      pixelSizeMicrons: Number(profile?.CameraSettings?.PixelSize),
      focalLengthMm: Number(profile?.TelescopeSettings?.FocalLength),
      sensorWidthPx: Number(profile?.FramingAssistantSettings?.CameraWidth),
      sensorHeightPx: Number(profile?.FramingAssistantSettings?.CameraHeight),
      ...(Number.isFinite(apertureMm) && apertureMm > 0 ? { apertureMm } : {}),
    });
  } catch {
    viewer.setFieldOfView(null);
    return;
  }
  viewer.setFieldOfView({
    widthDeg: fov.widthDeg,
    heightDeg: fov.heightDeg,
    rotationDeg: Number(framingStore.rotationAngle ?? 0),
    rotationConvention: ATLAS_POSITION_ANGLE_CONVENTION,
    mosaic: framingStore.isMosaicMode
      ? {
          columns: Number(framingStore.mosaicCols),
          rows: Number(framingStore.mosaicRows),
          overlapPercent: Number(framingStore.mosaicOverlap),
        }
      : undefined,
  });
}

// Draws the "actual" frame from the last plate solve as a second, dashed
// overlay on top of the package's own canvas, concentric with the primary
// frame from updateFieldOfView() — the package itself only supports one FOV
// slot (see docs/features/platesolve-camera-rotation.md, "Open questions").
function drawSecondaryFieldOfView() {
  const canvas = secondaryFovCanvas.value;
  if (!canvas || !viewer) return;
  const context = canvas.getContext('2d');
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const backingWidth = Math.max(1, Math.round(width * dpr));
  const backingHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const profile = store.profileInfo;
  const apertureMm = Number(profile?.TelescopeSettings?.Aperture);
  let fov;
  try {
    fov = calculateCameraFieldOfView({
      pixelSizeMicrons: Number(profile?.CameraSettings?.PixelSize),
      focalLengthMm: Number(profile?.TelescopeSettings?.FocalLength),
      sensorWidthPx: Number(profile?.FramingAssistantSettings?.CameraWidth),
      sensorHeightPx: Number(profile?.FramingAssistantSettings?.CameraHeight),
      ...(Number.isFinite(apertureMm) && apertureMm > 0 ? { apertureMm } : {}),
    });
  } catch {
    return;
  }

  const state = viewer.getState();
  const hasSolved = framingStore.hasSolvedRotation;
  const angleDeg = hasSolved
    ? framingStore.solvedRotationAngle
    : Number(framingStore.rotationAngle ?? 0);
  const frame = computeSecondaryFieldOfViewFrame({
    view: state.view,
    observer: state.observer,
    coordinateMode: state.coordinateMode,
    utcMs: viewer.getTime(),
    widthDeg: fov.widthDeg,
    heightDeg: fov.heightDeg,
    angleDeg,
    containerWidth: width,
  });
  if (!frame) return;

  context.save();
  context.translate(width / 2, height / 2);
  context.rotate((frame.screenRotationDeg * Math.PI) / 180);
  context.lineWidth = 2;
  if (hasSolved) {
    context.strokeStyle = 'rgb(103, 232, 249)';
    context.setLineDash([8, 6]);
  } else {
    context.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    context.setLineDash([2, 4]);
  }
  context.strokeRect(
    -frame.panelWidth / 2,
    -frame.panelHeight / 2,
    frame.panelWidth,
    frame.panelHeight
  );
  context.restore();
}

function startSecondaryFovTimer() {
  if (secondaryFovTimer !== null) return;
  secondaryFovTimer = setInterval(drawSecondaryFieldOfView, 1000);
}

function stopSecondaryFovTimer() {
  if (secondaryFovTimer === null) return;
  clearInterval(secondaryFovTimer);
  secondaryFovTimer = null;
}

function toggleMountFollow() {
  mountFollow.value = !mountFollow.value;
  viewer?.setMountFollow(mountFollow.value);
}

function focusMount() {
  viewer?.focusMount();
}

function toggleClock() {
  clockPaused.value = !clockPaused.value;
  viewer?.setTimeRate(clockPaused.value ? 0 : Math.pow(2, clockSpeedPower.value));
  updateClockLabel();
}

function updateClockInputs() {
  if (!viewer) return;
  const date = new Date(viewer.getTime());
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  clockDate.value = local.toISOString().slice(0, 10);
  clockTime.value = local.toISOString().slice(11, 16);
}

function toggleClockPanel() {
  clockPanelVisible.value = !clockPanelVisible.value;
  if (clockPanelVisible.value) updateClockInputs();
}

function applyClockInput() {
  if (!viewer || !clockDate.value || !clockTime.value) return;
  const value = new Date(`${clockDate.value}T${clockTime.value}:00`);
  if (!Number.isNaN(value.getTime())) viewer.setTime(value.getTime());
  updateClockLabel();
}

async function resetClockToServer() {
  await timeSync.ensureSync();
  viewer?.setTime(timeSync.getServerTime());
  updateClockInputs();
  updateClockLabel();
}

function updateClockLabel() {
  if (!viewer) return;
  clockLabel.value = new Date(viewer.getTime()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function startClockDisplay() {
  updateClockLabel();
  if (clockDisplayTimer === null) clockDisplayTimer = setInterval(updateClockLabel, 1000);
}

function stopClockDisplay() {
  if (clockDisplayTimer !== null) clearInterval(clockDisplayTimer);
  clockDisplayTimer = null;
}

function queueViewPersistence(viewState) {
  pendingViewState = viewState;
  if (viewSaveTimer !== null) clearTimeout(viewSaveTimer);
  viewSaveTimer = setTimeout(() => {
    sessionStorage.setItem(VIEW_STATE_KEY, JSON.stringify(pendingViewState));
    viewSaveTimer = null;
  }, 200);
}

function updateMount() {
  if (!viewer) return;
  try {
    viewer.setMountPosition(ninaMountToAtlas(store.mountInfo, Date.now()));
  } catch (error) {
    viewer.setMountPosition(null);
    console.warn('[Celestia Atlas] Mount marker omitted:', error.message);
  }
}

function updateDisplayOptions() {
  if (!viewer) return;
  viewer.setDisplayOptions({
    grid: Boolean(settingsStore.celestiaAtlas.equatorialLinesVisible),
    azimuthalGrid: Boolean(settingsStore.celestiaAtlas.azimuthalLinesVisible),
    meridian: Boolean(settingsStore.celestiaAtlas.meridianLinesVisible),
    ecliptic: Boolean(settingsStore.celestiaAtlas.eclipticLinesVisible),
    atmosphere: Boolean(settingsStore.celestiaAtlas.atmosphereVisible),
    milkyWay: false,
    skySurvey: settingsStore.celestiaAtlas.skySurveyVisible !== false,
    constellations: Boolean(settingsStore.celestiaAtlas.constellationsLinesVisible),
    labels: true,
    cardinals: true,
    starMagnitudeLimit: normalizeAtlasMagnitudeLimit(
      settingsStore.celestiaAtlas.starMagnitudeLimit,
      6.5
    ),
    galaxyMagnitudeLimit: normalizeAtlasMagnitudeLimit(
      settingsStore.celestiaAtlas.galaxyMagnitudeLimit,
      30
    ),
    deepSkyMagnitudeLimit: normalizeAtlasMagnitudeLimit(
      settingsStore.celestiaAtlas.deepSkyMagnitudeLimit,
      30
    ),
    deepSkyObjectTypes: normalizeAtlasFacetSelection(
      settingsStore.celestiaAtlas.deepSkyObjectTypes,
      catalogFacets.value.objectTypes
    ),
    starCatalogueGroups: normalizeAtlasFacetSelection(
      settingsStore.celestiaAtlas.starCatalogueGroups,
      catalogFacets.value.starCatalogueGroups
    ),
    deepSkyCatalogueGroups: normalizeAtlasFacetSelection(
      settingsStore.celestiaAtlas.deepSkyCatalogueGroups,
      catalogFacets.value.catalogueGroups
    ),
    deepSkyObjects: Boolean(settingsStore.celestiaAtlas.dsosVisible),
    horizon: Boolean(settingsStore.celestiaAtlas.landscapesVisible),
    hideBelowHorizon: settingsStore.celestiaAtlas.hideBelowHorizon !== false,
  });
}

function synchronizeCatalogFilterSettings() {
  const mappings = [
    ['deepSkyObjectTypes', catalogFacets.value.objectTypes],
    ['deepSkyCatalogueGroups', catalogFacets.value.catalogueGroups],
    ['starCatalogueGroups', catalogFacets.value.starCatalogueGroups],
  ];

  for (const [setting, facets] of mappings) {
    const current = settingsStore.celestiaAtlas[setting];
    const normalized = normalizeAtlasFacetSelection(current, facets);
    if (JSON.stringify(current) !== JSON.stringify(normalized)) {
      settingsStore.celestiaAtlas[setting] = normalized;
    }
  }
}

function updateHorizon() {
  if (!viewer) return;
  if (horizonStore.points.length < 2) {
    viewer.setHorizon([]);
    return;
  }
  const points = interpolateHorizon(horizonStore.points, 2).map(({ az, alt }) => ({
    azimuthDeg: az,
    altitudeDeg: alt,
  }));
  points.push({ ...points[0], azimuthDeg: 360 });
  viewer.setHorizon(points);
}

function updateLandscape() {
  if (!viewer) return;
  landscapeErrorMessage.value = '';
  const baseUrl = atlasDataBaseUrl();
  const config = resolveLandscapeSource(settingsStore.celestiaAtlas, baseUrl);
  void viewer.setLandscape(config.visible ? config.source : null);
}

function atlasDataBaseUrl() {
  return resolveCelestiaAtlasDataBaseUrl({
    native: Capacitor.isNativePlatform(),
    protocol: settingsStore.backendProtocol || 'http',
    host: settingsStore.connection.ip,
    port: settingsStore.connection.port,
  });
}

function updateSkySurveySource() {
  if (!viewer) return;
  viewer.setSkySurvey(createDssSkySurveySource(atlasDataBaseUrl()));
}

function runSearch() {
  if (searchTimer !== null) clearTimeout(searchTimer);
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    searchTimer = null;
    return;
  }
  searchTimer = setTimeout(() => {
    searchResults.value = viewer?.search(searchQuery.value) ?? [];
    searchTimer = null;
  }, SEARCH_DEBOUNCE_MS);
}

function selectSearchResult(result) {
  if (searchTimer !== null) clearTimeout(searchTimer);
  searchTimer = null;
  searchResults.value = [];
  let target;
  try {
    target = atlasSearchResultToTarget(result);
  } catch (error) {
    console.warn('[Celestia Atlas] Ignored invalid search result:', error.message);
    return;
  }
  viewer.focusTarget(target);
  viewer.select(target);
}

function hideSelectedTargetDetails() {
  selectedTarget.value = null;
}

async function refreshCometData() {
  if (!viewer || cometRefreshState.value === 'loading') return;
  cometRefreshState.value = 'loading';
  cometRefreshError.value = '';
  try {
    const payload = await downloadLiveCometCatalog(apiService.proxyRequest);
    viewer.setCometElements(payload.objects);
    saveCachedCometCatalog(payload);
    if (searchQuery.value.trim()) searchResults.value = viewer.search(searchQuery.value);
    cometRefreshState.value = 'success';
    cometRefreshCount.value = payload.meta.objectCount;
  } catch (error) {
    cometRefreshState.value = 'error';
    cometRefreshError.value = error instanceof Error ? error.message : String(error);
  }
}

function updateVisibility() {
  if (!viewer) return;
  if (store.showSkyAtlas && !document.hidden && !isAppBackgrounded.value) {
    viewer.resume();
    startClockDisplay();
    startSecondaryFovTimer();
  } else {
    viewer.pause();
    stopClockDisplay();
    stopSecondaryFovTimer();
  }
}

function handleVisibilityChange() {
  updateVisibility();
}

watch(() => store.profileInfo?.AstrometrySettings, updateObserver, { deep: true });
watch(
  () => [
    store.profileInfo?.CameraSettings?.PixelSize,
    store.profileInfo?.TelescopeSettings?.FocalLength,
    store.profileInfo?.FramingAssistantSettings?.CameraWidth,
    store.profileInfo?.FramingAssistantSettings?.CameraHeight,
    framingStore.rotationAngle,
    framingStore.solvedRotationAngle,
    framingStore.isMosaicMode,
    framingStore.mosaicCols,
    framingStore.mosaicRows,
    framingStore.mosaicOverlap,
  ],
  () => {
    updateFieldOfView();
    drawSecondaryFieldOfView();
  }
);
watch(() => store.showSkyAtlas, updateVisibility);
watch(isAppBackgrounded, updateVisibility);
watch(clockSpeedPower, (value) => {
  if (!clockPaused.value) viewer?.setTimeRate(Math.pow(2, Number(value)));
});
watch(() => store.mountInfo, updateMount, { deep: true });
watch(() => horizonStore.points, updateHorizon, { deep: true });
watch(
  () => [
    settingsStore.celestiaAtlas.landscapesVisible,
    settingsStore.celestiaAtlas.landscapeSourceMode,
    settingsStore.celestiaAtlas.customLandscapeUrl,
    settingsStore.celestiaAtlas.customLandscapeKey,
  ],
  updateLandscape
);
watch(
  () => [settingsStore.backendProtocol, settingsStore.connection.ip, settingsStore.connection.port],
  () => {
    updateLandscape();
    updateSkySurveySource();
  }
);
watch(
  () => [
    settingsStore.celestiaAtlas.equatorialLinesVisible,
    settingsStore.celestiaAtlas.azimuthalLinesVisible,
    settingsStore.celestiaAtlas.meridianLinesVisible,
    settingsStore.celestiaAtlas.eclipticLinesVisible,
    settingsStore.celestiaAtlas.atmosphereVisible,
    settingsStore.celestiaAtlas.constellationsLinesVisible,
    settingsStore.celestiaAtlas.dsosVisible,
    settingsStore.celestiaAtlas.starMagnitudeLimit,
    settingsStore.celestiaAtlas.starCatalogueGroups,
    settingsStore.celestiaAtlas.galaxyMagnitudeLimit,
    settingsStore.celestiaAtlas.deepSkyMagnitudeLimit,
    settingsStore.celestiaAtlas.deepSkyObjectTypes,
    settingsStore.celestiaAtlas.deepSkyCatalogueGroups,
    settingsStore.celestiaAtlas.landscapesVisible,
    settingsStore.celestiaAtlas.hideBelowHorizon,
    settingsStore.celestiaAtlas.skySurveyVisible,
  ],
  updateDisplayOptions
);

onMounted(async () => {
  try {
    await nextTick();
    void store.fetchProfilInfos().catch(() => {});
    void timeSync
      .ensureSync()
      .then(() => {
        if (!disposed) viewer?.setTime(timeSync.getServerTime());
      })
      .catch(() => {});
    const [
      openNgcModule,
      abellPlanetaryNebulaeModule,
      stellariumSupplementModule,
      brightSkyModule,
      hygStarsModule,
      westernConstellationsModule,
      saoCrossIdsModule,
      wrStarsModule,
    ] = await Promise.all([
      import('@acocalypso/celestia-atlas/viewer-catalog-data'),
      import('@acocalypso/celestia-atlas/abell-pn-data'),
      import('@acocalypso/celestia-atlas/stellarium-supplement-data'),
      import('@acocalypso/celestia-atlas/bright-sky-data'),
      import('@acocalypso/celestia-atlas/hyg-star-data'),
      import('@acocalypso/celestia-atlas/western-constellation-data'),
      import('@acocalypso/celestia-atlas/sao-star-crossids'),
      import('@acocalypso/celestia-atlas/wr-star-data'),
    ]);
    if (disposed) return;
    const { catalog, stars, constellations } = buildEmbeddedAtlasCatalog({
      openNgc: openNgcModule.default,
      abellPlanetaryNebulae: abellPlanetaryNebulaeModule.default,
      stellariumSupplement: stellariumSupplementModule.default,
      brightSky: brightSkyModule.default,
      hygStars: hygStarsModule.default,
      westernConstellations: westernConstellationsModule.default,
      saoCrossIds: saoCrossIdsModule.default,
      wrStars: wrStarsModule.default,
    });
    catalogFacets.value = {
      ...buildAtlasCatalogFacets(catalog),
      starCatalogueGroups: buildAtlasStarFacets(stars),
    };
    synchronizeCatalogFilterSettings();
    const cachedCometCatalog = loadCachedCometCatalog();
    viewer = createCelestiaAtlasViewer({
      container: viewerContainer.value,
      observer: ninaObserverToAtlas(store.profileInfo.AstrometrySettings),
      utcMs: timeSync.getServerTime(),
      catalog,
      stars,
      constellations,
      ...(cachedCometCatalog ? { cometElements: cachedCometCatalog.objects } : {}),
      milkyWayPanoramaUrl: null,
      skySurveySource: createDssSkySurveySource(atlasDataBaseUrl()),
      onSelect: (target) => {
        selectedTarget.value = target;
      },
      onViewChange: (viewState) => {
        queueViewPersistence(viewState);
        drawSecondaryFieldOfView();
      },
      onError: (error) => {
        console.warn('[Celestia Atlas] Landscape unavailable:', error.message);
        landscapeErrorMessage.value = t(
          'components.celestiaAtlas.settings.landscape_list_load_failed'
        );
      },
    });
    viewer.setCoordinateMode('horizontal');
    const savedView = sessionStorage.getItem(VIEW_STATE_KEY);
    if (savedView) {
      try {
        viewer.setView(JSON.parse(savedView));
      } catch (error) {
        sessionStorage.removeItem(VIEW_STATE_KEY);
        console.warn('[Celestia Atlas] Ignored invalid saved view:', error.message);
      }
    }
    updateFieldOfView();
    drawSecondaryFieldOfView();
    updateMount();
    updateDisplayOptions();
    updateHorizon();
    updateLandscape();
    updateVisibility();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    ready.value = true;
  } catch (error) {
    if (!disposed) errorMessage.value = error instanceof Error ? error.message : String(error);
  }
});

onBeforeUnmount(() => {
  disposed = true;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  if (viewSaveTimer !== null) clearTimeout(viewSaveTimer);
  if (searchTimer !== null) clearTimeout(searchTimer);
  stopSecondaryFovTimer();
  if (pendingViewState) sessionStorage.setItem(VIEW_STATE_KEY, JSON.stringify(pendingViewState));
  stopClockDisplay();
  viewer?.destroy();
  viewer = null;
});
</script>

<style scoped>
.celestia-atlas-container {
  position: fixed;
  z-index: 1;
}
.celestia-atlas-viewer {
  width: 100%;
  height: 100%;
  background: #03060d;
}
.celestia-atlas-secondary-fov {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
:deep(.celestia-atlas-survey-credit) {
  display: none !important;
}
.celestia-atlas-landscape {
  top: 0;
  left: var(--nav-width);
  width: calc(100vw - var(--nav-width));
  height: calc(100dvh - 2rem - env(safe-area-inset-bottom, 0px));
}
.celestia-atlas-portrait {
  top: 5rem;
  left: 0;
  width: 100vw;
  height: calc(100dvh - 6.5rem - env(safe-area-inset-bottom, 0px));
}
.celestia-atlas-loading,
.celestia-atlas-error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  color: white;
  background: #03060d;
}
.celestia-atlas-landscape-error {
  position: absolute;
  left: 50%;
  bottom: 4.5rem;
  transform: translateX(-50%);
  max-width: min(90%, 32rem);
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(120, 53, 15, 0.9);
  color: white;
  z-index: 20;
}
.celestia-atlas-error {
  color: #fca5a5;
}
.celestia-atlas-search {
  position: absolute;
  z-index: 3;
  top: calc(1rem + env(safe-area-inset-top, 0px));
  right: calc(1rem + env(safe-area-inset-right, 0px));
  width: min(24rem, calc(100% - 2rem));
}
.celestia-atlas-results {
  max-height: 20rem;
  overflow-y: auto;
}
.celestia-atlas-controls {
  position: absolute;
  z-index: 4;
  right: calc(1rem + env(safe-area-inset-right, 0px));
  bottom: var(--above-statusbar);
  display: flex;
  gap: 0.5rem;
  padding: 0.4rem;
  color: white;
  background: rgb(0 0 0 / 85%);
  border-radius: 9999px;
}
.celestia-atlas-mount-controls {
  position: absolute;
  z-index: 3;
  left: calc(1rem + env(safe-area-inset-left, 0px));
  bottom: var(--above-statusbar);
  display: flex;
  gap: 0.5rem;
  color: white;
}
.celestia-atlas-clock {
  position: absolute;
  z-index: 3;
  left: 50%;
  bottom: var(--above-statusbar);
  color: white;
  transform: translateX(-50%);
}
.celestia-atlas-clock-panel {
  position: absolute;
  bottom: 3.5rem;
  left: 50%;
  display: grid;
  gap: 0.6rem;
  width: min(22rem, calc(100vw - 2rem));
  padding: 0.8rem;
  color: white;
  background: rgb(3 7 18 / 95%);
  border: 1px solid rgb(8 145 178);
  border-radius: 0.75rem;
  transform: translateX(-50%);
}
:deep(.celestia-atlas-icon-button) {
  display: inline-grid;
  width: var(--spacing-touch);
  height: var(--spacing-touch);
  flex: 0 0 var(--spacing-touch);
  place-items: center;
  padding: 0.5rem;
  color: white;
}
.celestia-atlas-clock-panel label {
  display: grid;
  gap: 0.25rem;
}
@media (max-width: 390px) {
  .celestia-atlas-clock {
    bottom: calc(var(--above-statusbar) + var(--spacing-touch) + 0.5rem);
  }
}
</style>
