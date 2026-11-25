<template>
  <!-- Nothing in the panel is tappable until the arm delay has passed (see disarmActions) -->
  <div
    class="grid gap-4"
    :class="{ 'pointer-events-none': !actionsArmed }"
    :aria-busy="!actionsArmed"
  >
    <!-- What the actions below refer to: the tapped object, or the view centre -->
    <div class="grid gap-1.5">
      <div class="flex items-center gap-2">
        <span class="atlas-target-chip" :class="{ 'is-object': hasSelection }">
          <MapPinIcon v-if="hasSelection" class="h-3.5 w-3.5" />
          <ViewfinderCircleIcon v-else class="h-3.5 w-3.5" />
          {{
            $t(
              hasSelection
                ? 'components.celestiaAtlas.target.source_object'
                : 'components.celestiaAtlas.target.source_view'
            )
          }}
        </span>
        <button
          v-if="hasSelection"
          class="atlas-target-chip-clear"
          type="button"
          :title="$t('components.celestiaAtlas.target.clear_selection')"
          :aria-label="$t('components.celestiaAtlas.target.clear_selection')"
          @click="emit('clear-selection')"
        >
          <XMarkIcon class="h-4 w-4" />
        </button>
      </div>
      <template v-if="hasSelection">
        <p class="text-base font-semibold leading-tight text-content">{{ selectionNames[0] }}</p>
        <p v-if="selectionNames.length > 1" class="text-xs leading-snug text-content-muted">
          {{ selectionNames.slice(1).join(' · ') }}
        </p>
      </template>
      <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm tabular-nums">
        <dt class="text-content-muted">{{ $t('components.celestiaAtlas.selected_object.ra') }}</dt>
        <dd class="font-mono text-content">{{ raString || '—' }}</dd>
        <dt class="text-content-muted">{{ $t('components.celestiaAtlas.selected_object.dec') }}</dt>
        <dd class="font-mono text-content">{{ decString || '—' }}</dd>
        <!-- Catalogue facts: only rows the catalogue actually knows -->
        <template v-if="typeLabel">
          <dt class="text-content-muted">
            {{ $t('components.celestiaAtlas.selected_object.type') }}
          </dt>
          <dd class="text-content">{{ typeLabel }}</dd>
        </template>
        <template v-if="magnitudeLabel">
          <dt class="text-content-muted">
            {{ $t('components.celestiaAtlas.selected_object.magnitude') }}
          </dt>
          <dd class="text-content">{{ magnitudeLabel }}</dd>
        </template>
        <template v-if="sizeLabel">
          <dt class="text-content-muted">
            {{ $t('components.celestiaAtlas.selected_object.size') }}
          </dt>
          <dd class="text-content">{{ sizeLabel }}</dd>
        </template>
        <template v-if="constellationLabel">
          <dt class="text-content-muted">
            {{ $t('components.celestiaAtlas.selected_object.constellation') }}
          </dt>
          <dd class="text-content">{{ constellationLabel }}</dd>
        </template>
        <!-- Sky position at the atlas time; needs the site location -->
        <template v-if="altAzLabel">
          <dt class="text-content-muted">
            {{ $t('components.celestiaAtlas.selected_object.alt_az') }}
          </dt>
          <dd class="font-mono text-content">{{ altAzLabel }}</dd>
        </template>
        <template v-if="riseTransitSet && riseTransitSet.status !== 'normal'">
          <dt class="text-content-muted">
            {{ $t('components.celestiaAtlas.selected_object.rise_set') }}
          </dt>
          <dd class="text-content">
            {{
              $t(
                riseTransitSet.status === 'circumpolar'
                  ? 'components.celestiaAtlas.selected_object.circumpolar'
                  : 'components.celestiaAtlas.selected_object.never_rises'
              )
            }}
          </dd>
        </template>
        <template v-if="riseTransitSet?.rise">
          <dt class="text-content-muted">
            {{ $t('components.celestiaAtlas.selected_object.rise') }}
          </dt>
          <dd class="font-mono text-content">{{ formatClock(riseTransitSet.rise) }}</dd>
        </template>
        <template v-if="riseTransitSet?.transit">
          <dt class="text-content-muted">
            {{ $t('components.celestiaAtlas.selected_object.transit') }}
          </dt>
          <dd class="font-mono text-content">{{ formatClock(riseTransitSet.transit) }}</dd>
        </template>
        <template v-if="riseTransitSet?.set">
          <dt class="text-content-muted">
            {{ $t('components.celestiaAtlas.selected_object.set') }}
          </dt>
          <dd class="font-mono text-content">{{ formatClock(riseTransitSet.set) }}</dd>
        </template>
      </dl>
      <p v-if="hasValidCoordinates && !hasSiteLocation" class="text-xs text-content-muted">
        {{ $t('components.celestiaAtlas.selected_object.missing_location') }}
      </p>
      <SkyChart
        v-if="chartTarget"
        class="mt-1"
        :target="chartTarget"
        :coordinates="siteCoordinates"
        :time="clockUtcMs"
      />
      <img
        v-if="targetPreviewUrl"
        class="mt-1 max-h-48 w-full rounded-md border border-line object-contain"
        :src="targetPreviewUrl"
        :alt="selectionNames[0] || ''"
        @error="clearTargetPreview"
      />
    </div>

    <!-- Camera field: rotation and mosaic, only while a FOV can be drawn -->
    <section v-if="fovAvailable" class="atlas-target-section">
      <h4 class="atlas-target-heading">
        {{ $t('components.celestiaAtlas.target.camera_field') }}
      </h4>
      <RotationRuler @scrub="emit('scrub', $event)" />
      <getImageRotation />
      <MosaicControls :show-nina-cache="false" />
    </section>
    <div
      v-else-if="missingEquipmentSettings"
      role="status"
      class="flex items-start gap-2 rounded-card border border-status-warn/50 bg-status-warn/10 p-3 text-sm text-content"
    >
      <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 shrink-0 text-status-warn" />
      <span>{{ $t('components.framing.missingEquipmentSettings') }}</span>
    </div>

    <!-- Actions on the effective target -->
    <section class="atlas-target-section">
      <h4 class="atlas-target-heading">{{ $t('components.celestiaAtlas.target.actions') }}</h4>
      <input
        id="atlas-target-name"
        v-model="targetName"
        type="text"
        :placeholder="$t('components.celestiaAtlas.camera_panel.target_name_placeholder')"
        class="tns-input"
      />
      <fieldset
        :disabled="!actionsEnabled"
        class="grid min-w-0 gap-2 border-0 p-0 disabled:opacity-50"
      >
        <ButtonSlewCenterRotate
          :raAngle="raDeg"
          :decAngle="decDeg"
          :name="effectiveTargetName"
          :disabled="!hasMount || !hasValidCoordinates"
        />
        <!-- Simple mode: the plan slews there by itself, slewing now only previews the framing -->
        <p v-if="simpleMode && !framingStore.isMosaicMode" class="text-xs text-content-muted">
          {{ $t('components.simpleMode.slewOptional') }}
        </p>
        <setSequenceTarget
          v-if="!framingStore.isMosaicMode"
          class="w-full"
          :class="{ 'order-first': simpleMode }"
          :raAngle="raDeg"
          :decAngle="decDeg"
          :name="effectiveTargetName"
        />
        <SaveFavTargets
          :name="effectiveTargetName"
          :ra="raDeg"
          :dec="decDeg"
          :ra-string="raString"
          :dec-string="decString"
          :rotation="rotationModel"
          :mosaic-cols="framingStore.isMosaicMode ? framingStore.mosaicCols : null"
          :mosaic-rows="framingStore.isMosaicMode ? framingStore.mosaicRows : null"
          :mosaic-overlap="framingStore.isMosaicMode ? framingStore.mosaicOverlap : null"
          :mosaic-preserve-alignment="
            framingStore.isMosaicMode ? framingStore.mosaicPreserveAlignment : null
          "
          :panels="mosaicPanels"
          :disabled="framingStore.isMosaicMode && !mosaicPanels"
          :show-label="true"
        />
        <ButtomSyncCoordinatesToMount
          v-if="hasSelection"
          :raAngle="raDeg"
          :decAngle="decDeg"
          :disabled="!hasMount || !hasValidCoordinates"
        />
      </fieldset>
    </section>

    <!-- Other ways to pick a target -->
    <section class="atlas-target-section">
      <h4 class="atlas-target-heading">{{ $t('components.celestiaAtlas.target.more') }}</h4>
      <div class="grid grid-cols-2 gap-2">
        <FavTargets variant="button" :showFramning="true" :showSeqTarget="false" />
        <FitsPlateSolve
          v-if="fitsPlateSolveAvailable"
          variant="button"
          :showFraming="false"
          :showSeqTarget="false"
        />
        <button
          class="tns-btn-secondary col-span-2"
          type="button"
          :disabled="!hasValidCoordinates"
          @click="openFramingModal"
        >
          <ArrowTopRightOnSquareIcon class="h-5 w-5 shrink-0" />
          <span>{{ $t('components.framing.openFraminingModal') }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import {
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  ViewfinderCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useFramingStore } from '@/store/framingStore';
import apiService from '@/services/apiService';
import { timeSync } from '@/utils/timeSync';
import { degreesToHMS, degreesToDMS } from '@/utils/utils';
import { equatorialToAltAz, getRiseTransitSet } from '@/utils/astronomy';
import { getConstellation, getConstellationName } from '@/utils/constellation';
import { toNinaJ2000Coordinates } from '@/integrations/celestiaAtlas/contracts';
import { atlasObjectTypeI18nKey } from '@/integrations/celestiaAtlas/catalogFilters';
import { computeMosaicPanelCenters } from '@/integrations/celestiaAtlas/mosaicPanels';
import ButtonSlewCenterRotate from '@/components/mount/ButtonSlewCenterRotate.vue';
import ButtomSyncCoordinatesToMount from '@/components/mount/ButtomSyncCoordinatesToMount.vue';
import setSequenceTarget from '@/components/framing/setSequenceTarget.vue';
import SaveFavTargets from '@/components/favTargets/SaveFavTargets.vue';
import FavTargets from '@/components/favTargets/FavTargets.vue';
import FitsPlateSolve from '@/components/fitsPlatesolve/FitsPlateSolve.vue';
import getImageRotation from '@/components/framing/getImageRotation.vue';
import RotationRuler from '@/components/framing/RotationRuler.vue';
import MosaicControls from '@/components/framing/MosaicControls.vue';
import SkyChart from '@/components/framing/SkyChart.vue';
import { useSimpleMode } from '@/composables/useSimpleMode';

// The single target panel of the Atlas. Its target is the tapped object while one is
// selected, otherwise the live view centre; every action below works on that one
// J2000 position, so nothing is offered twice.
const props = defineProps({
  // Command model from atlasSelectionToCommandModel(), null without a selection.
  selection: {
    type: Object,
    default: null,
  },
  getViewCenter: {
    type: Function,
    default: null,
  },
  defaultTargetName: {
    type: String,
    default: 'Celestia Atlas view',
  },
  // View-centre sampling only runs while the panel is visible and the Atlas is shown.
  active: {
    type: Boolean,
    default: false,
  },
  // False while no camera FOV can be drawn (camera disconnected or profile incomplete).
  fovAvailable: {
    type: Boolean,
    default: false,
  },
  // CameraFieldOfView from the profile (widthDeg/heightDeg), for the mosaic panel centres.
  cameraFov: {
    type: Object,
    default: null,
  },
  missingEquipmentSettings: {
    type: Boolean,
    default: false,
  },
  // The framing-cache preview is only worth showing while the Atlas has no photographic
  // survey of its own; with DSS installed the sky behind the panel already shows the field.
  showPreview: {
    type: Boolean,
    default: true,
  },
  // Atlas clock (UTC ms) the sky-position rows and the altitude chart refer to;
  // null falls back to server time.
  clockUtcMs: {
    type: Number,
    default: null,
  },
});
const emit = defineEmits(['clear-selection', 'scrub']);

const store = apiStore();
const framingStore = useFramingStore();
const { active: simpleMode } = useSimpleMode();
const router = useRouter();
const { t, te } = useI18n();

const hasSelection = computed(() => props.selection !== null);
const selectionNames = computed(() => props.selection?.names ?? []);
const selectionValid = computed(
  () =>
    hasSelection.value &&
    Number.isFinite(props.selection.raDeg) &&
    props.selection.raDeg >= 0 &&
    props.selection.raDeg < 360 &&
    Number.isFinite(props.selection.decDeg) &&
    props.selection.decDeg >= -90 &&
    props.selection.decDeg <= 90
);

// --- View centre sampling (no selection) ---------------------------------------------
const viewRaDeg = ref(null);
const viewDecDeg = ref(null);
const viewRaString = ref('');
const viewDecString = ref('');
const viewValid = ref(false);
let rafId = null;
let lastViewSampleAt = 0;
const VIEW_SAMPLE_INTERVAL_MS = 100;

function setCommandCoordinates(value) {
  try {
    const coordinates = toNinaJ2000Coordinates(value ?? {});
    viewRaDeg.value = coordinates.raDeg;
    viewDecDeg.value = coordinates.decDeg;
    viewRaString.value = degreesToHMS(coordinates.raDeg);
    viewDecString.value = degreesToDMS(coordinates.decDeg);
    viewValid.value = true;
  } catch {
    invalidateCoordinates();
  }
}

function invalidateCoordinates() {
  viewRaDeg.value = null;
  viewDecDeg.value = null;
  viewRaString.value = '';
  viewDecString.value = '';
  viewValid.value = false;
}

function sampleView() {
  if (!props.getViewCenter) {
    invalidateCoordinates();
    return;
  }
  try {
    setCommandCoordinates(props.getViewCenter());
  } catch {
    invalidateCoordinates();
  }
}

function loop(timestamp) {
  if (timestamp - lastViewSampleAt >= VIEW_SAMPLE_INTERVAL_MS) {
    sampleView();
    lastViewSampleAt = timestamp;
  }
  rafId = requestAnimationFrame(loop);
}

function stopSampling() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
}

