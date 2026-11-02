<template>
  <Modal :show="show" @close="$emit('close')">
    <template #header>
      <h2 class="text-2xl font-semibold">
        {{ $t('components.guider.calibrationAssistant.title') }}
      </h2>
    </template>
    <template #body>
      <div class="flex flex-col gap-4 sm:gap-6 w-full min-w-0 max-w-full sm:min-w-[500px]">
        <!-- Info Section -->
        <div class="p-3 sm:p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
          <p class="text-blue-300 text-sm">
            {{ $t('components.guider.calibrationAssistant.info') }}
          </p>
        </div>

        <!-- Position Settings -->
        <div class="bg-gray-700/50 p-3 rounded-lg space-y-3">
          <h3 class="text-sm font-medium text-gray-300 mb-3">
            {{ $t('components.guider.calibrationAssistant.positionSettings') }}
          </h3>
          <div class="space-y-3">
            <!-- Dec Offset -->
            <NumberInputPicker
              v-model="decOffset"
              :label="`${$t('components.guider.calibrationAssistant.decOffset')} (°)`"
              labelKey="components.guider.calibrationAssistant.decOffset"
              :min="-90"
              :max="90"
              :step="1"
              :decimalPlaces="0"
              inputId="decOffset"
              wrapperClass="w-full"
              @change="calculateOptimalPosition"
            />

            <!-- Meridian Offset -->
            <NumberInputPicker
              v-model="meridianOffset"
              :label="`${$t('components.guider.calibrationAssistant.meridianOffset')} (°)`"
              labelKey="components.guider.calibrationAssistant.meridianOffset"
              :min="0"
              :max="90"
              :step="1"
              :decimalPlaces="0"
              inputId="meridianOffset"
              wrapperClass="w-full"
              @change="calculateOptimalPosition"
            />

            <!-- Calibration Step (PINS only) -->
            <NumberInputPicker
              v-if="store.isPINS"
              v-model="calibrationStep"
              :label="$t('components.guider.phd2.calibrationStep')"
              labelKey="components.guider.phd2.calibrationStep"
              :min="1"
              :max="10000"
              :step="1"
              :decimalPlaces="0"
              inputId="calibrationStepAssistant"
              wrapperClass="w-full"
              @change="onCalibrationStepChange"
            />

            <!-- Calibration Distance (PINS only) -->
            <NumberInputPicker
              v-if="store.isPINS"
              v-model="calibrationDistance"
              :label="$t('components.guider.phd2.calibDistance')"
              labelKey="components.guider.phd2.calibDistance"
              :min="10"
              :max="200"
              :step="1"
              :decimalPlaces="0"
              inputId="calibrationDistanceAssistant"
              wrapperClass="w-full"
              @change="onCalibrationDistanceChange"
            />

            <!-- East/West Selection -->
            <div>
              <label class="block text-xs text-gray-400 mb-1">
                {{ $t('components.guider.calibrationAssistant.direction') }}
              </label>
              <div class="flex gap-2">
                <button
                  @click="setDirection('west')"
                  :class="['tns-btn-secondary', { 'border-accent': direction === 'west' }]"
                  class="flex-1 px-2 py-1 text-xs sm:text-sm"
                >
                  {{ $t('components.guider.calibrationAssistant.west') }}
                </button>
                <button
                  @click="setDirection('east')"
                  :class="['tns-btn-secondary', { 'border-accent': direction === 'east' }]"
                  class="flex-1 px-2 py-1 text-xs sm:text-sm"
                >
                  {{ $t('components.guider.calibrationAssistant.east') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Status -->
        <div v-if="displayStatus" class="p-2 sm:p-3 rounded-lg" :class="statusClass">
          <div class="flex items-center gap-2">
            <div v-if="isSlewing" class="spinner"></div>
            <span class="text-sm">{{ displayStatus }}</span>
          </div>
        </div>

        <!-- Calibration Result -->
        <div v-if="calibrationResult" class="p-3 sm:p-4 rounded-lg" :class="calibrationResultClass">
          <h3 class="font-medium mb-2">
            {{ $t('components.guider.calibrationAssistant.calibrationResult') }}
          </h3>
          <div class="text-sm">
            <div>
              {{ $t('components.guider.calibrationAssistant.quality') }}:
              {{ calibrationResult.quality }}
            </div>
            <div v-if="calibrationResult.explanation" class="mt-2 text-gray-300">
              {{ calibrationResult.explanation }}
            </div>
          </div>
        </div>

        <!-- Step Size Calculator (PINS only) -->
        <div v-if="store.isPINS" class="bg-gray-700/50 rounded-lg">
          <button
            class="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            @click="showCalc = !showCalc"
          >
            <span>
              {{ $t('components.guider.phd2.calibStepCalc') }}
              <span
                v-if="calcStepResult !== null"
                class="font-normal"
                :class="
                  calcStepResult !== guiderStore.phd2CalibrationStep
                    ? 'text-orange-400'
                    : 'text-gray-400'
                "
              >
                ({{ $t('components.guider.phd2.optimal') }}: {{ calcStepResult }} ms)
              </span>
            </span>
            <svg
              class="w-4 h-4 transition-transform"
              :class="showCalc ? 'rotate-180' : ''"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <div v-if="showCalc" class="px-3 pb-3 space-y-3">
            <!-- Focal length -->
            <NumberInputPicker
              v-model="calcFocalLength"
              :label="`${$t('components.guider.phd2.focalLength')} (mm)`"
              labelKey="components.guider.phd2.focalLength"
              :min="1"
              :max="10000"
              :step="1"
              :decimalPlaces="0"
              inputId="calcFocalLength"
              wrapperClass="w-full"
            />

            <!-- Desired steps -->
            <NumberInputPicker
              v-model="calcDesiredSteps"
              :label="$t('components.guider.phd2.desiredSteps')"
              labelKey="components.guider.phd2.desiredSteps"
              :min="6"
              :max="60"
              :step="1"
              :decimalPlaces="0"
              inputId="calcDesiredSteps"
              wrapperClass="w-full"
            />

            <!-- Result row -->
            <div class="flex items-center justify-between pt-2 border-t border-gray-600">
              <span class="text-sm font-semibold text-white">
                {{ $t('components.guider.phd2.calculatedStep') }}:
                {{ calcStepResult !== null ? calcStepResult + ' ms' : '—' }}
              </span>
              <button
                :disabled="calcStepResult === null"
                class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
                @click="applyCalcStep"
              >
                {{ $t('components.guider.phd2.applyStep') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Slew/Stop Button -->
          <button
            @click="store.mountIsSlewing ? stopSlew() : slewToOptimalPosition()"
            :disabled="!store.mountIsSlewing && (!canSlew || isSlewing || isCalibrating)"
            :class="[
              'px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-center gap-2 flex-1',
              store.mountIsSlewing ? 'tns-btn-danger' : 'tns-btn-secondary',
            ]"
          >
            <StopIcon v-if="store.mountIsSlewing" class="w-5 h-5" />
            <svg v-else-if="!isSlewing" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
            <div v-else class="spinner"></div>
            {{
              store.mountIsSlewing
                ? $t('components.guider.calibrationAssistant.stopSlew')
                : $t('components.guider.calibrationAssistant.slewToPosition')
            }}
          </button>

          <!-- Calibration Button -->
          <button
            @click="toggleCalibration"
            :disabled="!store.guiderInfo?.Connected"
            :class="
              store.guiderInfo?.State === 'Calibrating' ? 'tns-btn-danger' : 'tns-btn-primary'
            "
            class="px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-center gap-2 flex-1"
          >
            <StopIcon v-if="store.guiderInfo?.State === 'Calibrating'" class="w-5 h-5" />
            <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{
              store.guiderInfo?.State === 'Calibrating'
                ? $t('components.guider.calibrationAssistant.stopCalibration')
                : $t('components.guider.calibrationAssistant.startCalibration')
            }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { StopIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { apiStore } from '@/store/store';
import { useFramingStore } from '@/store/framingStore';
import { useGuiderStore } from '@/store/guiderStore';
import { degreesToHMS, degreesToDMS, getLST } from '@/utils/utils';
import apiService from '@/services/apiService';
import { isBackendRefusal } from '@/utils/backendErrors';

const { t } = useI18n();
const store = apiStore();
const framingStore = useFramingStore();
const guiderStore = useGuiderStore();

defineProps({
  show: Boolean,
});

defineEmits(['close']);

// Reactive state
const currentPosition = ref({ ra: null, dec: null });
const recommendedPosition = ref({ ra: null, dec: null });
const status = ref('');
const isSlewing = ref(false);
const isCalibrating = ref(false);
const calibrationResult = ref(null);
const calibrationStarted = ref(false);

// PHD2-style position settings
const decOffset = ref(0); // Start neutral, let altitude calculation handle it
const meridianOffset = ref(5); // Standard 5° offset from meridian
const direction = ref('west');

// ── Step size calculator state (PINS) ───────────────────────────────────────
const showCalc = ref(false);
const calcPixelSize = ref(null);
const calcFocalLength = ref(null);
const calcBinning = ref(1);
const calcDesiredSteps = ref(12);

// Guide speed: derived from mount's GuideRateRightAscensionArcsecPerSec (arcsec/s ÷ 15 = sidereal ×).
// Falls back to 0.5 when not available.
const calcGuideSpeed = computed(() => {
  const rate = store.mountInfo?.GuideRateRightAscensionArcsecPerSec;
  if (rate && isFinite(rate) && rate > 0) return rate / 15.0;
  return 0.5;
});

const calcStepResult = computed(() => {
  const p = calcPixelSize.value,
    f = calcFocalLength.value,
    b = calcBinning.value;
  const g = calcGuideSpeed.value,
    d = decOffset.value,
    s = calcDesiredSteps.value;
  if (!p || !f || !b || !g || !s) return null;
  const scale = (206.265 * p * b) / f;
  const distance = Math.max(25, Math.ceil(20 / scale));
  const totalDuration = (distance * scale) / (15.0 * g);
  const rawPulse = (totalDuration / s) * 1000;
  const maxPulse = (totalDuration / 6) * 1000;
  const pulse = Math.min(maxPulse, rawPulse / Math.cos((d * Math.PI) / 180));
  return Math.ceil(pulse / 50) * 50;
});

const calibrationStep = computed({
  get() {
    return guiderStore.phd2CalibrationStep ?? 0;
  },
  set(value) {
    guiderStore.phd2CalibrationStep = value;
  },
});

async function onCalibrationStepChange(value) {
  const prev = guiderStore.phd2CalibrationStep;
  try {
    await guiderStore.setPHD2CalibrationStep(value);
  } catch {
    guiderStore.phd2CalibrationStep = prev;
  }
}

const calibrationDistance = computed({
  get() {
    return guiderStore.phd2CalibrationDistance ?? 25;
  },
  set(value) {
    guiderStore.phd2CalibrationDistance = value;
  },
});

async function onCalibrationDistanceChange(value) {
  const prev = guiderStore.phd2CalibrationDistance;
  try {
    await guiderStore.setPHD2CalibrationDistance(value);
  } catch {
    guiderStore.phd2CalibrationDistance = prev;
  }
}

async function applyCalcStep() {
  if (calcStepResult.value === null) return;
  await guiderStore.setPHD2CalibrationStep(calcStepResult.value);
}

const canSlew = computed(() => {
  return (
    store.mountInfo?.Connected &&
    !isSlewing.value &&
    !isCalibrating.value &&
    !framingStore.isSlewing &&
    !framingStore.isSlewingAndCentering
  );
});

const displayStatus = computed(() => {
  const guiderState = store.guiderInfo?.State;

  if (isSlewing.value) {
    return t('components.guider.calibrationAssistant.slewing');
  }

  if (status.value && !guiderState) {
    return status.value; // Show custom status when no guider state
  }

  // Show guider state-based status
  switch (guiderState) {
    case 'Calibrating':
      return (
        guiderStore.phd2CalibrationMessage ||
        t('components.guider.calibrationAssistant.calibrating')
      );
    case 'Guiding':
      return t('components.guider.calibrationAssistant.calibrationComplete');
    case 'Stopped':
      return status.value || t('components.guider.calibrationAssistant.positionCalculated');
    default:
      return status.value;
  }
});

const statusClass = computed(() => {
  const guiderState = store.guiderInfo?.State;

  if (isSlewing.value) return 'bg-blue-500/20 border border-blue-500/30';
  if (guiderState === 'Calibrating') return 'bg-yellow-500/20 border border-yellow-500/30';
  if (guiderState === 'Guiding') return 'bg-green-500/20 border border-green-500/30';
  return 'bg-gray-500/20 border border-gray-500/30';
});

const calibrationResultClass = computed(() => {
  if (!calibrationResult.value) return '';

  switch (calibrationResult.value.quality) {
    case 'good':
      return 'bg-green-500/20 border border-green-500/30';
    case 'acceptable':
      return 'bg-yellow-500/20 border border-yellow-500/30';
    case 'poor':
      return 'bg-red-500/20 border border-red-500/30';
    default:
      return 'bg-gray-500/20 border border-gray-500/30';
  }
});

function getCurrentPosition() {
  // Get current telescope position
  if (store.mountInfo?.Coordinates) {
    currentPosition.value = {
      ra: store.mountInfo.Coordinates.Ra,
      dec: store.mountInfo.Coordinates.Dec,
    };
  }
}

function calculateOptimalPosition() {
  // Calculate optimal calibration position with proper PHD2-style offsets
  const longitude = store.profileInfo?.AstrometrySettings?.Longitude || 0;

  // Get Local Sidereal Time for meridian calculation
  const lstDegrees = getLST(longitude);
  const lstHours = lstDegrees / 15; // Convert to hours

  // Calculate target RA based on meridian offset and direction
  let targetRAHours = lstHours;
  if (meridianOffset.value > 0) {
    const offsetHours = meridianOffset.value / 15; // Convert degrees to hours
    if (direction.value === 'west') {
      targetRAHours = (lstHours - offsetHours + 24) % 24; // West of meridian (earlier RA)
    } else {
      targetRAHours = (lstHours + offsetHours) % 24; // East of meridian (later RA)
    }
  }

  // Calculate target Dec using user's offset
  let targetDec = decOffset.value;

  // Convert RA hours back to degrees for final calculation
  const targetRADegrees = targetRAHours * 15;

  console.log(
    `LST: ${lstHours.toFixed(2)}h, Target RA: ${targetRAHours.toFixed(2)}h (${targetRADegrees.toFixed(1)}°), Target Dec: ${targetDec}°`
  );
  console.log(
    `Meridian offset: ${meridianOffset.value}° ${direction.value}, Dec offset: ${decOffset.value}°`
  );

  // Store both formatted and degree values
  const raFormatted = degreesToHMS(targetRADegrees);
  const decFormatted = degreesToDMS(targetDec);

  console.log(`Final RA/Dec: ${raFormatted}, ${decFormatted} (${targetRADegrees}°, ${targetDec}°)`);

  recommendedPosition.value = {
    ra: raFormatted,
    dec: decFormatted,
    raDegrees: targetRADegrees,
    decDegrees: targetDec,
  };
  status.value = t('components.guider.calibrationAssistant.positionCalculated');
}

function setDirection(newDirection) {
  direction.value = newDirection;
  calculateOptimalPosition();
}

function toggleCalibration() {
  if (store.guiderInfo?.State === 'Calibrating') {
    stopCalibration();
  } else {
    startCalibration();
  }
}

async function stopSlew() {
  try {
    const response = await apiService.slewStop();
    if (!response.Success) return;
    console.log('Slew stopped');
    status.value = t('components.guider.calibrationAssistant.slewStopped');
  } catch (error) {
    console.error('Error stopping slew:', error);
    status.value = t('components.guider.calibrationAssistant.slewError');
  } finally {
    isSlewing.value = false;
  }
}

async function slewToOptimalPosition() {
  if (guiderStore.isDarkLibraryBuildActive) return;
  if (!canSlew.value) return;

  isSlewing.value = true;
  status.value = t('components.guider.calibrationAssistant.slewing');

  try {
    // Use the same slew method as Flat Assistant (via framingStore)
    const raInDegrees = recommendedPosition.value.raDegrees;
    const decInDegrees = recommendedPosition.value.decDegrees;

    console.log(`Slewing to: RA=${raInDegrees}°, Dec=${decInDegrees}°`);

    // Use framingStore.slew like the Flat Assistant ButtonSlew component
    await framingStore.slew(raInDegrees, decInDegrees);

    status.value = t('components.guider.calibrationAssistant.slewComplete');
  } catch (error) {
    console.error('Slew failed:', error);
    status.value = t('components.guider.calibrationAssistant.slewError');
  } finally {
    isSlewing.value = false;
  }
}

async function startCalibration() {
  if (guiderStore.isDarkLibraryBuildActive) return;
  if (!store.guiderInfo?.Connected) return;

  calibrationStarted.value = true;
  status.value = t('components.guider.calibrationAssistant.calibrating');
  calibrationResult.value = null;

  try {
    // Start PHD2 calibration with forced calibration
    const response = await apiService.guiderStart(true);
    if (isBackendRefusal(response)) {
      calibrationStarted.value = false;
      status.value = response.Error || t('components.guider.calibrationAssistant.calibrationError');
      return;
    }

    // Monitor calibration progress
    watchCalibrationProgress();
  } catch (error) {
    console.error('Calibration failed:', error);
    status.value = t('components.guider.calibrationAssistant.calibrationError');
  }
}

async function stopCalibration() {
  try {
    await apiService.guiderAction('stop');
    status.value = t('components.guider.calibrationAssistant.calibrationStopped');
  } catch (error) {
    console.error('Stop calibration failed:', error);
  }
}

function watchCalibrationProgress() {
  const unwatch = watch(
    () => store.guiderInfo?.State,
    (newState, oldState) => {
      console.log('Guider state changed:', oldState, '->', newState);

      // If we transition away from Calibrating, the calibration process is done
      if (oldState === 'Calibrating' && newState !== 'Calibrating') {
        if (newState === 'Guiding') {
          // Calibration completed successfully
          status.value = t('components.guider.calibrationAssistant.calibrationComplete');

          // Simulate calibration result assessment
          calibrationResult.value = {
            quality: 'good',
            explanation: t('components.guider.calibrationAssistant.goodCalibration'),
          };
        } else if (calibrationStarted.value) {
          // Calibration failed or stopped - but only show this if we actually started a calibration
          status.value = t('components.guider.calibrationAssistant.calibrationFailed');

          calibrationResult.value = {
            quality: 'poor',
            explanation: t('components.guider.calibrationAssistant.poorCalibration'),
          };
        }

        // Reset the calibration started flag
        calibrationStarted.value = false;
        unwatch();
      }
    }
  );
}

// Lifecycle
onMounted(async () => {
  getCurrentPosition();
  calculateOptimalPosition();
  if (store.isPINS) {
    await Promise.all([
      guiderStore.fetchPHD2PixelSize(),
      guiderStore.fetchPHD2FocalLength(),
      guiderStore.fetchPHD2CameraBinning(),
      guiderStore.fetchPHD2CalibrationStep(),
    ]);
    if (guiderStore.phd2PixelSize) calcPixelSize.value = guiderStore.phd2PixelSize;
    if (guiderStore.phd2FocalLength) calcFocalLength.value = guiderStore.phd2FocalLength;
    if (guiderStore.phd2CameraBinning) calcBinning.value = guiderStore.phd2CameraBinning;
  }
});

// Watch for mount position updates
watch(
  () => store.mountInfo?.Coordinates,
  () => {
    getCurrentPosition();
  },
  { deep: true }
);
</script>

<style scoped>
.spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid #bbb;
  border-top-color: #333;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: middle;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
