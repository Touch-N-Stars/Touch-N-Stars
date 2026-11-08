<template>
  <div v-if="isEquipmentSelected" class="tns-card flex flex-col">
    <!-- Connection Mode -->
    <div class="flex flex-row items-center justify-between w-full">
      <label for="connectionMode" class="text-xs md:text-sm text-content mr-2">
        {{ $t('indi.config.connectionMode') }}
      </label>
      <select
        id="connectionMode"
        v-model="connectionMode"
        @change="setConnectionMode"
        class="tns-select text-xs md:text-sm w-48"
        :class="statusClassConnectionMode"
      >
        <option value="CONNECTION_SERIAL">{{ $t('indi.config.serial') }}</option>
        <option value="CONNECTION_TCP">{{ $t('indi.config.network') }}</option>
        <option value="CONNECTION_HTTP">{{ $t('indi.config.http') }}</option>
      </select>
    </div>

    <!-- SERIAL Connection Settings -->
    <div v-if="connectionMode === 'CONNECTION_SERIAL'">
      <!-- Auto Detect Checkbox -->
      <div class="flex flex-row items-center justify-between w-full mt-2 md:mt-3">
        <label for="autoDetect" class="text-xs md:text-sm text-content mr-2">
          {{ $t('indi.config.autoDetect') }}
        </label>
        <input
          id="autoDetect"
          v-model="autoDetect"
          @change="setAutoDetect"
          type="checkbox"
          class="h-4 w-4 cursor-pointer"
        />
      </div>

      <!-- Device Port (Serial) -->
      <div class="flex flex-row items-center justify-between w-full mt-2 md:mt-3">
        <label for="devicePort" class="text-xs md:text-sm text-content mr-2">
          {{ $t('indi.config.devicePort') }}
        </label>
        <select
          id="devicePort"
          v-model="selectedPort"
          class="tns-select text-xs md:text-sm w-48"
          :class="statusClassDevicePort"
          :disabled="autoDetect"
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

      <!-- Device Port (Manual entry, e.g. udev symlink) -->
      <div
        v-if="manualPortMode"
        class="flex flex-row items-center justify-between w-full mt-2 md:mt-3"
      >
        <label for="manualPort" class="text-xs md:text-sm text-content mr-2">
          {{ $t('indi.config.manualPortPath') }}
        </label>
        <input
          id="manualPort"
          v-model.trim="devicePort"
          @change="setDevicePort"
          type="text"
          class="tns-input text-xs md:text-sm w-48"
          :class="statusClassDevicePort"
          :disabled="autoDetect"
          placeholder="/dev/guidefocus"
        />
      </div>

      <!-- Baud Rate -->
      <div class="flex flex-row items-center justify-between w-full mt-2 md:mt-3">
        <label for="baudRate" class="text-xs md:text-sm text-content mr-2">
          {{ $t('indi.config.baudRate') }}
        </label>
        <select
          id="baudRate"
          v-model.number="baudRate"
          @change="setBaudRate"
          class="tns-select text-xs md:text-sm w-48"
          :class="statusClassBaudRate"
          :disabled="autoDetect"
        >
          <option :value="9600">9600</option>
          <option :value="19200">19200</option>
          <option :value="38400">38400</option>
          <option :value="57600">57600</option>
          <option :value="115200">115200</option>
        </select>
      </div>
    </div>

    <!-- TCP Connection Settings -->
    <div v-if="connectionMode === 'CONNECTION_TCP'">
      <!-- IP Address -->
      <div class="flex flex-row items-center justify-between w-full mt-2 md:mt-3">
        <label for="ipAddress" class="text-xs md:text-sm text-content mr-2">
          {{ $t('indi.config.ipAddress') }}
        </label>
        <input
          id="ipAddress"
          v-model="ipAddress"
          @change="setIPAddress"
          type="text"
          class="tns-input text-xs md:text-sm w-48"
          :class="statusClassIPAddress"
          placeholder="localhost"
        />
      </div>

      <!-- TCP Port -->
      <div class="flex flex-row items-center justify-between w-full mt-2 md:mt-3">
        <label for="tcpPort" class="text-xs md:text-sm text-content mr-2">
          {{ $t('indi.config.tcpPort') }}
        </label>
        <input
          id="tcpPort"
          v-model="tcpPort"
          @change="setTCPPort"
          type="text"
          class="tns-input text-xs md:text-sm w-48"
          :class="statusClassTCPPort"
          placeholder="3492"
        />
      </div>
    </div>

    <!-- HTTP Connection Settings (e.g. Starbook Ten) -->
    <div v-if="connectionMode === 'CONNECTION_HTTP'">
      <!-- IP Address -->
      <div class="flex flex-row items-center justify-between w-full mt-2 md:mt-3">
        <label for="httpAddress" class="text-xs md:text-sm text-content mr-2">
          {{ $t('indi.config.ipAddress') }}
        </label>
        <input
          id="httpAddress"
          v-model="ipAddress"
          @change="setIPAddress"
          type="text"
          class="tns-input text-xs md:text-sm w-48"
          :class="statusClassIPAddress"
          placeholder="192.168.0.1"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';

