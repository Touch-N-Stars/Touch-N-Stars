<template>
  <div class="container py-16 flex items-center justify-center">
    <div class="container max-w-4xl">
      <!-- Loading Spinner during initialization -->
      <div v-if="isInitializing" class="flex flex-col items-center justify-center py-20">
        <svg class="w-12 h-12 animate-spin text-blue-500 mb-4" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="m4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p class="text-gray-400 text-center">{{ $t('plugins.common.initializing') }}</p>
      </div>

      <!-- Outdated Plugin Version Message -->
      <div v-else-if="isPluginOutdated" class="flex flex-col items-center justify-center py-20">
        <div
          class="border border-red-700 rounded-lg bg-gradient-to-br from-red-900/30 to-red-800/30 shadow-lg p-8 max-w-md mx-auto text-center"
        >
          <svg class="w-16 h-16 text-red-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          <h3 class="text-xl font-bold text-red-400 mb-4">
            {{ $t('plugins.common.outdated.title') }}
          </h3>
          <p class="text-gray-300 mb-4">
            {{ $t('plugins.common.outdated.message', { host: store.isPINS ? 'PINS' : 'NINA' }) }}
          </p>
          <p class="text-sm text-gray-400">
            {{ $t('plugins.common.outdated.required') }}: v1.1.2.0
          </p>
          <p class="text-sm text-gray-400">
            {{ $t('plugins.common.outdated.current') }}: {{ store.currentTnsPluginVersion }}
          </p>
        </div>
      </div>

      <!-- Landing Page - zeige wenn weder API Key noch importierte Listen vorhanden sind -->
      <TelescopiusLandingPage
        v-else-if="!telescopiusStore.hasApiKey && !telescopiusStore.hasImportedLists"
        @openApiKeyModal="showApiKeyModal = true"
        @openImportModal="showImportModal = true"
      />

      <!-- Main Plugin View -->
      <div v-else>
        <h5 class="text-2xl text-center font-bold text-white mb-4">
          {{ $t('plugins.telescopius.title') }}
        </h5>

        <!-- Info Text about offline functionality -->
        <div class="text-center mb-6">
          <p class="text-gray-300 text-sm">
            {{ $t('plugins.telescopius.offlineInfo') }}
          </p>
        </div>

        <div class="flex flex-col space-y-4">
          <div
            class="border border-gray-700 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg p-5"
          >
            <!-- Actions -->
            <div class="flex flex-col sm:flex-row justify-center items-center gap-4">
              <button
                @click="showApiKeyModal = true"
                class="tns-btn-secondary flex items-center gap-2"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  ></path>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path>
                </svg>
                {{ $t('plugins.telescopius.apiKey.configure') }}
              </button>

              <button
                v-if="telescopiusStore.hasApiKey"
                @click="refreshTargetLists"
                :disabled="telescopiusStore.isLoadingLists"
                class="tns-btn-secondary flex items-center gap-2"
                title="Refresh from API and update cache"
              >
                <svg
                  v-if="telescopiusStore.isLoadingLists"
                  class="w-5 h-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="m4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  ></path>
                </svg>
                {{ $t('plugins.telescopius.apiKey.loadFromTelescopius') }}
              </button>

              <button
                @click="showImportModal = true"
                class="tns-btn-secondary flex items-center gap-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  ></path>
                </svg>
                {{ $t('plugins.telescopius.import.button') }}
              </button>
            </div>
          </div>

          <!-- Target Lists Display -->
          <div
            v-if="telescopiusStore.hasTargetLists"
            class="border border-gray-700 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg p-6"
          >
            <h6 class="text-lg font-semibold text-white mb-3 text-center">
              {{ $t('plugins.telescopius.targetLists.myLists') }}
            </h6>

            <!-- Cache timestamp display -->
            <div v-if="telescopiusStore.cacheTimestamp" class="text-center mb-3">
              <p class="text-gray-400 text-sm">
                {{ $t('plugins.telescopius.targetLists.dataFrom') }}:
                {{ formatCacheDate(telescopiusStore.cacheTimestamp) }}
              </p>
            </div>

            <!-- Link to edit lists on Telescopius -->
            <div class="text-center mb-4">
              <a
                href="https://telescopius.com/observing-lists"
                target="_blank"
                class="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  ></path>
                </svg>
                {{ $t('plugins.telescopius.targetLists.editOnTelescopius') }}
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  ></path>
                </svg>
              </a>
            </div>

            <div class="space-y-4">
              <TargetListCard
                v-for="list in telescopiusStore.targetLists"
                :key="list.id"
                :list="list"
                :expanded="expandedLists.includes(list.id)"
                @toggle="toggleListDetails(list.id)"
                @select="(obj, index) => openTargetModal(obj, list, index)"
              />
            </div>
          </div>

          <!-- Imported CSV Lists -->
          <div
            v-if="telescopiusStore.hasImportedLists"
            class="border border-gray-700 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg p-6"
          >
            <h6 class="text-lg font-semibold text-white mb-4 text-center">
              {{ $t('plugins.telescopius.import.importedLists') }}
            </h6>

            <div class="space-y-4">
              <TargetListCard
                v-for="list in telescopiusStore.importedLists"
                :key="list.id"
                :list="list"
                :expanded="expandedLists.includes(list.id)"
                removable
                @toggle="toggleListDetails(list.id)"
                @select="(obj, index) => openTargetModal(obj, list, index)"
                @remove="removeImportedList(list)"
              />
            </div>
          </div>

          <!-- No Target Lists Message -->
          <div
            v-if="
              telescopiusStore.hasApiKey &&
              !telescopiusStore.isLoadingLists &&
              !telescopiusStore.hasTargetLists &&
              !telescopiusStore.listsError
            "
            class="border border-gray-700 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg p-6"
          >
            <div class="text-center">
              <svg
                class="w-12 h-12 mx-auto text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
              <h6 class="text-lg font-semibold text-white mb-2">
                {{ $t('plugins.telescopius.targetLists.noListsTitle') }}
              </h6>
              <p class="text-gray-400 text-sm mb-4">
                {{ $t('plugins.telescopius.targetLists.noListsDescription') }}
              </p>
              <p class="text-gray-500 text-xs">
                {{ $t('plugins.telescopius.targetLists.noListsHint') }}
              </p>
            </div>
          </div>

          <!-- Target Lists Error Display -->
          <div
            v-if="telescopiusStore.listsError"
            class="border border-red-700 rounded-lg bg-gradient-to-br from-red-900/30 to-red-800/30 shadow-lg p-4"
          >
            <div class="flex items-center text-red-400 text-sm">
              <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
              {{ telescopiusStore.listsError }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- API Key Modal -->
    <ApiKeyModal
      :show="showApiKeyModal"
      @close="handleApiKeyModalClose"
      @apiKeySaved="handleApiKeySaved"
      @apiKeyDeleted="handleApiKeyDeleted"
    />

    <!-- CSV Import Modal -->
    <ImportCsvModal
      :show="showImportModal"
      @close="showImportModal = false"
      @imported="handleListImported"
    />

    <!-- Target Modal -->
    <TargetModal
      :show="showTargetModal"
      :target="selectedTarget"
      :editable="isSelectedTargetEditable"
      @close="closeTargetModal"
      @goToFraming="setFramingForTarget"
      @save="saveTargetEdit"
    />
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToastStore } from '@/store/toastStore';
import ApiKeyModal from '../components/ApiKeyModal.vue';
import TargetModal from '../components/TargetModal.vue';
import TargetListCard from '../components/TargetListCard.vue';
import ImportCsvModal from '../components/ImportCsvModal.vue';
import TelescopiusLandingPage from '../components/TelescopiusLandingPage.vue';
import { useTelescopisStore } from '../store/telescopiusStore';
import telescopiusApiService from '../services/telescopiusApiService';
import { apiStore } from '@/store/store';
import { degreesToHMS, degreesToDMS } from '@/utils/utils';
import { latitude, longitude, useLocationStore } from '@/utils/location';
import { useRouter } from 'vue-router';
import { useFramingStore } from '@/store/framingStore';

