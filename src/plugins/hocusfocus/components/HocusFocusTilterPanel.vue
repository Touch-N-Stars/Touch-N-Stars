<template>
  <div class="space-y-6">
    <!-- Device: Wanderer ETA selection and live state -->
    <div :class="cardClass">
      <h3 :class="headingClass">{{ L('device') }}</h3>
      <div class="flex items-center gap-2">
        <select
          v-model="selectedDeviceId"
          class="tns-select min-w-0 flex-1 py-2"
          :disabled="isBusy || isConnected"
        >
          <option disabled value="">{{ L('selectDevice') }}</option>
          <option v-for="device in devices" :key="device.DeviceId" :value="String(device.DeviceId)">
            {{ device.Name }} - {{ device.SerialInfo }}
          </option>
        </select>
        <!-- Scanning while connected would drop the selection out from under the open device -->
        <button
          class="tns-btn-secondary w-auto! shrink-0 px-3!"
          :disabled="isBusy || isConnected"
          :title="L('scanTooltip')"
          :aria-label="L('scanTooltip')"
          @click="scanDevices"
        >
          <ArrowPathIcon class="h-5 w-5" :class="{ 'animate-spin': isScanning }" />
        </button>
        <button
          class="w-auto! shrink-0 px-3!"
          :class="isConnected ? 'tns-btn-danger' : 'tns-btn-primary'"
          :disabled="!selectedDeviceId || isBusy || (isConnected && isMoving)"
          :title="isConnected ? L('disconnect') : L('connect')"
          :aria-label="isConnected ? L('disconnect') : L('connect')"
          @click="toggleConnection"
        >
          <LinkSlashIcon v-if="isConnected" class="h-5 w-5" />
          <LinkIcon v-else class="h-5 w-5" />
        </button>
      </div>

      <template v-if="isConnected && selectedDeviceId">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-400">{{ L('status') }}</span>
          <span
            class="flex items-center gap-1.5 font-semibold"
            :class="isMoving ? 'text-amber-400' : 'text-green-400'"
          >
            <ArrowPathIcon v-if="isMoving" class="h-4 w-4 animate-spin" />
            {{ isMoving ? L('moving') : L('idle') }}
          </span>
        </div>

        <div
          v-if="isMoving"
          class="flex items-center gap-2 rounded-lg border border-amber-600/50 bg-amber-900/25 p-2 text-sm text-amber-200"
        >
          <ArrowPathIcon class="h-5 w-5 shrink-0 animate-spin" />
          {{ L('movingHint') }}
        </div>
        <div
          v-else-if="moveDone"
          class="flex items-center gap-2 rounded-lg border border-green-700/40 bg-green-900/15 p-2 text-sm text-green-300"
        >
          <CheckCircleIcon class="h-5 w-5 shrink-0" />
          {{ L('moveDone') }}
        </div>

        <p class="text-sm font-medium text-gray-300">{{ L('currentPositions') }}</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="n in [1, 2, 3]"
            :key="n"
            class="tns-btn-secondary flex-col gap-0.5! px-2! py-2"
            :disabled="isMoving"
            @click="openPositionPicker(n)"
          >
            <span class="text-xs text-gray-400">{{ L('positionN', { n }) }}</span>
            <span class="font-mono text-sm">{{
              formatMm(deviceStatus?.[`CurrentPosition${n}`])
            }}</span>
          </button>
        </div>

        <TilterPlot
          :rotation="Number(sensorConfig.SensorRotation) || 0"
          :sensor-width="Number(sensorConfig.SensorWidth) || 0"
          :sensor-height="Number(sensorConfig.SensorHeight) || 0"
          :screw-count="3"
          :corner-values="etaCornerValues"
        />
        <p class="text-center text-xs text-gray-500">{{ L('cornerOffsetsCaption') }}</p>
      </template>
      <p v-else class="text-sm text-gray-400">{{ L('manualModeHint') }}</p>

      <p v-if="deviceError" class="text-sm text-red-400">{{ deviceError }}</p>
    </div>

    <!-- Manual tilter geometry -->
    <div v-if="isManualMode" :class="cardClass">
      <h3 :class="headingClass">{{ L('manualTilterConfiguration') }}</h3>
      <TilterPlot
        :rotation="Number(sensorConfig.SensorRotation) || 0"
        :sensor-width="Number(sensorConfig.SensorWidth) || 0"
        :sensor-height="Number(sensorConfig.SensorHeight) || 0"
        :screw-count="screwCount"
      />
      <p class="text-center text-xs text-gray-500">
        {{
          L('actuatorVisualizationLabel', {
            radius: (Number(sensorConfig.TilterOuterRadius) || 0).toFixed(1),
            rotation: (Number(sensorConfig.SensorRotation) || 0).toFixed(1),
          })
        }}
      </p>
      <p v-if="screwCount === 4" class="text-center text-xs text-amber-300/80">
        {{ L('fourScrewHint') }}
      </p>
    </div>

    <!-- Configuration: saved on change, like the other HocusFocus tabs -->
    <div :class="cardClass">
      <h3 :class="headingClass">{{ L('configuration') }}</h3>
      <div class="flex flex-col gap-3">
        <HfNumberField
          v-model="sensorConfig.SensorWidth"
          :label="L('sensorWidth')"
          :hint="L('unitMm')"
          :min="1"
          :max="100"
          :step="0.1"
          :decimals="1"
          inputId="hf-tilter-width"
          :status="statusOf('SensorWidth')"
          :error="errorOf('SensorWidth')"
          @change="saveConfig('SensorWidth')"
        />
        <HfNumberField
          v-model="sensorConfig.SensorHeight"
          :label="L('sensorHeight')"
          :hint="L('unitMm')"
          :min="1"
          :max="100"
          :step="0.1"
          :decimals="1"
          inputId="hf-tilter-height"
          :status="statusOf('SensorHeight')"
          :error="errorOf('SensorHeight')"
          @change="saveConfig('SensorHeight')"
        />
        <HfNumberField
          v-model="sensorConfig.SensorRotation"
          :label="L('sensorRotation')"
          :hint="L('sensorRotationDescription')"
          :min="0"
          :max="359.9"
          :step="1"
          :decimals="1"
          inputId="hf-tilter-rotation"
          :status="statusOf('SensorRotation')"
          :error="errorOf('SensorRotation')"
          @change="saveConfig('SensorRotation')"
        />
        <template v-if="isManualMode">
          <HfNumberField
            v-model="sensorConfig.TilterOuterRadius"
            :label="L('tilterOuterRadius')"
            :hint="L('unitMm')"
            :min="1"
            :max="200"
            :step="0.5"
            :decimals="1"
            inputId="hf-tilter-radius"
            :status="statusOf('TilterOuterRadius')"
            :error="errorOf('TilterOuterRadius')"
            @change="saveConfig('TilterOuterRadius')"
          />
          <HfNumberField
            v-model="sensorConfig.TilterThreadPitch"
            :label="L('tilterThreadPitch')"
            :help="L('threadPitchHelp')"
            :hint="L('unitMm')"
            :min="0"
            :max="5"
            :step="0.05"
            :decimals="2"
            inputId="hf-tilter-pitch"
            :status="statusOf('TilterThreadPitch')"
            :error="errorOf('TilterThreadPitch')"
            @change="saveConfig('TilterThreadPitch')"
          />
          <HfSelectField
            v-if="backendSupportsScrewCount"
            :model-value="String(screwCount)"
            :label="L('tilterScrewCount')"
            :help="L('tilterScrewCountDescription')"
            :options="[
              { value: '3', label: L('screwCountThree') },
              { value: '4', label: L('screwCountFour') },
            ]"
            :status="statusOf('TilterScrewCount')"
            :error="errorOf('TilterScrewCount')"
            @change="onScrewCountChange"
          />
          <HfSelectField
            :model-value="sensorConfig.TilterPositiveTurnIsOutward ? 'outward' : 'inward'"
            :label="L('positiveTurnDirection')"
            :help="L('positiveTurnDirectionDescription')"
            :options="[
              { value: 'inward', label: L('positiveTurnInward') },
              { value: 'outward', label: L('positiveTurnOutward') },
            ]"
            :status="statusOf('TilterPositiveTurnIsOutward')"
            :error="errorOf('TilterPositiveTurnIsOutward')"
            @change="onDirectionChange"
          />
        </template>
      </div>
      <p v-if="configError" class="text-sm text-red-400">{{ configError }}</p>
    </div>

    <!-- Tilt plane: corner corrections in, screw targets out -->
    <div :class="cardClass">
      <h3 :class="headingClass">{{ L('applyTiltPlane') }}</h3>
      <p class="text-xs text-gray-400">{{ L('tiltPlaneDescription') }}</p>
      <div class="flex flex-col gap-3">
        <HfNumberField
          v-for="corner in CORNER_FIELDS"
          :key="corner.key"
          v-model="applyTiltPlane[corner.key]"
          :label="L(corner.label)"
          :hint="L('unitMm')"
          :min="-5"
          :max="5"
          :step="0.001"
          :decimals="3"
          :inputId="`hf-tilter-${corner.key}`"
        />
        <HfToggleRow
          v-if="isManualMode"
          v-model="shiftToNonNegative"
          :label="L('shiftToNonNegative')"
          :help="L('startFromSeatedDescription')"
        />
      </div>

      <p v-if="fetchedReversed" class="text-xs text-amber-300/80">{{ L('fetchedReversed') }}</p>

      <div class="flex flex-wrap gap-2">
        <button
          class="tns-btn-secondary w-auto! px-4"
          :disabled="!aberrationInspectorAvailable || isFetchingAberration"
          :title="aberrationInspectorAvailable ? '' : L('aberrationUnavailable')"
          @click="fetchFromAberrationInspector"
        >
          {{ isFetchingAberration ? L('loading') : L('fetchFromAberrationInspector') }}
        </button>
        <button
          class="tns-btn-primary w-auto! px-4"
          :disabled="isCalculatingTiltPlane || (!isManualMode && isMoving)"
          @click="calculateTiltPlane"
        >
          {{ isCalculatingTiltPlane ? L('calculating') : L('calculateActuatorPositions') }}
        </button>
      </div>

      <!-- Calculated positions -->
      <div
        v-if="calculatedPositions"
        class="flex flex-col gap-2 rounded-lg border border-green-700/40 bg-green-900/15 p-3"
      >
        <p class="text-sm font-semibold text-green-400">{{ L('calculatedPositions') }}</p>
        <div
          v-for="screw in calculatedScrews"
          :key="screw.label"
          class="flex items-center justify-between gap-3 border-b border-gray-700/40 py-1 text-sm last:border-0"
        >
          <span class="font-semibold text-gray-300">{{ screw.label }}</span>
          <span class="text-right">
            <span class="font-mono text-gray-100">{{ formatMm(screw.position) }}</span>
            <span v-if="calculatedForManual && screw.showRaw" class="block text-xs text-gray-500">
              {{ L('calculatedRaw', { value: formatMm(screw.raw) }) }}
            </span>
            <span
              v-if="calculatedForManual"
              class="block text-xs font-semibold"
              :class="
                screw.direction === 'inward'
                  ? 'text-cyan-300'
                  : screw.direction === 'outward'
                    ? 'text-amber-300'
                    : 'text-gray-400'
              "
            >
              {{ screw.directionLabel }}
            </span>
          </span>
        </div>
        <button
          v-if="!calculatedForManual"
          class="tns-btn-primary"
          :disabled="isApplyingPositions || !isConnected || isMoving"
          @click="applyCalculatedPositions"
        >
          {{
            isApplyingPositions
              ? L('applying')
              : isMoving
                ? L('waitForMove')
                : L('applyThesePositionsToDevice')
          }}
        </button>
      </div>

      <p v-if="applyTiltPlaneError" class="text-sm text-red-400">{{ applyTiltPlaneError }}</p>
    </div>

    <!-- Set one ETA actuator -->
    <Modal :show="showPositionPicker" maxWidth="max-w-sm" @close="closePositionPicker">
      <template #header>
        <h2 class="text-xl font-bold text-white">
          {{ L('setPositionTitle', { n: selectedPositionIndex }) }}
        </h2>
      </template>
      <template #body>
        <div class="flex w-full flex-col gap-4">
          <HfNumberField
            v-model="positionInputValue"
            :label="L('newPosition')"
            :hint="L('newPositionHint', { max: ETA_TRAVEL.toFixed(3) })"
            :min="0"
            :max="ETA_TRAVEL"
            :step="0.001"
            :decimals="3"
            inputId="hf-tilter-position"
          />
          <p v-if="positionError" class="text-sm text-red-400">{{ positionError }}</p>
          <div class="flex justify-end gap-2">
            <button
              class="tns-btn-secondary w-auto! px-4"
              :disabled="isSettingPosition"
              @click="closePositionPicker"
            >
              {{ $t('general.cancel') }}
            </button>
            <button
              class="tns-btn-primary w-auto! px-4"
              :disabled="isSettingPosition || isMoving"
              @click="savePosition"
            >
              {{ isSettingPosition ? L('applying') : L('setPosition') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowPathIcon, CheckCircleIcon, LinkIcon, LinkSlashIcon } from '@heroicons/vue/24/outline';
import { usePolling } from '@/composables/usePolling';
import apiService from '@/services/apiService';
import { useSettingsStore } from '@/store/settingsStore';
import Modal from '@/components/helpers/Modal.vue';
import HfNumberField from './fields/HfNumberField.vue';
import HfSelectField from './fields/HfSelectField.vue';
import HfToggleRow from './fields/HfToggleRow.vue';
import TilterPlot from './tilter/TilterPlot.vue';
import { SCREW_LAYOUTS, ETA_TRAVEL } from './tilter/tilterGeometry';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const L = (key, params) => t(`plugins.hocusfocus.tilter.${key}`, params ?? {});

const cardClass =
  'p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50';
const headingClass = 'font-bold text-base text-cyan-400';

const CORNER_FIELDS = [
  { key: 'topLeftZ', label: 'cornerTopLeft' },
  { key: 'topRightZ', label: 'cornerTopRight' },
  { key: 'bottomLeftZ', label: 'cornerBottomLeft' },
  { key: 'bottomRightZ', label: 'cornerBottomRight' },
];

// Travel below this (mm) is shown as "no turn"; it rounds to 0.000 mm in the display
const NO_TURN_THRESHOLD_MM = 0.0005;

// localStorage keys, unchanged from earlier versions so saved state carries over
const STORAGE = {
  devices: 'tilterDevicesList',
  deviceId: 'tilterSelectedDeviceId',
  connected: 'tilterIsConnected',
  tiltPlane: 'applyTiltPlane',
  shift: 'tilterShiftToNonNegative',
};

// Storage can be unavailable (private mode, blocked site data); the panel must work without it.
// The device list, the chosen device and the measured corners belong to one rig, so they are kept
// per NINA instance; the screw travel reference is a personal preference and stays shared.
const RIG_KEYS = new Set([STORAGE.devices, STORAGE.deviceId, STORAGE.connected, STORAGE.tiltPlane]);
function storageKey(key) {
  const instanceId = settingsStore.selectedInstanceId;
  return RIG_KEYS.has(key) && instanceId ? `${key}:${instanceId}` : key;
}

function readStorage(key) {
  try {
    const scoped = storageKey(key);
    const value = localStorage.getItem(scoped);
    if (value !== null || scoped === key) return value;
    // Earlier versions kept one unscoped entry for all instances: the first instance to read it
    // adopts it, and it is removed so no other instance picks up that rig's devices.
    const legacy = localStorage.getItem(key);
    if (legacy !== null) {
      localStorage.setItem(scoped, legacy);
      localStorage.removeItem(key);
    }
    return legacy;
  } catch {
    return null;
  }
}
function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(storageKey(key));
    else localStorage.setItem(storageKey(key), value);
  } catch {
    // Remembering is a convenience only
  }
}

