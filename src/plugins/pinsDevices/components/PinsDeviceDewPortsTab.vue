<template>
  <div class="space-y-4">
    <!-- Error Message -->
    <div v-if="store.error" class="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
      <p class="text-red-400 font-medium">{{ store.error }}</p>
    </div>

    <!-- Dew Ports Grid -->
    <div v-if="store.dewPorts.Ports.length > 0" class="grid grid-cols-1 gap-3">
      <div
        v-for="port in store.dewPorts.Ports"
        :key="port.Index"
        class="border rounded-lg p-4 transition-all"
        :class="[
          port.AutoMode
            ? 'border-blue-500/50 bg-blue-500/10'
            : port.Enabled
              ? 'border-green-500/50 bg-green-500/10'
              : 'border-gray-600 bg-gray-800/30',
          port.Overcurrent ? 'border-red-500/50 bg-red-500/10' : '',
        ]"
      >
        <!-- Port Header with Editable Name -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex-1">
            <div v-if="editingPortIndex !== port.Index" class="flex items-center gap-2">
              <h4 class="font-semibold text-white">{{ port.Name }}</h4>
              <button
                @click="startEditingName(port.Index)"
                class="p-1 text-gray-400 hover:text-cyan-400 transition-colors"
                :title="$t('common.edit')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  ></path>
                </svg>
              </button>
            </div>
            <div v-else class="flex items-center gap-2">
              <input
                :value="editingPortName"
                @input="editingPortName = $event.target.value"
                @keyup.enter="savePortName(port.Index)"
                @keyup.escape="cancelEditingName()"
                type="text"
                class="flex-1 px-2 py-1 bg-gray-700 border border-cyan-500/50 rounded text-white text-sm focus:outline-none focus:border-cyan-400"
                autofocus
              />
              <button
                @click="savePortName(port.Index)"
                :disabled="isRenamingPort"
                class="p-1 text-green-400 hover:text-green-300 disabled:opacity-50 transition-colors"
                :title="$t('common.confirm')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </button>
              <button
                @click="cancelEditingName()"
                class="p-1 text-red-400 hover:text-red-300 transition-colors"
                :title="$t('common.cancel')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- Status Indicator -->
            <span
              class="inline-block w-2 h-2 rounded-full"
              :class="
                port.AutoMode ? 'bg-purple-500' : port.Enabled ? 'bg-green-500' : 'bg-gray-500'
              "
            ></span>
            <!-- Overcurrent Indicator -->
            <span
              v-if="port.Overcurrent"
              class="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 font-semibold"
            >
              {{ $t('plugins.pinsDevices.ports.overcurrent') }}
            </span>
          </div>
        </div>

        <!-- Port Info -->
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400">Status</span>
            <span
              :class="
                port.AutoMode
                  ? 'text-purple-400'
                  : port.Enabled
                    ? 'text-green-400'
                    : 'text-gray-500'
              "
            >
              {{
                port.AutoMode
                  ? 'Auto Mode'
                  : port.Enabled
                    ? $t('common.enabled')
                    : $t('common.disabled')
              }}
            </span>
          </div>

          <div v-if="port.Probe !== 'NaN' && port.Probe !== undefined" class="flex justify-between">
            <span class="text-gray-400">Probe Temperature</span>
            <span class="text-gray-200">{{
              port.Probe === -127.0 ? '--' : port.Probe.toFixed(2) + '°C'
            }}</span>
          </div>

          <div
            v-if="port.Current !== 'NaN' && port.Current !== undefined"
            class="flex justify-between"
          >
            <span class="text-gray-400">Current</span>
            <span class="text-gray-200">{{ port.Current.toFixed(2) }}A</span>
          </div>

          <div
            v-if="port.MaxCurrent !== 'NaN' && port.MaxCurrent !== undefined && port.MaxCurrent > 0"
            class="flex justify-between"
          >
            <span class="text-gray-400">Max Current</span>
            <span class="text-gray-200">{{ port.MaxCurrent.toFixed(2) }}A</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-400">Current Power</span>
            <span class="text-gray-200">{{ calculateCurrentPowerPercentage(port) }}%</span>
          </div>
        </div>

        <!-- Controls -->
        <div class="mt-4 space-y-2">
          <!-- Auto Mode Toggle -->
          <button
            @click="toggleAutoMode(port)"
            :disabled="isTogglingAutoMode"
            class="w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all"
            :class="
              port.AutoMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50'
            "
          >
            {{
              isTogglingAutoMode
                ? $t('common.loading')
                : port.AutoMode
                  ? 'Disable Auto Mode'
                  : 'Enable Auto Mode'
            }}
          </button>

          <!-- Auto Threshold Picker (only shown when AutoMode is on) -->
          <div v-if="port.AutoMode" class="space-y-1">
            <div class="flex justify-between items-center">
              <label class="text-gray-400 text-xs">Auto Threshold (ΔT)</label>
              <span class="text-blue-400 text-xs">{{ port.AutoThreshold }}°C</span>
            </div>
            <button
              @click="openAutoThresholdPicker(port)"
              class="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all"
            >
              {{ port.AutoThreshold.toFixed(1) }}°C
            </button>
            <p class="text-gray-500 text-xs">Temperature above dew point to maintain</p>
          </div>

          <!-- Power Level Slider (disabled when AutoMode is on or Enabled is false) -->
          <div class="space-y-1">
            <div class="flex justify-between">
              <span class="text-gray-400 text-xs">Power Level</span>
              <span
                :class="port.AutoMode || !port.Enabled ? 'text-gray-500' : 'text-blue-400'"
                class="text-sm font-semibold"
                >{{ getSliderDisplayWithPercentage(port.Index, port) }}</span
              >
            </div>
            <input
              type="range"
              min="0"
              :max="port.Resolution"
              :value="getSliderDisplayValue(port.Index, port)"
              :disabled="port.AutoMode || !port.Enabled"
              @input="
                localSliderValues[port.Index] = $event.target.value;
                isDraggingSlider = port.Index;
              "
              @change="handlePowerLevelChange(port.Index, $event, port.Resolution)"
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div class="flex justify-between text-xs text-gray-500">
              <span>0</span>
              <span>{{ port.Resolution }}</span>
            </div>
          </div>

          <!-- Manual Control Button (disabled if AutoMode is on) -->
          <button
            @click="togglePort(port)"
            :disabled="isToggling || port.AutoMode"
            class="w-full py-2 px-3 rounded-lg text-sm font-semibold transition-all"
            :class="
              port.Enabled
                ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50'
                : 'bg-green-600 hover:bg-green-700 text-white disabled:opacity-50'
            "
          >
            {{
              isToggling
                ? $t('common.loading')
                : port.Enabled
                  ? $t('common.disable')
                  : $t('common.enable')
            }}
          </button>
        </div>
      </div>
    </div>

    <!-- No Ports Message -->
    <div v-else class="p-4 text-center text-gray-400">
      {{ $t('plugins.pinsDevices.ports.noPorts') }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { usePinsDeviceStore } from '../store/pinsDevicesStore.js';
import { useNumberPicker } from '@/composables/useNumberPicker.js';

const store = usePinsDeviceStore();
const { openPicker } = useNumberPicker();

const isToggling = ref(false);
const isTogglingAutoMode = ref(false);
const isRenamingPort = ref(false);
const editingPortIndex = ref(null);
const editingPortName = ref('');
const isDraggingSlider = ref(null); // Track which port is being dragged
const localSliderValues = ref({}); // Track local values for each port

// Watch for power level changes and clear dragging state when API responds
watch(
  () => store.dewPorts.Ports.map((p) => p.SetPower),
  () => {
    isDraggingSlider.value = null;
  }
);

const startEditingName = (portIndex) => {
  const port = store.dewPorts.Ports.find((p) => p.Index === portIndex);
  if (port) {
    editingPortIndex.value = portIndex;
    editingPortName.value = port.Name;
  }
};

const cancelEditingName = () => {
  editingPortIndex.value = null;
  editingPortName.value = '';
};

const savePortName = async (portIndex) => {
  if (!editingPortName.value.trim()) {
    cancelEditingName();
    return;
  }

  isRenamingPort.value = true;
  const success = await store.setDewPortName(portIndex, editingPortName.value);
  if (!success) {
    console.error('Failed to rename port');
  }
  isRenamingPort.value = false;
  cancelEditingName();
};

const togglePort = async (port) => {
  isToggling.value = true;
  const currentPowerLevel = port.PowerLevel;
  const success = await store.setDewPortState(port.Index, !port.Enabled);
  if (!success) {
    console.error('Failed to toggle port');
  } else {
    // After toggling, update power level: 0 when disabling, current power when enabling
    const newPowerLevel = port.Enabled ? 0 : currentPowerLevel;
    await store.setDewPortPowerLevel(port.Index, newPowerLevel);
  }
  isToggling.value = false;
};

const toggleAutoMode = async (port) => {
  isTogglingAutoMode.value = true;
  const success = await store.setDewPortAutoMode(port.Index, !port.AutoMode);
  if (!success) {
    console.error('Failed to toggle auto mode');
  }
  isTogglingAutoMode.value = false;
};

const openAutoThresholdPicker = (port) => {
  openPicker(
    'common.autoThreshold',
    0,
    50,
    0.1,
    port.AutoThreshold,
    (newValue) => handleAutoThresholdChange(port.Index, newValue),
    1
  );
};

const handleAutoThresholdChange = async (portIndex, value) => {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return;

  const success = await store.setDewPortAutoThreshold(portIndex, numValue);
  if (!success) {
    console.error('Failed to set auto threshold');
  }
};

const calculateCurrentPowerPercentage = (port) => {
  if (!port.Resolution || port.Resolution === 0) return 0;
  return Math.round((port.PowerLevel / port.Resolution) * 100);
};

const getSliderDisplayValue = (portIndex, port) => {
  if (isDraggingSlider.value === portIndex && localSliderValues.value[portIndex] !== undefined) {
    return localSliderValues.value[portIndex];
  }
  return port.SetPower;
};

const getSliderDisplayWithPercentage = (portIndex, port) => {
  const value = getSliderDisplayValue(portIndex, port);
  if (!port.Resolution || port.Resolution === 0) return `${value} (0%)`;
  const percentage = Math.round((value / port.Resolution) * 100);
  return `${value} (${percentage}%)`;
};

const handlePowerLevelChange = async (portIndex, event, resolution) => {
  const absoluteValue = parseInt(event.target.value, 10);
  if (isNaN(absoluteValue) || !resolution) return;

  const success = await store.setDewPortPowerLevel(portIndex, absoluteValue);
  // Hand the slider back to the polled SetPower, so a refused value springs back
  if (isDraggingSlider.value === portIndex) isDraggingSlider.value = null;
  delete localSliderValues.value[portIndex];
  if (!success) {
    console.error('Failed to set power level');
  }
};
</script>
