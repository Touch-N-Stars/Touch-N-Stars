<template>
  <div>
    <!-- Modal Trigger -->
    <QuickAccessButton v-if="tppaStore.isRunning" @click="isModalOpen = true">
      <svg
        fill="currentColor"
        height="24"
        width="24"
        version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 329.015 329.015"
        xml:space="preserve"
      >
        <g>
          <g>
            <g>
              <path
                d="M164.508,71.909c-51.059,0-92.599,41.54-92.599,92.599c0,51.059,41.54,92.599,92.599,92.599s92.599-41.54,92.599-92.599
                                C257.107,113.449,215.568,71.909,164.508,71.909z M164.508,239.107c-41.134,0-74.599-33.465-74.599-74.599
                                c0-41.134,33.465-74.599,74.599-74.599c41.134,0,74.599,33.465,74.599,74.599C239.107,205.642,205.643,239.107,164.508,239.107z"
              />
              <path
                d="M164.508,137.639c-14.815,0-26.869,12.053-26.869,26.869c0,14.816,12.053,26.869,26.869,26.869
                                c14.816,0,26.869-12.053,26.869-26.869C191.378,149.692,179.323,137.639,164.508,137.639z M164.508,173.376
                                c-4.89,0-8.869-3.979-8.869-8.869c0-4.89,3.979-8.869,8.869-8.869s8.869,3.979,8.869,8.869
                                C173.378,169.397,169.398,173.376,164.508,173.376z"
              />
              <path
                d="M320.016,155.508h-8.934C306.596,81.685,247.333,22.42,173.51,17.935V9c0-4.971-4.029-9-9-9c-4.971,0-9,4.029-9,9v8.934
                                C81.685,22.42,22.42,81.685,17.935,155.508H9c-4.971,0-9,4.029-9,9s4.029,9,9,9h8.934
                                c4.486,73.823,63.75,133.088,137.573,137.573v8.934c0,4.971,4.029,9,9,9s9-4.029,9-9v-8.934
                                c73.823-4.486,133.088-63.75,137.573-137.573h8.934c4.971,0,9-4.029,9-9S324.987,155.508,320.016,155.508z M293.047,173.486
                                c-4.42,63.912-55.649,115.141-119.561,119.561c-0.228-4.768-4.154-8.566-8.978-8.566s-8.75,3.798-8.978,8.566
                                c-63.912-4.421-115.141-55.65-119.561-119.562c4.768-0.228,8.566-4.154,8.566-8.978c0-4.824-3.798-8.75-8.566-8.978
                                c4.42-63.911,55.649-115.14,119.561-119.561c0.228,4.768,4.154,8.566,8.978,8.566s8.75-3.798,8.978-8.566
                                c63.912,4.421,115.141,55.65,119.561,119.562c-4.768,0.228-8.566,4.154-8.566,8.978S288.279,173.258,293.047,173.486z"
              />
            </g>
          </g>
        </g>
      </svg>
    </QuickAccessButton>

    <Modal
      :show="isModalOpen"
      zIndex="z-dialog"
      maxWidth="max-w-md"
      bodyMaxHeight="max-h-[calc(100vh-10rem)]"
      @close="isModalOpen = false"
    >
      <template #header>
        <h2 class="text-xl font-bold">{{ $t('components.tppa.title') }}</h2>
      </template>
      <template #body>
        <div class="w-full">
          <TppaWaitingForValues />
          <!-- Error Circle Representation -->
          <div
            v-if="tppaStore.showTotalError"
            class="flex justify-center items-center py-4 relative"
          >
            <svg
              class="max-w-full h-auto"
              :width="circleSize"
              :height="circleSize"
              :viewBox="`0 0 ${circleSize} ${circleSize}`"
            >
              <!-- Background Circle -->
              <circle
                :cx="circleSize / 2"
                :cy="circleSize / 2"
                :r="circleRadius"
                :stroke="errorColor"
                stroke-width="2"
                fill="none"
              />

              <!-- Error Correction Arrow -->
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="7"
                  markerHeight="7"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 6 3, 0 6" :fill="errorColor" />
                </marker>
              </defs>

              <line
                :x1="circleSize / 2 - arrowLength * Math.cos(errorAngle)"
                :y1="circleSize / 2 + arrowLength * Math.sin(errorAngle)"
                :x2="circleSize / 2"
                :y2="circleSize / 2"
                :stroke="errorColor"
                stroke-width="4"
                marker-end="url(#arrowhead)"
              />

              <!-- Center Point -->
              <circle :cx="circleSize / 2" :cy="circleSize / 2" r="5" fill="currentColor" />
            </svg>
          </div>

          <div class="text-center text-xl">
            <p>{{ $t('components.tppa.total_error') }} {{ tppaStore.showTotalError || '?' }}</p>
            <p class="text-sm text-content-muted">
              {{ $t('components.tppa.azimuth_error') }} {{ tppaStore.showAzimuthError || '?' }}
            </p>
            <p class="text-sm text-content-muted">
              {{ $t('components.tppa.altitude_error') }} {{ tppaStore.showAltitudeError || '?' }}
            </p>
          </div>

          <div v-if="tppaStore.showAzimuthError" class="flex items-center justify-center pt-2">
            <ButtonPause class="w-12 h-12" />
          </div>
          <TppaLastStatus class="mt-4 p-3" />
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useTppaStore } from '@/store/tppaStore';
import ButtonPause from '@/components/tppa/ButtonPause.vue';
import TppaLastStatus from '@/components/tppa/TppaLastStatus.vue';
import TppaWaitingForValues from '@/components/tppa/TppaWaitingForValues.vue';
import Modal from '@/components/helpers/Modal.vue';
import QuickAccessButton from '@/components/helpers/QuickAccessButton.vue';

const tppaStore = useTppaStore();
const isModalOpen = ref(false);

// Berechnet den Winkel für die Fehlerdarstellung basierend auf Azimuth- und Höhenabweichungen
const errorAngle = computed(() => {
  const azimuthError = tppaStore.AzimuthErrorDeg;
  const altitudeError = tppaStore.AltitudeErrorDEG;
  if (tppaStore.isSouthernHemisphere) {
    return Math.atan2(azimuthError, -altitudeError);
  }
  return Math.atan2(-azimuthError, -altitudeError);
});

// Dynamische Pfeillänge basierend auf totalError
const arrowLength = computed(() => {
  return Math.min(circleRadius.value, Math.max(20, tppaStore.totalErrorDeg * 2000)); // Begrenzung zwischen 20 und Kreisradius
});

// Dynamischer Kreisradius basierend auf totalError
const circleRadius = computed(() => {
  return Math.min(150, Math.max(25, tppaStore.totalErrorDeg * 2000)); // Begrenzung zwischen 50 und 150
});

// Dynamische SVG-Größe
const circleSize = computed(() => {
  return circleRadius.value * 2 + 50; // Etwas Padding
});

// Fehlerfarbe basierend auf Total Error
const errorColor = computed(() => {
  const totalErrorSeconds = tppaStore.totalErrorDeg * 3600;
  if (totalErrorSeconds < 60) return 'var(--color-status-ok)'; // Unter 1' (60 Sekunden) Grün
  if (totalErrorSeconds < 120) return 'var(--color-status-warn)'; // Unter 2' (120 Sekunden) Gelb
  return 'var(--color-status-danger)'; // Sonst Rot
});
</script>
