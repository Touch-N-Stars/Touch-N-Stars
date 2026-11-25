<template>
  <!-- Connect/Disconnect All Buttons -->
  <div class="pb-5 flex gap-2">
    <!-- Connect All Button -->
    <button
      class="tns-btn-primary flex-1"
      @click="connectAll"
      :disabled="isConnecting || allConnected"
    >
      <span>{{ $t('components.connectEquipment.connectAll') }}</span>
      <Spinner v-if="isConnecting" size="sm" />
    </button>

    <!-- Disconnect All Button -->
    <button
      class="tns-btn-danger flex-1"
      @click="disconnectAll"
      :disabled="isDisconnecting || !hasAnyConnection"
    >
      <span>{{ $t('components.connectEquipment.disconnectAll') }}</span>
      <Spinner v-if="isDisconnecting" size="sm" />
    </button>
  </div>
  <!-- End of night: park, close, warm and disconnect on the server (needs a plugin that has it) -->
  <div
    v-if="secureObservatory.supported && (hasAnyConnection || secureObservatory.running)"
    class="-mt-3 pb-5"
  >
    <button
      class="tns-btn-secondary gap-2"
      data-testid="end-night"
      @click="secureObservatory.openDialog()"
    >
      <MoonIcon class="h-5 w-5 shrink-0" />
      <span>{{
        secureObservatory.running
          ? $t('components.secureObservatory.running')
          : $t('components.secureObservatory.open')
      }}</span>
      <Spinner v-if="secureObservatory.running" size="sm" />
    </button>
  </div>
  <div class="flex flex-col gap-2">
    <selectDevices
      apiAction="cameraAction"
      :deviceName="$t('components.connectEquipment.camera.name')"
      :default-device-id="store.profileInfo?.CameraSettings?.Id"
      :isConnected="store.cameraInfo.Connected"
      @open-config="openCameraSettings"
    />

    <selectDevices
      apiAction="mountAction"
      :deviceName="$t('components.connectEquipment.mount.name')"
      :default-device-id="store.profileInfo?.TelescopeSettings?.Id"
      :isConnected="store.mountInfo.Connected"
      :configDeviceIds="['OnStepX']"
      @open-config="openMountSettings"
    />

    <selectDevices
      apiAction="focusAction"
      :deviceName="$t('components.connectEquipment.focuser.name')"
      :default-device-id="store.profileInfo?.FocuserSettings?.Id"
      :isConnected="store.focuserInfo.Connected"
      @open-config="openFocuserSettings"
    />

    <!-- One guide camera row, owned by the chosen guider: the native guider uses PINS' guide
         camera slot (official NINA's profile has no GuideCameraSettings), PHD2 opens the camera
         from its own profile. Showing both would invite picking the same camera twice. -->
    <selectDevices
      v-if="guideCameraSlot"
      apiAction="guideCameraAction"
      :deviceName="$t('components.connectEquipment.guideCamera.name')"
      :default-device-id="store.profileInfo?.GuideCameraSettings?.Id"
      :isConnected="store.guideCameraInfo.Connected"
      @open-config="openGuideCameraSettings"
    />
    <selectGuiderCam
      v-else-if="store.isPINS && !isNativeGuiderChoice"
      :deviceName="$t('components.connectEquipment.guiderCam.name')"
    />

    <selectDevices
      apiAction="guiderAction"
      :deviceName="$t('components.connectEquipment.guider.name')"
      :default-device-id="store.profileInfo?.GuiderSettings?.GuiderName"
      :isConnected="store.guiderInfo.Connected"
      :disableConnect="isGuiderConnectDisabled"
      :disableConnectMessage="guiderDisabledMessage"
      :alwaysEnableConfig="true"
      @device-selected="selectedGuiderDevice = $event"
      @open-config="openGuiderSettings"
    />

    <selectDevices
      apiAction="filterAction"
      :deviceName="$t('components.connectEquipment.filter.name')"
      :default-device-id="store.profileInfo?.FilterWheelSettings?.Id"
      :isConnected="store.filterInfo.Connected"
      @open-config="openFilterSettings"
    />

    <selectDevices
      apiAction="rotatorAction"
      :deviceName="$t('components.connectEquipment.rotator.name')"
      :default-device-id="store.profileInfo?.RotatorSettings?.Id"
      :isConnected="store.rotatorInfo.Connected"
      @open-config="openRotatorSettings"
    />

    <selectDevices
      apiAction="weatherAction"
      :deviceName="$t('components.connectEquipment.weather.name')"
      :default-device-id="store.profileInfo?.WeatherDataSettings?.Id"
      :isConnected="store.weatherInfo.Connected"
      :alwaysEnableConfig="weatherHasApiKeySettings"
      @device-selected="selectedWeatherDeviceName = $event"
      @open-config="openWeatherSettings"
    />

    <selectDevices
      apiAction="safetyAction"
      :deviceName="$t('components.connectEquipment.safety.name')"
      :default-device-id="store.profileInfo?.SafetyMonitorSettings?.Id"
      :isConnected="store.safetyInfo.Connected"
      @open-config="openSafetySettings"
    />

    <selectDevices
      apiAction="flatdeviceAction"
      :deviceName="$t('components.connectEquipment.flat.name')"
      :default-device-id="store.profileInfo?.FlatDeviceSettings?.Id"
      :isConnected="store.flatdeviceInfo.Connected"
      @open-config="openFlatDeviceSettings"
    />

    <selectDevices
      apiAction="domeAction"
      :deviceName="$t('components.connectEquipment.dome.name')"
      :default-device-id="store.profileInfo?.DomeSettings?.Id"
      :isConnected="store.domeInfo.Connected"
      @open-config="openDomeSettings"
    />

    <selectDevices
      apiAction="switchAction"
      :deviceName="$t('components.connectEquipment.switch.name')"
      :default-device-id="store.profileInfo?.SwitchSettings?.Id"
      :isConnected="store.switchInfo.Connected"
      @open-config="openSwitchSettings"
    />
  </div>

  <!-- Guider Settings Modal -->
  <Modal :show="showGuiderSettings" @close="showGuiderSettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">{{ $t('components.guider.settings') }}</h2>
    </template>
    <template #body>
      <settingsGuiderConnect :selectedGuiderDevice="selectedGuiderDevice" />
    </template>
  </Modal>

  <!-- Camera Settings Modal -->
  <Modal :show="showCameraSettings" @close="showCameraSettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">
        {{ $t('components.alpacaDirect.title') }}
      </h2>
    </template>
    <template #body>
      <SettingsAlpacaDirect
        v-if="isAlpacaDirect(selectedCameraObj)"
        deviceType="camera"
        :selectedDevice="selectedCameraDevice"
        :deviceId="selectedCameraObj?.Id"
      />
      <p v-else class="text-sm text-content">
        {{ $t('components.alpacaDirect.cameraNoSettings') }}
      </p>
    </template>
  </Modal>

  <!-- Guide Camera Settings Modal: PINS' guide camera slot keeps its own Alpaca static IP -->
  <Modal :show="showGuideCameraSettings" @close="showGuideCameraSettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">
        {{ $t('components.alpacaDirect.title') }}
      </h2>
    </template>
    <template #body>
      <SettingsAlpacaDirect
        v-if="isAlpacaDirect(selectedGuideCameraObj)"
        deviceType="guidecamera"
        :selectedDevice="selectedGuideCameraDevice"
        :deviceId="selectedGuideCameraObj?.Id"
      />
      <p v-else class="text-sm text-content">
        {{ $t('components.alpacaDirect.cameraNoSettings') }}
      </p>
    </template>
  </Modal>

  <!-- Mount Settings Modal -->
  <Modal :show="showMountSettings" @close="showMountSettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">{{ $t('components.mount.indi.settings') }}</h2>
    </template>
    <template #body>
      <SettingsAlpacaDirect
        v-if="isAlpacaDirect(selectedMountObj)"
        deviceType="telescope"
        :selectedDevice="selectedMountDevice"
        :deviceId="selectedMountObj?.Id"
      />
      <SettingsOnStepXConnection v-else-if="selectedMountObj?.Id === 'OnStepX'" />
      <SettingsSerialConnection
        v-else
        equipmentType="mount"
        :selectedDevice="selectedMountDevice"
      />
    </template>
  </Modal>

  <!-- Focuser Settings Modal -->
  <Modal :show="showFocuserSettings" @close="showFocuserSettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">{{ $t('components.focuser.indi.settings') }}</h2>
    </template>
    <template #body>
      <SettingsAlpacaDirect
        v-if="isAlpacaDirect(selectedFocuserObj)"
        deviceType="focuser"
        :selectedDevice="selectedFocuserDevice"
        :deviceId="selectedFocuserObj?.Id"
      />
      <SettingsSerialConnection
        v-else
        equipmentType="focuser"
        :selectedDevice="selectedFocuserDevice"
      />
    </template>
  </Modal>

  <!-- Rotator Settings Modal -->
  <Modal :show="showRotatorSettings" @close="showRotatorSettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">{{ $t('components.rotator.indi.settings') }}</h2>
    </template>
    <template #body>
      <SettingsAlpacaDirect
        v-if="isAlpacaDirect(selectedRotatorObj)"
        deviceType="rotator"
        :selectedDevice="selectedRotatorDevice"
        :deviceId="selectedRotatorObj?.Id"
      />
      <SettingsSerialConnection
        v-else
        equipmentType="rotator"
        :selectedDevice="selectedRotatorDevice"
      />
    </template>
  </Modal>

  <!-- FlatDevice Settings Modal -->
  <Modal :show="showFlatDeviceSettings" @close="showFlatDeviceSettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">{{ $t('components.flat.indi.settings') }}</h2>
    </template>
    <template #body>
      <SettingsAlpacaDirect
        v-if="isAlpacaDirect(selectedFlatDeviceObj)"
        deviceType="flatdevice"
        :selectedDevice="selectedFlatDeviceDevice"
        :deviceId="selectedFlatDeviceObj?.Id"
      />
      <SettingsSerialConnection
        v-else
        equipmentType="flatdevice"
        :selectedDevice="selectedFlatDeviceDevice"
      />
    </template>
  </Modal>

  <!-- Switch Settings Modal -->
  <Modal :show="showSwitchSettings" @close="showSwitchSettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">{{ $t('components.switch.indi.settings') }}</h2>
    </template>
    <template #body>
      <div class="flex flex-col gap-2">
        <SettingsAlpacaDirect
          v-if="isAlpacaDirect(selectedSwitchObj)"
          deviceType="switch"
          :selectedDevice="selectedSwitchDevice"
          :deviceId="selectedSwitchObj?.Id"
        />
        <SettingsSerialConnection
          v-else
          equipmentType="switch"
          :selectedDevice="selectedSwitchDevice"
        />
        <SettingsSwitchSV241Pro
          :selectedDevice="selectedSwitchDevice"
          :selectedDeviceObj="selectedSwitchObj"
        />
      </div>
    </template>
  </Modal>

  <!-- Filter Settings Modal -->
  <Modal :show="showFilterSettings" @close="showFilterSettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">{{ $t('components.filterwheel.indi.settings') }}</h2>
    </template>
    <template #body>
      <div class="flex flex-col gap-2">
        <SettingsFilterWheelSlotNum
          :selectedDevice="selectedFilterDevice"
          :selectedDeviceObj="selectedFilterObj"
        />
        <SettingsAlpacaDirect
          v-if="isAlpacaDirect(selectedFilterObj)"
          deviceType="filterwheel"
          :selectedDevice="selectedFilterDevice"
          :deviceId="selectedFilterObj?.Id"
        />
        <SettingsSerialConnection
          v-else
          equipmentType="filterwheel"
          :selectedDevice="selectedFilterDevice"
        />
      </div>
    </template>
  </Modal>

  <!-- Weather Settings Modal -->
  <Modal :show="showWeatherSettings" @close="showWeatherSettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">{{ $t('components.weatherModal.indi.settings') }}</h2>
    </template>
    <template #body>
      <SettingsWeather
        :selectedDevice="selectedWeatherDevice"
        :selectedDeviceObj="selectedWeatherObj"
      />
    </template>
  </Modal>

  <!-- Dome Settings Modal -->
  <Modal :show="showDomeSettings" @close="showDomeSettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">{{ $t('components.dome.indi.settings') }}</h2>
    </template>
    <template #body>
      <SettingsAlpacaDirect
        v-if="isAlpacaDirect(selectedDomeObj)"
        deviceType="dome"
        :selectedDevice="selectedDomeDevice"
        :deviceId="selectedDomeObj?.Id"
      />
      <SettingsSerialConnection v-else equipmentType="dome" :selectedDevice="selectedDomeDevice" />
    </template>
  </Modal>

  <!-- Safety Monitor Settings Modal -->
  <Modal :show="showSafetySettings" @close="showSafetySettings = false">
    <template #header>
      <h2 class="text-2xl font-semibold">{{ $t('components.safetyMonitor.indi.settings') }}</h2>
    </template>
    <template #body>
      <SettingsAlpacaDirect
        v-if="isAlpacaDirect(selectedSafetyObj)"
        deviceType="safetymonitor"
        :selectedDevice="selectedSafetyDevice"
        :deviceId="selectedSafetyObj?.Id"
      />
      <SettingsSerialConnection
        v-else
        equipmentType="safety"
        :selectedDevice="selectedSafetyDevice"
      />
    </template>
  </Modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useGuiderStore } from '@/store/guiderStore';