const { t: $t } = useI18n();
const toastStore = useToastStore();
const showApiKeyModal = ref(false);
const showImportModal = ref(false);
const isInitializing = ref(true);
const isPluginOutdated = ref(false);
const telescopiusStore = useTelescopisStore();
const store = apiStore();
const locationStore = useLocationStore();
const router = useRouter();
const framingStore = useFramingStore();
const expandedLists = ref([]);
const showTargetModal = ref(false);
const selectedTarget = ref(null);
const selectedList = ref(null);
const selectedIndex = ref(-1);

const formatCacheDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const loadTargetLists = async (forceRefresh = false) => {
  console.log(
    '[Telescopius] loadTargetLists() - Starting to load user target lists',
    forceRefresh ? '(force refresh)' : ''
  );

  if (!telescopiusStore.hasApiKey) {
    console.log('[Telescopius] No API key configured');
    telescopiusStore.setListsError('API Key required');
    return;
  }

  telescopiusStore.setLoadingLists(true);
  telescopiusStore.setListsError(null);

  try {
    // First try to load from cache (unless force refresh)
    if (!forceRefresh) {
      console.log('[Telescopius] Checking cache for target lists...');
      const cacheLoaded = await telescopiusStore.loadTargetListsFromCache();

      if (cacheLoaded) {
        console.log('[Telescopius] Target lists loaded from cache');
        telescopiusStore.setLoadingLists(false);
        return;
      }
    }

    // Cache miss or expired, fetch from API
    console.log('[Telescopius] Cache miss, fetching from API...');
    const response = await telescopiusApiService.getUserLists();
    console.log('[Telescopius] getUserLists() response:', response);
    console.log('[Telescopius] Found', response?.length || 0, 'target lists');

    if (!response || response.length === 0) {
      telescopiusStore.setTargetLists([]);
      telescopiusStore.setLoadingLists(false);
      return;
    }

    // Load all target list details in parallel
    console.log('[Telescopius] Loading details for all lists...');
    const params = {};
    if (latitude.value && longitude.value) {
      params.lat = parseFloat(latitude.value);
      params.lon = parseFloat(longitude.value);
      console.log('[Telescopius] Using location parameters for all lists:', params);
    }

    const detailPromises = response.map(async (list) => {
      try {
        console.log(`[Telescopius] Loading details for list ${list.id}...`);
        const details = await telescopiusApiService.getTargetList(list.id, params);
        return { ...list, ...details };
      } catch (error) {
        console.error(`[Telescopius] Failed to load details for list ${list.id}:`, error);
        return list; // Return original list without details on error
      }
    });

    const listsWithDetails = await Promise.all(detailPromises);
    console.log('[Telescopius] All target lists with details loaded:', listsWithDetails);

    telescopiusStore.setTargetLists(listsWithDetails);

    // Save to cache
    await telescopiusStore.saveTargetListsToCache();
    console.log('[Telescopius] Target lists cached for future use');
  } catch (error) {
    console.error('[Telescopius] Failed to load target lists:', error);

    // Handle 404 errors specifically (no target lists found)
    if (error.isNotFound || error.status === 404) {
      console.log('[Telescopius] No target lists found (404) - keeping existing offline lists');

      if (telescopiusStore.hasTargetLists) {
        console.log('[Telescopius] Keeping existing target lists despite 404');
        telescopiusStore.setListsError($t('plugins.telescopius.targetLists.connectionError'));
      } else {
        // Only show "no lists" error if there are truly no lists at all
        telescopiusStore.setListsError(null);
      }
    } else {
      // Show error for actual API issues, but keep existing data if available
      console.log(
        '[Telescopius] API error occurred, preserving existing target lists if available'
      );
      telescopiusStore.setListsError($t('plugins.telescopius.targetLists.connectionError'));

      // Keep existing lists - don't clear them on connection errors
      console.log('[Telescopius] Keeping existing target lists due to API error');
    }
  } finally {
    telescopiusStore.setLoadingLists(false);
    console.log('[Telescopius] loadTargetLists() completed');
  }
};