// The server's own reason when it gave one, otherwise the transport error
const detailOf = (error) =>
  error?.response?.data?.Error || error?.response?.data?.Message || error?.message || '';
const withDetail = (message, error) => {
  const detail = detailOf(error);
  return detail ? `${message}: ${detail}` : message;
};

// The server refuses a new target while the actuators are still travelling
const isStillMoving = (error) => error?.response?.data?.ErrorCode === 'moving';

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const formatMm = (value) => (isFiniteNumber(value) ? `${value.toFixed(3)} mm` : '—');

// ---- Device ---------------------------------------------------------------------------------

const devices = ref([]);
const selectedDeviceId = ref('');
const isScanning = ref(false);
const isConnecting = ref(false);
const isDisconnecting = ref(false);
const isConnected = ref(false);
const deviceStatus = ref(null);
const deviceError = ref('');

const isBusy = computed(() => isScanning.value || isConnecting.value || isDisconnecting.value);
// Without a connected ETA everything is calculated for a manual tilter
const isManualMode = computed(() => !isConnected.value);

// A move counts from the moment it is sent until the ETA reports it has settled. Status is polled
// once a second, so right after sending the device can still read idle; without the pending move
// the controls would unlock in that gap and take a second target mid-move.
const MOVE_START_GRACE_MS = 3000;
const pendingMove = ref(null); // { sentAt, seenMoving }
const moveDone = ref(false);
let moveDoneTimer = null;
let lastReportedMoving = false;
const isMoving = computed(() => !!deviceStatus.value?.IsMoving || !!pendingMove.value);

