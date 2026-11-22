<template>
  <!-- The newest picture with what matters about it, like the main screen of an all-in-one
       box: sharpness (HFR), stars, guiding and sensor temperature, the sharpness trend of the
       night, and a test picture one tap away.
       `hero`: while the plan runs the picture fills the stage window like on the camera page
       (pinch to zoom, the zoom survives the next picture), and everything else floats on it.
       The imaging cockpit fills the slots: what the plan does in one chip at the top
       (`overlay-top`, `overlay-bottom`, with the exposure progress), problems as banners below
       it (`top`), its verdict in a floating panel like the camera page's capture panel - a
       single line at the bottom - (default slot, `actions`). The
       numbers here then only show with `details`. -->
  <section
    :class="
      hero
        ? 'fixed z-10 overflow-hidden rounded-[var(--stage-radius)] bg-ground'
        : 'tns-card p-0! overflow-hidden flex flex-col'
    "
    :style="hero ? stageWindowStyle : undefined"
  >
    <!-- No own background: the stage's ground shows, darker than the bars around it, like
         on the camera page -->
    <div v-if="hero" class="absolute inset-0">
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
            <PhotoIcon class="w-10 h-10" />
            <span class="text-sm">{{ $t('components.simpleMode.live.firstPlanPicture') }}</span>
          </div>
        </template>
      </ZoomableImage>

      <!-- No loading overlay: with short exposures it would cover the picture every few
           seconds; the old picture stays until the new one is there. -->
      <!-- On top of the picture, but let pinch and pan through except where there is
           something to tap. A floating chip like the camera page's controls. -->
      <div class="absolute top-0 inset-x-0 z-30 flex flex-col gap-2 p-2 pointer-events-none">
        <div
          class="rounded-control bg-surface-1/90 shadow-lg overflow-hidden text-content text-left"
        >
          <div
            v-if="$slots['overlay-top']"
            class="flex items-start justify-between gap-3 px-3 pt-2"
          >
            <slot
              name="overlay-top"
              :caption="pictureUrl ? caption : ''"
              :ago="pictureUrl ? ago : ''"
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
    </div>

    <button
      v-else
      type="button"
      class="relative block w-full aspect-[3/2] bg-black"
      :disabled="!pictureUrl"
      :aria-label="$t('components.simpleMode.live.openFull')"
      data-haptic="none"
      @click="showFull = true"
    >
      <img
        v-if="pictureUrl"
        :src="pictureUrl"
        :alt="$t('components.simpleMode.live.lastPicture')"
        class="absolute inset-0 w-full h-full object-contain"
      />
      <div
        v-else-if="!loadingPicture"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-content-muted"
      >
        <PhotoIcon class="w-10 h-10" />
        <span class="text-sm">{{ $t('components.simpleMode.live.noPicture') }}</span>
      </div>
      <div
        v-if="loadingPicture || cameraStore.isLoadingImage"
        class="absolute inset-0 flex items-center justify-center bg-black/30 text-accent"
      >
        <Spinner size="lg" />
      </div>

      <div
        v-if="pictureUrl && caption"
        class="absolute top-0 inset-x-0 flex justify-between gap-2 px-3 py-1.5 bg-black/55 text-xs text-content text-left"
      >
        <span class="truncate">{{ caption }}</span>
        <span class="shrink-0 text-content-muted">{{ ago }}</span>
      </div>
      <ArrowsPointingOutIcon
        v-if="pictureUrl"
        class="absolute bottom-2 right-2 w-5 h-5 text-white/80 drop-shadow"
      />

      <!-- Exposure running -->
      <div v-if="store.cameraInfo.IsExposing" class="absolute bottom-0 inset-x-0 h-1.5 bg-black/60">
        <div
          class="h-full bg-accent transition-[width] duration-500"
          :style="{ width: `${Math.min(100, Math.max(0, cameraStore.exposureProgress))}%` }"
        ></div>
      </div>
    </button>

    <!-- Hero: the panel floats on the picture - a single line at the bottom, across the stage
         on a phone, in the bottom right corner on a wider screen - and only grows when the
         verdict is tapped open. It then keeps its own scroll, so the picture never scrolls
         away. Placed by width, not orientation: a small desktop window counts as landscape,
         and a side column took all of its width. -->
    <div
      class="p-3 flex flex-col gap-3"
      :class="
        hero
          ? 'absolute z-30 left-2 right-2 bottom-2 md:left-auto md:w-96 max-h-[65%] overflow-y-auto overscroll-contain bg-ground/70 backdrop-blur-md rounded-card border border-line shadow-lg shadow-black'
          : ''
      "
    >
      <slot />

      <!-- lg: the panel only gets half the page next to the night steps, too narrow for four
           tiles ("SHARPNESS (HFR)" was cut off on a 1024 px tablet) -->
      <div v-if="!hero" class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2">
        <div v-for="tile in tiles" :key="tile.key" class="tns-stat-tile">
          <span class="tns-stat-label">{{ tile.label }}</span>
          <span class="tns-stat-value">{{ tile.value }}</span>
        </div>
      </div>

      <!-- Histogram of the shown picture: where the sky background sits, and how many pixels
           are at the darkest and brightest value (clipped background, saturated stars) -->
      <div v-if="histogram && showNumbers" class="flex flex-col gap-1">
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

      <!-- Sharpness over the night. While the plan runs it lives in the status bar's focus
           panel instead. -->
      <SimpleHfrTrend v-if="!hero" />

      <!-- Test picture (not while the plan runs: the camera is the plan's) -->
      <div v-if="store.cameraInfo.Connected && !hero" class="flex gap-2">
        <label for="simple-mode-exposure" class="sr-only">
          {{ $t('components.simpleMode.live.exposure') }}
        </label>
        <select
          id="simple-mode-exposure"
          class="tns-select w-28! shrink-0"
          :value="exposureTime"
          :disabled="store.cameraInfo.IsExposing || sequenceStore.sequenceRunning"
          @change="settingsStore.camera.exposureTime = Number($event.target.value)"
        >
          <option v-for="seconds in exposureChoices" :key="seconds" :value="seconds">
            {{ seconds }} s
          </option>
        </select>
        <button
          v-if="!store.cameraInfo.IsExposing"
          type="button"
          class="tns-btn-primary"
          :disabled="cameraStore.loading || sequenceStore.sequenceRunning"
          @click="takeTestPicture"
        >
          <CameraIcon class="w-5 h-5" />
          {{ $t('components.simpleMode.live.testPicture') }}
        </button>
        <button
          v-else
          type="button"
          class="tns-btn-danger"
          :disabled="sequenceStore.sequenceRunning"
          @click="cameraStore.abortExposure(apiService)"
        >
          {{ $t('components.simpleMode.live.abort') }}
        </button>
      </div>
      <p v-if="sequenceStore.sequenceRunning && !hero" class="text-xs text-content-faint">
        {{ $t('components.simpleMode.live.planRunning') }}
      </p>

      <slot name="actions" />
    </div>

    <ImageModal
      v-if="!hero"
      :showModal="showFull"
      :imageData="pictureUrl"
      :isLoading="false"
      @close="showFull = false"
    />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowsPointingOutIcon, CameraIcon, PhotoIcon } from '@heroicons/vue/24/outline';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useCameraStore } from '@/store/cameraStore';
