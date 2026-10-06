<template>
  <div class="space-y-6">
    <!-- GPS Coordinates -->
    <template
      v-if="
        store.isPINS || store.checkVersionNewerOrEqual(store.currentTnsPluginVersion, '1.2.8.0')
      "
    >
      <LocationSettingsPins />
    </template>
    <template v-else>
      <div
        v-if="store.isBackendReachable"
        class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
      >
        <h3 class="font-bold text-base text-cyan-400">
          {{ $t('components.settings.coordinates') }}
        </h3>
        <div class="grid grid-cols-2 md:flex md:gap-4 md:items-end gap-2">
          <div class="flex flex-col min-w-0 md:flex-1">
            <label class="text-xs md:text-sm text-gray-300 mb-1">Latitude</label>
            <NumberInputPicker
              v-model="latitude"
              :label="``"
              :labelKey="'latitude'"
              :min="-90"
              :max="90"
              :step="0.001"
              :decimalPlaces="3"
              placeholder="Latitude"
              inputId="latitude"
              wrapperClass="w-full"
            />
          </div>
          <div class="flex flex-col min-w-0 md:flex-1">
            <label class="text-xs md:text-sm text-gray-300 mb-1">Longitude</label>
            <NumberInputPicker
              v-model="longitude"
              :label="``"
              :labelKey="'longitude'"
              :min="-180"
              :max="180"
              :step="0.001"
              :decimalPlaces="3"
              placeholder="Longitude"
              inputId="longitude"
              wrapperClass="w-full"
            />
          </div>
          <div class="flex flex-col min-w-0 md:flex-1">
            <label class="text-xs md:text-sm text-gray-300 mb-1">Altitude</label>
            <NumberInputPicker
              v-model="altitude"
              :label="``"
              :labelKey="'altitude'"
              :min="-500"
              :max="9000"
              :step="1"
              :decimalPlaces="0"
              placeholder="Altitude"
              inputId="altitude"
              wrapperClass="w-full"
            />
          </div>
          <button
            @click="getCurrentLocation"
            class="tns-btn-secondary md:w-10 md:h-10 md:shrink-0 col-span-2 md:col-span-1 md:self-end"
            title="Get current location"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
        <div v-if="gpsError" class="mt-2 text-sm text-red-400">
          {{ gpsError }}
        </div>
        <button
          v-if="
            store.profileInfo.TelescopeSettings.TelescopeLocationSyncDirection === 'TOTELESCOPE'
          "
          @click="locationStore.saveCoordinates"
          class="tns-btn-primary mt-3"
        >
          {{ $t('components.settings.save') }}
        </button>
        <div v-else>
          <p class="text-red-500 text-sm mt-2">
            {{ $t('components.settings.infoSetLocationSync') }}
          </p>
          <ButtonSetLocationSyncToMount class="mt-3" />
        </div>
      </div>
    </template>

    <!-- Time Synchronisation -->
    <TimeSyncSettings v-if="store.isPINS" />

    <!-- Raspberry Pi system locale, regulatory domain, timezone and keyboard -->
    <PinsLocalizationSettings v-if="store.isPINS" />
    <PinsSwapSettings v-if="store.isPINS" />

    <!-- Connection Settings -->
    <div
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
    >
      <h3 class="font-bold text-base text-cyan-400">
        {{ $t('components.settings.connection') }}
      </h3>
      <SetInstance />
    </div>

    <!-- Horizon File Path -->
    <div
      v-if="store.isBackendReachable && store.isPINS"
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
    >
      <h3 class="font-bold text-base text-cyan-400">
        {{ $t('components.settings.horizonFilePath.title') }}
      </h3>
      <SetHorizonFilePath />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { apiStore } from '@/store/store';
import {
  latitude,
  longitude,
  altitude,
  gpsError,
  getCurrentLocation,
  useLocationStore,
} from '@/utils/location';
import ButtonSetLocationSyncToMount from '@/components/mount/ButtonSetLocationSyncToMount.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import LocationSettingsPins from '@/components/settings/general/LocationSettingsPins.vue';
import TimeSyncSettings from '@/components/settings/general/TimeSyncSettings.vue';
import PinsLocalizationSettings from '@/components/settings/general/PinsLocalizationSettings.vue';
import PinsSwapSettings from '@/components/settings/general/PinsSwapSettings.vue';
import SetInstance from '@/components/settings/general/SetInstance.vue';
import SetHorizonFilePath from '@/components/settings/general/SetHorizonFilePath.vue';

const store = apiStore();
const locationStore = useLocationStore();

onMounted(() => {
  if (store.isBackendReachable) {
    const storedCoords = store.profileInfo.AstrometrySettings;
    if (storedCoords) {
      latitude.value = storedCoords.Latitude;
      longitude.value = storedCoords.Longitude;
      altitude.value = storedCoords.Elevation || 0;
    }
  }
});
</script>