function beginMove() {
  pendingMove.value = { sentAt: Date.now(), seenMoving: false };
  moveDone.value = false;
  clearTimeout(moveDoneTimer);
}

function showMoveDone() {
  moveDone.value = true;
  clearTimeout(moveDoneTimer);
  moveDoneTimer = setTimeout(() => (moveDone.value = false), 5000);
}

// Called with every status: ends a pending move once the device has been seen moving and stops,
// or when a short move finished between two polls and it never read as moving at all.
function trackMove(status) {
  const moving = !!status.IsMoving;
  const move = pendingMove.value;
  if (move) {
    if (moving) {
      move.seenMoving = true;
    } else if (move.seenMoving || Date.now() - move.sentAt > MOVE_START_GRACE_MS) {
      pendingMove.value = null;
      showMoveDone();
    }
  } else if (lastReportedMoving && !moving) {
    // A move started elsewhere (another client) finished
    showMoveDone();
  }
  lastReportedMoving = moving;
}

// Corner offsets of the ETA's current plane, in µm, keyed like TilterPlot's corners
const etaCornerValues = computed(() => {
  const s = deviceStatus.value;
  const microns = (mm) => (isFiniteNumber(mm) ? `${Math.round(mm * 1000)} µm` : '—');
  return {
    TL: microns(s?.ImagePlaneTopLeftOffset),
    TR: microns(s?.ImagePlaneTopRightOffset),
    BL: microns(s?.ImagePlaneBottomLeftOffset),
    BR: microns(s?.ImagePlaneBottomRightOffset),
  };
});

