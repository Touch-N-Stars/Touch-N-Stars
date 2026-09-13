<template>
  <div
    :class="borderClass"
    class="flex flex-col sm:flex-row border p-2 rounded-lg h-full gap-2 sm:items-center transition-all duration-300"
  >
    <label class="text-sm sm:w-36 shrink-0" for="deviceSelect">{{ deviceName }}:</label>
    <div class="flex flex-col gap-1 w-full">
      <div class="flex gap-2 items-center w-full">
        <select
          id="deviceSelect"
          class="w-full tns-select min-w-0"
          v-model="selectedDevice"
          :disabled="isConnected"
          @change="onDeviceSelected"
        >
          <!-- Placeholder for a selection that is not (yet) in the fetched list, e.g. while
             the list is still empty after a backend restart. Hidden once the list contains
             it, otherwise the device would show up twice. -->
          <option v-if="!isSelectedDeviceInList" disabled>{{ selectedDevice }}</option>
          <option
            v-for="device in displayDevices"
            :key="device.DisplayName"
            :value="String(device.DisplayName)"
          >
            {{ device.displayLabel }}
          </option>
        </select>
        <div class="flex shrink-0 gap-1">
          <button
            v-if="store.isPINS"
            @click="configDevice"
            :disabled="
              isScanning ||
              isConnected ||
              (!props.alwaysEnableConfig &&
                !(selectedDeviceObj && selectedDeviceObj.HasSetupDialog))
            "
            class="flex justify-center items-center w-10 h-10 border border-cyan-500/20 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-70"
          >
            <Cog6ToothIcon
              class="w-6 h-6"
              :class="{
                'text-gray-400':
                  isScanning ||
                  isConnected ||
                  (!props.alwaysEnableConfig &&
                    !(selectedDeviceObj && selectedDeviceObj.HasSetupDialog)),
              }"
            />
          </button>
          <button
            @click="rescanDevices"
            :disabled="isScanning || isConnected"
            class="flex justify-center items-center w-10 h-10 border border-cyan-500/20 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-70"
          >
            <ArrowPathIcon
              class="w-6 h-6"
              :class="{ 'text-green-500 spin': isScanning, 'text-white': !isScanning }"
            />
          </button>
          <button
            @click="
              isToggleCon && store.isPINS
                ? cancelConnect()
                : disableConnect && disableConnectMessage
                  ? openDisableInfo()
                  : toggleConnection()
            "
            :disabled="isToggleCon && !store.isPINS"
            class="flex justify-center items-center w-10 h-10 border border-cyan-500/20 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-30"
          >
            <XCircleIcon v-if="isToggleCon && store.isPINS" class="w-6 h-6 text-yellow-500" />
            <InformationCircleIcon
              v-else-if="disableConnect && disableConnectMessage"
              class="w-6 h-6 text-yellow-500"
            />
            <LinkIcon v-else-if="!isConnected" class="w-6 h-6" />
            <LinkSlashIcon v-else class="w-6 h-6 text-red-600" />
          </button>
        </div>
      </div>
      <span v-if="isReloadingDriver" class="text-xs text-content-faint">
        {{ $t('components.selectDevices.reloadingDriver') }}
      </span>
    </div>

    <!-- Disable Info Modal -->
    <div
      v-if="showDisableModal"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      @click.self="showDisableModal = false"
    >
      <div class="bg-gray-800 text-white p-4 m-8 rounded-lg max-w-xl">
        <div class="flex justify-end">
          <button @click="showDisableModal = false" class="text-white hover:text-gray-300">
            <XMarkIcon class="w-6 h-6" />
          </button>
        </div>
        <h2 class="text-xl font-bold mb-4">Info</h2>
        <p>{{ disableConnectMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import apiService from '@/services/apiService';
import {
  ArrowPathIcon,
  LinkIcon,
  LinkSlashIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
  XMarkIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline';
import { useEquipmentStore } from '@/store/equipmentStore';
import { useI18n } from 'vue-i18n';
import { checkMountConnectionPermission } from '@/utils/locationSyncUtils';
import {
  isOfflineDevice,
  redirectManualFilterWheel,
  reloadIndiDriver,
  resolveReloadedDevice,
  setProfileDevice,
} from '@/utils/equipmentDevices';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';

const equipmentStore = useEquipmentStore();
const store = apiStore();
const { t } = useI18n();

const props = defineProps({
  apiAction: { type: String, required: true },
  defaultDeviceId: { type: String, default: '?' },
  deviceName: { type: String, default: 'Gerät' },
  isConnected: { type: Boolean, required: true },
  disableConnect: { type: Boolean, default: false },
  disableConnectMessage: { type: String, default: '' },
  alwaysEnableConfig: { type: Boolean, default: false },
});

const devices = ref([]);
const selectedDevice = ref('');
const error = ref(false);
const isScanning = ref(false);
const isToggleCon = ref(false);
const isReloadingDriver = ref(false);
const borderClass = ref('border-gray-500');
const showDisableModal = ref(false);

// After a backend restart App.vue remounts this page in the very tick isBackendReachable
// flips to true, while PINS is still enumerating drivers. When the fast retry budget in
// getDevices() is not enough, keep refetching in the background until a non-empty list
// arrives instead of leaving the select empty until the user navigates away and back.
const EMPTY_RETRY_DELAY_MS = 10000;
let emptyRetryTimer = null;
// Several triggers can overlap (mount, reloadTrigger, reachability watcher, background
// timer, rescan button); an older chain must not overwrite a newer list.
let fetchGeneration = 0;

function cancelEmptyRetry() {
  if (emptyRetryTimer) {
    clearTimeout(emptyRetryTimer);
    emptyRetryTimer = null;
  }
}

function scheduleEmptyRetry() {
  cancelEmptyRetry();
  emptyRetryTimer = setTimeout(() => {
    emptyRetryTimer = null;
    // Do not fire into a dead backend; the reachability watcher refetches as soon as it
    // comes back.
    if (!store.isBackendReachable) {
      scheduleEmptyRetry();
      return;
    }
    getDevices();
  }, EMPTY_RETRY_DELAY_MS);
}

function openDisableInfo() {
  showDisableModal.value = true;
}

const selectedDeviceObj = computed(() =>
  devices.value.find((d) => d.DisplayName === selectedDevice.value)
);

const displayDevices = computed(() => {
  if (props.apiAction !== 'focusAction') {
    return devices.value.map((d) => ({ ...d, displayLabel: d.DisplayName }));
  }
  return devices.value.map((d) => ({
    ...d,
    displayLabel:
      d.DisplayName === 'MyFocuserPro2 (INDI)' ? 'Gemini / MyFocuserPro2' : d.DisplayName,
  }));
});

// Compared against the rendered option values, not the raw device objects.
const isSelectedDeviceInList = computed(() =>
  displayDevices.value.some((d) => String(d.DisplayName) === selectedDevice.value)
);

// API call with a dynamic `apiAction`, retrying while the backend is still starting up.
async function getDevices(maxRetries = 3, delayMs = 2000) {
  if (!props.apiAction) {
    console.error('apiAction is not defined');
    return;
  }

  const apiName = props.apiAction.replace('Action', '');
  const generation = ++fetchGeneration;
  const isStale = () => generation !== fetchGeneration;

  cancelEmptyRetry();

  // On a cold start this component mounts before the port handshake in the store has
  // finished. Firing now would only produce ':null/v2/api/...' URLs and burn the first of
  // the three fast retries; the apiPort watcher refetches as soon as the port is known.
  if (!store.apiPort) {
    scheduleEmptyRetry();
    return;
  }

  error.value = false;
  isScanning.value = true;

  try {
    for (let retryCount = 0; ; retryCount++) {
      let reason = null;
      let isEmptyResult = false;

      try {
        if (!apiService[props.apiAction]) {
          throw new Error(`Invalid API method: ${props.apiAction}`);
        }
        const response = await apiService[props.apiAction]('list-devices');
        if (isStale()) return;

        if (response.Error) {
          reason = `API Error: ${response.Error}`;
        } else if (!Array.isArray(response.Response)) {
          reason = `Faulty API response: ${JSON.stringify(response)}`;
        } else if (response.Response.length === 0) {
          // An empty array can mean the backend has not finished scanning yet.
          devices.value = response.Response;
          reason = 'Empty device list';
          isEmptyResult = true;
        } else {
          devices.value = response.Response;
          updateBorderClass();
          return;
        }
      } catch (err) {
        if (isStale()) return;
        reason = `Error: ${err.message}`;
      }

      // Retry: the backend may not be fully initialized yet.
      if (retryCount < maxRetries) {
        console.warn(
          `[${apiName}] ${reason}, retrying in ${delayMs}ms... (${retryCount + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (isStale()) return;
        continue;
      }

      // Fast budget exhausted: keep retrying in the background instead of leaving the
      // list permanently empty.
      console.warn(`[${apiName}] ${reason}, retrying in ${EMPTY_RETRY_DELAY_MS}ms...`);
      error.value = !isEmptyResult;
      updateBorderClass();
      scheduleEmptyRetry();
      return;
    }
  } finally {
    if (!isStale()) {
      isScanning.value = false;
    }
  }
}

const emit = defineEmits(['openConfig', 'deviceSelected']);

async function configDevice() {
  emit('openConfig', {
    deviceName: props.deviceName,
    apiAction: props.apiAction,
    selectedDeviceDisplayName: selectedDevice.value,
    selectedDeviceObj: selectedDeviceObj.value,
  });
}

async function rescanDevices() {
  if (!props.apiAction) {
    console.error('apiAction is not defined');
    return;
  }

  const generation = ++fetchGeneration;
  const isStale = () => generation !== fetchGeneration;

  cancelEmptyRetry();
  error.value = false;
  console.log('scan');
  isScanning.value = true;
  try {
    if (!apiService[props.apiAction]) {
      throw new Error(`Invalid API method: ${props.apiAction}`);
    }
    const response = await apiService[props.apiAction]('rescan');
    console.log(response);
    if (isStale()) return;

    if (response.Error) {
      error.value = true;
      console.error('API Error:', response.Error);
      // A rescan right after a restart can hit a backend that is still starting up.
      scheduleEmptyRetry();
      return;
    }

    if (Array.isArray(response.Response)) {
      devices.value = response.Response;
      if (response.Response.length === 0) {
        scheduleEmptyRetry();
      }
    } else {
      error.value = true;
      console.error('Faulty API response:', response);
      scheduleEmptyRetry();
    }
  } catch (err) {
    if (isStale()) return;
    error.value = true;
    console.error('Error:', err);
    scheduleEmptyRetry();
  } finally {
    if (!isStale()) {
      isScanning.value = false;
      updateBorderClass();
    }
  }
}

async function toggleConnection() {
  error.value = false;
  isToggleCon.value = true;

  // Not const: an OFFLINE device resolves to a different Id after its driver was reloaded.
  let deviceId = getDeviceId(selectedDevice.value);
  console.log('props.apiAction', props.apiAction);

  try {
    if (props.isConnected) {
      console.log('disconnect');
      const response = await apiService[props.apiAction]('disconnect');
      if (deviceId == 'PHD2_Single') {
        try {
          await apiService.setPHD2StopGuiding();
        } catch (_) {
          /* not guiding */
        }
        await apiService.disconnectPHD2Equipment();
        await apiService.disconnectPHD2();
      }
      console.log('response', response);
    } else {
      // Prüfung vor dem Verbinden der Montierung
      if (props.apiAction === 'mountAction') {
        const canConnect = await checkMountConnectionPermission(t);
        if (!canConnect) {
          // Benutzer hat abgebrochen
          return;
        }
      }
      // The INDI manual wheel never shows the filter change prompt (see equipmentDevices.js),
      // so a selection of it is swapped for NINA's built-in manual wheel before connecting.
      if (props.apiAction === 'filterAction') {
        try {
          const redirected = await redirectManualFilterWheel(selectedDeviceObj.value);
          if (redirected) {
            await getDevices();
            deviceId = redirected;
            const entry = devices.value.find((d) => String(d.Id) === redirected);
            if (entry) selectedDevice.value = entry.DisplayName;
          }
        } catch (err) {
          // Fall through to the connect attempt; its error handling reports the failure.
          console.warn('[selectDevices] manual filter wheel redirect failed:', err);
        }
      }
      // A device PINS reports as OFFLINE can never be connected: its INDI driver was started
      // before the hardware had power (typically a power box port) and therefore never saw
      // it. Restarting the driver is what makes it appear — until now users had to do that
      // by hand in the INDI setup dialog.
      if (isOfflineDevice(selectedDeviceObj.value)) {
        // Hold on to the placeholder: selectedDeviceObj is a computed over devices and
        // changes as soon as the list is refetched below.
        const offlineEntry = selectedDeviceObj.value;
        isReloadingDriver.value = true;
        try {
          if (await reloadIndiDriver(props.apiAction)) {
            await getDevices();
            const resolved = resolveReloadedDevice(offlineEntry, devices.value);
            if (!resolved) {
              // Connecting with the placeholder's Id would just reproduce the original
              // failure, so stop here and say why.
              useToastStore().showToast({
                type: 'error',
                title: t('components.selectDevices.deviceNotFound'),
                message: t('components.selectDevices.deviceNotFoundMessage', {
                  device: offlineEntry.DisplayName,
                }),
              });
              error.value = true;
              return;
            }
            selectedDevice.value = resolved.DisplayName;
            if (String(resolved.Id) !== deviceId) {
              // The restarted driver derives the Id from the INDI device name, so it can
              // differ from what the profile stored. Write it back, otherwise connectAll -
              // which connects without ?to= - would keep using the dead Id.
              deviceId = String(resolved.Id);
              await setProfileDevice(props.apiAction, deviceId);
            }
          }
        } catch (err) {
          // Fall through to the connect attempt; its error handling reports the failure.
          console.warn('[selectDevices] INDI driver reload failed:', err);
        } finally {
          isReloadingDriver.value = false;
        }
      }

      console.log('connect to', selectedDevice.value, 'ID:', deviceId);
      const response = await apiService[props.apiAction](
        'connect?to=' + encodeURIComponent(deviceId)
      );
      console.log('response', response);
      if (deviceId == 'PHD2_Single') {
        await apiService.connectPHD2();
      }

      if (!response.Success) {
        throw new Error(response.Error || 'Unbekannter Verbindungsfehler');
      }
    }
  } catch (err) {
    error.value = true;
    console.error('Error connect device: ', err);
  } finally {
    isToggleCon.value = false;
    updateBorderClass();
  }
}

async function cancelConnect() {
  const cancelAction = props.apiAction.replace('Action', 'CancelConnect');
  try {
    if (!apiService[cancelAction]) {
      throw new Error(`Invalid API method: ${cancelAction}`);
    }
    await apiService[cancelAction]();
  } catch (err) {
    console.error('Error cancelling connect: ', err);
  }
}

function updateBorderClass() {
  if (error.value) {
    borderClass.value = 'border-red-500 error-glow';
  } else if (props.isConnected) {
    borderClass.value = 'border-green-500 connected-glow';
  } else {
    borderClass.value = 'border-gray-500';
  }
}

function getDeviceName(deviceId) {
  const device = devices.value.find((d) => String(d.Id) === String(deviceId));
  return device ? device.DisplayName : '';
}

function getDeviceId(deviceName) {
  const device = devices.value.find((d) => d.DisplayName === deviceName);
  return device ? String(device.Id) : '';
}

// Bound to the select's change event rather than a watcher on selectedDevice: that watcher
// also fires for the programmatic resets from the profile and would write them straight
// back. Without persisting here the pick would only live in this component and the next
// device list refresh would overwrite it — which is what made 'No device' unselectable.
async function onDeviceSelected() {
  const deviceId = getDeviceId(selectedDevice.value);
  if (!deviceId) return;

  error.value = false;
  try {
    await setProfileDevice(props.apiAction, deviceId);
  } catch (err) {
    error.value = true;
    console.error('Error selecting device: ', err);
  } finally {
    updateBorderClass();
  }
}

watch(
  () => props.isConnected,
  () => {
    console.log('isConnected', props.deviceName);
    isToggleCon.value = false;
    updateBorderClass();
  }
);
watch([() => props.defaultDeviceId, devices], ([newDeviceId]) => {
  if (!newDeviceId || newDeviceId === '?') return;
  const name = getDeviceName(newDeviceId);
  if (name) {
    selectedDevice.value = name;
    updateBorderClass();
  }
});
watch(selectedDevice, (newValue) => {
  emit('deviceSelected', newValue);
});

watch(
  () => equipmentStore.rescanTrigger[props.apiAction.replace('Action', '')],
  (newValue, oldValue) => {
    if (newValue > 0 && newValue !== oldValue) {
      rescanDevices();
    }
  }
);
watch(
  () => equipmentStore.reloadTrigger,
  async (newValue, oldValue) => {
    if (newValue > 0 && newValue !== oldValue) {
      await getDevices();
      // Keep the current selection when the reload came back empty; the devices watcher
      // resolves it once a background retry delivers the list.
      const name = getDeviceName(props.defaultDeviceId);
      if (name) {
        selectedDevice.value = name;
      }
      updateBorderClass();
    }
  }
);

// A short outage does not always unmount this page (the reconnect overlay is debounced and
// skipped on /settings), so the list would stay stale without this.
watch(
  () => store.isBackendReachable,
  (reachable) => {
    if (reachable) {
      getDevices();
    }
  }
);

// The port handshake usually completes in well under a second, so waiting for the 10s
// background retry after a skipped cold-start fetch would be needlessly slow.
watch(
  () => store.apiPort,
  (port) => {
    if (port) {
      getDevices();
    }
  }
);

onMounted(async () => {
  await getDevices();
  selectedDevice.value = props.defaultDeviceId;
  selectedDevice.value = getDeviceName(selectedDevice.value);
  updateBorderClass();
});

onBeforeUnmount(() => {
  // Invalidate any in-flight retry chain so it stops firing requests after unmount.
  fetchGeneration++;
  cancelEmptyRetry();
});
</script>

<style scoped>
@keyframes error-glow {
  0% {
    box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 0, 0, 0.8);
  }
  100% {
    box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
  }
}

.error-glow {
  animation: error-glow 1.5s infinite alternate;
}

.warning-glow {
  box-shadow: 0 0 6px rgba(245, 91, 2, 0.925);
}
.connected-glow {
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
