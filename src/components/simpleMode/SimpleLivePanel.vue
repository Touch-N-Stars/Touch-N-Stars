<template>
  <!-- The stage of the start page: the newest picture fills the stage window like on the camera
       page (pinch to zoom, the zoom survives the next picture), and everything else floats on it,
       like the main screen of an all-in-one box. The start page is the camera in the simple mode,
       so every picture lands here: test pictures, focusing, the plan's frames.
       Slots: a chip at the top (`overlay-top`, `overlay-bottom`, with the exposure progress),
       banners below it (`top`), and a floating panel at the bottom (default slot, `actions`).
       `testPicture` puts the test picture controls at the top of the panel (not while the plan
       runs: the camera is the plan's then). The histogram, sharpness trend and camera values
       only show with `details`. -->
  <section
    class="fixed z-10 overflow-hidden rounded-[var(--stage-radius)] bg-ground"
    :style="stageWindowStyle"
  >
    <!-- No own background: the stage's ground shows, darker than the bars around it, like
         on the camera page. On a phone the chip and the panel span the stage, so the picture
         takes the free space between them instead of hiding behind the panel. -->
    <div class="absolute inset-x-0" :style="pictureBox">
      <ZoomableImage
        :imageData="pictureUrl"
        height="100%"
        :showDownload="false"
        :showFullscreen="false"
        :showCrosshair="false"
        :showLoupe="false"
        :altText="$t('components.simpleMode.live.lastPicture')"
      >
        <template #placeholder>
          <div class="flex flex-col items-center gap-2 p-4 text-center text-content-muted">
            <Spinner v-if="loadingPicture" size="lg" class="text-accent" />
            <!-- The app's logo on the empty stage, as on the camera page -->
            <img v-else :src="logoUrl" alt="Touch'N'Stars" class="w-44 h-44 opacity-50" />
            <span v-if="!loadingPicture && placeholderKey" class="text-sm">
              {{ $t(placeholderKey) }}
            </span>
          </div>
        </template>
      </ZoomableImage>
    </div>

    <!-- No loading overlay: with short exposures it would cover the picture every few
         seconds; the old picture stays until the new one is there. -->
    <!-- On top of the picture, but let pinch and pan through except where there is
         something to tap. A floating chip like the camera page's controls. -->
    <div
      ref="topEl"
      class="absolute top-0 inset-x-0 z-30 flex flex-col gap-2 p-2 pointer-events-none"
    >
      <div class="rounded-control bg-surface-1/90 shadow-lg overflow-hidden text-content text-left">
        <div
          v-if="$slots['overlay-top']"
          class="flex items-start justify-between gap-3 px-3 pt-2"
          :class="$slots['overlay-bottom'] ? '' : 'pb-2'"
        >
          <slot
            name="overlay-top"
            :caption="pictureUrl ? caption : ''"
            :ago="pictureUrl ? ago : ''"
            :numbers="pictureUrl ? numbers : ''"
          />
        </div>
        <div v-if="$slots['overlay-bottom']" class="flex items-center gap-2 px-3 py-1.5">
          <slot name="overlay-bottom" />
        </div>
        <div class="h-1 bg-surface-3">
          <div
            v-if="store.cameraInfo.IsExposing"
            class="h-full bg-accent transition-[width] duration-500"
            :style="{ width: `${Math.min(100, Math.max(0, cameraStore.exposureProgress))}%` }"
          ></div>
        </div>
      </div>
      <div v-if="$slots.top" class="pointer-events-auto">
        <slot name="top" />
      </div>
    </div>

    <!-- The panel floats on the picture - across the stage on a phone, in the bottom right
         corner on a wider screen - and keeps its own scroll, so the picture never scrolls away.
         `tall` lets it grow when opened. Placed by width, not orientation: a small desktop
         window counts as landscape, and a side column took all of its width. -->
    <div
      ref="panelEl"
      class="absolute z-30 left-2 right-2 bottom-2 md:left-auto md:w-96 overflow-y-auto overscroll-contain bg-ground/70 backdrop-blur-md rounded-card border border-line shadow-lg shadow-black p-3 flex flex-col gap-3"
      :class="tall ? 'max-h-[85%]' : 'max-h-[55%]'"
    >
      <!-- Stays at the top while the panel scrolls, e.g. the way to fold it again -->
      <div
        v-if="$slots.header"
        class="sticky -top-3 z-10 -mx-3 -mt-3 px-3 pt-3 pb-1 bg-ground/95 rounded-t-card"
      >
        <slot name="header" />
      </div>

      <!-- Test picture: what the camera sees now, once or in a loop (focusing by hand) -->
      <div v-if="showTestPicture" class="flex gap-2">
        <label for="simple-mode-exposure" class="sr-only">
          {{ $t('components.simpleMode.live.exposure') }}
        </label>
        <select
          id="simple-mode-exposure"
          class="tns-select w-24! shrink-0"
          :value="exposureTime"
          :disabled="store.cameraInfo.IsExposing"
          @change="settingsStore.camera.exposureTime = Number($event.target.value)"
        >
          <option v-for="seconds in exposureChoices" :key="seconds" :value="seconds">
            {{ seconds }} s
          </option>
        </select>
        <button
          v-if="!store.cameraInfo.IsExposing && !cameraStore.isLooping"
          type="button"
          class="tns-btn-primary"
          :disabled="cameraStore.loading"
          @click="takeTestPicture()"
        >
          <CameraIcon class="w-5 h-5" />
          {{ $t('components.simpleMode.live.testPicture') }}
        </button>
        <button v-else type="button" class="tns-btn-danger" @click="stopTestPictures">
          {{ $t('components.simpleMode.live.abort') }}
        </button>
        <button
          type="button"
          class="tns-btn-secondary w-auto! shrink-0 px-3!"
          :class="cameraStore.isLooping ? 'border-accent! text-accent!' : ''"
          :aria-pressed="cameraStore.isLooping"
          :aria-label="$t('components.simpleMode.live.loop')"
          :title="$t('components.simpleMode.live.loop')"
          @click="toggleLoop"
        >
          <ArrowPathIcon class="w-5 h-5" />
        </button>
      </div>

      <slot />

      <!-- Histogram of the shown picture: where the sky background sits, and how many pixels
           are at the darkest and brightest value (clipped background, saturated stars) -->
      <div v-if="histogram && details" class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-2">
          <span class="tns-label">{{ $t('components.simpleMode.live.histogram') }}</span>
          <span class="text-xs text-content-faint tabular-nums">
            {{ histogram.lo }} – {{ histogram.hi }} ADU
          </span>
        </div>
        <svg
          :viewBox="`0 0 ${HIST_W} ${HIST_H}`"
          preserveAspectRatio="none"
          class="w-full h-14 rounded-chip bg-surface-2"
          role="img"
          :aria-label="$t('components.simpleMode.live.histogram')"
        >
          <polygon
            :points="histogramPoints"
            fill="var(--color-accent)"
            fill-opacity="0.35"
            stroke="var(--color-accent)"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
            stroke-linejoin="round"
          />
        </svg>
        <!-- Say what the curve is: a cut of the linear axis can be mistaken for a stretch -->
        <p class="text-xs text-content-faint">
          {{ $t('components.simpleMode.live.histogramHint') }}
        </p>
        <div class="grid grid-cols-2 gap-2">
          <div class="tns-stat-tile min-w-0">
            <span class="tns-stat-label">{{ $t('components.simpleMode.live.min') }}</span>
            <span class="tns-stat-value">{{ histogram.min }}</span>
            <span class="text-[11px] leading-tight text-content-muted">
              {{
                $t(
                  'components.simpleMode.live.pixels',
                  { count: formatCount(histogram.minCount) },
                  histogram.minCount
                )
              }}
            </span>
          </div>
          <div
            class="tns-stat-tile min-w-0"
            :class="histogram.saturated ? 'tns-stat-tile-warn' : ''"
          >
            <span class="tns-stat-label">{{ $t('components.simpleMode.live.max') }}</span>
            <span class="tns-stat-value">{{ histogram.max }}</span>
            <span class="text-[11px] leading-tight text-content-muted">
              {{
                $t(
                  histogram.saturated
                    ? 'components.simpleMode.live.pixelsSaturated'
                    : 'components.simpleMode.live.pixels',
                  { count: formatCount(histogram.maxCount) },
                  histogram.maxCount
                )
              }}
            </span>
          </div>
        </div>
      </div>

      <!-- Sharpness over the night and the default gain, offset and readout mode of the test
           picture and the plan. While the plan runs the trend lives in the status bar's focus
           panel instead. -->
      <template v-if="testPicture && details">
        <SimpleHfrTrend />
        <SimpleCameraSettings v-if="store.cameraInfo.Connected" />
      </template>

      <slot name="actions" />
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowPathIcon, CameraIcon } from '@heroicons/vue/24/outline';
import logoUrl from '@/assets/Logo_TouchNStars_600x600.png';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useCameraStore } from '@/store/cameraStore';
import { useSequenceStore } from '@/store/sequenceStore';
import { useImagetStore } from '@/store/imageStore';
import { usePolling } from '@/composables/usePolling';
import Spinner from '@/components/helpers/Spinner.vue';
import ZoomableImage from '@/components/helpers/ZoomableImage.vue';
import SimpleHfrTrend from '@/components/simpleMode/SimpleHfrTrend.vue';
import SimpleCameraSettings from '@/components/simpleMode/SimpleCameraSettings.vue';
import { useStageWindow } from '@/composables/useStageWindow';
import { histogramSummary, latestPicture } from '@/utils/simpleMode';
import {
  historyEntryKey,
  historyRawSource,
  isHistoryEntryDeleted,
} from '@/utils/imageHistoryUtils';
import { parseRawImage } from '@/utils/rawImage/parseRawImage';
import { localDecimal } from '@/utils/localeNumber';

