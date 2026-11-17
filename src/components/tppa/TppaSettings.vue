<template>
  <div class="tns-card flex flex-col gap-1">
    <div class="tns-field-row">
      <label for="toggle_Pos" class="text-sm text-content">
        {{ $t('components.tppa.settings.StartFromCurrentPosition') }}
      </label>
      <div>
        <toggleButton
          @click="togglePosition"
          :status-value="tppaStore.settings.StartFromCurrentPosition"
          class="pr-5 pl-5 justify-center"
        />
      </div>
    </div>
    <div class="tns-field-row">
      <label for="toggle_Pos" class="text-sm text-content">
        {{ $t('components.tppa.settings.DirectionEast') }}
      </label>
      <div>
        <toggleButton
          @click="toggleDirection"
          :status-value="tppaStore.settings.EastDirection"
          class="pr-5 pl-5 justify-center"
        />
      </div>
    </div>
    <div
      v-if="store.checkVersionNewerOrEqual(store.currentApiVersion, '2.2.10.0')"
      class="tns-field-row"
    >
      <label for="toggle_Pos" class="text-sm text-content">
        {{ $t('components.tppa.settings.ManualMode') }}
      </label>
      <div>
        <toggleButton
          @click="toggleManualMode"
          :status-value="tppaStore.settings.ManualMode"
          class="pr-5 pl-5 justify-center"
        />
      </div>
    </div>

    <!-- Camera Settings -->
    <div class="border-t border-line pt-2 mt-2">
      <h4 class="tns-section-title mb-1">
        {{ $t('components.tppa.settings.camera_settings') }}
      </h4>
      <p class="tns-label mb-3">
        {{ $t('components.tppa.settings.camera_settings_hint') }}
      </p>

      <!-- Exposure Time -->
      <div class="mb-2">
        <NumberInputPicker
          v-model="tppaStore.settings.ExposureTime"
          :label="$t('components.tppa.settings.exposure_time')"
          labelKey="components.tppa.settings.exposure_time"
          :min="0"
          :max="999"
          :step="0.1"
          :decimalPlaces="1"
          inputId="tppa-exposure-time"
        />
      </div>

      <!-- Gain -->
      <div>
        <NumberInputPicker
          v-model="tppaStore.settings.Gain"
          :label="$t('components.tppa.settings.gain')"
          labelKey="components.tppa.settings.gain"
          :min="0"
          :max="9999"
          :step="1"
          :decimalPlaces="0"
          :defaultValue="store.profileInfo.CameraSettings.Gain"
          inputId="tppa-gain"
        />
      </div>

      <!-- Filter -->
      <div v-if="store.filterInfo.Connected" class="mt-2">
        <label for="tppa-filter" class="tns-label mb-1 block">
          {{ $t('components.tppa.settings.filter') }}
        </label>
        <select id="tppa-filter" v-model="tppaStore.settings.Filter" class="tns-select w-full">
          <option :value="null">{{ $t('components.tppa.settings.filter_default') }}</option>
          <option
            v-for="filter in store.filterInfo.AvailableFilters"
            :key="filter.Id"
            :value="filter.Name"
          >
            {{ filter.Name }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useTppaStore } from '@/store/tppaStore';
import { apiStore } from '@/store/store';
import toggleButton from '../helpers/toggleButton.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const tppaStore = useTppaStore();
const store = apiStore();

function togglePosition() {
  if (tppaStore.settings.StartFromCurrentPosition) {
    tppaStore.settings.StartFromCurrentPosition = false;
    console.log('StartCurrentPosition off');
  } else {
    tppaStore.settings.StartFromCurrentPosition = true;
    console.log('StartCurrentPosition on');
  }
}

function toggleDirection() {
  if (tppaStore.settings.EastDirection) {
    tppaStore.settings.EastDirection = false;
    console.log('EastDirection off');
  } else {
    tppaStore.settings.EastDirection = true;
    console.log('EastDirection on');
  }
}

function toggleManualMode() {
  if (tppaStore.settings.ManualMode) {
    tppaStore.settings.ManualMode = false;
    console.log('ManualMode off');
  } else {
    tppaStore.settings.ManualMode = true;
    console.log('ManualMode on');
  }
}
</script>
