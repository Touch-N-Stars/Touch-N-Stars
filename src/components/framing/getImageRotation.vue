<template>
  <!-- Capture Button -->
  <div class="flex flex-col space-y-2">
    <button
      class="btn-primary bg-gradient-to-br from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 transition-all duration-200 shadow-lg hover:shadow-cyan-500/20"
      @click="cameraStore.getCameraRotation(apiService, exposureTime, gain)"
      :disabled="cameraStore.loading"
    >
      <template v-if="cameraStore.loading">
        <!-- Wenn Belichtung läuft -->
        <div v-if="cameraStore.isExposure" class="flex items-center">
          <svg class="w-6 h-6" viewBox="0 0 36 36">
            <path
              class="text-white text-opacity-30 fill-none stroke-current stroke-[2.8]"
              d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              class="fill-none stroke-current stroke-[2.8]"
              :style="{
                strokeDasharray: cameraStore.progress + ', 100',
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
              }"
              d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span class="ml-2 text-white text-sm font-medium">
            {{ $t('components.camera.capture_running') }}
            {{ cameraStore.remainingExposureTime }}s
          </span>
        </div>
        <!-- Wenn Bild gerade geladen wird -->
        <div v-else-if="cameraStore.isLoadingImage" class="flex items-center">
          <svg class="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span class="ml-2 text-white text-sm font-medium">
            {{ $t('components.framing.getImageRotation.SolveRun') }}
          </span>
        </div>
      </template>
      <template v-else>
        {{ $t('components.framing.getImageRotation.startCapture') }}
      </template>
    </button>
  </div>
  <div
    v-if="cameraStore.plateSolveError"
    class="p-4 mt-2 text-center bg-red-500/20 border border-red-500/70 rounded-lg"
  >
    <p>{{ $t('components.framing.getImageRotation.SolveError') }}</p>
  </div>
</template>
<script setup>
import apiService from '@/services/apiService';
import { useCameraStore } from '@/store/cameraStore';
import { apiStore } from '@/store/store';
import { ref } from 'vue';

const cameraStore = useCameraStore();
const store = apiStore();
const gain = ref(store.profileInfo.PlateSolveSettings.Gain);
const exposureTime = ref(store.profileInfo.PlateSolveSettings.ExposureTime);
</script>