import selectDevices from '@/components/equipment/selectDevices.vue';
import selectGuiderCam from '@/components/guider/PHD2/selectGuiderCam.vue';
import Modal from '@/components/helpers/Modal.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import settingsGuiderConnect from '@/components/guider/settingsGuiderConnect.vue';
import SettingsSerialConnection from '@/components/equipment/SettingsSerialConnection.vue';
import SettingsOnStepXConnection from '@/components/equipment/SettingsOnStepXConnection.vue';
import SettingsWeather from '@/components/equipment/SettingsWeather.vue';
import SettingsAlpacaDirect from '@/components/equipment/SettingsAlpacaDirect.vue';
import SettingsFilterWheelSlotNum from '@/components/equipment/SettingsFilterWheelSlotNum.vue';
import SettingsSwitchSV241Pro from '@/components/equipment/SettingsSwitchSV241Pro.vue';
import { phd2ConnectBlockers } from '@/utils/equipmentDevices';
import { useEquipmentConnection } from '@/composables/useEquipmentConnection';
import { useSecureObservatoryStore } from '@/store/secureObservatoryStore';
import { MoonIcon } from '@heroicons/vue/24/outline';

const { t } = useI18n();
const store = apiStore();
const secureObservatory = useSecureObservatoryStore();
// Re-asked after every reconnect: the plugin may have been updated in between.
watch(
  () => store.isTnsPluginConnected,
  (connected) => connected && secureObservatory.checkSupport(),
  { immediate: true }
);
const guiderStore = useGuiderStore();
const showGuiderSettings = ref(false);
const selectedGuiderDevice = ref('');
const showCameraSettings = ref(false);
const selectedCameraDevice = ref('');
const selectedCameraObj = ref(null);
const showGuideCameraSettings = ref(false);
const selectedGuideCameraDevice = ref('');
const selectedGuideCameraObj = ref(null);
const showMountSettings = ref(false);
const selectedMountDevice = ref('');
const selectedMountObj = ref(null);
const showFocuserSettings = ref(false);
const selectedFocuserDevice = ref('');
const selectedFocuserObj = ref(null);
const showRotatorSettings = ref(false);
const selectedRotatorDevice = ref('');
const selectedRotatorObj = ref(null);
const showFlatDeviceSettings = ref(false);
const selectedFlatDeviceDevice = ref('');
const selectedFlatDeviceObj = ref(null);
const showFilterSettings = ref(false);
const selectedFilterDevice = ref('');
const selectedFilterObj = ref(null);
const showSwitchSettings = ref(false);
const selectedSwitchDevice = ref('');
const selectedSwitchObj = ref(null);
const showWeatherSettings = ref(false);
const selectedWeatherDevice = ref('');
const selectedWeatherObj = ref(null);
const showDomeSettings = ref(false);
const selectedDomeDevice = ref('');
const selectedDomeObj = ref(null);
const showSafetySettings = ref(false);
const selectedSafetyDevice = ref('');
const selectedSafetyObj = ref(null);
const selectedWeatherDeviceName = ref(store.profileInfo?.WeatherDataSettings?.Id || '');