const props = defineProps({
  equipmentType: { type: String, required: true }, // 'mount', 'focuser', 'rotator', 'flatdevice'
  selectedDevice: { type: String, default: '' },
});

const store = apiStore();

// Map equipment type to store info
const equipmentInfoMap = {
  mount: () => store.mountInfo,
  focuser: () => store.focuserInfo,
  rotator: () => store.rotatorInfo,
  flatdevice: () => store.flatdeviceInfo,
  weather: () => store.weatherInfo,
  filterwheel: () => store.filterInfo,
  switch: () => store.switchInfo,
  dome: () => store.domeInfo,
  safety: () => store.safetyInfo,
};

// Map equipment type to settings key in profileInfo
const settingsKeyMap = {
  mount: 'TelescopeSettings',
  focuser: 'FocuserSettings',
  rotator: 'RotatorSettings',
  flatdevice: 'FlatDeviceSettings',
  weather: 'WeatherDataSettings',
  filterwheel: 'FilterWheelSettings',
  switch: 'SwitchSettings',
  dome: 'DomeSettings',
  safety: 'SafetyMonitorSettings',
};

// Map equipment type to setting property prefixes
const settingsPrefixMap = {
  mount: {
    connection: 'IndiConnectionMode',
    port: 'IndiPort',
    baud: 'IndiBaudRate',
    address: 'IndiAddress',
    autoDetect: 'IndiAutoSearch',
  },
  focuser: {
    connection: 'IndiConnectionMode',
    port: 'IndiPort',
    baud: 'IndiBaudRate',
    address: 'IndiAddress',
    autoDetect: 'IndiAutoSearch',
  },
  rotator: {
    connection: 'IndiConnectionMode',
    port: 'IndiPort',
    baud: 'IndiBaudRate',
    address: 'IndiAddress',
    autoDetect: 'IndiAutoSearch',
  },
  flatdevice: {
    connection: 'IndiConnectionMode',
    port: 'IndiPort',
    baud: 'IndiBaudRate',
    address: 'IndiAddress',
    autoDetect: 'IndiAutoSearch',
  },
  weather: {
    connection: 'IndiConnectionMode',
    port: 'IndiPort',
    baud: 'IndiBaudRate',
    address: 'IndiAddress',
    autoDetect: 'IndiAutoSearch',
  },
  filterwheel: {
    connection: 'IndiConnectionMode',
    port: 'IndiPort',
    baud: 'IndiBaudRate',
    address: 'IndiAddress',
    autoDetect: 'IndiAutoSearch',
  },
  switch: {
    connection: 'IndiConnectionMode',
    port: 'IndiPort',
    baud: 'IndiBaudRate',
    address: 'IndiAddress',
    autoDetect: 'IndiAutoSearch',
  },
  dome: {
    connection: 'IndiConnectionMode',
    port: 'IndiPort',
    baud: 'IndiBaudRate',
    address: 'IndiAddress',
    autoDetect: 'IndiAutoSearch',
  },
  safety: {
    connection: 'IndiConnectionMode',
    port: 'IndiPort',
    baud: 'IndiBaudRate',
    address: 'IndiAddress',
    autoDetect: 'IndiAutoSearch',
  },
};

