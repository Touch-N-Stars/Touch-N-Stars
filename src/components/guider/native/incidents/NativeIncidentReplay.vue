<template>
  <teleport to="body">
    <div
      class="replay fixed inset-0 z-top flex flex-col bg-ground text-content"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      data-testid="native-guider-incident-replay"
    >
      <!-- Header: back, what and when, download -->
      <header
        class="replay-header flex items-center gap-2 border-b border-line bg-surface-1 px-2 pb-2 sm:px-3"
      >
        <button
          ref="closeButton"
          type="button"
          class="tns-btn-secondary w-auto! h-10! min-h-10! min-w-10! px-2! shrink-0"
          :aria-label="k('replay.close')"
          :title="k('replay.close')"
          @click="close"
        >
          <ArrowLeftIcon class="h-5 w-5" />
        </button>
        <div class="flex min-w-0 flex-1 flex-col leading-tight">
          <span class="truncate text-sm font-semibold">{{ title }}</span>
          <span class="truncate text-xs text-content-muted">{{ subtitle }}</span>
        </div>
        <button
          type="button"
          class="tns-btn-secondary w-auto! h-10! min-h-10! min-w-10! px-2! sm:px-3! text-xs! gap-1! shrink-0"
          :disabled="!!downloading"
          :aria-label="k('download')"
          :title="k('download')"
          @click="download(id)"
        >
          <ArrowDownTrayIcon class="h-5 w-5" :class="{ 'animate-pulse': downloading === id }" />
          <span class="hidden sm:inline">{{ k('download') }}</span>
        </button>
      </header>

      <!-- Content -->
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div class="mx-auto flex w-full max-w-7xl flex-col gap-3 p-2 sm:p-3">
          <div
            v-if="loading && !incident"
            class="flex items-center justify-center gap-2 py-16 text-sm text-content-muted"
            role="status"
          >
            <span
              class="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent"
            ></span>
            {{ k('replay.loading') }}
          </div>
          <p
            v-else-if="error && !incident"
            class="rounded-control border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger break-words"
          >
            {{ k('replay.loadFailed') }}: {{ error }}
          </p>

          <template v-else-if="incident">
            <!-- Likely cause and evidence first -->
            <NativeIncidentDiagnosis :incident="incident" @jump="jumpToFrame" />

            <div class="grid grid-cols-1 gap-3 lg:grid-cols-12">
              <div class="flex min-w-0 flex-col gap-3 lg:col-span-7">
                <!-- Frame with the overlays of the live view -->
                <div ref="frameCard" class="tns-card p-2! flex min-w-0 flex-col gap-2">
                  <div class="flex min-w-0 items-center gap-2 text-xs">
                    <span class="font-semibold tabular-nums text-content">
                      {{ k('replay.frame', { frame: shownFrame?.frame ?? '–' }) }}
                    </span>
                    <span class="min-w-0 truncate text-content-faint">{{ imageLabel }}</span>
                    <div class="seg ml-auto shrink-0" role="group" :aria-label="stretchLabel">
                      <button
                        v-for="option in STRETCH_OPTIONS"
                        :key="option.id"
                        type="button"
                        class="seg-btn"
                        :class="{ 'seg-btn-active': stretchId === option.id }"
                        :aria-pressed="stretchId === option.id"
                        :title="stretchLabel"
                        @click="setStretch(option.id)"
                      >
                        {{ t(`components.guider.native.frame.stretch_${option.id}`) }}
                      </button>
                    </div>
                  </div>

                  <div
                    ref="viewport"
                    class="relative w-full overflow-hidden rounded-control bg-black"
                    :style="viewportStyle"
                  >
                    <!-- Stage: the sensor letterboxed into the viewport; the JPEG (context or key,
                         whatever its binning) is stretched over it and the overlay's viewBox is the
                         sensor, so both map sensor pixels to the same place. -->
                    <div class="absolute" :style="stageStyle">
                      <img
                        v-if="shown.src"
                        :src="shown.src"
                        class="pointer-events-none absolute inset-0 h-full w-full select-none"
                        draggable="false"
                        alt=""
                      />
                      <NativeFrameOverlay
                        :width="sensorWidth"
                        :height="sensorHeight"
                        :stars="overlayStars"
                        :lock="lock"
                        :scale="fitScale"
                        :show-labels="overlayStars.length <= 30"
                        :search-region="searchRegion"
                      />
                    </div>
                    <!-- Markers of this frame -->
                    <div
                      v-if="markersHere.length"
                      class="pointer-events-none absolute left-1.5 top-1.5 flex max-w-[80%] flex-col items-start gap-1"
                    >
                      <span
                        v-for="(m, i) in markersHere"
                        :key="`${m.type}-${i}`"
                        class="truncate rounded bg-surface-1/85 px-1.5 py-0.5 text-[11px] font-semibold"
                        :style="{ color: INCIDENT_MARKER_COLORS[m.type] || undefined }"
                      >
                        {{ marker(m.type) }}<template v-if="m.text">: {{ m.text }}</template>
                      </span>
                    </div>
                    <span
                      v-if="shownFrame && shownFrame.starFound === false"
                      class="pointer-events-none absolute right-1.5 top-1.5 rounded bg-surface-1/85 px-1.5 py-0.5 text-[11px] font-semibold text-status-danger"
                    >
                      {{ k('replay.starLost') }}
                    </span>
                    <span
                      v-if="loadingImage"
                      class="pointer-events-none absolute bottom-2 right-2 h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"
                    ></span>
                    <p
                      v-if="imageNotice"
                      class="pointer-events-none absolute bottom-1.5 left-1.5 right-8 rounded bg-surface-1/85 px-2 py-1 text-[11px] text-content-muted"
                    >
                      {{ imageNotice }}
                    </p>
                  </div>

                  <!-- Legend -->
                  <div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-content-muted">
                    <span class="flex items-center gap-1">
                      <span class="legend-swatch border-[#34d399]"></span>
                      {{ t('components.guider.native.frame.legendPrimary') }}
                    </span>
                    <span class="flex items-center gap-1">
                      <span class="legend-swatch rounded-full border-[#22d3ee]"></span>
                      {{ t('components.guider.native.frame.legendSecondary') }}
                    </span>
                    <span class="flex items-center gap-1">
                      <span
                        class="legend-swatch rounded-full border-dashed border-[#94a3b8]"
                      ></span>
                      {{ t('components.guider.native.frame.legendRejected') }}
                    </span>
                    <span class="flex items-center gap-1 text-[#fbbf24]">
                      + {{ t('components.guider.native.frame.legendLock') }}
                    </span>
                    <span v-if="searchRegion" class="flex items-center gap-1">
                      <span class="legend-swatch border-dashed border-[#fbbf24]/60"></span>
                      {{ k('replay.searchRegion') }}
                    </span>
                  </div>
                </div>

                <!-- Star crops of the frame (peeper style) -->
                <div class="tns-card p-2! flex min-w-0 flex-col gap-1.5">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-content-faint">
                    {{ k('replay.crops') }}
                  </span>
                  <div
                    v-if="cropView"
                    class="grid grid-cols-5 gap-1.5 sm:grid-cols-9 transition-opacity"
                    :class="{ 'opacity-50': cropView.stale }"
                  >
                    <NativeStarPeeper
                      :primary-crop="cropView.primaryCrop"
                      :primary-star="cropView.primaryStar"
                      :secondary-crops="cropView.secondaryCrops"
                      :bit-depth="16"
                    />
                  </div>
                  <p v-else class="text-xs text-content-faint">{{ k('replay.noCrops') }}</p>
                </div>
              </div>

              <div class="flex min-w-0 flex-col gap-3 lg:col-span-5">
                <NativeIncidentTelemetry :frame="shownFrame" :offset-seconds="offsetSeconds" />
              </div>

              <div class="min-w-0 lg:col-span-12">
                <NativeIncidentGraph
                  :frames="frames"
                  :markers="markers"
                  :gaps="gaps"
                  :current-index="shownIndex"
                  @seek="seekPaused"
                />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Playback controls -->
      <footer
        v-if="incident && frames.length"
        class="replay-footer border-t border-line bg-surface-1 px-2 pt-1.5 sm:px-3"
      >
        <div class="mx-auto flex w-full max-w-7xl flex-col gap-1">
          <!-- Scrubber with marker ticks and the stretches without images -->
          <div class="relative h-8">
            <div class="pointer-events-none absolute inset-x-2 top-0 h-2.5" aria-hidden="true">
              <span
                v-for="(gap, i) in gaps"
                :key="`gap-${i}`"
                class="absolute top-1 h-1 rounded bg-content-faint/50"
                :style="{ left: percent(gap.from), width: spanWidth(gap) }"
              ></span>
              <span
                v-for="(m, i) in markers"
                :key="`tick-${i}`"
                class="absolute top-0 h-2.5 w-0.5 -translate-x-1/2 rounded"
                :style="{ left: percent(m.index), background: INCIDENT_MARKER_COLORS[m.type] }"
              ></span>
            </div>
            <input
              type="range"
              class="scrubber absolute inset-x-0 bottom-0 w-full"
              min="0"
              :max="frames.length - 1"
              step="1"
              :value="index"
              :aria-label="k('replay.scrubber')"
              :aria-valuetext="positionText"
              @input="onScrub"
            />
          </div>

          <div class="flex items-center gap-2">
            <span class="min-w-0 flex-1 truncate text-xs tabular-nums text-content-muted">
              {{ positionText }}
            </span>
            <div class="seg shrink-0" role="group" :aria-label="k('replay.speed')">
              <button
                v-for="s in PLAYBACK_SPEEDS"
                :key="s"
                type="button"
                class="seg-btn"
                :class="{ 'seg-btn-active': speed === s }"
                :aria-pressed="speed === s"
                @click="setSpeed(s)"
              >
                {{ s }}×
              </button>
            </div>
          </div>

          <div class="flex items-center justify-center gap-1.5 pb-1">
            <button
              type="button"
              class="ctl-btn"
              :disabled="!previousMarker"
              :aria-label="k('replay.prevMarker')"
              :title="k('replay.prevMarker')"
              @click="jumpMarker(-1)"
            >
              <ChevronDoubleLeftIcon class="h-5 w-5" />
            </button>
            <button
              type="button"
              class="ctl-btn"
              :disabled="index <= 0"
              :aria-label="k('replay.stepBack')"
              :title="k('replay.stepBack')"
              @click="step(-1)"
            >
              <BackwardIcon class="h-5 w-5" />
            </button>
            <button
              type="button"
              class="tns-btn-primary w-auto! h-12! min-h-12! min-w-14! px-4!"
              :aria-label="playing ? k('replay.pause') : k('replay.play')"
              :title="playing ? k('replay.pause') : k('replay.play')"
              data-testid="native-guider-replay-play"
              @click="togglePlay"
            >
              <PauseIcon v-if="playing" class="h-6 w-6" />
              <PlayIcon v-else class="h-6 w-6" />
            </button>
            <button
              type="button"
              class="ctl-btn"
              :disabled="index >= frames.length - 1"
              :aria-label="k('replay.stepForward')"
              :title="k('replay.stepForward')"
              @click="step(1)"
            >
              <ForwardIcon class="h-5 w-5" />
            </button>
            <button
              type="button"
              class="ctl-btn"
              :disabled="!nextMarker"
              :aria-label="k('replay.nextMarker')"
              :title="k('replay.nextMarker')"
              @click="jumpMarker(1)"
            >
              <ChevronDoubleRightIcon class="h-5 w-5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  </teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  BackwardIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ForwardIcon,
  PauseIcon,
  PlayIcon,
} from '@heroicons/vue/24/solid';
import apiService from '@/services/apiService';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import {
  INCIDENT_MARKER_COLORS,
  PLAYBACK_SPEEDS,
  adjacentMarker,
  cropTiles,
  formatIncidentDuration,
  frameImageKind,
  frameIndexOf,
  framePositions,
  imageGapSpans,
  incidentDurationSeconds,
  parseIncidentId,
  playbackAdvance,
  preloadIndices,
  searchRegionRect,
  timelineMarkers,
} from '@/utils/nativeGuiderIncidents';
import NativeFrameOverlay from '../NativeFrameOverlay.vue';
import NativeStarPeeper from '../NativeStarPeeper.vue';
import NativeIncidentDiagnosis from './NativeIncidentDiagnosis.vue';
import NativeIncidentGraph from './NativeIncidentGraph.vue';
import NativeIncidentTelemetry from './NativeIncidentTelemetry.vue';
import { useIncidentDownload } from './useIncidentDownload';
import { useIncidentText } from './useIncidentText';

