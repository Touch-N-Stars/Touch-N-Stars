<template>
  <div class="flex w-full items-center gap-2 p-4">
    <select v-model="settingsStore.flats.altitudeSite" class="tns-select w-28!">
      <option value="EAST">{{ $t('components.tppa.east') }}</option>
      <option value="WEST">{{ $t('components.tppa.west') }}</option>
    </select>

    <ButtonSlew
      class="w-full"
      :label="t('components.flatassistant.button_slew_to_zenith')"
      :getCoordinates="zenithCoordinates"
      @finished="stopTracking"
    />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import ButtonSlew from '@/components/mount/ButtonSlew.vue';
import apiService from '@/services/apiService';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import { altAzToRaDec } from '@/utils/utils';
import { useI18n } from 'vue-i18n';

const settingsStore = useSettingsStore();
const store = apiStore();
const { t } = useI18n();

const ALTITUDE_SITE = {
  EAST: 'EAST',
  WEST: 'WEST',
};

const zenithAzimuth = computed(() =>
  settingsStore.flats.altitudeSite === ALTITUDE_SITE.WEST ? 90 : 270
);

// 5° off zenith puts the target clearly on one side of the meridian (beyond
// typical mount tracking limits) while keeping the tube steep enough for a
// flat panel to rest on it.
const ZENITH_ALTITUDE = 85;

// Computed at click time: the sidereal time is not reactive, so a cached
// value drifts across the meridian and lands on the wrong pier side.
function zenithCoordinates() {
  return altAzToRaDec(
    ZENITH_ALTITUDE,
    zenithAzimuth.value,
    store.profileInfo.AstrometrySettings.Latitude,
    store.profileInfo.AstrometrySettings.Longitude
  );
}

async function stopTracking() {
  try {
    await apiService.setTrackingMode(4);
  } catch (error) {
    console.error('Error stopping tracking after slew to zenith:', error);
  }
}

onMounted(() => {
  if (!settingsStore.flats.altitudeSite) {
    settingsStore.flats.altitudeSite = ALTITUDE_SITE.EAST;
  }
});
</script>
