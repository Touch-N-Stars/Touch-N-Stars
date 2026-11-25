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
      <div v-if="store.isBackendReachable" class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.settings.coordinates') }}
        </h3>
        <div class="grid grid-cols-2 md:flex md:gap-4 md:items-end gap-2">
          <div class="flex flex-col min-w-0 md:flex-1">
            <label class="text-xs md:text-sm text-content mb-1">{{
              $t('components.setupWizard.location.latitude')
            }}</label>
            <NumberInputPicker
              v-model="latitude"
              :label="``"
              :labelKey="'latitude'"
              :min="-90"
              :max="90"
              :step="0.001"
              :decimalPlaces="3"
              :placeholder="$t('components.setupWizard.location.latitude')"
              inputId="latitude"
              wrapperClass="w-full"
            />
          </div>
          <div class="flex flex-col min-w-0 md:flex-1">
            <label class="text-xs md:text-sm text-content mb-1">{{
              $t('components.setupWizard.location.longitude')
            }}</label>
            <NumberInputPicker
              v-model="longitude"
              :label="``"
              :labelKey="'longitude'"
              :min="-180"
              :max="180"
              :step="0.001"
              :decimalPlaces="3"
              :placeholder="$t('components.setupWizard.location.longitude')"
              inputId="longitude"
              wrapperClass="w-full"
            />
          </div>
          <div class="flex flex-col min-w-0 md:flex-1">
            <label class="text-xs md:text-sm text-content mb-1">{{
              $t('components.setupWizard.location.altitude')
            }}</label>
            <NumberInputPicker
              v-model="altitude"
              :label="``"
              :labelKey="'altitude'"
              :min="-500"
              :max="9000"
              :step="1"
              :decimalPlaces="0"
              :placeholder="$t('components.setupWizard.location.altitude')"
              inputId="altitude"
              wrapperClass="w-full"
            />
          </div>
          <!-- Spelled out like in the setup assistant: a bare pin icon was not recognised as
               "take the location from this device". -->
          <button
            @click="getCurrentLocation"
            :disabled="gpsLoading"
            class="tns-btn-secondary w-auto! md:shrink-0 col-span-2 md:self-end whitespace-nowrap"
          >
            <Spinner v-if="gpsLoading" size="sm" />
            <MapPinIcon v-else class="h-5 w-5" />
            {{
              gpsLoading
                ? $t('components.setupWizard.location.locating')
                : $t('components.setupWizard.location.useCurrentLocation')
            }}
          </button>
        </div>
        <div v-if="gpsError" class="mt-2 text-sm text-status-danger">
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
          <p class="text-status-danger text-sm mt-2">
            {{ $t('components.settings.infoSetLocationSync') }}
          </p>
          <ButtonSetLocationSyncToMount class="mt-3" />
        </div>
      </div>
    </template>

    <!-- Connection Settings -->
    <div class="tns-card flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">
        {{ $t('components.settings.connection') }}
      </h3>
      <SetInstance />
    </div>

    <!-- Horizon File Path -->
    <div
      v-if="store.isBackendReachable && store.isPINS"
      class="tns-card flex flex-col gap-2 sm:gap-3"
    >
      <h3 class="tns-section-title">
        {{ $t('components.settings.horizonFilePath.title') }}
      </h3>
      <SetHorizonFilePath />
    </div>
  </div>
</template>

<script setup>
import { MapPinIcon } from '@heroicons/vue/24/outline';
import Spinner from '@/components/helpers/Spinner.vue';
import { onMounted } from 'vue';
import { apiStore } from '@/store/store';
import {
  latitude,
  longitude,
  altitude,
  gpsError,
  gpsLoading,
  getCurrentLocation,
  useLocationStore,
} from '@/utils/location';
import ButtonSetLocationSyncToMount from '@/components/mount/ButtonSetLocationSyncToMount.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import LocationSettingsPins from '@/components/settings/general/LocationSettingsPins.vue';
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