const props = defineProps({
  /** Id of the incident to replay. */
  id: { type: String, required: true },
});
const emit = defineEmits(['close']);

const store = useNativeGuiderStore();
const { t, te, k, kind, kinds, dateTime, clock, likely, endReason, marker } = useIncidentText();
const { downloading, download } = useIncidentDownload();

const STRETCH_OPTIONS = [
  { id: 'low', value: 0.1 },
  { id: 'medium', value: 0.2 },
  { id: 'high', value: 0.33 },
];
// Rendered JPEG widths of full-resolution key frames (fixed sizes keep the backend cache useful);
// context images are small (about 480 px) and always asked for at one size.
const WIDTHS = [512, 768, 1024, 1536, 2048];
const CONTEXT_MAX_WIDTH = 1024;
// At most this many images load at once (the shown frame plus preloads).
const MAX_PARALLEL_IMAGES = 3;
// Crops are fetched at most once a second while playing faster than real time.
const CROP_INTERVAL_FAST_MS = 1000;
const CROP_CACHE_SIZE = 40;

const incident = shallowRef(null);
const loading = ref(true);
const error = ref(null);
/** Position of the scrubber / playback (frame index). */
const index = ref(0);
/** The frame on screen: image, overlays, crops, telemetry and graph cursor follow it together. */
const shown = ref({ index: 0, src: null, failed: false });
const loadingImage = ref(false);
const playing = ref(false);
const speed = ref(1);
const stretchId = ref(readStored('nativeGuider.frame.stretch', 'medium'));
const viewportSize = ref({ width: 0, height: 0 });
const crops = shallowRef(null);
const viewport = ref(null);
const frameCard = ref(null);
const closeButton = ref(null);