const props = defineProps({
  // The test picture controls at the top of the panel (while the night is prepared)
  testPicture: { type: Boolean, default: false },
  // Show the histogram (and with testPicture the sharpness trend and camera values)
  details: { type: Boolean, default: false },
  // Let the panel take more of the stage, for a panel that was opened
  tall: { type: Boolean, default: false },
  // What the empty stage says under the logo; '' for the logo alone
  placeholderKey: { type: String, default: 'components.simpleMode.live.firstPlanPicture' },
});
const { stageWindowStyle } = useStageWindow();

// --- Where the picture goes ---------------------------------------------------------------
// Below md the chip and the panel span the stage: the picture box ends where they begin, so
// the picture centers in the free space between them. From md on the panel sits in a corner
// and the picture keeps the whole stage.
const GAP_PX = 8;
const topEl = ref(null);
const panelEl = ref(null);
const topHeight = ref(0);
const panelHeight = ref(0);
const wide = ref(false);
let resizeObserver = null;
let wideQuery = null;
const onWideChange = (event) => (wide.value = event.matches);
function measure() {
  topHeight.value = topEl.value?.offsetHeight ?? 0;
  panelHeight.value = panelEl.value?.offsetHeight ?? 0;
}
onMounted(() => {
  wideQuery = window.matchMedia('(min-width: 768px)');
  wide.value = wideQuery.matches;
  wideQuery.addEventListener('change', onWideChange);
  measure();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(measure);
    if (topEl.value) resizeObserver.observe(topEl.value);
    if (panelEl.value) resizeObserver.observe(panelEl.value);
  }
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  wideQuery?.removeEventListener('change', onWideChange);
});
const pictureBox = computed(() =>
  wide.value
    ? { top: '0px', bottom: '0px' }
    : { top: `${topHeight.value}px`, bottom: `${panelHeight.value + 2 * GAP_PX}px` }
);

