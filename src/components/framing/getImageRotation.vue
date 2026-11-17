<template>
  <!-- Capture Button -->
  <div class="flex flex-col space-y-2">
    <button
      class="tns-btn-secondary w-full"
      @click="cameraStore.getCameraRotation(apiService, exposureTime, gain)"
      :disabled="cameraStore.loading"
    >
      <template v-if="cameraStore.loading">
        <!-- Phase 1: Belichtung läuft mit Server-Countdown -->
        <div v-if="store.cameraInfo.IsExposing" class="flex items-center">
          <svg class="w-6 h-6" viewBox="0 0 36 36">
            <path
              class="text-white/30 fill-none stroke-current stroke-[2.8]"
              d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              class="fill-none stroke-current stroke-[2.8]"
              :style="{
                strokeDasharray: cameraStore.exposureProgress + ', 100',
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
            {{ cameraStore.exposureCountdown }}s
          </span>
        </div>
        <!-- Phase 2: Bild wird geladen - Spinner -->
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
        <div class="flex items-center justify-center gap-2">
          <div class="relative flex items-center justify-center w-7 h-7">
            <ArrowPathIcon class="w-7 h-7 absolute text-accent" />
            <CameraIcon class="w-3.5 h-3.5" />
          </div>
          <span>{{ $t('components.framing.getImageRotation.startCapture') }}</span>
        </div>
      </template>
    </button>
  </div>
  <div
    v-if="cameraStore.plateSolveError"
    class="p-4 mt-2 text-center bg-status-danger/20 border border-status-danger/70 rounded-lg"
  >
    <p>{{ $t('components.framing.getImageRotation.SolveError') }}</p>
  </div>
</template>
<script setup>
import apiService from '@/services/apiService';
import { useCameraStore } from '@/store/cameraStore';
import { apiStore } from '@/store/store';
import { ref } from 'vue';
import { CameraIcon, ArrowPathIcon } from '@heroicons/vue/24/outline';

const cameraStore = useCameraStore();
const store = apiStore();
const gain = ref(store.profileInfo.PlateSolveSettings.Gain);
const exposureTime = ref(store.profileInfo.PlateSolveSettings.ExposureTime);
</script>