const refreshTargetLists = async () => {
  console.log('[Telescopius] refreshTargetLists() - Force refresh from API');
  await loadTargetLists(true);
};

const handleApiKeyModalClose = () => {
  console.log('[Telescopius] API Key modal closed');
  showApiKeyModal.value = false;
};

const handleApiKeySaved = async () => {
  console.log('[Telescopius] API Key saved successfully, loading target lists automatically');
  await loadTargetLists();
};

const handleApiKeyDeleted = () => {
  console.log('[Telescopius] API Key deleted, clearing target lists');
  telescopiusStore.clearTargetLists();
};

const toggleListDetails = (listId) => {
  console.log(`[Telescopius] toggleListDetails(${listId}) - Toggle list details`);

  if (expandedLists.value.includes(listId)) {
    console.log(`[Telescopius] Collapsing list ${listId}`);
    expandedLists.value = expandedLists.value.filter((id) => id !== listId);
    return;
  }

  expandedLists.value.push(listId);
  console.log(`[Telescopius] Expanded lists:`, expandedLists.value);
};

const handleListImported = (list) => {
  console.log(`[Telescopius] Imported list "${list.name}" with ${list.objects.length} targets`);
  // Show the freshly imported targets right away.
  if (!expandedLists.value.includes(list.id)) {
    expandedLists.value.push(list.id);
  }
};

const removeImportedList = async (list) => {
  const confirmed = await toastStore.showConfirmation(
    $t('common.confirm'),
    $t('plugins.telescopius.import.removeConfirm', { name: list.name }),
    $t('common.delete'),
    $t('common.cancel')
  );
  if (!confirmed) return;

  console.log(`[Telescopius] Removing imported list ${list.id}`);
  expandedLists.value = expandedLists.value.filter((id) => id !== list.id);
  await telescopiusStore.removeImportedList(list.id);
};

const formatRA = (raHours) => {
  // Telescopius API returns RA in hours, so convert to degrees first
  const raDegrees = raHours * 15;
  return degreesToHMS(raDegrees);
};

const formatDec = (decDegrees) => {
  return degreesToDMS(decDegrees);
};

const openTargetModal = (target, list, index) => {
  console.log('[Telescopius] Opening modal for target:', target.name);
  selectedTarget.value = target;
  selectedList.value = list ?? null;
  selectedIndex.value = index ?? -1;
  showTargetModal.value = true;
};

