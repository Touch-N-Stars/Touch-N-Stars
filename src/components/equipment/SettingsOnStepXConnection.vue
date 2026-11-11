<template>
  <div class="tns-card flex flex-col">
    <!-- Serial port -->
    <div class="flex flex-row items-center justify-between w-full">
      <label for="onstepxPort" class="text-xs md:text-sm text-content mr-2">
        {{ $t('indi.config.devicePort') }}
      </label>
      <select
        id="onstepxPort"
        v-model="selectedPort"
        class="tns-select text-xs md:text-sm w-48"
        :class="statusClassPort"
      >
        <option value="" disabled>{{ $t('indi.config.selectPort') }}</option>
        <option :value="MANUAL_PORT">{{ $t('indi.config.manualPort') }}</option>
        <template v-for="port in availablePorts" :key="port.separator ? port.label : port.Port">
          <option v-if="port.separator" value="" disabled>{{ port.label }}</option>
          <option v-else :value="port.Port">
            {{ port.Description ? `${port.Port} (${port.Description})` : port.Port }}
          </option>
        </template>
      </select>
    </div>

    <!-- Serial port, manual entry (e.g. a udev symlink) -->
    <div
      v-if="manualPortMode"
      class="flex flex-row items-center justify-between w-full mt-2 md:mt-3"
    >
      <label for="onstepxManualPort" class="text-xs md:text-sm text-content mr-2">
        {{ $t('indi.config.manualPortPath') }}
      </label>
      <input
        id="onstepxManualPort"
        v-model.trim="port"
        @change="savePort"
        type="text"
        class="tns-input text-xs md:text-sm w-48"
        :class="statusClassPort"
        placeholder="/dev/ttyUSB0"
      />
    </div>

    <!-- Baud rate -->
    <div class="flex flex-row items-center justify-between w-full mt-2 md:mt-3">
      <label for="onstepxBaudRate" class="text-xs md:text-sm text-content mr-2">
        {{ $t('indi.config.baudRate') }}
      </label>
      <select
        id="onstepxBaudRate"
        v-model.number="baudRate"
        @change="saveBaudRate"
        class="tns-select text-xs md:text-sm w-48"
        :class="statusClassBaudRate"
      >
        <option v-for="rate in baudOptions" :key="rate" :value="rate">{{ rate }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
// Connection settings of pins' native OnStepX mount driver: TelescopeSettings.SerialPort and
// TelescopeSettings.SerialBaudRate, read at every connect.
import { onMounted, ref, computed, watch } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';

// OnStepX's SERIAL_A_BAUD_DEFAULT is 9600; a firmware can be built with the others
const DEFAULT_BAUD_RATE = 9600;
const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800];
const MANUAL_PORT = '__manual__';

const store = apiStore();

const port = ref('');
const baudRate = ref(DEFAULT_BAUD_RATE);
const availablePorts = ref([]);
const manualPortMode = ref(false);
const statusClassPort = ref('');
const statusClassBaudRate = ref('');

// A rate set elsewhere (e.g. through the API) stays selectable
const baudOptions = computed(() =>
  BAUD_RATES.includes(baudRate.value)
    ? BAUD_RATES
    : [...BAUD_RATES, baudRate.value].sort((a, b) => a - b)
);

// The dropdown shows the MANUAL_PORT sentinel in manual mode while port keeps the real path
const selectedPort = computed({
  get() {
    return manualPortMode.value ? MANUAL_PORT : port.value;
  },
  set(value) {
    if (value === MANUAL_PORT) {
      manualPortMode.value = true;
      return;
    }
    manualPortMode.value = false;
    port.value = value;
    savePort();
  },
});

// A saved port that is not among the detected ones is a manual entry (e.g. /dev/onstep)
watch([port, availablePorts], ([current, ports]) => {
  // Also with no detected ports at all, so a saved path never hides behind an empty dropdown
  if (!current) {
    return;
  }
  if (!ports.some((p) => !p.separator && p.Port === current)) {
    manualPortMode.value = true;
  }
});

function flash(statusClass, ok) {
  statusClass.value = ok ? 'glow-green' : 'glow-red';
  setTimeout(() => {
    statusClass.value = '';
  }, 2000);
}

async function savePort() {
  // An empty value (a cleared manual field) would leave the driver without a port
  if (!port.value) {
    return;
  }
  try {
    await apiService.profileChangeValue('TelescopeSettings-SerialPort', port.value);
    flash(statusClassPort, true);
  } catch (error) {
    console.error('Error setting the OnStepX serial port:', error);
    flash(statusClassPort, false);
  }
}

async function saveBaudRate() {
  try {
    await apiService.profileChangeValue('TelescopeSettings-SerialBaudRate', baudRate.value);
    flash(statusClassBaudRate, true);
  } catch (error) {
    console.error('Error setting the OnStepX baud rate:', error);
    flash(statusClassBaudRate, false);
  }
}

async function fetchAvailablePorts() {
  try {
    availablePorts.value = await apiService.availableSerialPorts();
  } catch (error) {
    console.error('Error fetching serial ports:', error);
    availablePorts.value = [];
  }
}

onMounted(async () => {
  // store.profileInfo is only refreshed by the polling loop; read the profile fresh
  await store.fetchProfilInfos();
  const settings = store.profileInfo?.TelescopeSettings;
  port.value = settings?.SerialPort ?? '';
  // a pins build without SerialBaudRate connects at 9600
  baudRate.value = settings?.SerialBaudRate ?? DEFAULT_BAUD_RATE;
  fetchAvailablePorts();
});
</script>
