<template>
  <div class="min-h-screen">
    <div class="container py-10">
      <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-4xl font-bold text-white mb-2">{{ $t('plugins.hocusfocus.title') }}</h1>
          <p class="text-gray-400 text-sm">{{ store.pluginInfo.description }}</p>
        </div>

        <!-- Tabs Navigation -->
        <div class="border border-gray-700 rounded-lg bg-gray-800">
          <div class="flex border-b border-gray-700 overflow-x-auto snap-x snap-mandatory">
            <button
              @click="activeTab = 'aberration'"
              :class="
                activeTab === 'aberration'
                  ? 'border-b-2 border-cyan-400 text-white'
                  : 'text-gray-400 hover:text-white'
              "
              class="px-6 py-3 font-semibold transition whitespace-nowrap snap-start shrink-0"
            >
              {{ $t('plugins.hocusfocus.tabs.aberration') }}
            </button>
            <button
              @click="activeTab = 'aberration-options'"
              :class="
                activeTab === 'aberration-options'
                  ? 'border-b-2 border-cyan-400 text-white'
                  : 'text-gray-400 hover:text-white'
              "
              class="px-6 py-3 font-semibold transition whitespace-nowrap snap-start shrink-0"
            >
              {{ $t('plugins.hocusfocus.tabs.aberrationOptions') }}
            </button>
            <button
              @click="activeTab = 'configuration'"
              :class="
                activeTab === 'configuration'
                  ? 'border-b-2 border-cyan-400 text-white'
                  : 'text-gray-400 hover:text-white'
              "
              class="px-6 py-3 font-semibold transition whitespace-nowrap snap-start shrink-0"
            >
              {{ $t('plugins.hocusfocus.tabs.autoFocusOptions') }}
            </button>

            <button
              @click="activeTab = 'star-detection'"
              :class="
                activeTab === 'star-detection'
                  ? 'border-b-2 border-cyan-400 text-white'
                  : 'text-gray-400 hover:text-white'
              "
              class="px-6 py-3 font-semibold transition whitespace-nowrap snap-start shrink-0"
            >
              {{ $t('plugins.hocusfocus.tabs.starDetection') }}
            </button>
            <button
              @click="activeTab = 'tilter'"
              :class="
                activeTab === 'tilter'
                  ? 'border-b-2 border-cyan-400 text-white'
                  : 'text-gray-400 hover:text-white'
              "
              class="px-6 py-3 font-semibold transition whitespace-nowrap snap-start shrink-0"
            >
              {{ $t('plugins.hocusfocus.tabs.tilter') }}
            </button>
          </div>

          <!-- AutoFocus directory picker for "Load Saved AF" -->
          <Modal
            :show="showAFDirectoryModal"
            maxWidth="max-w-md"
            @close="showAFDirectoryModal = false"
          >
            <template #header>
              <h2 class="text-xl font-bold text-white">
                {{ $t('plugins.hocusfocus.modal.selectDirectory') }}
              </h2>
            </template>
            <template #body>
              <div class="flex w-full flex-col gap-4">
                <div
                  v-if="loadingAFDirectories"
                  class="flex items-center justify-center gap-3 py-4 text-gray-400"
                >
                  <div class="spinner"></div>
                  <span>{{ $t('plugins.hocusfocus.modal.loading') }}</span>
                </div>
                <template v-else>
                  <select v-model="selectedAFDirectory" class="tns-select">
                    <option :value="null" disabled>
                      {{ $t('plugins.hocusfocus.modal.placeholder') }}
                    </option>
                    <option v-for="dir in afDirectories" :key="dir" :value="dir">
                      {{ dir }}
                    </option>
                  </select>
                  <div class="flex justify-end gap-3">
                    <button
                      class="tns-btn-secondary w-auto px-4"
                      @click="showAFDirectoryModal = false"
                    >
                      {{ $t('plugins.hocusfocus.modal.cancel') }}
                    </button>
                    <button
                      class="tns-btn-primary w-auto px-4"
                      :disabled="!selectedAFDirectory"
                      @click="proceedWithAFRerun()"
                    >
                      {{ $t('plugins.hocusfocus.modal.proceed') }}
                    </button>
                  </div>
                </template>
              </div>
            </template>
          </Modal>

          <!-- Aberration Inspector Tab -->
          <div v-if="activeTab === 'aberration'" class="p-6">
            <AberrationInspector
              :auto-focus-chart-active="autoFocusChartActive"
              :auto-focus-chart-activated-once="autoFocusChartActivatedOnce"
              :auto-focus-completed="autoFocusCompleted"
              :tilt-measurements="tiltMeasurements"
              :tilt-measurement-history="tiltMeasurementHistory"
              :final-focus-data="finalFocusData"
              :sensor-model="sensorModel"
              :eccentricity="eccentricity"
              :fwhm-contour="fwhmContour"
              :exposure-analyzed="exposureAnalyzed"
              :error="store.error || ''"
              :camera-connected="store.cameraConnected"
              :focuser-connected="store.focuserConnected"
              :is-cancelling="store.isCancelling"
              :sequence-running="sequenceRunning"
              :backend-can-run="backendCanRun"
              :backend-can-rerun="backendCanRerun"
              :is-tab-active="activeTab === 'aberration'"
              :on-update-status="updateStatus"
              :on-update-final-focus-data="updateFinalFocusData"
              :on-update-tilt-measurements="updateTiltMeasurements"
              :on-update-tilt-measurement-history="updateTiltMeasurementHistory"
              :on-update-sensor-model="updateSensorModel"
              :on-update-eccentricity="updateEccentricity"
              :on-update-fwhm-contour="updateFwhmContour"
              :get-region-focus-points="() => apiService.hocusfocus.getRegionFocusPoints()"
              @run="runDetailedAutoFocus"
              @stop="stopDetailedAutoFocus"
              @rerun="rerunDetailedAutoFocus"
              @clear="clearDetailedAutoFocus"
              @dismiss-error="store.error = null"
            />
          </div>

          <!-- Aberration Inspector Options Tab -->
          <div v-if="activeTab === 'aberration-options'" class="p-6">
            <AberrationInspectorOptions />
          </div>

          <!-- Configuration Tab -->
          <div v-if="activeTab === 'configuration'" class="p-6">
            <AutoFocusOptions />
          </div>

          <!-- Star Detection Tab -->
          <div v-if="activeTab === 'star-detection'" class="p-6">
            <StarDetection :isTabActive="activeTab === 'star-detection'" />
          </div>

          <!-- Tilter Tab -->
          <div v-if="activeTab === 'tilter'" class="p-6">
            <HocusFocusTilterPanel />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useBackgroundAwarePolling } from '@/utils/appLifecycle';