const closeTargetModal = () => {
  console.log('[Telescopius] Closing target modal');
  showTargetModal.value = false;
  selectedTarget.value = null;
  selectedList.value = null;
  selectedIndex.value = -1;
};

// Only imported lists can be edited - API lists are overwritten on the next refresh.
const isSelectedTargetEditable = computed(() =>
  telescopiusStore.importedLists.some((list) => list.id === selectedList.value?.id)
);

const saveTargetEdit = async (changes) => {
  if (!isSelectedTargetEditable.value || selectedIndex.value < 0) return;

  console.log('[Telescopius] Saving edits for target:', changes.name);
  try {
    await telescopiusStore.updateImportedTarget(
      selectedList.value.id,
      selectedIndex.value,
      changes
    );
    // Keep the modal in sync with the stored object.
    selectedTarget.value =
      telescopiusStore.importedLists.find((list) => list.id === selectedList.value.id)?.objects?.[
        selectedIndex.value
      ] ?? selectedTarget.value;
  } catch (error) {
    console.error('[Telescopius] Failed to save target edits:', error);
    toastStore.showToast({
      type: 'error',
      title: $t('plugins.telescopius.title'),
      message: $t('plugins.telescopius.edit.saveFailed'),
    });
  }
};

const setFramingForTarget = (target) => {
  console.log('[Telescopius] Setting framing for target:', target.name);

  try {
    const raDegrees = target.coordinates.ra * 15; // Convert hours to degrees
    const decDegrees = target.coordinates.dec;

    console.log(
      `[Telescopius] Setting framing coordinates: RA: ${raDegrees}°, Dec: ${decDegrees}°`
    );

    const framingData = {
      name: target.name,
      raString: formatRA(target.coordinates.ra), // HMS format
      decString: formatDec(target.coordinates.dec), // DMS format
      ra: raDegrees, // Degrees
      dec: decDegrees, // Degrees
      rotation: Number.isFinite(target.positionAngle) ? target.positionAngle : 0,
    };

    console.log('[Telescopius] Framing data:', framingData);

    setFramingCoordinates(framingData);

    // Close modal
    closeTargetModal();
  } catch (error) {
    console.error('[Telescopius] Failed to set framing:', error);
    toastStore.showToast({
      type: 'error',
      title: $t('plugins.telescopius.title'),
      message: $t('plugins.telescopius.edit.framingFailed', { error: error.message }),
    });
  }
};

const setFramingCoordinates = (data) => {
  framingStore.RAangleString = data?.raString;
  framingStore.DECangleString = data?.decString;
  framingStore.RAangle = data?.ra;
  framingStore.DECangle = data?.dec;
  // Reset explicitly - without this the rotation of the previously framed target leaks in.
  framingStore.rotationAngle = data?.rotation ?? 0;
  framingStore.selectedItem = {
    Name: data?.name || '',
    RA: data?.ra,
    Dec: data?.dec,
  };

  console.log('[Telescopius] Set Framing Coordinates');
  store.mount.currentTab = 'showSlew';
  console.log('[Telescopius] store.mount.currentTab', store.mount.currentTab);
  router.push('/mount');
};

onMounted(async () => {
  if (!store.checkVersionNewerOrEqual(store.currentTnsPluginVersion, '1.1.2.0')) {
    console.log('[Telescopius] Plugin version is to old ', store.currentTnsPluginVersion);
    isPluginOutdated.value = true;
    isInitializing.value = false;
    return;
  }
  try {
    if (!telescopiusStore.isLoaded) {
      await telescopiusStore.loadApiKey();
    }

    // CSV imports work without an API key, so always restore them.
    await telescopiusStore.loadImportedLists();

    // Try to load location from profile if not set
    if (!latitude.value && !longitude.value) {
      console.log('[Telescopius] No location data found, trying to load from profile');
      await locationStore.loadFromAstrometrySettings();
      console.log(
        `[Telescopius] After loading from profile: lat=${latitude.value}, lon=${longitude.value}`
      );
    }

    // Auto-load cached target lists on page load
    if (telescopiusStore.hasApiKey) {
      console.log('[Telescopius] Page loaded with API key, checking for cached target lists...');
      const cacheLoaded = await telescopiusStore.loadTargetListsFromCache();
      if (cacheLoaded) {
        console.log('[Telescopius] Target lists auto-loaded from cache on page load');
      } else {
        console.log('[Telescopius] No valid cache found on page load');
      }
    }
  } finally {
    isInitializing.value = false;
  }
});
</script>

<style scoped>
/* Remove border from slew button component */
:deep(.no-border > div:first-child) {
  border: none !important;
  padding: 0 !important;
  margin-top: 0 !important;
}
</style>