import { useSequenceStore } from '@/store/sequenceStore';
import { useImagetStore } from '@/store/imageStore';
import { usePolling } from '@/composables/usePolling';
import Spinner from '@/components/helpers/Spinner.vue';
import ImageModal from '@/components/helpers/imageModal.vue';
import ZoomableImage from '@/components/helpers/ZoomableImage.vue';
import SimpleHfrTrend from '@/components/simpleMode/SimpleHfrTrend.vue';
import { useStageWindow } from '@/composables/useStageWindow';
import { histogramSummary, latestPicture } from '@/utils/simpleMode';
import {
  historyEntryKey,
  historyRawSource,
  isHistoryEntryDeleted,
} from '@/utils/imageHistoryUtils';
import { parseRawImage } from '@/utils/rawImage/parseRawImage';

const props = defineProps({
  // While the plan runs the imaging cockpit wraps the picture (see the template)
  hero: { type: Boolean, default: false },
  // Hero only: show the histogram
  details: { type: Boolean, default: false },
});
const showNumbers = computed(() => !props.hero || props.details);
const { stageWindowStyle } = useStageWindow();

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

// Only while guiding: NINA keeps the last RMS after guiding stopped.
const guidingRms = computed(() => {
  if (!store.guiderInfo.Connected || store.guiderInfo.State !== 'Guiding') return null;
  return num(store.guiderInfo.RMSError?.Total?.Arcseconds);
});

const tiles = computed(() => {
  const hfr = num(stats.value.HFR);
  const stars = num(stats.value.Stars);
  const temp = num(stats.value.Temperature) ?? num(store.cameraInfo.Temperature);
  return [
    {
      key: 'hfr',
      label: t('components.simpleMode.live.hfr'),
      value: hfr !== null && hfr > 0 ? hfr.toFixed(2) : '–',
    },
    { key: 'stars', label: t('components.simpleMode.live.stars'), value: stars ?? '–' },
    {
      key: 'guiding',
      label: t('components.simpleMode.live.guiding'),
      value: guidingRms.value ? `${guidingRms.value.toFixed(2)}″` : '–',
    },
    {
      key: 'temp',
      label: t('components.simpleMode.live.sensor'),
      value: temp !== null ? `${temp.toFixed(1)} °C` : '–',
    },
  ];
});

const caption = computed(() => {
  const s = stats.value;
  const parts = [];
  const name = s.TargetName && s.TargetName !== 'Snapshot' ? s.TargetName : '';
  if (previewIsTestPicture.value || s.ImageType === 'SNAPSHOT') {
    parts.push(t('components.simpleMode.live.preview'));
  }
  // In the hero the cockpit names the target above the caption already
  if (name && !props.hero) parts.push(name);
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
const showFull = ref(false);

function takeTestPicture() {
  ownCapture.value = { atMs: Date.now(), exposure: exposureTime.value };
  cameraStore.capturePhoto(
    apiService,
    exposureTime.value,
    store.profileInfo?.SnapShotControlSettings?.Gain
  );
}

onMounted(() => {
  // The preview's numbers are only fetched after a capture; fetch them once for a preview
  // that already exists from earlier in this session.
  if (imageStore.imageData && num(store.lastImageStats?.HFR) === null) awaitPreviewStars();
});
</script>