let disposed = false;
let resizeObserver = null;
let playTimer = null;
let playhead = 0;
let wantedIndex = null;
let displaying = false;
let cropTimer = null;
let cropRequest = 0;
let lastCropFetch = 0;
let previousFocus = null;
let previousOverflow = '';
const loadPromises = new Map();
const loadedSources = new Set();
const cropCache = new Map();

function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

// --- Data --------------------------------------------------------------------------------

const summary = computed(() => store.incidents.find((i) => i?.id === props.id) || null);
const frames = computed(() => (Array.isArray(incident.value?.frames) ? incident.value.frames : []));
const positions = computed(() => framePositions(frames.value));
const markers = computed(() => timelineMarkers(incident.value));
const gaps = computed(() => imageGapSpans(frames.value));
const shownIndex = computed(() =>
  Math.min(Math.max(0, shown.value.index), Math.max(0, frames.value.length - 1))
);
const shownFrame = computed(() => frames.value[shownIndex.value] || null);
const sensorWidth = computed(() => Number(incident.value?.sensorWidth) || 1936);
const sensorHeight = computed(() => Number(incident.value?.sensorHeight) || 1216);
const framesOmitted = computed(() => incident.value?.framesOmitted || null);
const firstTrigger = computed(() => markers.value.find((m) => m.type === 'trigger') || null);
const previousMarker = computed(() => adjacentMarker(markers.value, index.value, -1));
const nextMarker = computed(() => adjacentMarker(markers.value, index.value, 1));

