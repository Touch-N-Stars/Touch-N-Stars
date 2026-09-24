<template>
  <div class="celestia-atlas-container" :class="containerClasses">
    <div ref="viewerContainer" class="celestia-atlas-viewer" @pointermove="updateCompass" />
    <canvas ref="secondaryFovCanvas" class="celestia-atlas-secondary-fov" />

    <!-- Header: search and settings. Everything else lives in the toolbar below. -->
    <div v-if="ready" class="celestia-atlas-header">
      <div class="celestia-atlas-search">
        <MagnifyingGlassIcon class="celestia-atlas-search-icon" aria-hidden="true" />
        <input
          id="atlas-search"
          v-model="searchQuery"
          class="tns-input celestia-atlas-search-input"
          type="search"
          :placeholder="t('components.framing.search.placeholder')"
          @input="runSearch"
        />
        <ul v-if="searchResults.length" class="celestia-atlas-results">
          <li v-for="result in searchResults" :key="result.catalogId || result.id">
            <button class="celestia-atlas-result" type="button" @click="selectSearchResult(result)">
              {{ result.displayName || result.name || result.id }}
            </button>
          </li>
        </ul>
      </div>
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

    <!-- One message slot above the toolbar: survey offer / progress, else landscape errors -->
    <div
      v-if="surveyBannerMode"
      class="celestia-atlas-toast"
      role="status"
      data-testid="atlas-survey-offer"
    >
      <template v-if="surveyBannerMode === 'progress'">
        <p class="text-sm text-gray-100">
          {{
            t('components.celestiaAtlas.survey.offer_progress', {
              percent: Math.round(surveyStore.progressFraction * 100),
            })
          }}
        </p>
        <div class="celestia-atlas-survey-progress">
          <div :style="{ width: `${surveyStore.progressFraction * 100}%` }" />
        </div>
      </template>
      <template v-else>
        <p class="text-sm text-gray-100">
          {{
            t(
              surveyStore.legacyFormat
                ? 'components.celestiaAtlas.survey.offer_text_legacy'
                : 'components.celestiaAtlas.survey.offer_text',
              {
                size: formatSurveyBytes(
                  estimateDssSurveyBytes(DSS_SURVEY_MIN_ORDER, DSS_SURVEY_BASE_ORDER)
                ),
              }
            )
          }}
        </p>
        <p v-if="surveyStore.actionError" class="text-xs text-red-300">
          {{ surveyStore.actionError }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            class="tns-btn-primary w-auto! min-h-touch"
            type="button"
            :disabled="surveyStore.busy"
            @click="acceptSurveyOffer"
          >
            {{ t('components.celestiaAtlas.survey.offer_accept') }}
          </button>
          <button
            class="tns-btn-secondary w-auto! min-h-touch"
            type="button"
            @click="dismissSurveyOffer"
          >
            {{ t('components.celestiaAtlas.survey.offer_decline') }}
          </button>
        </div>
      </template>
    </div>
    <div
      v-else-if="landscapeErrorMessage"
      class="celestia-atlas-toast celestia-atlas-toast-warning"
      role="status"
    >
      {{ landscapeErrorMessage }}
    </div>

    <!-- The one sheet: target, time or layers -->
    <AtlasSheet
      v-if="ready"
      :open="activeSheet !== null"
      :title="sheetTitle"
      :peek="rulerScrubbing"
      @close="closeSheet"
    >
      <AtlasTargetPanel
        v-if="activeSheet === 'target'"
        :selection="selectedObjectCommand"
        :get-view-center="getAtlasViewCenter"
        :active="store.showSkyAtlas"
        :fov-available="showFovControls"
        :camera-fov="cameraFov"
        :missing-equipment-settings="hasMissingEquipmentSettings"
        :show-preview="surveyStore.installedOrder === null"
        :clock-utc-ms="clockMinuteUtcMs"
        default-target-name="Celestia Atlas view"
        @clear-selection="hideSelectedTargetDetails"
        @scrub="rulerScrubbing = $event"
      />
      <div v-else-if="activeSheet === 'clock'" class="grid gap-3">
        <div class="grid grid-cols-2 gap-2">
          <button class="tns-btn-secondary" type="button" @click="toggleClock">
            <PlayIcon v-if="clockPaused" class="h-5 w-5 shrink-0" />
            <PauseIcon v-else class="h-5 w-5 shrink-0" />
            <span>
              {{
                t(
                  clockPaused
                    ? 'components.celestiaAtlas.datetime.play'
                    : 'components.celestiaAtlas.datetime.pause'
                )
              }}
            </span>
          </button>
          <button class="tns-btn-primary" type="button" @click="resetClockToServer">
            {{ t('components.celestiaAtlas.datetime.now') }}
          </button>
        </div>
        <label class="grid gap-1 text-sm text-content-muted" for="atlas-clock-date">
          {{ t('components.celestiaAtlas.datetime.date') }}
          <input
            id="atlas-clock-date"
            v-model="clockDate"
            class="tns-input"
            type="date"
            @change="applyClockInput"
          />
        </label>
        <label class="grid gap-1 text-sm text-content-muted" for="atlas-clock-time">
          {{ t('components.celestiaAtlas.datetime.time') }}
          <input
            id="atlas-clock-time"
            v-model="clockTime"
            class="tns-input"
            type="time"
            @change="applyClockInput"
          />
        </label>
        <label class="grid gap-1 text-sm text-content-muted" for="atlas-clock-speed">
          <span class="flex justify-between gap-2">
            <span>{{ t('components.celestiaAtlas.datetime.speed') }}</span>
            <output class="font-mono tabular-nums text-content">
              {{ Math.pow(2, clockSpeedPower) }}×
            </output>
          </span>
          <input
            id="atlas-clock-speed"
            v-model.number="clockSpeedPower"
            class="h-11 w-full accent-cyan-500"
            type="range"
            min="-10"
            max="10"
            step="1"
          />
        </label>
      </div>
      <AtlasLayersPanel v-else-if="activeSheet === 'layers'" />
    </AtlasSheet>

    <div
      v-if="ready && settingsStore.celestiaAtlas.compassVisible !== false"
      class="celestia-atlas-compass"
      role="img"
      :aria-label="`View centre bearing ${compassHeading}`"
      data-testid="atlas-compass"
    >
      <div class="celestia-atlas-compass-dial" aria-hidden="true">
        <span class="compass-n">N</span><span class="compass-e">E</span>
        <span class="compass-s">S</span><span class="compass-w">W</span>
        <span class="compass-needle" :style="{ transform: `rotate(${compassBearing}deg)` }" />
      </div>
      <strong class="celestia-atlas-compass-heading">{{ compassHeading }}</strong>
    </div>

    <AtlasToolbar
      v-if="ready"
      :mount-connected="Boolean(store.mountInfo.Connected)"
      :mount-follow="mountFollow"
      :clock-paused="clockPaused"
      :clock-label="clockLabel"
      :clock-label-short="clockLabelShort"
      :active-sheet="activeSheet"
      :has-selection="selectedObjectCommand !== null"
      @focus-mount="focusMount"
      @toggle-follow="toggleMountFollow"
      @toggle-sheet="toggleSheet"
    />

    <div v-if="errorMessage" class="celestia-atlas-error" role="alert">
      {{ errorMessage }}
    </div>
    <div v-else-if="!ready" class="celestia-atlas-loading">
      {{ t('components.celestiaAtlas.loading') }}
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  calculateCameraFieldOfView,
  createCelestiaAtlasViewer,
  equatorialToHorizontal,
} from '@acocalypso/celestia-atlas';
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
  toAtlasCoordinates,
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
  CELESTIA_ATLAS_DATA_PATH,
  DSS_SURVEY_BASE_ORDER,
  DSS_SURVEY_MIN_ORDER,
  createDssSkySurveySource,
  estimateDssSurveyBytes,
  loadDssSurveyOrder,
  resolveCelestiaAtlasDataBaseUrl,
} from '@/integrations/celestiaAtlas/offlineSkySurvey';
import { getUrls } from '@/services/api/core';
import { useCelestiaAtlasSurveyStore } from '@/store/celestiaAtlasSurveyStore';
import { formatSurveyBytes } from '@/utils/formatSurveyBytes';
import { timeSync } from '@/utils/timeSync';
import { useHorizonStore } from '@/plugins/horizon-creator/store/horizonStore';
import { interpolateHorizon } from '@/plugins/horizon-creator/utils/horizon-utils';
import { isAppBackgrounded, useBackgroundAwarePolling } from '@/utils/appLifecycle';
import { resolveLandscapeSource } from '@/store/utils/celestiaAtlasLandscapeSource';
import apiService from '@/services/apiService';
import {
  downloadLiveCometCatalog,
  loadCachedCometCatalog,
  saveCachedCometCatalog,
} from '@/integrations/celestiaAtlas/cometCatalog';
import AtlasLayersPanel from '@/components/celestiaAtlas/AtlasLayersPanel.vue';
import AtlasSheet from '@/components/celestiaAtlas/AtlasSheet.vue';
import AtlasTargetPanel from '@/components/celestiaAtlas/AtlasTargetPanel.vue';
import AtlasToolbar from '@/components/celestiaAtlas/AtlasToolbar.vue';
import CelestiaAtlasSettings from '@/components/celestiaAtlas/CelestiaAtlasSettings.vue';
import { MagnifyingGlassIcon, PauseIcon, PlayIcon } from '@heroicons/vue/24/outline';