const isAlpacaDirect = (device) => device?.Category === 'ASCOM Alpaca';

const WEATHER_API_KEY_DEVICES = ['OpenWeatherMap', 'TheWeatherCompany', 'Weather Underground'];
const weatherHasApiKeySettings = computed(() =>
  WEATHER_API_KEY_DEVICES.includes(selectedWeatherDeviceName.value)
);

const {
  isConnecting,
  isDisconnecting,
  isNativeGuiderChoice,
  guideCameraSlot,
  allConnected,
  hasAnyConnection,
  connectAll,
  disconnectAll,
} = useEquipmentConnection({ selectedGuiderDevice });

const phd2Blockers = computed(() =>
  phd2ConnectBlockers({
    selectedGuider: selectedGuiderDevice.value,
    isPINS: store.isPINS,
    mountConnected: store.mountInfo.Connected,
    guidecamOk: guiderStore.guidecamOk,
  })
);
const isGuiderConnectDisabled = computed(() => phd2Blockers.value.length > 0);
const guiderDisabledMessage = computed(() => phd2Blockers.value.map((key) => t(key)).join(' '));

const openGuiderSettings = (payload) => {
  selectedGuiderDevice.value = payload?.selectedDeviceDisplayName || '';
  showGuiderSettings.value = true;
};

