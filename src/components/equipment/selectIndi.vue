<template>
  <div class="flex flex-col gap-1 w-full border border-gray-600 rounded-lg p-3">
    <!-- Loading Spinner -->
    <div v-if="loading" class="flex items-center justify-center py-4">
      <svg
        class="animate-spin h-6 w-6 text-blue-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </div>

    <template v-else>
      <!-- Camera -->
      <div class="flex flex-row w-full items-center">
        <label for="indi-camera" class="mr-3 text-gray-200">
          {{ $t('components.connectEquipment.camera.name') }}
        </label>
        <select
          id="indi-camera"
          v-model="selectedCamera"
          @change="onCameraChange"
          class="tns-select w-40 ml-auto"
        >
          <option value="None">None</option>
          <option v-for="item in camera" :key="item.Name" :value="item.Name">
            {{ item.Label }}
          </option>
        </select>
      </div>

      <!-- Focuser -->
      <div class="flex flex-row w-full items-center">
        <label for="indi-focuser" class="mr-3 text-gray-200">
          {{ $t('components.connectEquipment.focuser.name') }}
        </label>
        <select
          id="indi-focuser"
          v-model="selectedFocuser"
          @change="onFocuserChange"
          class="tns-select w-40 ml-auto"
        >
          <option value="None">None</option>
          <option v-for="item in focuser" :key="item.Name" :value="item.Name">
            {{ item.Name === 'indi_myfocuserpro2_focus' ? 'Gemini / MyFocuserPro2' : item.Label }}
          </option>
        </select>
      </div>

      <!-- Filterwheel -->
      <div class="flex flex-row w-full items-center">
        <label for="indi-filterwheel" class="mr-3 text-gray-200">
          {{ $t('components.connectEquipment.filter.name') }}
        </label>
        <select
          id="indi-filterwheel"
          v-model="selectedFilterwheel"
          @change="onFilterwheelChange"
          class="tns-select w-40 ml-auto"
        >
          <option value="None">None</option>
          <option v-for="item in filterwheel" :key="item.Name" :value="item.Name">
            {{ item.Label }}
          </option>
        </select>
      </div>

      <!-- Rotator -->
      <div class="flex flex-row w-full items-center">
        <label for="indi-rotator" class="mr-3 text-gray-200">
          {{ $t('components.connectEquipment.rotator.name') }}
        </label>
        <select
          id="indi-rotator"
          v-model="selectedRotator"
          @change="onRotatorChange"
          class="tns-select w-40 ml-auto"
        >
          <option value="None">None</option>
          <option v-for="item in rotator" :key="item.Name" :value="item.Name">
            {{ item.Label }}
          </option>
        </select>
      </div>

      <!-- Telescope -->
      <div class="flex flex-row w-full items-center">
        <label for="indi-telescope" class="mr-3 text-gray-200">
          {{ $t('components.connectEquipment.mount.name') }}
        </label>
        <select
          id="indi-telescope"
          v-model="selectedTelescope"
          @change="onTelescopeChange"
          class="tns-select w-40 ml-auto"
        >
          <option value="None">None</option>
          <option v-for="item in telescope" :key="item.Name" :value="item.Name">
            {{ item.Label }}
          </option>
        </select>
      </div>

      <!-- Weather -->
      <div class="flex flex-row w-full items-center">
        <label for="indi-weather" class="mr-3 text-gray-200">
          {{ $t('components.connectEquipment.weather.name') }}
        </label>
        <select
          id="indi-weather"
          v-model="selectedWeather"
          @change="onWeatherChange"
          class="tns-select w-40 ml-auto"
        >
          <option value="None">None</option>
          <option v-for="item in weather" :key="item.Name" :value="item.Name">
            {{ item.Label }}
          </option>
        </select>
      </div>

      <!-- Switches -->
      <div class="flex flex-row w-full items-center">
        <label for="indi-switches" class="mr-3 text-gray-200">
          {{ $t('components.connectEquipment.switch.name') }}
        </label>
        <select
          id="indi-switches"
          v-model="selectedSwitches"
          @change="onSwitchesChange"
          class="tns-select w-40 ml-auto"
        >
          <option value="None">None</option>
          <option v-for="item in switches" :key="item.Name" :value="item.Name">
            {{ item.Label }}
          </option>
        </select>
      </div>

      <!-- Flatpanel -->
      <div class="flex flex-row w-full items-center">
        <label for="indi-flatpanel" class="mr-3 text-gray-200">
          {{ $t('components.connectEquipment.flat.name') }}
        </label>
        <select
          id="indi-flatpanel"
          v-model="selectedFlatpanel"
          @change="onFlatpanelChange"
          class="tns-select w-40 ml-auto"
        >
          <option value="None">None</option>
          <option v-for="item in flatpanel" :key="item.Name" :value="item.Name">
            {{ item.Label }}
          </option>
        </select>
      </div>

      <!-- Dome -->
      <div class="flex flex-row w-full items-center">
        <label for="indi-dome" class="mr-3 text-gray-200">
          {{ $t('components.connectEquipment.dome.name') }}
        </label>
        <select
          id="indi-dome"
          v-model="selectedDome"
          @change="onDomeChange"
          class="tns-select w-40 ml-auto"
        >
          <option value="None">None</option>
          <option v-for="item in dome" :key="item.Name" :value="item.Name">
            {{ item.Label }}
          </option>
        </select>
      </div>

      <!-- Safety Monitor -->
      <div class="flex flex-row w-full items-center">
        <label for="indi-safetymonitor" class="mr-3 text-gray-200">
          {{ $t('components.connectEquipment.safety.name') }}
        </label>
        <select
          id="indi-safetymonitor"
          v-model="selectedSafetymonitor"
          @change="onSafetymonitorChange"
          class="tns-select w-40 ml-auto"
        >
          <option value="None">None</option>
          <option v-for="item in safetymonitor" :key="item.Name" :value="item.Name">
            {{ item.Label }}
          </option>
        </select>
      </div>
    </template>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import apiPinsService from '@/services/apiPinsService';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useEquipmentStore } from '@/store/equipmentStore';