const store = apiStore();
const framingStore = useFramingStore();
const settingsStore = useSettingsStore();
const horizonStore = useHorizonStore();
const surveyStore = useCelestiaAtlasSurveyStore();
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
const clockLabelShort = ref('');
const compassBearing = ref(0);
const compassHeading = computed(() => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return `${directions[Math.round(compassBearing.value / 45) % 8]} ${compassBearing.value.toFixed(1)}°`;
});
// Which sheet is open: 'target' | 'clock' | 'layers' | null. Only one at a time.
const activeSheet = ref(null);
const clockDate = ref('');
const clockTime = ref('');
// Atlas time for the target card, rounded to the minute so the card's altitude
// chart is not redrawn on every one-second tick of the clock display.
const clockMinuteUtcMs = ref(null);
// True while the rotation ruler in the target sheet is being dragged.
const rulerScrubbing = ref(false);
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
  'celestia-atlas-has-sheet': activeSheet.value !== null,
  'celestia-atlas-has-compass': settingsStore.celestiaAtlas.compassVisible !== false,
}));
const showFovControls = computed(
  () =>
    ready.value &&
    Boolean(store.cameraInfo.Connected) &&
    Boolean(store.profileInfo?.TelescopeSettings?.FocalLength)
);
const selectedObjectCommand = computed(() => atlasSelectionToCommandModel(selectedTarget.value));
const sheetTitle = computed(() => {
  if (activeSheet.value === 'target') return t('components.celestiaAtlas.target.title');
  if (activeSheet.value === 'clock') return t('components.celestiaAtlas.datetime.title');
  if (activeSheet.value === 'layers') return t('components.celestiaAtlas.toolbar.layers');
  return '';
});

