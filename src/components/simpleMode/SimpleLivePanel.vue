<template>
  <!-- The newest picture with what matters about it, like the main screen of an all-in-one
       box: sharpness (HFR), stars, guiding and sensor temperature, the sharpness trend of the
       night, and a test picture one tap away. -->
  <section class="tns-card p-0! overflow-hidden flex flex-col">
    <button
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

    <div class="p-3 flex flex-col gap-3">
      <!-- lg: the panel only gets half the page next to the night steps, too narrow for four
           tiles ("SHARPNESS (HFR)" was cut off on a 1024 px tablet) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2">
        <div v-for="tile in tiles" :key="tile.key" class="tns-stat-tile">
          <span class="tns-stat-label">{{ tile.label }}</span>
          <span class="tns-stat-value">{{ tile.value }}</span>
        </div>
      </div>

      <!-- Sharpness over the night -->
      <div v-if="series.length >= 2" class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-2">
          <span class="tns-label">
            {{ $t('components.simpleMode.live.trendTitle', { count: series.length }) }}
          </span>
          <span class="text-xs text-content-faint tabular-nums">
            {{ trendRange }}
          </span>
        </div>
        <svg
          :viewBox="`0 0 ${TREND_W} ${TREND_H}`"
          preserveAspectRatio="none"
          class="w-full h-12 rounded-chip bg-surface-2"
          role="img"
          :aria-label="$t('components.simpleMode.live.trendTitle', { count: series.length })"
        >
          <polyline
            :points="trendPoints"
            fill="none"
            stroke="var(--color-accent)"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
            stroke-linejoin="round"
          />
        </svg>
        <p class="text-xs text-content-faint">{{ $t('components.simpleMode.live.trendHint') }}</p>
      </div>

      <!-- Test picture -->
      <div v-if="store.cameraInfo.Connected" class="flex gap-2">
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
      <p v-if="sequenceStore.sequenceRunning" class="text-xs text-content-faint">
        {{ $t('components.simpleMode.live.planRunning') }}
      </p>
    </div>

    <ImageModal
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
import { hfrSeries, latestPicture } from '@/utils/simpleMode';
import { historyEntryKey, isHistoryEntryDeleted } from '@/utils/imageHistoryUtils';

const { t } = useI18n();
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
  if (name) parts.push(name);
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

// --- HFR trend ----------------------------------------------------------------------------
const TREND_W = 300;
const TREND_H = 48;
const series = computed(() => hfrSeries(store.imageHistoryInfo, 30, isDeleted));
// The vertical scale spans at least this much HFR. Scaled to the data alone, 1.392 and 1.388
// filled the whole height and read as a steep change while the label said "1.39 - 1.39".
const TREND_MIN_SPAN = 0.5;
const trendBounds = computed(() => {
  const values = series.value.map((p) => p.hfr);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, TREND_MIN_SPAN);
  // Centre a widened scale on the data, so a steady series draws a flat line in the middle
  const bottom = (min + max) / 2 - span / 2;
  return { min, max, bottom, span };
});
const trendPoints = computed(() => {
  const points = series.value;
  const { bottom: min, span } = trendBounds.value;
  const pad = 4;
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * TREND_W;
      // Lower HFR = sharper = higher up, so "going down" reads as getting worse
      const y = pad + ((p.hfr - min) / span) * (TREND_H - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
});
const trendRange = computed(() => {
  const { min, max } = trendBounds.value;
  return `HFR ${min.toFixed(2)} – ${max.toFixed(2)}`;
});

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