import { isHiddenIndiDriver } from '@/utils/equipmentDevices';

const store = apiStore();
const equipmentStore = useEquipmentStore();
const loading = ref(true);
const camera = ref([]);
const focuser = ref([]);
const filterwheel = ref([]);
const rotator = ref([]);
const telescope = ref([]);
const weather = ref([]);
const switches = ref([]);
const flatpanel = ref([]);
const dome = ref([]);
const safetymonitor = ref([]);

const selectedCamera = ref('None');
const selectedFocuser = ref('None');
const selectedFilterwheel = ref('None');
const selectedRotator = ref('None');
const selectedTelescope = ref('None');
const selectedWeather = ref('None');
const selectedSwitches = ref('None');
const selectedFlatpanel = ref('None');
const selectedDome = ref('None');
const selectedSafetymonitor = ref('None');

const onCameraChange = async () => {
  try {
    await apiService.profileChangeValue('CameraSettings-IndiDriver', selectedCamera.value);
    await apiService.cameraAction('list-devices');
    equipmentStore.triggerRescan('camera');
    await store.fetchProfilInfos();
    console.log('[SelectIndi] Camera selected:', selectedCamera.value);
  } catch (error) {
    console.error('[SelectIndi] Error Camera selection:', error);
  }
};

const onFocuserChange = async () => {
  try {
    await apiService.profileChangeValue('FocuserSettings-IndiDriver', selectedFocuser.value);
    await apiService.focusAction('list-devices');
    equipmentStore.triggerRescan('focus');
    await store.fetchProfilInfos();
    console.log('[SelectIndi] Focuser selected:', selectedFocuser.value);
  } catch (error) {
    console.error('[SelectIndi] Error Focuser selection:', error);
  }
};

const onFilterwheelChange = async () => {
  try {
    await apiService.profileChangeValue(
      'FilterWheelSettings-IndiDriver',
      selectedFilterwheel.value
    );
    await apiService.filterAction('list-devices');
    equipmentStore.triggerRescan('filter');
    await store.fetchProfilInfos();
    console.log('[SelectIndi] Filterwheel selected:', selectedFilterwheel.value);
  } catch (error) {
    console.error('[SelectIndi] Error Filterwheel selection:', error);
  }
};

const onRotatorChange = async () => {
  try {
    await apiService.profileChangeValue('RotatorSettings-IndiDriver', selectedRotator.value);
    await apiService.rotatorAction('list-devices');
    equipmentStore.triggerRescan('rotator');
    await store.fetchProfilInfos();
    console.log('[SelectIndi] Rotator selected:', selectedRotator.value);
  } catch (error) {
    console.error('[SelectIndi] Error Rotator selection:', error);
  }
};

const onTelescopeChange = async () => {
  try {
    await apiService.profileChangeValue('TelescopeSettings-IndiDriver', selectedTelescope.value);
    await apiService.mountAction('list-devices');
    equipmentStore.triggerRescan('mount');
    await store.fetchProfilInfos();
    console.log('[SelectIndi] Telescope selected:', selectedTelescope.value);
  } catch (error) {
    console.error('[SelectIndi] Error Telescope selection:', error);
  }
};

const onWeatherChange = async () => {
  try {
    await apiService.profileChangeValue('WeatherDataSettings-IndiDriver', selectedWeather.value);
    await apiService.weatherAction('list-devices');
    equipmentStore.triggerRescan('weather');
    await store.fetchProfilInfos();
    console.log('[SelectIndi] Weather selected:', selectedWeather.value);
  } catch (error) {
    console.error('[SelectIndi] Error Weather selection:', error);
  }
};

const onSwitchesChange = async () => {
  try {
    await apiService.profileChangeValue('SwitchSettings-IndiDriver', selectedSwitches.value);
    await apiService.switchAction('list-devices');
    equipmentStore.triggerRescan('switch');
    await store.fetchProfilInfos();
    console.log('[SelectIndi] Switches selected:', selectedSwitches.value);
  } catch (error) {
    console.error('[SelectIndi] Error Switches selection:', error);
  }
};