const statusPoller = usePolling(
  () => {
    if (isConnected.value && selectedDeviceId.value) return refreshStatus();
  },
  1000,
  { autoStart: false, immediate: false }
);

function rememberDevices(list) {
  devices.value = list;
  writeStorage(STORAGE.devices, JSON.stringify(list));
}

async function loadDevices() {
  try {
    isScanning.value = true;
    deviceError.value = '';
    const response = await apiService.hocusfocus.getTilterDevices();
    rememberDevices(Array.isArray(response?.Response) ? response.Response : []);
  } catch (error) {
    deviceError.value = withDetail(L('loadDevicesFailed'), error);
  } finally {
    isScanning.value = false;
  }
}

async function scanDevices() {
  if (isConnected.value) return;
  try {
    isScanning.value = true;
    deviceError.value = '';
    const response = await apiService.hocusfocus.scanTilterDevices();
    const list = Array.isArray(response?.Response) ? response.Response : [];
    rememberDevices(list);
    // Keep the selection when the device is still there
    if (!list.some((d) => String(d.DeviceId) === selectedDeviceId.value)) {
      selectedDeviceId.value = '';
    }
  } catch (error) {
    deviceError.value = withDetail(L('loadDevicesFailed'), error);
  } finally {
    isScanning.value = false;
  }
}