/** Shows the top of the panel, e.g. when another step comes to lead it. */
function scrollPanelToTop() {
  if (panelEl.value) panelEl.value.scrollTop = 0;
}

const { t, locale } = useI18n();
const store = apiStore();
const settingsStore = useSettingsStore();
const cameraStore = useCameraStore();
const sequenceStore = useSequenceStore();
const imageStore = useImagetStore();

const exposureChoices = [1, 2, 3, 5, 10, 15, 30];
const exposureTime = computed(() => {
  const value = Number(settingsStore.camera?.exposureTime);
  return exposureChoices.includes(value) ? value : 2;
});

const isDeleted = (entry, index) =>
  isHistoryEntryDeleted(entry, historyEntryKey(index, entry), imageStore.deletedHistoryKeys);

// When the camera's preview last changed. A preview that was already there when the page
// opened has no known time, so a saved picture wins over it.
const previewAtMs = ref(0);
watch(
  () => imageStore.imageData,
  (url) => {
    if (!url) return;
    previewAtMs.value = Date.now();
    awaitPreviewStars();
  }
);

// The store fetches the preview's statistics once, as soon as the picture is there; the star
// analysis (HFR, stars) usually finishes a moment later, so that fetch only has the histogram
// values. Ask again a few times until HFR and stars arrive.
const STAR_STATS_RETRIES = 6;
const STAR_STATS_DELAY_MS = 2000;
let starStatsTimer = null;
function awaitPreviewStars(attempt = 0) {
  clearTimeout(starStatsTimer);
  starStatsTimer = setTimeout(async () => {
    starStatsTimer = null;
    if (num(store.lastImageStats?.HFR) !== null) return;
    await store.fetchLastImageStats();
    if (num(store.lastImageStats?.HFR) === null && attempt + 1 < STAR_STATS_RETRIES) {
      awaitPreviewStars(attempt + 1);
    }
  }, STAR_STATS_DELAY_MS);
}
onBeforeUnmount(() => clearTimeout(starStatsTimer));