function toggleSheet(name) {
  if (activeSheet.value === name) {
    closeSheet();
    return;
  }
  if (name === 'clock') updateClockInputs();
  activeSheet.value = name;
}

// Closing the target sheet also drops the selection; the toolbar dot would otherwise
// promise a target the user has just dismissed.
function closeSheet() {
  if (activeSheet.value === 'target') selectedTarget.value = null;
  activeSheet.value = null;
}

function getAtlasViewCenter() {
  const center = viewer?.getView().center;
  return center ? toNinaJ2000Coordinates(center) : null;
}

function updateObserver() {
  if (!viewer || !store.profileInfo?.AstrometrySettings) return;
  viewer.setObserver(ninaObserverToAtlas(store.profileInfo.AstrometrySettings));
}

// Camera field of view from the active NINA profile; null while the profile
// lacks a usable pixel size / focal length / sensor size.
const cameraFov = computed(() => {
  const profile = store.profileInfo;
  const apertureMm = Number(profile?.TelescopeSettings?.Aperture);
  try {
    return calculateCameraFieldOfView({
      pixelSizeMicrons: Number(profile?.CameraSettings?.PixelSize),
      focalLengthMm: Number(profile?.TelescopeSettings?.FocalLength),
      sensorWidthPx: Number(profile?.FramingAssistantSettings?.CameraWidth),
      sensorHeightPx: Number(profile?.FramingAssistantSettings?.CameraHeight),
      ...(Number.isFinite(apertureMm) && apertureMm > 0 ? { apertureMm } : {}),
    });
  } catch {
    return null;
  }
});