function setConnected(connected) {
  isConnected.value = connected;
  writeStorage(STORAGE.connected, connected ? 'true' : 'false');
  if (connected) {
    statusPoller.start();
  } else {
    statusPoller.stop();
    deviceStatus.value = null;
    pendingMove.value = null;
    moveDone.value = false;
    lastReportedMoving = false;
  }
}

async function toggleConnection() {
  if (!selectedDeviceId.value) return;
  if (isConnected.value) await disconnect();
  else await connect();
}

async function connect() {
  try {
    isConnecting.value = true;
    deviceError.value = '';
    const response = await apiService.hocusfocus.connectTilterDevice(selectedDeviceId.value);
    if (response?.Success === false) {
      deviceError.value = response.Error || response.Message || L('connectFailed');
      setConnected(false);
      return;
    }
    setConnected(true);
    await refreshStatus();
  } catch (error) {
    deviceError.value = withDetail(L('connectFailed'), error);
    setConnected(false);
  } finally {
    isConnecting.value = false;
  }
}

async function disconnect() {
  try {
    isDisconnecting.value = true;
    deviceError.value = '';
    const response = await apiService.hocusfocus.disconnectTilterDevice(selectedDeviceId.value);
    if (response?.Success === false) {
      deviceError.value = response.Error || response.Message || L('disconnectFailed');
      return;
    }
    setConnected(false);
    calculatedPositions.value = null;
  } catch (error) {
    deviceError.value = withDetail(L('disconnectFailed'), error);
  } finally {
    isDisconnecting.value = false;
  }
}

async function refreshStatus() {
  try {
    const response = await apiService.hocusfocus.getTilterStatus(selectedDeviceId.value);
    if (response?.Response) {
      deviceStatus.value = response.Response;
      deviceError.value = '';
      trackMove(response.Response);
    }
  } catch (error) {
    deviceError.value = withDetail(L('statusFailed'), error);
  }
}

// A remembered connection is only trusted once the backend confirms it (it forgets its devices on
// every NINA restart).
async function restoreConnection() {
  try {
    const response = await apiService.hocusfocus.isTilterDeviceConnected(selectedDeviceId.value);
    setConnected(!!response?.IsConnected);
    if (response?.IsConnected) await refreshStatus();
  } catch {
    setConnected(false);
  }
}

watch(selectedDeviceId, (value) => writeStorage(STORAGE.deviceId, value || null));

// ---- Position picker ------------------------------------------------------------------------

const showPositionPicker = ref(false);
const selectedPositionIndex = ref(null);
const positionInputValue = ref(0);
const isSettingPosition = ref(false);
const positionError = ref('');

function openPositionPicker(index) {
  selectedPositionIndex.value = index;
  const current = deviceStatus.value?.[`CurrentPosition${index}`];
  positionInputValue.value = isFiniteNumber(current) ? Number(current.toFixed(3)) : 0;
  positionError.value = '';
  showPositionPicker.value = true;
}

function closePositionPicker() {
  showPositionPicker.value = false;
  selectedPositionIndex.value = null;
  positionError.value = '';
}