const title = computed(() => {
  const source = incident.value || summary.value;
  if (source) return `${kinds(source)} · ${dateTime(source.start)}`;
  const parsed = parseIncidentId(props.id);
  return parsed.kind ? `${kind(parsed.kind)} · ${dateTime(parsed.start)}` : props.id;
});

const subtitle = computed(() => {
  const source = incident.value || summary.value;
  if (!source) return '';
  const parts = [];
  const cause = incident.value?.diagnosis?.cause || source.cause;
  parts.push(cause ? likely(cause, incident.value?.diagnosis?.message) : k('analysing'));
  parts.push(formatIncidentDuration(incidentDurationSeconds(source)));
  if (source.occurrences > 1) parts.push(k('occurrences', { count: source.occurrences }));
  if (source.endReason) parts.push(endReason(source.endReason));
  return parts.join(' · ');
});

const overlayStars = computed(() =>
  Array.isArray(shownFrame.value?.stars) ? shownFrame.value.stars : []
);
const lock = computed(() => {
  const f = shownFrame.value;
  if (!f || !Number.isFinite(f.lockX) || !Number.isFinite(f.lockY)) return null;
  return { x: f.lockX, y: f.lockY };
});
const searchRegion = computed(() =>
  lock.value ? searchRegionRect(lock.value.x, lock.value.y, incident.value?.searchRegionPx) : null
);
const markersHere = computed(() => markers.value.filter((m) => m.index === shownIndex.value));