// When the newest saved picture appeared here, on this device's clock like previewAtMs.
// Entries that were there when the page opened keep null (their own date then counts).
const historyArrivedAtMs = ref(null);
watch(
  () => (Array.isArray(store.imageHistoryInfo) ? store.imageHistoryInfo.length : 0),
  (length, previous) => {
    if (previous !== undefined && length > previous) historyArrivedAtMs.value = Date.now();
  },
  { immediate: true }
);

// A test picture is one this panel asked for; everything else that lands in the camera's
// preview (plan frames, plate solves of polar alignment and centering) is not.
const ownCapture = ref(null);
const OWN_CAPTURE_SLACK_MS = 60000;

const previewIsOwn = computed(() => {
  const own = ownCapture.value;
  if (!own || !imageStore.imageData) return false;
  // The camera store takes the looped pictures by itself, after the one asked for here
  if (cameraStore.isLooping && previewAtMs.value >= own.atMs) return true;
  const delay = previewAtMs.value - own.atMs;
  return delay >= 0 && delay <= own.exposure * 1000 + OWN_CAPTURE_SLACK_MS;
});

const picture = computed(() =>
  latestPicture({
    preview: imageStore.imageData
      ? { url: imageStore.imageData, atMs: previewAtMs.value, own: previewIsOwn.value }
      : null,
    history: store.imageHistoryInfo,
    isDeleted,
    historyArrivedAtMs: historyArrivedAtMs.value,
  })
);

const previewIsTestPicture = computed(
  () => previewIsOwn.value && picture.value?.source === 'preview'
);

// Saved pictures are fetched by index; one at a time, the newest request wins.
const historyUrl = ref(null);
const loadingPicture = ref(false);
let loadGeneration = 0;
watch(
  () => (picture.value?.source === 'history' ? picture.value.index : null),
  async (index) => {
    if (index === null) return;
    const generation = ++loadGeneration;
    loadingPicture.value = true;
    try {
      const url = await imageStore.getImageByIndex(index);
      if (generation === loadGeneration) historyUrl.value = url;
    } catch (error) {
      console.error('[Simple mode] loading the last picture failed', error);
    } finally {
      if (generation === loadGeneration) loadingPicture.value = false;
    }
  },
  { immediate: true }
);

const pictureUrl = computed(() => {
  if (!picture.value) return null;
  return picture.value.source === 'preview' ? imageStore.imageData : historyUrl.value;
});

// The numbers of the shown picture: the history entry, or the preview's prepared statistics.
const stats = computed(() => {
  if (picture.value?.source === 'history') return picture.value.entry;
  if (picture.value?.source === 'preview') return store.lastImageStats ?? {};
  return {};
});