const onFlatpanelChange = async () => {
  try {
    await apiService.profileChangeValue('FlatDeviceSettings-IndiDriver', selectedFlatpanel.value);
    await apiService.flatdeviceAction('list-devices');
    equipmentStore.triggerRescan('flatdevice');
    await store.fetchProfilInfos();
    console.log('[SelectIndi] Flatpanel selected:', selectedFlatpanel.value);
  } catch (error) {
    console.error('[SelectIndi] Error Flatpanel selection:', error);
  }
};

const onDomeChange = async () => {
  try {
    await apiService.profileChangeValue('DomeSettings-IndiDriver', selectedDome.value);
    await apiService.domeAction('list-devices');
    equipmentStore.triggerRescan('dome');
    await store.fetchProfilInfos();
    console.log('[SelectIndi] Dome selected:', selectedDome.value);
  } catch (error) {
    console.error('[SelectIndi] Error Dome selection:', error);
  }
};

const onSafetymonitorChange = async () => {
  try {
    await apiService.profileChangeValue(
      'SafetyMonitorSettings-IndiDriver',
      selectedSafetymonitor.value
    );
    await apiService.safetyAction('list-devices');
    equipmentStore.triggerRescan('safety');
    await store.fetchProfilInfos();
    console.log('[SelectIndi] Safetymonitor selected:', selectedSafetymonitor.value);
  } catch (error) {
    console.error('[SelectIndi] Error Safetymonitor selection:', error);
  }
};

onMounted(async () => {
  try {
    const [
      cameraResponse,
      focuserResponse,
      filterwheelResponse,
      rotatorResponse,
      telescopeResponse,
      weatherResponse,
      switchesResponse,
      flatpanelResponse,
      domeResponse,
      safetymonitorResponse,
    ] = await Promise.all([
      apiPinsService.getINDIDeviceList('camera'),
      apiPinsService.getINDIDeviceList('focuser'),
      apiPinsService.getINDIDeviceList('filterwheel'),
      apiPinsService.getINDIDeviceList('rotator'),
      apiPinsService.getINDIDeviceList('telescope'),
      apiPinsService.getINDIDeviceList('weather'),
      apiPinsService.getINDIDeviceList('switches'),
      apiPinsService.getINDIDeviceList('flatpanel'),
      apiPinsService.getINDIDeviceList('dome'),
      apiPinsService.getINDIDeviceList('safetymonitor'),
    ]);

    const sortByLabel = (arr) => [...arr].sort((a, b) => a.Label.localeCompare(b.Label));
    const getFocuserLabel = (item) =>
      item.Name === 'indi_myfocuserpro2_focus' ? 'Gemini / MyFocuserPro2' : item.Label;
    const sortFocuserByLabel = (arr) =>
      [...arr].sort((a, b) => getFocuserLabel(a).localeCompare(getFocuserLabel(b)));

    const visible = (type, arr) => arr.filter((item) => !isHiddenIndiDriver(type, item.Name));

    camera.value = sortByLabel(cameraResponse.Response);
    focuser.value = sortFocuserByLabel(visible('focuser', focuserResponse.Response));
    filterwheel.value = sortByLabel(visible('filterwheel', filterwheelResponse.Response));
    rotator.value = sortByLabel(rotatorResponse.Response);
    telescope.value = sortByLabel(telescopeResponse.Response);
    weather.value = sortByLabel(weatherResponse.Response);
    switches.value = sortByLabel(switchesResponse.Response);
    flatpanel.value = sortByLabel(flatpanelResponse.Response);
    dome.value = sortByLabel(domeResponse.Response);
    safetymonitor.value = sortByLabel(safetymonitorResponse.Response);

    // Set saved values from store as defaults
    selectedCamera.value = store.profileInfo?.CameraSettings?.IndiDriver || 'None';
    selectedFocuser.value = store.profileInfo?.FocuserSettings?.IndiDriver || 'None';
    selectedFilterwheel.value = store.profileInfo?.FilterWheelSettings?.IndiDriver || 'None';
    selectedRotator.value = store.profileInfo?.RotatorSettings?.IndiDriver || 'None';
    selectedTelescope.value = store.profileInfo?.TelescopeSettings?.IndiDriver || 'None';
    selectedWeather.value = store.profileInfo?.WeatherDataSettings?.IndiDriver || 'None';
    selectedSwitches.value = store.profileInfo?.SwitchSettings?.IndiDriver || 'None';
    selectedFlatpanel.value = store.profileInfo?.FlatDeviceSettings?.IndiDriver || 'None';
    selectedDome.value = store.profileInfo?.DomeSettings?.IndiDriver || 'None';
    selectedSafetymonitor.value = store.profileInfo?.SafetyMonitorSettings?.IndiDriver || 'None';

    console.log('[SelectIndi] All INDI devices loaded');
  } catch (error) {
    console.error('[SelectIndi] Error fetching INDI devices:', error);
  } finally {
    loading.value = false;
  }
});
</script>