import { useHocusFocusStore } from '../store/hocusfocusStore';
import apiService from '@/services/apiService';
import Modal from '@/components/helpers/Modal.vue';
import AberrationInspector from '../components/AberrationInspector.vue';
import AberrationInspectorOptions from '../components/AberrationInspectorOptions.vue';
import AutoFocusOptions from '../components/AutoFocusOptions.vue';
import StarDetection from '../components/StarDetection.vue';
import HocusFocusTilterPanel from '../components/HocusFocusTilterPanel.vue';

const store = useHocusFocusStore();
const activeTab = ref('aberration');
const tiltMeasurements = ref([]);
const tiltMeasurementHistory = ref([]);
const finalFocusData = ref(null);
const sensorModel = ref(null);
const eccentricity = ref(null);
const fwhmContour = ref(null);
// Whether the run's final exposure produced plot data; undefined until a status arrives, and on a
// plugin build without the flag.
const exposureAnalyzed = ref(undefined);
// A live Inspector run is refused while a sequence runs (backend-enforced); shown before the tap.
const sequenceRunning = ref(false);
const autoFocusCompleted = ref(false);
const autoFocusChartActive = ref(false);
const autoFocusChartActivatedOnce = ref(false);

// AutoFocus directory selection modal
const showAFDirectoryModal = ref(false);
const afDirectories = ref([]);
const selectedAFDirectory = ref(null);
const loadingAFDirectories = ref(false);

// Compute canRunAutoFocus from backend status - source of truth
const backendCanRun = ref(true);
const backendCanRerun = ref(true);
const canRunAutoFocus = computed(() => {
  return (
    store.cameraConnected && store.focuserConnected && backendCanRun.value && !store.isCancelling
  );
});