const isEquipmentSelected = computed(() => {
  const deviceName = props.selectedDevice.toLowerCase();
  const equipInfo = equipmentInfoMap[props.equipmentType]?.();
  const driverInfo = equipInfo?.DriverInfo?.toLowerCase() || '';
  const category = equipInfo?.Category?.toLowerCase() || '';
  return deviceName.includes('indi') || driverInfo.includes('indi') || category.includes('indi');
});

const connectionMode = ref('CONNECTION_SERIAL');
const devicePort = ref('/dev/ttyUSB0');
const baudRate = ref(9600);
const ipAddress = ref('localhost');
const tcpPort = ref('3492');
const autoDetect = ref(false);
const availablePorts = ref([]);

const MANUAL_PORT = '__manual__';
const manualPortMode = ref(false); // true = Dropdown steht auf "Manuell", Textfeld sichtbar

// The dropdown's selected value is decoupled from the real port value (devicePort).
// In manual mode it reports the sentinel MANUAL_PORT so the "Manual…" option stays
// selected, while devicePort always keeps the actual path (e.g. /dev/guidefocus).
const selectedPort = computed({
  get() {
    return manualPortMode.value ? MANUAL_PORT : devicePort.value;
  },
  set(val) {
    if (val === MANUAL_PORT) {
      manualPortMode.value = true;
      return;
    }
    manualPortMode.value = false;
    devicePort.value = val;
    setDevicePort();
  },
});

const statusClassConnectionMode = ref('');
const statusClassDevicePort = ref('');
const statusClassBaudRate = ref('');
const statusClassIPAddress = ref('');
const statusClassTCPPort = ref('');

const initializeSettings = () => {
  const settingsKey = settingsKeyMap[props.equipmentType];
  const settings = store.profileInfo?.[settingsKey];

  if (!settings) {
    console.warn(`${settingsKey} not loaded`);
    return;
  }

  const prefix = settingsPrefixMap[props.equipmentType];

  if (prefix.connection) {
    connectionMode.value = settings[prefix.connection] ?? 'CONNECTION_SERIAL';
  }
  if (prefix.address) {
    ipAddress.value = settings[prefix.address] ?? 'localhost';
  }
  if (prefix.baud) {
    baudRate.value = settings[prefix.baud] ?? 9600;
  }
  if (prefix.autoDetect) {
    autoDetect.value = settings[prefix.autoDetect] ?? false;
  }

  // IndiPort is shared between serial and TCP, so load it into the appropriate field based on connection mode
  if (prefix.port) {
    const portValue = settings[prefix.port] ?? '3492';
    if (connectionMode.value === 'CONNECTION_TCP') {
      tcpPort.value = portValue;
      devicePort.value = '/dev/ttyUSB0';
    } else if (connectionMode.value === 'CONNECTION_HTTP') {
      // HTTP mode has no port; address is stored separately
      devicePort.value = '/dev/ttyUSB0';
      tcpPort.value = '3492';
    } else {
      devicePort.value = portValue;
      tcpPort.value = '3492';
    }
  }

  // Fetch available ports if in serial mode
  if (connectionMode.value === 'CONNECTION_SERIAL') {
    fetchAvailablePorts();
  }
};

async function fetchAvailablePorts() {
  try {
    const ports = await apiService.availableSerialPorts();
    availablePorts.value = ports;
  } catch (error) {
    console.error('Error fetching serial ports:', error);
    availablePorts.value = [];
  }
}

// If the saved port is not among the detected ports, treat it as a manual entry
// (e.g. a udev symlink like /dev/guidefocus) and switch the dropdown to "Manual…".
// devicePort keeps the real path; only manualPortMode flips so the text field shows.
watch([devicePort, availablePorts], ([port, ports]) => {
  if (!port || port === MANUAL_PORT || ports.length === 0) {
    return;
  }
  const isKnownPort = ports.some((p) => !p.separator && p.Port === port);
  if (!isKnownPort) {
    manualPortMode.value = true;
  }
});