const offsetSeconds = computed(() => {
  const trigger = firstTrigger.value;
  const p = positions.value;
  if (!trigger || p[shownIndex.value] === undefined) return null;
  return p[shownIndex.value] - p[trigger.index];
});

const stretchLabel = computed(() => t('components.guider.native.frame.stretch'));
const stretchValue = computed(
  () => STRETCH_OPTIONS.find((o) => o.id === stretchId.value)?.value ?? 0.2
);

const imageLabel = computed(() => {
  const kindOfImage = frameImageKind(shownFrame.value);
  if (!kindOfImage || framesOmitted.value) return '';
  return kindOfImage === 'key'
    ? k('replay.keyFrame')
    : k('replay.context', { binning: incident.value?.contextBinning || 1 });
});

const imageNotice = computed(() => {
  if (!shownFrame.value) return '';
  if (framesOmitted.value) {
    const key = `components.guider.native.incidents.framesOmitted.${framesOmitted.value}`;
    return te(key) ? t(key) : framesOmitted.value;
  }
  if (shown.value.failed) return k('replay.imageFailed');
  if (!frameImageKind(shownFrame.value)) return k('replay.noImage');
  return '';
});

const positionText = computed(() => {
  const f = frames.value[index.value];
  if (!f) return '';
  return [
    k('replay.frame', { frame: f.frame }),
    k('replay.position', { index: index.value + 1, count: frames.value.length }),
    clock(f.timestamp),
  ].join(' · ');
});

const viewportStyle = computed(() => ({
  aspectRatio: `${sensorWidth.value} / ${sensorHeight.value}`,
  maxHeight: '52vh',
}));

/** Screen pixels per sensor pixel of the letterboxed frame. */
const fitScale = computed(() => {
  const { width, height } = viewportSize.value;
  if (!width || !height) return 0.3;
  return Math.min(width / sensorWidth.value, height / sensorHeight.value);
});