watch(
  [() => props.active, hasSelection],
  ([isActive, selected]) => {
    stopSampling();
    if (isActive && !selected) {
      sampleView();
      lastViewSampleAt = 0;
      rafId = requestAnimationFrame(loop);
    }
  },
  { immediate: true }
);

// --- Effective target -------------------------------------------------------------------
const raDeg = computed(() => (hasSelection.value ? props.selection.raDeg : viewRaDeg.value));
const decDeg = computed(() => (hasSelection.value ? props.selection.decDeg : viewDecDeg.value));
const raString = computed(() =>
  hasSelection.value ? props.selection.raString : viewRaString.value
);
const decString = computed(() =>
  hasSelection.value ? props.selection.decString : viewDecString.value
);
const hasValidCoordinates = computed(() =>
  hasSelection.value ? selectionValid.value : viewValid.value
);
const hasMount = computed(() => store.mountInfo.Connected && !store.sequenceRunning);

const targetName = ref('');
const effectiveTargetName = computed(() => {
  if (targetName.value.trim() !== '') return targetName.value.trim();
  if (selectionNames.value[0]) return selectionNames.value[0];
  if (raString.value && decString.value) return `${raString.value} ${decString.value}`;
  return props.defaultTargetName;
});

// --- Object info and sky position ---------------------------------------------------------
const selectionInfo = computed(() => props.selection?.info ?? null);