async function savePosition() {
  if (isMoving.value) {
    positionError.value = L('stillMoving');
    return;
  }
  const value = Number(positionInputValue.value);
  if (!Number.isFinite(value) || value < 0 || value > ETA_TRAVEL) {
    positionError.value = L('positionOutOfRange', { max: ETA_TRAVEL.toFixed(3) });
    return;
  }
  try {
    isSettingPosition.value = true;
    positionError.value = '';
    // Only the changed actuator is sent; the others keep their positions
    const response = await apiService.hocusfocus.setTilterPositions(selectedDeviceId.value, {
      [`position${selectedPositionIndex.value}`]: value,
    });
    if (response?.Success === false) {
      positionError.value = response.Error || response.Message || L('setPositionFailed');
      return;
    }
    beginMove();
    // An ETA result is current + correction; with one actuator moved it no longer holds
    if (!calculatedForManual.value) calculatedPositions.value = null;
    closePositionPicker();
  } catch (error) {
    positionError.value = isStillMoving(error)
      ? L('stillMoving')
      : withDetail(L('setPositionFailed'), error);
  } finally {
    isSettingPosition.value = false;
  }
}

// ---- Configuration --------------------------------------------------------------------------

const sensorConfig = reactive({
  SensorWidth: 36,
  SensorHeight: 24,
  SensorRotation: 0,
  TilterOuterRadius: 60,
  TilterThreadPitch: 0,
  TilterScrewCount: 3,
  TilterPositiveTurnIsOutward: false,
});

// Plugin versions before the 4-screw support ignore `screwCount` and always compute a 3-screw
// solution, so the option stays hidden there rather than showing wrong guidance.
const backendSupportsScrewCount = ref(false);
const screwCount = computed(() =>
  backendSupportsScrewCount.value && Number(sensorConfig.TilterScrewCount) === 4 ? 4 : 3
);

const configError = ref('');
const configStatus = ref({});
const configErrors = ref({});
const statusOf = (key) => configStatus.value[key] || '';
const errorOf = (key) => configErrors.value[key] || '';
const setStatus = (key, status) => (configStatus.value = { ...configStatus.value, [key]: status });
const setFieldError = (key, message) =>
  (configErrors.value = { ...configErrors.value, [key]: message });

async function loadSensorConfiguration() {
  try {
    configError.value = '';
    const response = await apiService.hocusfocus.getSensorConfiguration();
    if (!response?.Success) {
      if (response?.Error) configError.value = response.Error;
      return;
    }
    Object.assign(sensorConfig, {
      SensorWidth: response.SensorWidth,
      SensorHeight: response.SensorHeight,
      SensorRotation: response.SensorRotation,
      TilterOuterRadius: response.TilterOuterRadius ?? 60,
      TilterThreadPitch: response.TilterThreadPitch ?? 0,
      TilterScrewCount: response.TilterScrewCount === 4 ? 4 : 3,
      TilterPositiveTurnIsOutward: response.TilterPositiveTurnIsOutward === true,
    });
    backendSupportsScrewCount.value =
      response.TilterScrewCount !== undefined && response.TilterScrewCount !== null;
  } catch (error) {
    configError.value = withDetail(L('configLoadFailed'), error);
  }
}

// The endpoint takes the whole configuration, so each edit sends all of it; edits in quick
// succession collapse into one request, marked on the field that was changed last.
let saveTimer = null;
let pendingKey = null;
function saveConfig(key) {
  pendingKey = key;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(pushConfig, 300);
}

async function pushConfig() {
  const key = pendingKey;
  setStatus(key, 'saving');
  setFieldError(key, '');
  try {
    const response = await apiService.hocusfocus.setSensorConfiguration({
      sensorWidth: Number(sensorConfig.SensorWidth),
      sensorHeight: Number(sensorConfig.SensorHeight),
      sensorRotation: Number(sensorConfig.SensorRotation) || 0,
      tilterOuterRadius: Number(sensorConfig.TilterOuterRadius),
      tilterThreadPitch: Number(sensorConfig.TilterThreadPitch),
      tilterScrewCount: screwCount.value,
      tilterPositiveTurnIsOutward: sensorConfig.TilterPositiveTurnIsOutward === true,
    });
    if (response?.Success === false) throw new Error(response.Error || L('configSaveFailed'));
    setStatus(key, 'saved');
    setTimeout(() => setStatus(key, ''), 1000);
  } catch (error) {
    setStatus(key, 'error');
    setFieldError(key, withDetail(L('configSaveFailed'), error));
  }
}

function onScrewCountChange(value) {
  sensorConfig.TilterScrewCount = Number(value) === 4 ? 4 : 3;
  saveConfig('TilterScrewCount');
}

function onDirectionChange(value) {
  sensorConfig.TilterPositiveTurnIsOutward = value === 'outward';
  saveConfig('TilterPositiveTurnIsOutward');
}

// ---- Tilt plane -----------------------------------------------------------------------------