/** The sensor's box inside the viewport (centred), in CSS pixels. */
const stageStyle = computed(() => {
  const { width, height } = viewportSize.value;
  if (!width || !height) return { inset: '0' };
  const w = sensorWidth.value * fitScale.value;
  const h = sensorHeight.value * fitScale.value;
  return {
    left: `${(width - w) / 2}px`,
    top: `${(height - h) / 2}px`,
    width: `${w}px`,
    height: `${h}px`,
  };
});

function percent(frameIndex) {
  const n = frames.value.length;
  return n > 1 ? `${(frameIndex / (n - 1)) * 100}%` : '0%';
}

function spanWidth(gap) {
  const n = frames.value.length;
  return n > 1 ? `${Math.max(0.5, ((gap.to - gap.from) / (n - 1)) * 100)}%` : '0%';
}

async function load({ keepFrame = null } = {}) {
  loading.value = true;
  error.value = null;
  try {
    const result = await apiService.getNativeGuiderIncident(props.id);
    if (disposed) return;
    if (!result || !Array.isArray(result.frames)) throw new Error(k('replay.loadFailed'));
    incident.value = result;
    // The viewport exists from the next render on: its size picks the key-frame width.
    await nextTick();
    if (disposed) return;
    measure();
    const list = frames.value;
    let start = keepFrame !== null ? frameIndexOf(list, keepFrame) : -1;
    if (start < 0) start = firstTrigger.value?.index ?? 0;
    // A reload keeps the image on screen until the frame's image is there.
    if (keepFrame === null) shown.value = { index: start, src: null, failed: false };
    seek(start);
  } catch (e) {
    if (!e?.cancelled && !disposed) error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

// --- Images: the shown frame first, a few ahead preloaded -----------------------------------

function keyWidth() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const needed = Math.max(fitScale.value * sensorWidth.value, 320) * dpr;
  return WIDTHS.find((w) => w >= needed) || WIDTHS[WIDTHS.length - 1];
}

function imageSource(i) {
  const frame = frames.value[i];
  const kindOfImage = frameImageKind(frame);
  if (!frame || !kindOfImage || framesOmitted.value) return null;
  return apiService.getNativeGuiderIncidentImageUrl(props.id, {
    kind: kindOfImage,
    frame: frame.frame,
    maxWidth: kindOfImage === 'key' ? keyWidth() : CONTEXT_MAX_WIDTH,
    stretch: stretchValue.value,
  });
}

function loadImage(src) {
  if (loadedSources.has(src)) return Promise.resolve(true);
  const pending = loadPromises.get(src);
  if (pending) return pending;
  const promise = new Promise((resolve) => {
    const image = new Image();
    const finish = (ok) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      loadPromises.delete(src);
      if (ok) loadedSources.add(src);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 20000);
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = src;
  });
  loadPromises.set(src, promise);
  return promise;
}

/**
 * Puts frame i on screen: at once when it has no image or its image is loaded, else once the
 * image has loaded. While one image loads, only the newest request waits: the frames asked for in
 * between are skipped, so a fast playback or a scrub never queues up requests.
 */
async function display(i) {
  wantedIndex = i;
  if (displaying) return;
  displaying = true;
  try {
    while (wantedIndex !== null) {
      const target = wantedIndex;
      wantedIndex = null;
      const src = imageSource(target);
      if (src && !loadedSources.has(src)) {
        loadingImage.value = true;
        const ok = await loadImage(src);
        if (disposed) return;
        shown.value = { index: target, src: ok ? src : null, failed: !ok };
      } else {
        shown.value = { index: target, src, failed: false };
      }
    }
  } finally {
    displaying = false;
    loadingImage.value = false;
  }
  preloadAhead();
}