const openCameraSettings = (payload) => {
  selectedCameraDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedCameraObj.value = payload?.selectedDeviceObj || null;
  showCameraSettings.value = true;
};

const openGuideCameraSettings = (payload) => {
  selectedGuideCameraDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedGuideCameraObj.value = payload?.selectedDeviceObj || null;
  showGuideCameraSettings.value = true;
};

const openMountSettings = (payload) => {
  selectedMountDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedMountObj.value = payload?.selectedDeviceObj || null;
  showMountSettings.value = true;
};

const openFocuserSettings = (payload) => {
  selectedFocuserDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedFocuserObj.value = payload?.selectedDeviceObj || null;
  showFocuserSettings.value = true;
};

const openRotatorSettings = (payload) => {
  selectedRotatorDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedRotatorObj.value = payload?.selectedDeviceObj || null;
  showRotatorSettings.value = true;
};

const openFlatDeviceSettings = (payload) => {
  selectedFlatDeviceDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedFlatDeviceObj.value = payload?.selectedDeviceObj || null;
  showFlatDeviceSettings.value = true;
};

const openFilterSettings = (payload) => {
  selectedFilterDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedFilterObj.value = payload?.selectedDeviceObj || null;
  showFilterSettings.value = true;
};

const openSwitchSettings = (payload) => {
  selectedSwitchDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedSwitchObj.value = payload?.selectedDeviceObj || null;
  showSwitchSettings.value = true;
};

const openWeatherSettings = (payload) => {
  selectedWeatherDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedWeatherObj.value = payload?.selectedDeviceObj || null;
  showWeatherSettings.value = true;
};

const openDomeSettings = (payload) => {
  selectedDomeDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedDomeObj.value = payload?.selectedDeviceObj || null;
  showDomeSettings.value = true;
};

const openSafetySettings = (payload) => {
  selectedSafetyDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedSafetyObj.value = payload?.selectedDeviceObj || null;
  showSafetySettings.value = true;
};
</script>