const applyTiltPlane = reactive({ topLeftZ: 0, topRightZ: 0, bottomLeftZ: 0, bottomRightZ: 0 });
// Manual tilters are adjusted from fully seated screws, so travel is reported as inward-only by
// default (sign depends on TilterPositiveTurnIsOutward); unchecking reports signed adjustments.
const shiftToNonNegative = ref(true);
const calculatedPositions = ref(null);
// Whether the result on screen was calculated for a manual tilter (it must not follow a later
// connect or disconnect, or ETA targets would be labelled as screw turns and vice versa)
const calculatedForManual = ref(true);
const isCalculatingTiltPlane = ref(false);
const isApplyingPositions = ref(false);
const applyTiltPlaneError = ref('');
const aberrationInspectorAvailable = ref(false);
const isFetchingAberration = ref(false);
// True when the last fetch flipped the signs for a focuser that moves toward the objective
const fetchedReversed = ref(false);

watch(applyTiltPlane, (value) => writeStorage(STORAGE.tiltPlane, JSON.stringify(value)), {
  deep: true,
});
watch(shiftToNonNegative, (value) => writeStorage(STORAGE.shift, JSON.stringify(value)));

// Calculated positions flattened into per-screw rows
const calculatedScrews = computed(() => {
  const result = calculatedPositions.value;
  if (!result) return [];
  const layout = SCREW_LAYOUTS[result.ScrewCount === 4 ? 4 : 3];
  const pitch = Number(sensorConfig.TilterThreadPitch);
  // The direction the backend calculated with, so a later config change can't relabel old values
  const positiveIsOutward = result.PositiveTurnIsOutward === true;
  return layout.map((screw, index) => {
    const position = result[`Position${index + 1}`];
    const raw = result[`RawPosition${index + 1}`];
    let direction = null;
    if (isFiniteNumber(position) && Math.abs(position) >= NO_TURN_THRESHOLD_MM) {
      direction = position > 0 === positiveIsOutward ? 'outward' : 'inward';
    }
    const turns = direction && pitch > 0 ? (Math.abs(position) / pitch).toFixed(2) : null;
    let directionLabel;
    if (!direction) directionLabel = L('noTurn');
    else if (direction === 'inward')
      directionLabel = turns !== null ? L('turnsInward', { turns }) : L('inward');
    else directionLabel = turns !== null ? L('turnsOutward', { turns }) : L('outward');
    return {
      // 4-screw rows name the corner in full; the plot keeps the short tag
      label: screw.nameKey ? L(screw.nameKey) : screw.label,
      position,
      raw,
      direction,
      directionLabel,
      // With the shift disabled the reported value is the raw one, so don't print it twice
      showRaw: isFiniteNumber(raw) && Math.abs(raw - position) > 1e-9,
    };
  });
});

async function checkAberrationInspector() {
  try {
    const data = await apiService.hocusfocus.getTiltCornerMeasurements();
    aberrationInspectorAvailable.value = !!data?.tiltCornerMeasurements?.length;
  } catch {
    aberrationInspectorAvailable.value = false;
  }
}

async function fetchFromAberrationInspector() {
  try {
    isFetchingAberration.value = true;
    applyTiltPlaneError.value = '';
    const data = await apiService.hocusfocus.getTiltCornerMeasurements();
    const corners = data?.tiltCornerMeasurements || [];
    const microns = (side) => {
      const corner = corners.find((c) => c.sensorSide === side);
      // NaN arrives as the string "NaN"
      return corner ? Number(corner.adjustmentRequiredMicrons) : undefined;
    };
    const values = {
      topLeftZ: microns('TopLeft'),
      topRightZ: microns('TopRight'),
      bottomLeftZ: microns('BottomLeft'),
      bottomRightZ: microns('BottomRight'),
    };
    if (Object.values(values).some((v) => v === undefined)) {
      aberrationInspectorAvailable.value = false;
      applyTiltPlaneError.value = L('aberrationUnavailable');
      return;
    }
    // Without a focuser step size HocusFocus has no micron values; filling the corners anyway
    // would send nulls that the backend reads as 0 and report a level plate.
    if (!Object.values(values).every(Number.isFinite)) {
      applyTiltPlaneError.value = L('noMicronsPerStep');
      return;
    }
    // HocusFocus measures in focuser direction. The screw corrections here assume a focuser that
    // moves the camera away from the objective as its position increases; for one that moves
    // toward it, the same physical tilt reads with the opposite sign.
    const sign = data.focuserIncreasesTowardObjective ? -1 : 1;
    for (const [key, value] of Object.entries(values)) {
      applyTiltPlane[key] = Number(((sign * value) / 1000).toFixed(6));
    }
    fetchedReversed.value = !!data.focuserIncreasesTowardObjective;
  } catch (error) {
    applyTiltPlaneError.value = withDetail(L('fetchFailed'), error);
  } finally {
    isFetchingAberration.value = false;
  }
}