/** Preloads the next frames the playback (or a step) will show, a few at a time. */
function preloadAhead() {
  if (disposed || framesOmitted.value) return;
  const ahead = preloadIndices(
    positions.value,
    frames.value,
    index.value,
    playing.value ? speed.value : 1,
    {
      count: playing.value ? 3 : 2,
    }
  );
  if (!playing.value && index.value > 0 && frameImageKind(frames.value[index.value - 1])) {
    ahead.push(index.value - 1);
  }
  for (const j of ahead) {
    if (loadPromises.size >= MAX_PARALLEL_IMAGES) break;
    const src = imageSource(j);
    if (src && !loadedSources.has(src) && !loadPromises.has(src)) loadImage(src);
  }
}

// --- Crops ----------------------------------------------------------------------------------

/** Crops of the shown frame; stale ones (another frame, while fetching) are dimmed. */
const cropView = computed(() => {
  const entry = crops.value;
  if (!entry || (!entry.primaryCrop && !entry.secondaryCrops.length)) return null;
  return { ...entry, stale: entry.frame !== shownFrame.value?.frame };
});

function rememberCrops(frameNumber, tiles) {
  cropCache.set(frameNumber, tiles);
  if (cropCache.size > CROP_CACHE_SIZE) cropCache.delete(cropCache.keys().next().value);
}

function scheduleCrops() {
  clearTimeout(cropTimer);
  const frame = shownFrame.value;
  if (!frame || !(frame.crops > 0) || framesOmitted.value) {
    crops.value = null;
    return;
  }
  const cached = cropCache.get(frame.frame);
  if (cached) {
    crops.value = cached;
    return;
  }
  const fast = playing.value && speed.value > 1;
  const wait = fast ? Math.max(0, CROP_INTERVAL_FAST_MS - (Date.now() - lastCropFetch)) : 120;
  cropTimer = setTimeout(() => fetchCrops(frame), wait);
}

async function fetchCrops(frame) {
  const request = ++cropRequest;
  lastCropFetch = Date.now();
  try {
    const result = await apiService.getNativeGuiderIncidentCrops(props.id, frame.frame);
    if (disposed) return;
    const tiles = { frame: frame.frame, ...cropTiles(frame, result?.crops) };
    rememberCrops(frame.frame, tiles);
    if (request === cropRequest) crops.value = tiles;
  } catch (e) {
    if (!disposed && request === cropRequest && !e?.cancelled) crops.value = null;
  }
}

// --- Navigation and playback ------------------------------------------------------------------

function clampIndex(i) {
  return Math.min(Math.max(0, Math.round(i)), Math.max(0, frames.value.length - 1));
}

function seek(i) {
  if (!frames.value.length) return;
  const target = clampIndex(i);
  index.value = target;
  playhead = positions.value[target] ?? 0;
  display(target);
}

function seekPaused(i) {
  pause();
  seek(i);
}

function step(delta) {
  pause();
  seek(index.value + delta);
}

function jumpMarker(direction) {
  pause();
  const m = adjacentMarker(markers.value, index.value, direction);
  if (m) seek(m.index);
}