const typeLabel = computed(() => {
  const typeKey = selectionInfo.value?.typeKey;
  if (!typeKey) return '';
  const key = atlasObjectTypeI18nKey(typeKey);
  return te(key) ? t(key) : typeKey;
});

const magnitudeLabel = computed(() => {
  const magnitude = selectionInfo.value?.magnitude;
  if (!Number.isFinite(magnitude)) return '';
  return t('components.celestiaAtlas.selected_object.magnitude_fmt', {
    value: magnitude.toFixed(1),
  });
});

function formatArcmin(value) {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

const sizeLabel = computed(() => {
  const size = selectionInfo.value?.sizeArcmin;
  if (!size) return '';
  const major = `${formatArcmin(size.major)}′`;
  return size.minor ? `${major} × ${formatArcmin(size.minor)}′` : major;
});

// Stars carry their IAU abbreviation; everything else is looked up from the
// J2000 position, so the view centre gets a constellation too.
const constellationLabel = computed(() => {
  if (!hasValidCoordinates.value) return '';
  const abbr = selectionInfo.value?.constellation ?? getConstellation(raDeg.value, decDeg.value);
  if (!abbr || abbr === '?') return '';
  const name = getConstellationName(abbr);
  return name !== abbr ? `${name} (${abbr})` : abbr;
});

const siteCoordinates = computed(() => {
  const settings = store.profileInfo?.AstrometrySettings;
  const latitude = Number(settings?.Latitude);
  const longitude = Number(settings?.Longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
});
const hasSiteLocation = computed(() => siteCoordinates.value !== null);

const atlasTime = computed(() =>
  props.clockUtcMs !== null ? new Date(props.clockUtcMs) : new Date(timeSync.getServerTime())
);

const altAzLabel = computed(() => {
  if (!hasSiteLocation.value || !hasValidCoordinates.value) return '';
  const { altDeg, azDeg } = equatorialToAltAz(
    raDeg.value,
    decDeg.value,
    atlasTime.value,
    siteCoordinates.value.latitude,
    siteCoordinates.value.longitude
  );
  const sign = altDeg >= 0 ? '+' : '−';
  return `${sign}${Math.abs(altDeg).toFixed(1)}° / ${azDeg.toFixed(1)}°`;
});

// The chart and the rise/set rows follow the coordinates with a short delay:
// while the view centre is being panned they would otherwise recompute one
// whole night of samples on every 100 ms sample.
const chartCoordinates = ref(null);
let chartCoordinatesTimer = null;
watch(
  [raDeg, decDeg, hasValidCoordinates],
  ([ra, dec, valid]) => {
    if (chartCoordinatesTimer !== null) clearTimeout(chartCoordinatesTimer);
    if (!valid) {
      chartCoordinates.value = null;
      return;
    }
    chartCoordinatesTimer = setTimeout(() => {
      chartCoordinates.value = { RA: ra, Dec: dec };
      chartCoordinatesTimer = null;
    }, 250);
  },
  { immediate: true }
);

const chartTarget = computed(() =>
  hasSiteLocation.value && chartCoordinates.value ? chartCoordinates.value : null
);

// Same night window as SkyChart: local noon before the atlas time, 24 h long.
const nightWindowStart = computed(() => {
  const start = new Date(atlasTime.value);
  if (start.getHours() < 12) start.setDate(start.getDate() - 1);
  start.setHours(12, 0, 0, 0);
  return start;
});

// The Moon moves ~13° a day, so rise/set from a fixed RA/Dec would be off by
// the better part of an hour; it gets no rows.
const riseTransitSet = computed(() => {
  if (!chartTarget.value || selectionInfo.value?.typeKey === 'natural satellite') return null;
  return getRiseTransitSet(
    chartTarget.value.RA,
    chartTarget.value.Dec,
    nightWindowStart.value,
    siteCoordinates.value.latitude,
    siteCoordinates.value.longitude
  );
});

function formatClock(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// A tap on the sky that selects an object lands where the sheet appears a moment later;
// hold the whole panel back briefly so the same tap cannot fire a button. The panel is
// mounted in the same flush as the selection, so arming has to start on mount, not only
// when the selection changes later. iOS delivers the synthesized click later than
// Android/desktop, hence the longer delay there (same values the old panel used).
const ARM_DELAY_MS = Capacitor.getPlatform() === 'ios' ? 800 : 500;
const actionsArmed = ref(false);
let armTimer = null;
function disarmActions() {
  if (armTimer !== null) clearTimeout(armTimer);
  actionsArmed.value = false;
  armTimer = setTimeout(() => {
    actionsArmed.value = true;
    armTimer = null;
  }, ARM_DELAY_MS);
}
watch(
  () => props.selection,
  () => {
    targetName.value = '';
    disarmActions();
  },
  { immediate: true }
);
const actionsEnabled = computed(() => actionsArmed.value && hasValidCoordinates.value);

const rotationModel = computed({
  get: () => Number(framingStore.rotationAngle ?? 0),
  set: (value) => {
    framingStore.rotationAngle = Number(value);
  },
});

// Same gate as FramingPage.vue: the FITS endpoints need PINS or plugin >= 1.2.7.0.
const fitsPlateSolveAvailable = computed(
  () => store.isPINS || store.checkVersionNewerOrEqual(store.currentTnsPluginVersion, '1.2.7.0')
);

// Panel centres follow the effective target. Null disables saving so SaveFavTargets never
// falls back to the framing page's stale framingStore.mosaicPanelCoords.
const mosaicPanels = computed(() => {
  if (!framingStore.isMosaicMode || !props.cameraFov || !hasValidCoordinates.value) return null;
  return computeMosaicPanelCenters({
    centerRaDeg: raDeg.value,
    centerDecDeg: decDeg.value,
    positionAngleDeg: rotationModel.value,
    fovWidthDeg: props.cameraFov.widthDeg,
    fovHeightDeg: props.cameraFov.heightDeg,
    columns: Number(framingStore.mosaicCols),
    rows: Number(framingStore.mosaicRows),
    overlapPercent: Number(framingStore.mosaicOverlap),
  });
});

function openFramingModal() {
  if (!hasValidCoordinates.value) return;
  framingStore.RAangle = raDeg.value;
  framingStore.DECangle = decDeg.value;
  framingStore.RAangleString = raString.value;
  framingStore.DECangleString = decString.value;
  framingStore.selectedItem = {
    ...(props.selection?.commandTarget ?? {}),
    Name: props.selection?.commandTarget?.Name ?? effectiveTargetName.value,
    RA: raDeg.value,
    Dec: decDeg.value,
  };
  router.push('/framing');
}

// --- Preview image from the shared Framing Assistant cache ------------------------------
const targetPreviewUrl = ref('');
let targetPreviewRequest = 0;

function clearTargetPreview() {
  if (targetPreviewUrl.value) URL.revokeObjectURL(targetPreviewUrl.value);
  targetPreviewUrl.value = '';
}

async function targetPreviewHasContent(url) {
  const image = new Image();
  image.decoding = 'async';
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index] > 4 || pixels[index + 1] > 4 || pixels[index + 2] > 4) return true;
  }
  return false;
}

