<template>
  <div class="container mx-auto p-4 flex flex-col gap-4 max-w-3xl">
    <div class="flex items-start justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold text-white">{{ $t('plugins.hardwareDb.title') }}</h1>
        <p class="text-sm text-gray-400 mt-1">{{ $t('plugins.hardwareDb.intro') }}</p>
      </div>
      <button
        class="tns-btn-secondary w-auto! px-3"
        :disabled="snapshot.loading.value"
        @click="refresh"
      >
        {{ $t('common.refresh') }}
      </button>
    </div>

    <p v-if="snapshot.loading.value" class="text-blue-400 text-sm">
      {{ $t('plugins.hardwareDb.collecting') }}
    </p>
    <p v-else-if="snapshot.error.value" class="text-red-400 text-sm">
      {{ snapshot.error.value }}
    </p>

    <div v-else-if="candidates.length === 0" class="tns-card p-4">
      <p class="text-gray-300">{{ $t('plugins.hardwareDb.noDevices') }}</p>
    </div>

    <template v-else>
      <HardwareDeviceRow
        v-for="candidate in candidates"
        :key="candidate.id"
        :candidate="candidate"
        :rating="ratingFor(candidate.id)"
        :known="knownFor(candidate)"
        :knowledge-loaded="knowledgeLoaded"
        :suggestions="suggestionsFor(candidate.category)"
        @update:rating="setRating(candidate.id, $event)"
      />

      <button
        class="tns-btn-primary"
        :disabled="ratedCount === 0 || missingModelCount > 0"
        @click="openPreview"
      >
        {{ $t('plugins.hardwareDb.reviewAndSend', { count: ratedCount }) }}
      </button>
      <p v-if="ratedCount === 0" class="text-xs text-gray-500 text-center">
        {{ $t('plugins.hardwareDb.selectAtLeastOne') }}
      </p>
      <p v-else-if="missingModelCount > 0" class="text-xs text-red-400 text-center">
        {{ $t('plugins.hardwareDb.missingModel', { count: missingModelCount }) }}
      </p>
    </template>

    <!-- Queued because the server was unreachable. Says so plainly: the report
         is safe, it just has not left the device yet. -->
    <div v-if="queuedNotice" class="tns-card p-4 flex flex-col gap-1 border border-amber-700">
      <p class="text-amber-300 font-semibold">{{ $t('plugins.hardwareDb.queued') }}</p>
      <p class="text-sm text-gray-300">{{ $t('plugins.hardwareDb.queuedHint') }}</p>
    </div>

    <!-- Submission receipt: the token is the only way back to one's own report. -->
    <div v-if="lastToken" class="tns-card p-4 flex flex-col gap-2 border border-green-700">
      <p class="text-green-300 font-semibold">{{ $t('plugins.hardwareDb.submitSuccess') }}</p>
      <p class="text-sm text-gray-300">{{ $t('plugins.hardwareDb.submitSuccessHint') }}</p>
      <div class="flex items-center gap-2">
        <code class="tns-input flex items-center overflow-x-auto text-sm">{{ lastToken }}</code>
        <button class="tns-btn-secondary w-auto! px-3" @click="copyToken(lastToken)">
          {{
            copiedToken === lastToken
              ? $t('plugins.hardwareDb.copied')
              : $t('plugins.hardwareDb.copy')
          }}
        </button>
      </div>
    </div>

    <div v-if="store.submissions.length" class="tns-card p-4 flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-lg font-semibold text-white">
          {{ $t('plugins.hardwareDb.history.title') }}
        </h2>
        <button
          class="tns-btn-secondary w-auto! px-3"
          :disabled="refreshingStatus"
          @click="refreshStatuses"
        >
          {{ $t('plugins.hardwareDb.history.refreshStatus') }}
        </button>
      </div>

      <div
        v-for="submission in store.submissions"
        :key="submission.reportToken"
        class="flex items-center justify-between gap-2 border-b border-gray-700 last:border-0 pb-2 last:pb-0"
      >
        <div class="min-w-0">
          <p class="text-sm text-gray-200 truncate">{{ submission.reportToken }}</p>
          <p class="text-xs text-gray-500">
            {{ formatDate(submission.createdAt) }} ·
            {{ $t('plugins.hardwareDb.history.deviceCount', { count: submission.deviceCount }) }}
          </p>
        </div>
        <span class="text-xs font-semibold shrink-0" :class="statusClass(submission.status)">
          {{ $t(`plugins.hardwareDb.history.status.${submission.status}`) }}
        </span>
      </div>

      <button class="tns-btn-secondary" @click="store.clearSubmissions()">
        {{ $t('plugins.hardwareDb.history.clear') }}
      </button>
    </div>

    <HardwareReportPreviewModal
      :show="showPreview"
      :payload="previewPayload"
      :sending="sending"
      :error-message="submitError"
      @close="closePreview"
      @confirm="submit"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HardwareDeviceRow from '../components/HardwareDeviceRow.vue';