/** Evidence or trigger pointing at a frame number: jump there and bring the frame into view. */
function jumpToFrame(frameNumber) {
  const i = frameIndexOf(frames.value, frameNumber);
  if (i < 0) return;
  seekPaused(i);
  nextTick(() => frameCard.value?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
}

function onScrub(event) {
  pause();
  seek(Number(event.target.value));
}

function scheduleTick() {
  clearTimeout(playTimer);
  const next = playbackAdvance(positions.value, playhead, speed.value);
  if (!next) {
    pause();
    return;
  }
  playTimer = setTimeout(() => {
    if (disposed || !playing.value) return;
    playhead = next.playhead;
    index.value = next.index;
    display(next.index);
    scheduleTick();
  }, next.delayMs);
}

function play() {
  if (!frames.value.length) return;
  if (index.value >= frames.value.length - 1) seek(0);
  playhead = Math.max(playhead, positions.value[index.value] ?? 0);
  playing.value = true;
  scheduleTick();
  preloadAhead();
}

function pause() {
  playing.value = false;
  clearTimeout(playTimer);
  playTimer = null;
}

function togglePlay() {
  if (playing.value) pause();
  else play();
}

function setSpeed(value) {
  speed.value = value;
  if (playing.value) scheduleTick();
}

function setStretch(id) {
  stretchId.value = id;
  try {
    localStorage.setItem('nativeGuider.frame.stretch', id);
  } catch {
    // not remembered without storage
  }
  display(shownIndex.value);
}

function close() {
  pause();
  emit('close');
}

function onKeydown(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  const tag = target?.tagName;
  const isRange = tag === 'INPUT' && target.type === 'range';
  if ((tag === 'INPUT' && !isRange) || tag === 'TEXTAREA' || tag === 'SELECT') return;
  switch (event.key) {
    case 'Escape':
      event.preventDefault();
      close();
      break;
    case ' ':
      if (tag === 'BUTTON') return;
      event.preventDefault();
      togglePlay();
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
      // A focused scrubber moves itself (and pauses through its input event).
      if (isRange) return;
      event.preventDefault();
      step(event.key === 'ArrowLeft' ? -1 : 1);
      break;
    case 'PageUp':
    case 'PageDown':
      event.preventDefault();
      jumpMarker(event.key === 'PageUp' ? -1 : 1);
      break;
    default:
      break;
  }
}

function measure() {
  if (!viewport.value) return;
  const rect = viewport.value.getBoundingClientRect();
  viewportSize.value = { width: rect.width, height: rect.height };
}

// The frame object (not its index): a (re)loaded incident fetches the crops of its first frame too.
watch(shownFrame, scheduleCrops);
watch(viewport, (el, old) => {
  if (!resizeObserver) return;
  if (old) resizeObserver.unobserve(old);
  if (el) {
    resizeObserver.observe(el);
    measure();
  }
});
// An ongoing incident saved again (a repeat joined it): reload, staying on the same frame.
watch(
  () => summary.value?.end,
  (end, previous) => {
    if (end && previous && end !== previous && !loading.value && incident.value) {
      load({ keepFrame: shownFrame.value?.frame ?? null });
    }
  }
);

onMounted(() => {
  previousFocus = document.activeElement;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', onKeydown);
  if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(measure);
  nextTick(() => closeButton.value?.focus?.());
  load();
});

onBeforeUnmount(() => {
  disposed = true;
  pause();
  clearTimeout(cropTimer);
  window.removeEventListener('keydown', onKeydown);
  resizeObserver?.disconnect();
  resizeObserver = null;
  document.body.style.overflow = previousOverflow;
  previousFocus?.focus?.();
});
</script>

<style scoped>
@reference '../../../../assets/tailwind.css';

.replay-header {
  padding-top: calc(env(safe-area-inset-top, 0px) + 0.5rem);
  padding-left: max(0.5rem, env(safe-area-inset-left, 0px));
  padding-right: max(0.5rem, env(safe-area-inset-right, 0px));
}

.replay-footer {
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: max(0.5rem, env(safe-area-inset-left, 0px));
  padding-right: max(0.5rem, env(safe-area-inset-right, 0px));
}

.seg {
  @apply flex overflow-hidden rounded-chip border border-line-strong bg-surface-2;
}

.seg-btn {
  @apply h-9 min-w-9 px-2 text-xs font-semibold tabular-nums text-content-muted
    transition-colors border-r border-line last:border-r-0;
}

.seg-btn-active {
  @apply bg-accent/15 text-accent;
}

.ctl-btn {
  @apply tns-btn-secondary w-auto h-11 min-h-11 min-w-11 px-2;
}

.scrubber {
  accent-color: var(--color-accent);
  height: 1.5rem;
}

.legend-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-width: 2px;
}
</style>