async function calculateTiltPlane() {
  applyTiltPlaneError.value = '';
  const corners = CORNER_FIELDS.map((c) => Number(applyTiltPlane[c.key]));
  if (!corners.every(Number.isFinite)) {
    applyTiltPlaneError.value = L('invalidCorners');
    return;
  }
  const manual = isManualMode.value;
  // The ETA calculation starts from the current actuator positions, which are meaningless mid-move
  if (!manual && isMoving.value) {
    applyTiltPlaneError.value = L('stillMoving');
    return;
  }
  if (manual && !(Number(sensorConfig.TilterOuterRadius) > 0)) {
    applyTiltPlaneError.value = L('outerRadiusRequired');
    return;
  }
  try {
    isCalculatingTiltPlane.value = true;
    const response = await apiService.hocusfocus.applyTiltPlane(
      // -1 is the virtual manual device
      manual ? -1 : parseInt(selectedDeviceId.value),
      ...corners,
      // ETA devices report their own radius
      manual ? Number(sensorConfig.TilterOuterRadius) : undefined,
      // Manual tilters have no fixed travel, so no offset into 0..1.2 mm
      manual ? true : undefined,
      // ETA hardware is always a 3-screw plate
      manual ? screwCount.value : 3,
      // Real hardware always needs non-negative positions
      manual ? shiftToNonNegative.value : true,
      // Only manual tilters have a screw direction
      manual ? sensorConfig.TilterPositiveTurnIsOutward === true : false
    );
    if (!response?.Success) {
      applyTiltPlaneError.value = response?.Error || response?.Message || L('calculateFailed');
      calculatedPositions.value = null;
      return;
    }
    calculatedPositions.value = response;
    calculatedForManual.value = manual;
  } catch (error) {
    calculatedPositions.value = null;
    applyTiltPlaneError.value =
      error?.code === 'exceedsTravel'
        ? L('exceedsTravel', {
            travel: Number(error.requiredTravel).toFixed(3),
            max: ETA_TRAVEL.toFixed(1),
          })
        : withDetail(L('calculateFailed'), error);
  } finally {
    isCalculatingTiltPlane.value = false;
  }
}

async function applyCalculatedPositions() {
  const result = calculatedPositions.value;
  if (!result) return;
  if (isMoving.value) {
    applyTiltPlaneError.value = L('stillMoving');
    return;
  }
  // 4-screw plates are manual-only and this path drives exactly three actuators
  if (result.ScrewCount === 4) {
    applyTiltPlaneError.value = L('fourScrewApplyUnsupported');
    return;
  }
  try {
    isApplyingPositions.value = true;
    applyTiltPlaneError.value = '';
    const response = await apiService.hocusfocus.setTilterPositions(
      parseInt(selectedDeviceId.value),
      { position1: result.Position1, position2: result.Position2, position3: result.Position3 }
    );
    if (response?.Success === false) {
      applyTiltPlaneError.value = response.Error || response.Message || L('applyFailed');
      return;
    }
    calculatedPositions.value = null;
    beginMove();
  } catch (error) {
    applyTiltPlaneError.value = isStillMoving(error)
      ? L('stillMoving')
      : withDetail(L('applyFailed'), error);
  } finally {
    isApplyingPositions.value = false;
  }
}

// ---- Startup --------------------------------------------------------------------------------

onMounted(async () => {
  const savedDevices = readStorage(STORAGE.devices);
  let restored = false;
  if (savedDevices) {
    try {
      devices.value = JSON.parse(savedDevices);
      restored = Array.isArray(devices.value);
    } catch {
      restored = false;
    }
  }
  if (!restored) await loadDevices();

  // Corner values and the travel reference are remembered whether or not a device is used
  const savedTiltPlane = readStorage(STORAGE.tiltPlane);
  if (savedTiltPlane) {
    try {
      const saved = JSON.parse(savedTiltPlane);
      for (const { key } of CORNER_FIELDS) {
        const value = Number(saved?.[key]);
        if (Number.isFinite(value)) applyTiltPlane[key] = value;
      }
    } catch {
      // Ignore a corrupt entry
    }
  }
  const savedShift = readStorage(STORAGE.shift);
  if (savedShift !== null) shiftToNonNegative.value = savedShift !== 'false';

  const savedDeviceId = readStorage(STORAGE.deviceId);
  if (savedDeviceId && savedDeviceId !== '-1') {
    selectedDeviceId.value = savedDeviceId;
    if (readStorage(STORAGE.connected) === 'true') restoreConnection();
  }

  await loadSensorConfiguration();
  await checkAberrationInspector();
});
</script>