import HardwareReportPreviewModal from '../components/HardwareReportPreviewModal.vue';
import { useHardwareSnapshot } from '../composables/useHardwareSnapshot';
import { useHardwareDbStore } from '../store/hardwareDbStore';
import { createHardwareDbApi } from '../utils/hardwareDbApi';
import { generateReportToken } from '../utils/reportToken';
import {
  buildSubmissionPayload,
  isGenericDriver,
  suggestVendorModel,
} from '../utils/snapshotSerializer';
import {
  buildKnowledgeIndex,
  lookupDevice,
  suggestionsForCategory,
} from '../utils/knowledgeLookup';
import metadata from '../plugin.json';
import { copyText } from '@/utils/clipboard';

const { t } = useI18n();
const store = useHardwareDbStore();
const snapshot = useHardwareSnapshot();
const api = createHardwareDbApi({ baseUrl: metadata.config.apiBaseUrl });

const ratings = ref({});
const showPreview = ref(false);
const previewPayload = ref(null);
const sending = ref(false);
const submitError = ref('');
const lastToken = ref('');
const copiedToken = ref('');
const refreshingStatus = ref(false);
const knowledgeIndex = ref(null);
const knowledgeLoaded = ref(false);
const queuedNotice = ref(false);

const candidates = computed(() => snapshot.candidates.value);
const ratedCount = computed(
  () => Object.values(ratings.value).filter((rating) => rating?.status).length
);

/**
 * Rated devices whose driver does not identify the hardware and that still
 * carry no model. A report like that cannot be attributed to anything, so it
 * blocks the send button rather than landing unusable in the review queue.
 */
const missingModelCount = computed(
  () =>
    candidates.value.filter(
      (candidate) =>
        ratings.value[candidate.id]?.status &&
        isGenericDriver(candidate) &&
        !String(ratings.value[candidate.id]?.model || '').trim()
    ).length
);

function emptyRating() {
  return { status: null, note: '', vendor: '', model: '' };
}

function ratingFor(id) {
  return ratings.value[id] || emptyRating();
}

/**
 * Vendor and model are prefilled the moment a device is first rated, not
 * before: an untouched list full of guessed values invites confirming them
 * without reading, and a later refresh must never overwrite what was typed.
 */
function setRating(id, rating) {
  const previous = ratings.value[id];
  let next = { ...emptyRating(), ...rating };

  if (rating?.status && !previous?.status) {
    const candidate = candidates.value.find((item) => item.id === id);
    const suggested = candidate ? suggestVendorModel(candidate) : { vendor: '', model: '' };
    next = {
      ...next,
      vendor: next.vendor || suggested.vendor,
      model: next.model || suggested.model,
    };
  }

  ratings.value = { ...ratings.value, [id]: next };
}

const EMPTY_SUGGESTIONS = Object.freeze({ vendors: [], models: [] });

// Built once per knowledge load rather than per render: the rows re-render on
// every keystroke, and the published list can hold hundreds of devices.
const suggestionsByCategory = computed(() => {
  const map = {};
  if (!knowledgeIndex.value) return map;
  for (const candidate of candidates.value) {
    if (map[candidate.category]) continue;
    map[candidate.category] = suggestionsForCategory(knowledgeIndex.value, candidate.category);
  }
  return map;
});

function suggestionsFor(category) {
  return suggestionsByCategory.value[category] || EMPTY_SUGGESTIONS;
}

async function refresh() {
  // Refresh means refresh: the button bypasses the cache, otherwise a change
  // made on the server would stay invisible for up to a day with no way out.
  // Also the manual way out when a queued report is waiting for internet.
  await Promise.all([snapshot.collect(), loadKnowledge({ force: true }), flushPending()]);
}

/**
 * Loads what the database already knows, so the user sees it while rating.
 *
 * Failure is silent by design: at a PINS access point without internet the
 * server is simply unreachable, and reporting has to keep working. A stale
 * cache is still better than nothing, so it is only replaced on success.
 */
async function loadKnowledge({ force = false } = {}) {
  if (!force && store.isKnowledgeFresh && store.knowledgeCache.entries.length) {
    knowledgeIndex.value = buildKnowledgeIndex(
      store.knowledgeCache.entries,
      store.knowledgeCache.notes
    );
    knowledgeLoaded.value = true;
    return;
  }

  // An expired cache is still shown while the refetch runs, and stays if it
  // fails: offline, stale suggestions beat none at all.
  const cached = store.knowledgeCache;
  if (cached.entries.length) {
    knowledgeIndex.value = buildKnowledgeIndex(cached.entries, cached.notes);
  }

  try {
    const fresh = await api.fetchKnowledge();
    store.setKnowledgeCache(fresh);
    knowledgeIndex.value = buildKnowledgeIndex(fresh.entries, fresh.notes);
  } catch (error) {
    console.warn('[hardware-db] Knowledge base unreachable:', error?.message || error);
  } finally {
    knowledgeLoaded.value = true;
  }
}

function knownFor(candidate) {
  if (!knowledgeIndex.value) return null;
  // The user's own vendor/model is passed along: with a generic driver it is
  // the only thing that can find the published entry.
  const rating = ratings.value[candidate.id];
  return lookupDevice(knowledgeIndex.value, {
    ...candidate,
    userVendor: rating?.vendor || '',
    userModel: rating?.model || '',
  });
}

