<template>
  <button
    @click="openSolveModal"
    class="w-10 h-10 bg-surface-1/90 hover:bg-surface-2 text-content rounded-lg shadow-lg flex items-center justify-center transition-colors"
    title="Plate Solve"
  >
    <NinaPlateSolveIcon />
  </button>

  <Modal
    :show="showModal"
    @close="closeModal"
    :closeOnBackdropClick="false"
    max-width="max-w-md"
    z-index="z-modal-raised"
  >
    <template #header>
      <h2 class="text-xl font-bold text-white">Plate Solve</h2>
    </template>

    <template #body>
      <div v-if="isSolving" class="loading-spinner">
        <div class="spinner"></div>
        <p class="text-content">{{ $t('components.platesolve.solving') }}</p>
      </div>

      <div v-else-if="solveResult" class="solve-result space-y-4">
        <!-- Success Status -->
        <div class="flex items-center gap-2 mb-2">
          <div
            :class="[
              'w-4 h-4 rounded-full',
              solveResult.Response?.Success ? 'bg-status-ok' : 'bg-status-danger',
            ]"
          ></div>
          <span :class="solveResult.Response?.Success ? 'text-status-ok' : 'text-status-danger'">
            {{
              solveResult.Response?.Success
                ? $t('components.platesolve.solve_successful')
                : $t('components.platesolve.solve_failed')
            }}
          </span>
        </div>

        <div class="bg-surface-1/50 rounded-lg p-4 border border-line">
          <div class="space-y-3">
            <div
              v-if="solveResult.Response?.Orientation !== undefined"
              class="flex justify-between items-center"
            >
              <span class="text-content-muted">{{ $t('components.platesolve.orientation') }}</span>
              <span class="text-accent font-semibold"
                >{{ formatValue(solveResult.Response.Orientation) }}°</span
              >
            </div>
            <div
              v-if="solveResult.Response?.PositionAngle !== undefined"
              class="flex justify-between items-center"
            >
              <span class="text-content-muted">{{ $t('components.platesolve.ra') }}</span>
              <span class="text-accent font-semibold"
                >{{ formatValue(solveResult.Response.Coordinates.RAString) }}°</span
              >
            </div>
            <div
              v-if="solveResult.Response?.Pixscale !== undefined"
              class="flex justify-between items-center"
            >
              <span class="text-content-muted">{{ $t('components.platesolve.dec') }}</span>
              <span class="text-accent font-semibold"
                >{{ formatValue(solveResult.Response.Coordinates.DecString) }}"</span
              >
            </div>
            <div
              v-if="solveResult.Response?.Pixscale !== undefined"
              class="flex justify-between items-center"
            >
              <span class="text-content-muted">{{ $t('components.platesolve.pixel_scale') }}</span>
              <span class="text-accent font-semibold"
                >{{ formatValue(solveResult.Response.Pixscale) }}"</span
              >
            </div>
            <div v-if="calculatedFocalLength !== null" class="flex justify-between items-center">
              <span class="text-content-muted">{{ $t('components.platesolve.focal_length') }}</span>
              <span class="text-accent font-semibold"
                >{{ calculatedFocalLength.toFixed(1) }} mm</span
              >
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-line-strong">
              <span class="text-content-muted">{{ $t('components.platesolve.flipped') }}</span>
              <span class="text-accent font-semibold">{{
                solveResult.Response?.Flipped ? $t('general.yes') : $t('general.no')
              }}</span>
            </div>
          </div>
        </div>
        <ButtomSyncCoordinatesToMount
          v-if="solveResult.Response?.Success"
          :raAngle="solveResult.Response.Coordinates.RADegrees"
          :decAngle="solveResult.Response.Coordinates.Dec"
        />
      </div>

      <div v-else-if="solveError" class="solve-error space-y-4">
        <div class="bg-status-danger/15 rounded-lg p-4 border border-status-danger/50">
          <p class="text-status-danger">{{ solveError }}</p>
        </div>
        <button class="tns-btn-primary w-full px-4 py-2" @click="closeModal">Close</button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue';
import apiService from '@/services/apiService';
import { useCameraStore } from '@/store/cameraStore';
import { apiStore } from '@/store/store';
import Modal from '@/components/helpers/Modal.vue';
import NinaPlateSolveIcon from '@/components/platesolve/NinaPlateSolveIcon.vue';
import ButtomSyncCoordinatesToMount from '../mount/ButtomSyncCoordinatesToMount.vue';

const cameraStore = useCameraStore();
const store = apiStore();
const isSolving = ref(false);
const showModal = ref(false);
const solveResult = ref(null);
const solveError = ref(null);

const pixelSize = computed(() => {
  return store.profileInfo?.CameraSettings?.PixelSize || 5.0;
});

const calculatedFocalLength = computed(() => {
  if (!solveResult.value?.Response?.Pixscale || solveResult.value.Response.Pixscale === 0) {
    return null;
  }
  // Formel: Brennweite (mm) = 206.265 * Pixelgröße (µm) / Pixscale (arcsec/pixel)
  return (206.265 * pixelSize.value) / solveResult.value.Response.Pixscale;
});

function openSolveModal() {
  showModal.value = true;
  solvePreparedImage();
}

function closeModal() {
  showModal.value = false;
  solveResult.value = null;
  solveError.value = null;
}

async function solvePreparedImage() {
  try {
    isSolving.value = true;
    solveError.value = null;
    const response = await apiService.solvePreparedImage();
    solveResult.value = response;
    cameraStore.plateSolveResult = response.Response;
  } catch (error) {
    console.error('[solvePreparedImage] Error solving prepared image:', error);
    solveError.value = error.message || 'Failed to solve image';
  } finally {
    isSolving.value = false;
  }
}

function formatValue(value) {
  if (typeof value === 'number') {
    return value.toFixed(4);
  }
  return value;
}
</script>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.spinner {
  border: 4px solid #1f2937;
  border-top: 4px solid #22d3ee;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.solve-result {
  padding: 0;
}

.solve-error {
  padding: 0;
}
</style>