// Polling management - always active while this view is mounted, but pausing
// while the app is backgrounded (see src/utils/appLifecycle.js).
const isActive = ref(true);

useBackgroundAwarePolling(
  async () => {
    try {
      await updateStatus();
    } catch (err) {
      console.error('[HocusFocus] Error in status polling:', err);
    }
  },
  1000,
  isActive
);

// Fetch and update tilt corner measurements
const updateTiltMeasurements = async () => {
  try {
    const data = await apiService.hocusfocus.getTiltCornerMeasurements();
    if (data && data.tiltCornerMeasurements) {
      tiltMeasurements.value = data.tiltCornerMeasurements;
    }
  } catch (err) {
    console.error('Error fetching tilt measurements:', err);
  }
};

// Fetch and update tilt measurement history
const updateTiltMeasurementHistory = async () => {
  try {
    const data = await apiService.hocusfocus.getTiltMeasurementHistory();
    if (data && data.tiltMeasurementHistory) {
      tiltMeasurementHistory.value = data.tiltMeasurementHistory;
    }
  } catch (err) {
    console.error('Error fetching tilt measurement history:', err);
  }
};

// Fetch and update final focus data
const updateFinalFocusData = async () => {
  try {
    const data = await apiService.hocusfocus.getFinalFocusData();
    if (data && data.RegionFinalFocusPoints) {
      finalFocusData.value = data;
    }
  } catch (err) {
    console.error('Error fetching final focus data:', err);
  }
};

// Fetch the sensor curve model; ModelLoaded is false unless the run had the option enabled
const updateSensorModel = async () => {
  try {
    const data = await apiService.hocusfocus.getSensorModel();
    sensorModel.value = data?.Success ? data : null;
  } catch (err) {
    console.error('Error fetching sensor model:', err);
    sensorModel.value = null;
  }
};

// Fetch per-cell star eccentricity from the run's final exposure
const updateEccentricity = async () => {
  try {
    const data = await apiService.hocusfocus.getEccentricity();
    eccentricity.value = data?.Success ? data : null;
  } catch (err) {
    console.error('Error fetching eccentricity:', err);
    eccentricity.value = null;
  }
};

// Fetch the FWHM surface HocusFocus' contour map draws, from the run's final exposure
const updateFwhmContour = async () => {
  try {
    const data = await apiService.hocusfocus.getFwhmContour();
    fwhmContour.value = data?.Success ? data : null;
  } catch (err) {
    console.error('Error fetching FWHM contour:', err);
    fwhmContour.value = null;
  }
};

// Fetch and update status
const updateStatus = async () => {
  try {
    const data = await apiService.hocusfocus.getStatus();
    if (data && data.Success) {
      const wasNotCompleted = !autoFocusCompleted.value;
      backendCanRun.value = data.CanRunAutoFocusAnalysis ?? false;
      backendCanRerun.value = data.CanRerunSavedAutoFocusAnalysis ?? false;
      autoFocusCompleted.value = data.AutoFocusCompleted ?? false;
      autoFocusChartActive.value = data.AutoFocusChartActive ?? false;
      autoFocusChartActivatedOnce.value = data.AutoFocusChartActivatedOnce ?? false;
      exposureAnalyzed.value = data.ExposureAnalysisActivatedOnce;
      sequenceRunning.value = !!data.SequenceRunning;

      // If AutoFocus just completed, fetch the updated tilt history
      if (wasNotCompleted && autoFocusCompleted.value) {
        await updateTiltMeasurementHistory();
      }

      // Reset cancelling flag when backend indicates AF is no longer running
      if (backendCanRun.value && store.isCancelling) {
        store.isCancelling = false;
      }
    }
  } catch (err) {
    console.error('Error fetching status:', err);
    backendCanRun.value = false;
    backendCanRerun.value = false;
    autoFocusCompleted.value = false;
    autoFocusChartActive.value = false;
    autoFocusChartActivatedOnce.value = false;
  }
};