// Same check as FramingPage.vue: without these two values no FOV can be drawn.
const hasMissingEquipmentSettings = computed(() => {
  const focalLength = store.profileInfo?.TelescopeSettings?.FocalLength;
  const pixelSize = store.profileInfo?.CameraSettings?.PixelSize;
  return !focalLength || focalLength <= 0 || !pixelSize || pixelSize <= 0;
});

function updateFieldOfView() {
  if (!viewer) return;
  const fov = cameraFov.value;
  if (!fov) {
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

  const fov = cameraFov.value;
  if (!fov) return;

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

// Targets loaded "into framing" elsewhere (favourites list, FITS plate solve,
// sequence container) bump framingStore.framingReloadKey. The atlas answers by
// centring on the stored coordinates — immediately when visible, otherwise on
// the next time it becomes visible. The store is not persisted, so a key > 0
// on mount means a target was loaded before the atlas was first opened.
let appliedFramingReloadKey = 0;
let framingFocusPending = false;

function focusFramingTarget() {
  if (!viewer) return;
  let center;
  try {
    center = toAtlasCoordinates({
      raDeg: Number(framingStore.RAangle),
      decDeg: Number(framingStore.DECangle),
      frame: 'J2000',
    });
  } catch (error) {
    console.warn('[Celestia Atlas] Ignored invalid framing target:', error.message);
    return;
  }
  // An explicit target wins over auto-follow, which would otherwise pull the
  // view back to the mount on the next poll.
  if (mountFollow.value) {
    mountFollow.value = false;
    viewer.setMountFollow(false);
  }
  viewer.focusTarget(center);
}

function applyFramingReload() {
  const key = framingStore.framingReloadKey;
  if (key === appliedFramingReloadKey) return;
  if (!ready.value || !store.showSkyAtlas) {
    framingFocusPending = true;
    return;
  }
  appliedFramingReloadKey = key;
  framingFocusPending = false;
  focusFramingTarget();
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
  updateCompass();
  const time = new Date(viewer.getTime());
  clockMinuteUtcMs.value = Math.floor(time.getTime() / 60000) * 60000;
  clockLabel.value = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  clockLabelShort.value = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateCompass() {
  if (!viewer || settingsStore.celestiaAtlas.compassVisible === false) return;
  const atlasState = viewer.getState();
  const horizontal = equatorialToHorizontal(
    atlasState.view.center,
    atlasState.observer,
    viewer.getTime()
  );
  compassBearing.value = ((horizontal.azimuthDeg % 360) + 360) % 360;
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

// The DSS survey is plugin-managed data, not a packaged asset: the Vite dev server
// answers /celestia-atlas-data/surveys/dss with the SPA fallback (no properties, no
// tiles). In dev the layer is therefore fetched from the plugin server, which
// getUrls() already resolves with the 8080 -> 5000 dev port rule.
function surveyDataBaseUrl() {
  if (import.meta.env.DEV && !Capacitor.isNativePlatform()) {
    return `${getUrls().PLUGINSERVER_URL}${CELESTIA_ATLAS_DATA_PATH}`;
  }
  return atlasDataBaseUrl();
}

// The survey layer follows what the plugin server advertises in `properties`: the
// installed order becomes maxOrder, no properties file means no photographic layer.
// A token guards against a slow lookup overtaking a newer one after a host switch.
let surveyLookupToken = 0;
async function updateSkySurveySource() {
  if (!viewer) return;
  const token = ++surveyLookupToken;
  const baseUrl = surveyDataBaseUrl();
  const order = await loadDssSurveyOrder(baseUrl);
  if (disposed || !viewer || token !== surveyLookupToken) return;
  viewer.setSkySurvey(order === null ? null : createDssSkySurveySource(baseUrl, order));
}

const surveyPollingActive = computed(
  () => ready.value && store.showSkyAtlas && surveyStore.supported !== false
);
useBackgroundAwarePolling(() => surveyStore.tick(), 2000, surveyPollingActive, {
  immediate: true,
});

// First-open offer: shown until the user declines it or a survey is installed; while
// the accepted download runs it turns into a progress line and disappears once the base
// orders are served. A survey in the legacy WebP format counts as not installed and gets
// the same offer with a different text; the server replaces the old files on download.
const surveyBannerMode = computed(() => {
  if (!ready.value || !surveyStore.loaded || surveyStore.supported !== true) return null;
  if (settingsStore.celestiaAtlas.dssSurveyOfferDismissed) return null;
  const installed = surveyStore.installedOrder;
  if (surveyStore.isRunning) {
    return installed !== null && installed >= DSS_SURVEY_BASE_ORDER ? null : 'progress';
  }
  return installed === null ? 'offer' : null;
});

function acceptSurveyOffer() {
  void surveyStore.startDownload(DSS_SURVEY_BASE_ORDER);
}

function dismissSurveyOffer() {
  settingsStore.celestiaAtlas.dssSurveyOfferDismissed = true;
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
    if (framingFocusPending) applyFramingReload();
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
watch(() => framingStore.framingReloadKey, applyFramingReload);
watch(() => store.showSkyAtlas, updateVisibility);
watch(() => settingsStore.celestiaAtlas.compassVisible, updateCompass);
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
    surveyStore.reset();
    updateLandscape();
    void updateSkySurveySource();
  }
);
// A finished download or a delete changes what the server serves; re-read `properties`.
watch(
  () => surveyStore.installedOrder,
  () => {
    void updateSkySurveySource();
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
      skySurveySource: null,
      onSelect: (target) => {
        selectedTarget.value = target;
        activeSheet.value = 'target';
      },
      onViewChange: (viewState) => {
        updateCompass();
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
    void updateSkySurveySource();
    updateVisibility();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    ready.value = true;
    updateCompass();
    // After the persisted view: a target loaded before the first open wins.
    applyFramingReload();
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
  /* Shared geometry for header, sheet and toolbar; see AtlasSheet.vue / AtlasToolbar.vue. */
  --atlas-toolbar-height: 4rem;
  --atlas-toolbar-clearance: calc(var(--above-statusbar) + var(--atlas-toolbar-height) + 0.5rem);
  --atlas-header-clearance: calc(
    0.75rem + env(safe-area-inset-top, 0px) + var(--spacing-touch) + 0.5rem
  );
  /* Landscape: the sheet is a full-height column on the right; header, toolbar and
     toast stop at its left edge. Squeezed between header and toolbar instead, the
     sheet body would be ~70 px tall on a 360 px phone. */
  --atlas-sheet-width: min(22rem, 50%);
  --atlas-side-inset: 0px;
}
.celestia-atlas-landscape.celestia-atlas-has-sheet {
  --atlas-side-inset: calc(var(--atlas-sheet-width) + 0.5rem);
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
.celestia-atlas-compass {
  position: absolute;
  z-index: 12;
  left: calc(0.75rem + env(safe-area-inset-left, 0px));
  bottom: calc(var(--atlas-toolbar-clearance) + 0.5rem);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: calc(100% - var(--atlas-side-inset) - 1.5rem);
  padding: 0.4rem 0.65rem;
  color: #e8f4ff;
  background: rgb(10 18 30 / 88%);
  border: 1px solid rgb(112 151 180 / 34%);
  border-radius: 0.875rem;
  pointer-events: none;
}
.celestia-atlas-compass-dial {
  position: relative;
  flex: 0 0 4rem;
  width: 4rem;
  height: 4rem;
  border: 1px solid #526378;
  border-radius: 50%;
  font-size: 0.625rem;
  font-weight: 700;
}
.celestia-atlas-compass-dial span:not(.compass-needle) {
  position: absolute;
  line-height: 1;
}
.compass-n {
  top: 0.25rem;
  left: 50%;
  transform: translateX(-50%);
  color: #7bdcff;
}
.compass-e {
  right: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
}
.compass-s {
  bottom: 0.25rem;
  left: 50%;
  transform: translateX(-50%);
}
.compass-w {
  left: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
}
.compass-needle {
  position: absolute;
  inset: 0;
  transition: transform 0.12s linear;
}
.compass-needle::before {
  content: '';
  position: absolute;
  top: 0.9rem;
  left: calc(50% - 0.1875rem);
  width: 0.375rem;
  height: 1.1rem;
  background: #7bdcff;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}
.compass-needle::after {
  content: '';
  position: absolute;
  top: calc(50% - 0.1875rem);
  left: calc(50% - 0.1875rem);
  width: 0.375rem;
  height: 0.375rem;
  background: #7bdcff;
  border-radius: 50%;
}
.celestia-atlas-compass-heading {
  min-width: 3.6rem;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
@media (max-width: 480px) {
  .celestia-atlas-compass {
    gap: 0.375rem;
    padding: 0.25rem 0.45rem;
  }
  .celestia-atlas-compass-dial {
    flex-basis: 3.25rem;
    width: 3.25rem;
    height: 3.25rem;
  }
  .compass-needle::before {
    top: 0.7rem;
    height: 0.9rem;
  }
  .celestia-atlas-compass-heading {
    font-size: 0.75rem;
  }
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
.celestia-atlas-error {
  color: #fca5a5;
}

/* Header ------------------------------------------------------------------------ */
.celestia-atlas-header {
  position: absolute;
  z-index: 25;
  top: calc(0.75rem + env(safe-area-inset-top, 0px));
  left: calc(0.75rem + env(safe-area-inset-left, 0px));
  right: calc(0.75rem + env(safe-area-inset-right, 0px) + var(--atlas-side-inset));
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  pointer-events: none;
}
.celestia-atlas-header > * {
  pointer-events: auto;
}
.celestia-atlas-search {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 24rem;
}
.celestia-atlas-search-icon {
  position: absolute;
  top: 50%;
  left: 0.75rem;
  width: 1.25rem;
  height: 1.25rem;
  transform: translateY(-50%);
  color: var(--color-content-faint);
  pointer-events: none;
}
.celestia-atlas-search-input {
  padding-left: 2.5rem;
  background: rgb(17 24 39 / 92%);
}
.celestia-atlas-results {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  max-height: 20rem;
  overflow-y: auto;
  background: rgb(17 24 39 / 96%);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-control);
}
.celestia-atlas-result {
  display: block;
  width: 100%;
  min-height: var(--spacing-touch);
  padding: 0.5rem 0.75rem;
  text-align: left;
  color: var(--color-content);
}
.celestia-atlas-result:hover {
  background: var(--color-surface-2);
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
:deep(.celestia-atlas-header-button) {
  color: var(--color-content);
  background: rgb(17 24 39 / 92%);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-control);
}
:deep(.celestia-atlas-header-button.is-active) {
  color: var(--color-accent);
}

/* Message slot above the toolbar ---------------------------------------------- */
.celestia-atlas-toast {
  position: absolute;
  z-index: 15;
  left: calc((100% - var(--atlas-side-inset)) / 2);
  bottom: var(--atlas-toolbar-clearance);
  transform: translateX(-50%);
  display: grid;
  gap: 0.5rem;
  width: min(28rem, calc(100% - 1rem - var(--atlas-side-inset)));
  padding: 0.75rem 1rem;
  border-radius: var(--radius-card);
  background: rgb(3 7 18 / 92%);
  border: 1px solid rgb(8 145 178);
  color: white;
}
.celestia-atlas-has-compass .celestia-atlas-toast {
  bottom: calc(var(--atlas-toolbar-clearance) + 5.5rem);
}
.celestia-atlas-toast-warning {
  background: rgba(120, 53, 15, 0.92);
  border-color: rgb(180 83 9);
}
.celestia-atlas-survey-progress {
  height: 0.375rem;
  overflow: hidden;
  border-radius: 9999px;
  background: rgb(55 65 81);
}
.celestia-atlas-survey-progress > div {
  height: 100%;
  background: rgb(6 182 212);
  transition: width 0.4s ease;
}
</style>