async function setConnectionMode() {
  try {
    const prefix = settingsPrefixMap[props.equipmentType];
    await apiService.profileChangeValue(
      `${settingsKeyMap[props.equipmentType]}-${prefix.connection}`,
      connectionMode.value
    );

    // When switching modes, persist the port/address settings that make sense for that mode.
    // Both must be (re-)sent here, not just left to their own field-level @change handlers,
    // otherwise a stale/default address never reaches the backend if the user only touches
    // the dropdown (e.g. INDI reports "Server address is missing or invalid" on first connect).
    if (connectionMode.value === 'CONNECTION_TCP') {
      await Promise.all([
        apiService.profileChangeValue(
          `${settingsKeyMap[props.equipmentType]}-${prefix.port}`,
          tcpPort.value
        ),
        apiService.profileChangeValue(
          `${settingsKeyMap[props.equipmentType]}-${prefix.address}`,
          ipAddress.value
        ),
      ]);
    } else if (connectionMode.value === 'CONNECTION_HTTP') {
      await apiService.profileChangeValue(
        `${settingsKeyMap[props.equipmentType]}-${prefix.address}`,
        ipAddress.value
      );
    } else {
      // Serial: save device port
      await apiService.profileChangeValue(
        `${settingsKeyMap[props.equipmentType]}-${prefix.port}`,
        devicePort.value
      );
    }

    statusClassConnectionMode.value = 'glow-green';

    if (connectionMode.value === 'CONNECTION_SERIAL') {
      fetchAvailablePorts();
    }
  } catch (error) {
    console.error('Error setting connection mode:', error);
    statusClassConnectionMode.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassConnectionMode.value = '';
    }, 2000);
  }
}

async function setDevicePort() {
  // Don't save an empty value (e.g. cleared manual text field). The MANUAL_PORT
  // sentinel never reaches here: selectedPort's setter returns early for it.
  if (!devicePort.value) {
    return;
  }
  try {
    const prefix = settingsPrefixMap[props.equipmentType];
    await apiService.profileChangeValue(
      `${settingsKeyMap[props.equipmentType]}-${prefix.port}`,
      devicePort.value
    );
    statusClassDevicePort.value = 'glow-green';
  } catch (error) {
    console.error('Error setting device port:', error);
    statusClassDevicePort.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassDevicePort.value = '';
    }, 2000);
  }
}

async function setBaudRate() {
  try {
    const prefix = settingsPrefixMap[props.equipmentType];
    await apiService.profileChangeValue(
      `${settingsKeyMap[props.equipmentType]}-${prefix.baud}`,
      baudRate.value
    );
    statusClassBaudRate.value = 'glow-green';
  } catch (error) {
    console.error('Error setting baud rate:', error);
    statusClassBaudRate.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassBaudRate.value = '';
    }, 2000);
  }
}

async function setIPAddress() {
  try {
    const prefix = settingsPrefixMap[props.equipmentType];
    await apiService.profileChangeValue(
      `${settingsKeyMap[props.equipmentType]}-${prefix.address}`,
      ipAddress.value
    );
    statusClassIPAddress.value = 'glow-green';
  } catch (error) {
    console.error('Error setting IP address:', error);
    statusClassIPAddress.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassIPAddress.value = '';
    }, 2000);
  }
}

async function setTCPPort() {
  try {
    // Only save TCP port if we're actually in TCP mode
    if (connectionMode.value !== 'CONNECTION_TCP') {
      console.warn('Cannot set TCP port when not in TCP connection mode');
      return;
    }
    const prefix = settingsPrefixMap[props.equipmentType];
    await apiService.profileChangeValue(
      `${settingsKeyMap[props.equipmentType]}-${prefix.port}`,
      tcpPort.value
    );
    statusClassTCPPort.value = 'glow-green';
  } catch (error) {
    console.error('Error setting TCP port:', error);
    statusClassTCPPort.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassTCPPort.value = '';
    }, 2000);
  }
}

async function setAutoDetect() {
  try {
    const prefix = settingsPrefixMap[props.equipmentType];
    if (!prefix.autoDetect) {
      console.warn('Auto detect not supported for this equipment');
      return;
    }
    await apiService.profileChangeValue(
      `${settingsKeyMap[props.equipmentType]}-${prefix.autoDetect}`,
      autoDetect.value
    );
  } catch (error) {
    console.error('Error setting auto detect:', error);
    autoDetect.value = !autoDetect.value; // revert on error
  }
}

onMounted(async () => {
  // Always fetch the latest profile before populating the form. The global
  // store.profileInfo is only refreshed by the periodic polling loop, so it
  // may be stale right after the user changes the INDI driver selection.
  await store.fetchProfilInfos();
  initializeSettings();
});
</script>
