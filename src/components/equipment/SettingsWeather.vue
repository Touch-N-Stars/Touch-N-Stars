<template>
  <div class="flex flex-col gap-3">
    <!-- OpenWeatherMap API Key -->
    <div v-if="isOpenWeatherMap" class="tns-card flex flex-col gap-2">
      <h4 class="tns-section-title">OpenWeatherMap</h4>
      <div class="flex flex-row items-center justify-between w-full">
        <label for="owmApiKey" class="text-xs md:text-sm text-content mr-2 shrink-0">
          {{ $t('components.weatherModal.settings.apiKey') }}
        </label>
        <input
          id="owmApiKey"
          v-model="openWeatherMapApiKey"
          @change="setOpenWeatherMapApiKey"
          type="text"
          class="tns-input text-xs md:text-sm w-48"
          :class="statusClassOwm"
          :placeholder="$t('components.weatherModal.settings.apiKeyPlaceholder')"
        />
      </div>
    </div>

    <!-- The Weather Company API Key -->
    <div v-else-if="isTheWeatherCompany" class="tns-card flex flex-col gap-2">
      <h4 class="tns-section-title">The Weather Company</h4>
      <div class="flex flex-row items-center justify-between w-full">
        <label for="twcApiKey" class="text-xs md:text-sm text-content mr-2 shrink-0">
          {{ $t('components.weatherModal.settings.apiKey') }}
        </label>
        <input
          id="twcApiKey"
          v-model="theWeatherCompanyApiKey"
          @change="setTheWeatherCompanyApiKey"
          type="text"
          class="tns-input text-xs md:text-sm w-48"
          :class="statusClassTwc"
          :placeholder="$t('components.weatherModal.settings.apiKeyPlaceholder')"
        />
      </div>
    </div>

    <!-- Weather Underground API Key + Station ID -->
    <div v-else-if="isWeatherUnderground" class="tns-card flex flex-col gap-2">
      <h4 class="tns-section-title">Weather Underground</h4>
      <div class="flex flex-row items-center justify-between w-full">
        <label for="wuApiKey" class="text-xs md:text-sm text-content mr-2 shrink-0">
          {{ $t('components.weatherModal.settings.apiKey') }}
        </label>
        <input
          id="wuApiKey"
          v-model="weatherUndergroundApiKey"
          @change="setWeatherUndergroundApiKey"
          type="text"
          class="tns-input text-xs md:text-sm w-48"
          :class="statusClassWuKey"
          :placeholder="$t('components.weatherModal.settings.apiKeyPlaceholder')"
        />
      </div>
      <div class="flex flex-row items-center justify-between w-full">
        <label for="wuStation" class="text-xs md:text-sm text-content mr-2 shrink-0">
          {{ $t('components.weatherModal.settings.stationId') }}
        </label>
        <input
          id="wuStation"
          v-model="weatherUndergroundStation"
          @change="setWeatherUndergroundStation"
          type="text"
          class="tns-input text-xs md:text-sm w-48"
          :class="statusClassWuStation"
          :placeholder="$t('components.weatherModal.settings.stationIdPlaceholder')"
        />
      </div>
    </div>

    <!-- Alpaca Direct weather devices -->
    <SettingsAlpacaDirect
      v-else-if="isAlpacaDirectDevice"
      deviceType="weather"
      :selectedDevice="selectedDevice"
      :deviceId="selectedDeviceObj?.Id"
    />

    <!-- INDI-based weather devices -->
    <SettingsSerialConnection
      v-else-if="isIndiDevice"
      equipmentType="weather"
      :selectedDevice="selectedDevice"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import SettingsSerialConnection from '@/components/equipment/SettingsSerialConnection.vue';
import SettingsAlpacaDirect from '@/components/equipment/SettingsAlpacaDirect.vue';

const props = defineProps({
  selectedDevice: { type: String, default: '' },
  selectedDeviceObj: { type: Object, default: null },
});

const store = apiStore();

const isOpenWeatherMap = computed(() => props.selectedDevice === 'OpenWeatherMap');
const isTheWeatherCompany = computed(() => props.selectedDevice === 'TheWeatherCompany');
const isWeatherUnderground = computed(() => props.selectedDevice === 'Weather Underground');
const isAlpacaDirectDevice = computed(() => props.selectedDeviceObj?.Category === 'ASCOM Alpaca');
const isIndiDevice = computed(
  () =>
    !isOpenWeatherMap.value &&
    !isTheWeatherCompany.value &&
    !isWeatherUnderground.value &&
    !isAlpacaDirectDevice.value &&
    props.selectedDevice !== ''
);

const openWeatherMapApiKey = ref('');
const theWeatherCompanyApiKey = ref('');
const weatherUndergroundApiKey = ref('');
const weatherUndergroundStation = ref('');

const statusClassOwm = ref('');
const statusClassTwc = ref('');
const statusClassWuKey = ref('');
const statusClassWuStation = ref('');

function applyGlowFeedback(statusRef, success) {
  statusRef.value = success ? 'glow-green' : 'glow-red';
  setTimeout(() => {
    statusRef.value = '';
  }, 2000);
}

async function setOpenWeatherMapApiKey() {
  try {
    await apiService.profileChangeValue(
      'WeatherDataSettings-OpenWeatherMapAPIKey',
      openWeatherMapApiKey.value
    );
    applyGlowFeedback(statusClassOwm, true);
  } catch {
    applyGlowFeedback(statusClassOwm, false);
  }
}

async function setTheWeatherCompanyApiKey() {
  try {
    await apiService.profileChangeValue(
      'WeatherDataSettings-TheWeatherCompanyAPIKey',
      theWeatherCompanyApiKey.value
    );
    applyGlowFeedback(statusClassTwc, true);
  } catch {
    applyGlowFeedback(statusClassTwc, false);
  }
}

async function setWeatherUndergroundApiKey() {
  try {
    await apiService.profileChangeValue(
      'WeatherDataSettings-WeatherUndergroundAPIKey',
      weatherUndergroundApiKey.value
    );
    applyGlowFeedback(statusClassWuKey, true);
  } catch {
    applyGlowFeedback(statusClassWuKey, false);
  }
}

async function setWeatherUndergroundStation() {
  try {
    await apiService.profileChangeValue(
      'WeatherDataSettings-WeatherUndergroundStation',
      weatherUndergroundStation.value
    );
    applyGlowFeedback(statusClassWuStation, true);
  } catch {
    applyGlowFeedback(statusClassWuStation, false);
  }
}

onMounted(() => {
  const settings = store.profileInfo?.WeatherDataSettings;
  if (settings) {
    openWeatherMapApiKey.value = settings.OpenWeatherMapAPIKey ?? '';
    theWeatherCompanyApiKey.value = settings.TheWeatherCompanyAPIKey ?? '';
    weatherUndergroundApiKey.value = settings.WeatherUndergroundAPIKey ?? '';
    weatherUndergroundStation.value = settings.WeatherUndergroundStation ?? '';
  }
});
</script>