function openPreview() {
  submitError.value = '';
  queuedNotice.value = false;
  lastToken.value = '';
  previewPayload.value = buildSubmissionPayload({
    candidates: candidates.value,
    ratings: ratings.value,
    installId: store.ensureInstallId(),
    ...snapshot.collectMeta(),
  });
  showPreview.value = true;
}

function closePreview() {
  if (sending.value) return;
  showPreview.value = false;
}

/**
 * A server that answered and refused is a real error the user has to see. A
 * server that never answered is the PINS normal case — an access point without
 * internet — and must not cost the user their work.
 */
function isOffline(error) {
  return !error?.httpStatus;
}

async function submit() {
  if (!previewPayload.value) return;

  sending.value = true;
  submitError.value = '';
  queuedNotice.value = false;
  // The token is created before the first attempt and reused by every retry, so
  // a queued report cannot arrive twice under two identities.
  const reportToken = generateReportToken();
  const payload = previewPayload.value;

  try {
    await api.submitReport({
      reportToken,
      installId: payload.installId,
      payload,
    });

    store.addSubmission({ reportToken, deviceCount: payload.devices.length });
    lastToken.value = reportToken;
    finishSubmission();
  } catch (error) {
    if (isOffline(error)) {
      console.warn('[hardware-db] Server unreachable, queued report:', error?.message || error);
      store.enqueuePending({ reportToken, payload });
      store.addSubmission({
        reportToken,
        deviceCount: payload.devices.length,
        status: 'queued',
      });
      // No success receipt here — the token is in the history, where it sits
      // next to the "queued" state that tells the truth about the report.
      queuedNotice.value = true;
      finishSubmission();
      return;
    }

    console.error('[hardware-db] Submission failed:', error);
    submitError.value = error?.message || t('plugins.hardwareDb.submitError');
  } finally {
    sending.value = false;
  }
}

/** Ratings are cleared so the same report cannot be sent twice by accident. */
function finishSubmission() {
  showPreview.value = false;
  ratings.value = {};
  store.clearDraft();
}

/**
 * Sends what previous attempts could not deliver. Runs silently — the user
 * asked for this once already and does not need to be told again on every page
 * open that the server is still out of reach.
 */
async function flushPending() {
  for (const item of [...store.pending]) {
    try {
      await api.submitReport({
        reportToken: item.reportToken,
        installId: item.payload?.installId,
        payload: item.payload,
      });
      store.dequeuePending(item.reportToken);
      store.setSubmissionStatus(item.reportToken, 'pending');
    } catch (error) {
      if (isOffline(error)) {
        // Still no server. Stop: the rest of the queue would only fail too.
        store.markPendingAttempt(item.reportToken);
        return;
      }
      // The server rejected it. Retrying would fail forever, so drop it and say
      // so in the history rather than leaving a queue entry nobody can resolve.
      console.error('[hardware-db] Queued report rejected:', error);
      store.dequeuePending(item.reportToken);
      store.setSubmissionStatus(item.reportToken, 'rejected');
    }
  }
}

async function refreshStatuses() {
  refreshingStatus.value = true;
  try {
    for (const submission of store.submissions) {
      // A queued report has never reached the server; there is nothing to ask
      // about yet.
      if (submission.status !== 'pending') continue;
      try {
        const status = await api.fetchSubmissionStatus(submission.reportToken);
        store.setSubmissionStatus(submission.reportToken, status);
      } catch (error) {
        console.warn('[hardware-db] Status lookup failed:', error?.message || error);
      }
    }
  } finally {
    refreshingStatus.value = false;
  }
}

async function copyToken(token) {
  try {
    await copyText(token);
    copiedToken.value = token;
    setTimeout(() => {
      if (copiedToken.value === token) copiedToken.value = '';
    }, 3000);
  } catch (error) {
    console.error('[hardware-db] Clipboard write failed:', error);
  }
}

function formatDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function statusClass(status) {
  if (status === 'approved') return 'text-green-400';
  if (status === 'rejected') return 'text-red-400';
  if (status === 'duplicate') return 'text-gray-400';
  return 'text-amber-400';
}

/**
 * Restores the unsent form. Only entries whose device is present in the current
 * snapshot are taken back: a rating for equipment that has since been removed
 * from the profile has nothing left to describe.
 */
function restoreDraft() {
  const stored = store.draft?.ratings;
  if (!stored || typeof stored !== 'object') return;

  const restored = {};
  for (const candidate of candidates.value) {
    const rating = stored[candidate.id];
    if (rating?.status) restored[candidate.id] = { ...emptyRating(), ...rating };
  }
  if (Object.keys(restored).length) ratings.value = restored;
}

// Persist on every change: the app is regularly reloaded or backgrounded in the
// field, and rating a full rig is minutes of typing.
watch(ratings, (value) => store.setDraft(value), { deep: true });

onMounted(async () => {
  // Independent of each other: neither should delay the other. On open the
  // cache may serve the knowledge base; the refresh button forces a reload.
  loadKnowledge();
  flushPending();
  await snapshot.collect();
  restoreDraft();
});
</script>