function num(value) {
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

// Sharpness and star count of the shown picture, for the chip on the stage.
const numbers = computed(() => {
  const hfr = num(stats.value.HFR);
  const stars = num(stats.value.Stars);
  const parts = [];
  if (hfr !== null && hfr > 0) {
    parts.push(t('components.simpleMode.live.hfrValue', { hfr: localDecimal(hfr, 2) }));
  }
  if (stars !== null) parts.push(t('components.simpleMode.live.starsValue', { stars }, stars));
  return parts.join(' · ');
});

const caption = computed(() => {
  const s = stats.value;
  const parts = [];
  const name = s.TargetName && s.TargetName !== 'Snapshot' ? s.TargetName : '';
  if (previewIsTestPicture.value || s.ImageType === 'SNAPSHOT') {
    parts.push(t('components.simpleMode.live.preview'));
  }
  // The cockpit names the target above the caption already
  if (name && props.testPicture) parts.push(name);
  // The test picture's exposure is the one picked here; any other preview only says its own
  // exposure if the statistics carry it - the picker value would be a guess.
  const exposure = previewIsTestPicture.value ? ownCapture.value.exposure : num(s.ExposureTime);
  if (exposure !== null) parts.push(`${exposure} s`);
  if (s.Filter) parts.push(s.Filter);
  return parts.join(' · ');
});

// "2 min ago", refreshed by a slow clock while the page is open.
const nowMs = ref(Date.now());
usePolling(() => (nowMs.value = Date.now()), 30000, { immediate: false });
const ago = computed(() => {
  const at = picture.value?.atMs;
  if (!at) return '';
  const minutes = Math.max(0, Math.round((nowMs.value - at) / 60000));
  return minutes < 1
    ? t('components.simpleMode.live.justNow')
    : t('components.simpleMode.live.minutesAgo', { minutes });
});

// --- Histogram --------------------------------------------------------------------------
// From the plugin's raw image: its histogram and statistics cover the full frame, while the
// pixel plane is asked for at a token size (only the histogram is used here). One request per
// shown picture; a newer picture cancels the one in flight.
const RAW_MAX_DIM = 16;
const histogram = ref(null);
let histogramAbort = null;
const histogramSource = computed(() => {
  const p = picture.value;
  if (!p) return null;
  if (p.source === 'history') {
    const source = historyRawSource(p.index, p.entry);
    return source ? { key: `history-${p.index}`, source } : null;
  }
  return { key: `prepared-${previewAtMs.value}`, source: { kind: 'prepared' } };
});
watch(
  () => histogramSource.value?.key,
  async () => {
    histogramAbort?.abort();
    const target = histogramSource.value;
    if (!target) {
      histogram.value = null;
      return;
    }
    const controller = new AbortController();
    histogramAbort = controller;
    try {
      const buffer =
        target.source.kind === 'history'
          ? await apiService.getRawHistoryImage(target.source, RAW_MAX_DIM, controller.signal)
          : await apiService.getRawPreparedImage(RAW_MAX_DIM, controller.signal);
      if (histogramAbort === controller) histogram.value = histogramSummary(parseRawImage(buffer));
    } catch (error) {
      if (controller.signal.aborted) return;
      // An older plugin without raw images: no histogram, the rest of the panel stays.
      histogram.value = null;
      if (error?.rawImageCode !== 'unsupported') {
        console.warn('[Simple mode] histogram not available', error?.message ?? error);
      }
    }
  },
  { immediate: true }
);
onBeforeUnmount(() => histogramAbort?.abort());

const HIST_W = 300;
const HIST_H = 56;
const histogramPoints = computed(() => {
  const bins = histogram.value?.bins ?? [];
  const peak = Math.max(...bins, 1);
  const step = HIST_W / Math.max(bins.length - 1, 1);
  const line = bins.map((count, i) => {
    const y = HIST_H - 2 - (count / peak) * (HIST_H - 4);
    return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
  });
  return [`0,${HIST_H}`, ...line, `${HIST_W},${HIST_H}`].join(' ');
});

const countFormat = computed(() => new Intl.NumberFormat(locale.value));
const formatCount = (count) => countFormat.value.format(count);

// --- Actions ------------------------------------------------------------------------------
const showTestPicture = computed(
  () => props.testPicture && store.cameraInfo.Connected && !sequenceStore.sequenceRunning
);

/** Takes a test picture; with `loop` it goes on until stopped (focusing by hand). */
function takeTestPicture({ loop = cameraStore.isLooping } = {}) {
  if (store.cameraInfo.IsExposing || cameraStore.loading) return;
  cameraStore.isLooping = loop;
  ownCapture.value = { atMs: Date.now(), exposure: exposureTime.value };
  // The camera's default gain (set below the button), the one the plan's exposures use too.
  // -1 leaves it to N.I.N.A., which falls back to the same profile default.
  cameraStore.capturePhoto(
    apiService,
    exposureTime.value,
    store.profileInfo?.CameraSettings?.Gain ?? -1
  );
}

function stopTestPictures() {
  // Cleared first: abortExposure() leaves the loop on when the camera refuses the abort
  cameraStore.isLooping = false;
  cameraStore.abortExposure(apiService);
}

// Switching the loop on while idle starts it; switched off, the running picture still finishes.
function toggleLoop() {
  if (cameraStore.isLooping) {
    cameraStore.isLooping = false;
    return;
  }
  if (store.cameraInfo.IsExposing || cameraStore.loading) cameraStore.isLooping = true;
  else takeTestPicture({ loop: true });
}

defineExpose({ takeTestPicture, scrollPanelToTop });

onMounted(() => {
  // The preview's numbers are only fetched after a capture; fetch them once for a preview
  // that already exists from earlier in this session.
  if (imageStore.imageData && num(store.lastImageStats?.HFR) === null) awaitPreviewStars();
});
</script>
