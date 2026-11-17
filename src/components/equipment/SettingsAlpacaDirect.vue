<template>
  <div class="flex flex-col gap-3">
    <div class="tns-card flex flex-col gap-2">
      <h4 class="tns-section-title">
        {{ $t('components.alpacaDirect.title') }}
      </h4>

      <p v-if="isSharedGuid" class="text-xs text-status-warn">
        {{ $t('components.alpacaDirect.sharedGuidWarning') }}
      </p>

      <p class="text-xs text-content-muted">
        {{ $t('components.alpacaDirect.noReconnectHint') }}
      </p>

      <!-- One fieldset locks every field while the settings load; the number pickers have no
           disabled prop of their own. -->
      <fieldset :disabled="isLoading" class="flex flex-col gap-2 min-w-0 mt-2">
        <div class="flex flex-row items-center justify-between w-full">
          <label for="adIpAddress" class="text-xs md:text-sm text-content mr-2 shrink-0">
            {{ $t('components.alpacaDirect.ipAddress') }}
          </label>
          <input
            id="adIpAddress"
            v-model="ipAddress"
            type="text"
            class="tns-input text-xs md:text-sm w-48"
          />
        </div>

        <NumberInputPicker
          v-model="port"
          :label="$t('components.alpacaDirect.port')"
          labelKey="components.alpacaDirect.port"
          :min="1"
          :max="65535"
          :step="1"
          :decimalPlaces="0"
          :useDefaultSentinel="false"
          inputId="adPort"
        />

        <NumberInputPicker
          v-model="deviceNumber"
          :label="$t('components.alpacaDirect.deviceNumber')"
          labelKey="components.alpacaDirect.deviceNumber"
          :min="0"
          :max="99"
          :step="1"
          :decimalPlaces="0"
          :useDefaultSentinel="false"
          inputId="adDeviceNumber"
        />

        <div class="flex flex-row items-center justify-between w-full">
          <label for="adServiceType" class="text-xs md:text-sm text-content mr-2 shrink-0">
            {{ $t('components.alpacaDirect.serviceType') }}
          </label>
          <select
            id="adServiceType"
            v-model="serviceType"
            class="tns-select text-xs md:text-sm w-48"
          >
            <option value="Http">Http</option>
            <option value="Https">Https</option>
          </select>
        </div>
      </fieldset>

      <p v-if="errorMessage" class="text-xs text-status-danger mt-1">{{ errorMessage }}</p>

      <div class="flex justify-end gap-2 mt-2">
        <button
          v-if="!isConnected"
          class="tns-btn-primary px-4 text-xs md:text-sm"
          :class="statusClassConnect"
          :disabled="isLoading || isSaving || isConnecting || !canConnect"
          @click="connect"
        >
          {{ $t('components.alpacaDirect.connect') }}
        </button>
        <button
          v-else
          class="tns-btn-danger px-4 text-xs md:text-sm"
          :class="statusClassConnect"
          :disabled="isConnecting"
          @click="disconnect"
        >
          {{ $t('components.alpacaDirect.disconnect') }}
        </button>
        <button
          class="tns-btn-secondary px-4 text-xs md:text-sm"
          :class="statusClassSave"
          :disabled="isLoading || isSaving"
          @click="save"
        >
          {{ $t('components.alpacaDirect.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { apiStore } from '@/store/store';

const props = defineProps({
  deviceType: { type: String, required: true },
  selectedDevice: { type: String, default: '' },
  deviceId: { type: String, default: '' },
});

const store = apiStore();

const DEVICE_TYPE_TO_API_ACTION = {
  camera: 'cameraAction',
  guidecamera: 'guideCameraAction',
  telescope: 'mountAction',
  focuser: 'focusAction',
  filterwheel: 'filterAction',
  dome: 'domeAction',
  rotator: 'rotatorAction',
  safetymonitor: 'safetyAction',
  switch: 'switchAction',
  flatdevice: 'flatdeviceAction',
  weather: 'weatherAction',
};

const DEVICE_TYPE_TO_INFO_KEY = {
  camera: 'cameraInfo',
  guidecamera: 'guideCameraInfo',
  telescope: 'mountInfo',
  focuser: 'focuserInfo',
  filterwheel: 'filterInfo',
  dome: 'domeInfo',
  rotator: 'rotatorInfo',
  safetymonitor: 'safetyInfo',
  switch: 'switchInfo',
  flatdevice: 'flatdeviceInfo',
  weather: 'weatherInfo',
};

const ipAddress = ref('127.0.0.1');
const port = ref(11111);
const deviceNumber = ref(0);
const serviceType = ref('Http');

const isLoading = ref(false);
const isSaving = ref(false);
const isConnecting = ref(false);
const errorMessage = ref('');
const statusClassSave = ref('');
const statusClassConnect = ref('');

const isSharedGuid = computed(
  () => props.deviceType === 'rotator' || props.deviceType === 'safetymonitor'
);

const apiActionName = computed(() => DEVICE_TYPE_TO_API_ACTION[props.deviceType] || null);
const infoKey = computed(() => DEVICE_TYPE_TO_INFO_KEY[props.deviceType] || null);
const isConnected = computed(() => !!(infoKey.value && store[infoKey.value]?.Connected));
const canConnect = computed(() => !!props.deviceId && !!apiActionName.value);

function applyGlowFeedback(statusRef, success) {
  statusRef.value = success ? 'glow-green' : 'glow-red';
  setTimeout(() => {
    statusRef.value = '';
  }, 2000);
}

async function loadSettings() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await apiService.getAlpacaDirectSettings(props.deviceType);
    const data = response?.Response;
    if (response?.Success && data) {
      ipAddress.value = data.IpAddress ?? '127.0.0.1';
      port.value = data.Port ?? 5000;
      deviceNumber.value = data.DeviceNumber ?? 0;
      serviceType.value = data.ServiceType ?? 'Http';
    } else if (response?.Error) {
      errorMessage.value = response.Error;
    }
  } catch (err) {
    errorMessage.value = err?.response?.data?.Error || err?.message || 'Unknown error';
  } finally {
    isLoading.value = false;
  }
}

async function persistSettings() {
  const response = await apiService.setAlpacaDirectSettings(props.deviceType, {
    IpAddress: ipAddress.value.replace(/\s/g, ''),
    Port: port.value,
    DeviceNumber: deviceNumber.value,
    ServiceType: serviceType.value,
  });
  if (response?.Success) {
    const data = response.Response;
    if (data) {
      ipAddress.value = data.IpAddress ?? ipAddress.value;
      port.value = data.Port ?? port.value;
      deviceNumber.value = data.DeviceNumber ?? deviceNumber.value;
      serviceType.value = data.ServiceType ?? serviceType.value;
    }
    return true;
  }
  errorMessage.value = response?.Error || 'Failed to save settings.';
  return false;
}

async function save() {
  isSaving.value = true;
  errorMessage.value = '';
  try {
    const ok = await persistSettings();
    applyGlowFeedback(statusClassSave, ok);
  } catch (err) {
    errorMessage.value = err?.response?.data?.Error || err?.message || 'Unknown error';
    applyGlowFeedback(statusClassSave, false);
  } finally {
    isSaving.value = false;
  }
}

async function connect() {
  if (!canConnect.value) return;
  isConnecting.value = true;
  errorMessage.value = '';
  try {
    const saved = await persistSettings();
    if (!saved) {
      applyGlowFeedback(statusClassConnect, false);
      return;
    }
    const encodedId = encodeURIComponent(props.deviceId);
    const response = await apiService[apiActionName.value](`connect?to=${encodedId}`);
    if (response?.Success) {
      applyGlowFeedback(statusClassConnect, true);
    } else {
      errorMessage.value = response?.Error || 'Connect failed.';
      applyGlowFeedback(statusClassConnect, false);
    }
  } catch (err) {
    errorMessage.value = err?.response?.data?.Error || err?.message || 'Unknown error';
    applyGlowFeedback(statusClassConnect, false);
  } finally {
    isConnecting.value = false;
  }
}

async function disconnect() {
  if (!apiActionName.value) return;
  isConnecting.value = true;
  errorMessage.value = '';
  try {
    const response = await apiService[apiActionName.value]('disconnect');
    if (response?.Success) {
      applyGlowFeedback(statusClassConnect, true);
    } else {
      errorMessage.value = response?.Error || 'Disconnect failed.';
      applyGlowFeedback(statusClassConnect, false);
    }
  } catch (err) {
    errorMessage.value = err?.response?.data?.Error || err?.message || 'Unknown error';
    applyGlowFeedback(statusClassConnect, false);
  } finally {
    isConnecting.value = false;
  }
}

watch(
  () => props.deviceType,
  () => {
    loadSettings();
  }
);

onMounted(() => {
  loadSettings();
});
</script>