async function loadTargetPreview() {
  const request = ++targetPreviewRequest;
  clearTargetPreview();
  if (!props.showPreview || !selectionValid.value) return;
  try {
    const url = await apiService.searchTargetPic(
      Number(framingStore.width) || 200,
      Number(framingStore.height) || 200,
      Number(framingStore.fov) || 5,
      props.selection.raDeg,
      props.selection.decDeg,
      true
    );
    const hasContent = await targetPreviewHasContent(url);
    if (request !== targetPreviewRequest || !hasContent) {
      URL.revokeObjectURL(url);
      return;
    }
    targetPreviewUrl.value = url;
  } catch {
    // A cache miss is expected for targets that have not been framed before.
  }
}

watch(
  [() => props.selection?.raDeg, () => props.selection?.decDeg, () => props.showPreview],
  loadTargetPreview,
  { immediate: true }
);

onBeforeUnmount(() => {
  stopSampling();
  if (chartCoordinatesTimer !== null) clearTimeout(chartCoordinatesTimer);
  targetPreviewRequest++;
  clearTargetPreview();
  if (armTimer !== null) clearTimeout(armTimer);
});
</script>

<style scoped>
.atlas-target-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-content-muted);
  border: 1px solid var(--color-line-strong);
  border-radius: 9999px;
}
.atlas-target-chip.is-object {
  color: var(--color-accent);
  border-color: rgb(34 211 238 / 45%);
  background: rgb(34 211 238 / 10%);
}
.atlas-target-chip-clear {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  color: var(--color-content-muted);
}
.atlas-target-chip-clear:hover {
  color: var(--color-content);
  background: var(--color-surface-2);
}
.atlas-target-section {
  display: grid;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-line);
}
.atlas-target-heading {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-content-faint);
}
</style>