// Update and manage focus curve chart
// A failed request throws in axios; the backend's reason is in the response body.
const errorMessage = (err, fallback) => err.response?.data?.Error || err.message || fallback;

// Start detailed autofocus run with analysis
const runDetailedAutoFocus = async () => {
  if (!canRunAutoFocus.value) {
    return;
  }

  try {
    // Call the backend endpoint - let polling handle state transitions
    const response = await apiService.hocusfocus.runDetailedAutoFocus();

    if (response && response.Success) {
      store.error = null;
      // Let polling update button state
    } else {
      store.error = response?.Error || 'Failed to start detailed AutoFocus';
    }
  } catch (err) {
    console.error('[HocusFocus] Error starting analysis:', err);
    store.error = errorMessage(err, 'Failed to run DetailedAutoFocus');
  }
};

const stopDetailedAutoFocus = async () => {
  store.isCancelling = true;

  try {
    const response = await apiService.hocusfocus.cancelDetailedAutoFocus();

    if (!response?.Success) {
      store.error = response?.Error || 'Failed to cancel analysis';
    } else {
      store.error = null;
    }
    // Let polling reset the isCancelling flag
  } catch (err) {
    console.error('[HocusFocus] Error cancelling analysis:', err);
    store.error = `Error cancelling: ${errorMessage(err)}`;
    // Next polling cycle will attempt to reset state
  }
};

const rerunDetailedAutoFocus = async () => {
  if (!backendCanRerun.value) {
    return;
  }

  try {
    loadingAFDirectories.value = true;
    afDirectories.value = [];
    selectedAFDirectory.value = null;

    // Load list of available AutoFocus directories
    const result = await apiService.hocusfocus.listAutoFocusDirectories();

    if (result && Array.isArray(result.DirectoryNames)) {
      afDirectories.value = result.DirectoryNames;
    } else if (result && Array.isArray(result.directories)) {
      afDirectories.value = result.directories;
    }

    if (afDirectories.value.length === 0) {
      store.error = 'No AutoFocus directories available to rerun';
      console.warn('[HocusFocus] No AutoFocus directories found');
      return;
    }

    // Show the modal for directory selection
    showAFDirectoryModal.value = true;
  } catch (err) {
    console.error('[HocusFocus] Error loading AutoFocus directories:', err);
    store.error = err.message || 'Failed to load AutoFocus directories';
  } finally {
    loadingAFDirectories.value = false;
  }
};

const proceedWithAFRerun = async () => {
  if (!selectedAFDirectory.value) {
    console.warn('[HocusFocus] No AutoFocus directory selected');
    return;
  }

  try {
    // Call the backend endpoint with the selected directory
    const response = await apiService.hocusfocus.rerunDetailedAutoFocus(selectedAFDirectory.value);

    if (response && response.Success) {
      store.error = null;
      showAFDirectoryModal.value = false;
      // Immediately fetch updated data
      await updateStatus();
      await updateFinalFocusData();
      await updateTiltMeasurements();
      await updateSensorModel();
    } else {
      store.error = response?.Error || 'Failed to re-run detailed AutoFocus';
    }
  } catch (err) {
    console.error('[HocusFocus] Error re-run analysis:', err);
    store.error = errorMessage(err, 'Failed to re-run DetailedAutoFocus');
  }
};

const clearDetailedAutoFocus = async () => {
  if (!backendCanRerun.value) {
    return;
  }

  try {
    // Call the backend endpoint (which now also clears tilt history)
    const response = await apiService.hocusfocus.clearDetailedAutoFocus();

    if (response && response.Success) {
      store.error = null;
      // Fetch updated data to reflect cleared state
      await updateStatus();
      await updateFinalFocusData();
      await updateTiltMeasurements();
      await updateTiltMeasurementHistory();
      await updateSensorModel();
      eccentricity.value = null;
      fwhmContour.value = null;
    } else {
      store.error = response?.Error || 'Failed to clear detailed AutoFocus';
    }
  } catch (err) {
    console.error('[HocusFocus] Error clearing analysis:', err);
    store.error = errorMessage(err, 'Failed to clear DetailedAutoFocus');
  }
};

// Generate sample focus data on mount
onMounted(() => {
  store.fetchEquipmentStatus();
});
</script>
