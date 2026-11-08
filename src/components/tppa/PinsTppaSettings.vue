<template>
  <div v-if="loading" class="flex items-center justify-center py-8">
    <Spinner class="text-accent" />
  </div>

  <div v-else class="flex flex-col gap-2 w-full">
    <!-- NINA TPPA Settings -->
    <div class="tns-card p-2!">
      <div class="space-y-2">
        <div class="tns-field-row">
          <label class="text-sm text-content">{{
            $t('components.tppa.settings.StartFromCurrentPosition')
          }}</label>
          <toggleButton
            :status-value="tppaStore.settings.StartFromCurrentPosition"
            @click="
              tppaStore.settings.StartFromCurrentPosition =
                !tppaStore.settings.StartFromCurrentPosition
            "
            class="pr-3 pl-3"
          />
        </div>
        <div
          v-if="store.checkVersionNewerOrEqual(store.currentApiVersion, '2.2.10.0')"
          class="tns-field-row"
        >
          <label class="text-sm text-content">{{
            $t('components.tppa.settings.ManualMode')
          }}</label>
          <toggleButton
            :status-value="tppaStore.settings.ManualMode"
            @click="tppaStore.settings.ManualMode = !tppaStore.settings.ManualMode"
            class="pr-3 pl-3"
          />
        </div>
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
    </div>

    <!-- Movement Section -->
    <div class="tns-card p-2!">
      <h4 class="tns-section-title mb-2">
        {{ $t('components.tppa.pins_settings.movement') }}
      </h4>
      <div class="space-y-2">
        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.default_move_rate')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.default_move_rate')"
              :message="$t('components.tppa.pins_settings.help_default_move_rate')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <NumberInputPicker
            v-model="options.DefaultMoveRate"
            labelKey="components.tppa.pins_settings.default_move_rate"
            :min="0.1"
            :max="100"
            :step="0.1"
            :decimalPlaces="1"
            inputId="pins-default-move-rate"
            @change="updateOption('DefaultMoveRate', options.DefaultMoveRate)"
          />
        </div>

        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.default_east_direction')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.default_east_direction')"
              :message="$t('components.tppa.pins_settings.help_default_east_direction')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <toggleButton
            :status-value="options.DefaultEastDirection"
            @click="toggleDefaultEastDirection"
            class="pr-3 pl-3"
          />
        </div>

        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.move_timeout_factor')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.move_timeout_factor')"
              :message="$t('components.tppa.pins_settings.help_move_timeout_factor')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <NumberInputPicker
            v-model="options.MoveTimeoutFactor"
            labelKey="components.tppa.pins_settings.move_timeout_factor"
            :min="0.1"
            :max="100"
            :step="0.1"
            :decimalPlaces="1"
            inputId="pins-move-timeout-factor"
            @change="updateOption('MoveTimeoutFactor', options.MoveTimeoutFactor)"
          />
        </div>

        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.default_target_distance')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.default_target_distance')"
              :message="$t('components.tppa.pins_settings.help_default_target_distance')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <NumberInputPicker
            v-model="options.DefaultTargetDistance"
            labelKey="components.tppa.pins_settings.default_target_distance"
            :min="0.1"
            :max="360"
            :step="0.1"
            :decimalPlaces="1"
            inputId="pins-default-target-distance"
            @change="updateOption('DefaultTargetDistance', options.DefaultTargetDistance)"
          />
        </div>

        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.default_search_radius')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.default_search_radius')"
              :message="$t('components.tppa.pins_settings.help_default_search_radius')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <NumberInputPicker
            v-model="options.DefaultSearchRadius"
            labelKey="components.tppa.pins_settings.default_search_radius"
            :min="0.1"
            :max="360"
            :step="0.1"
            :decimalPlaces="1"
            inputId="pins-default-search-radius"
            @change="updateOption('DefaultSearchRadius', options.DefaultSearchRadius)"
          />
        </div>
      </div>
    </div>

    <!-- Offsets Section -->
    <div class="tns-card p-2!">
      <h4 class="tns-section-title mb-2">
        {{ $t('components.tppa.pins_settings.offsets') }}
      </h4>
      <div class="space-y-2">
        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.default_azimuth_offset')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.default_azimuth_offset')"
              :message="$t('components.tppa.pins_settings.help_default_azimuth_offset')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <NumberInputPicker
            v-model="options.DefaultAzimuthOffset"
            labelKey="components.tppa.pins_settings.default_azimuth_offset"
            :min="-360"
            :max="360"
            :step="0.1"
            :decimalPlaces="1"
            inputId="pins-default-azimuth-offset"
            @change="updateOption('DefaultAzimuthOffset', options.DefaultAzimuthOffset)"
          />
        </div>

        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.default_altitude_offset')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.default_altitude_offset')"
              :message="$t('components.tppa.pins_settings.help_default_altitude_offset')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <NumberInputPicker
            v-model="options.DefaultAltitudeOffset"
            labelKey="components.tppa.pins_settings.default_altitude_offset"
            :min="-360"
            :max="360"
            :step="0.1"
            :decimalPlaces="1"
            inputId="pins-default-altitude-offset"
            @change="updateOption('DefaultAltitudeOffset', options.DefaultAltitudeOffset)"
          />
        </div>

        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.alignment_tolerance')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.alignment_tolerance')"
              :message="$t('components.tppa.pins_settings.help_alignment_tolerance')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <NumberInputPicker
            v-model="options.AlignmentTolerance"
            labelKey="components.tppa.pins_settings.alignment_tolerance"
            :min="0"
            :max="360"
            :step="0.1"
            :decimalPlaces="1"
            inputId="pins-alignment-tolerance"
            @change="updateOption('AlignmentTolerance', options.AlignmentTolerance)"
          />
        </div>
      </div>
    </div>

    <!-- Behavior Section -->
    <div class="tns-card p-2!">
      <h4 class="tns-section-title mb-2">
        {{ $t('components.tppa.pins_settings.behavior') }}
      </h4>
      <div class="space-y-2">
        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.refraction_adjustment')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.refraction_adjustment')"
              :message="$t('components.tppa.pins_settings.help_refraction_adjustment')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <toggleButton
            :status-value="options.RefractionAdjustment"
            @click="toggleRefractionAdjustment"
            class="pr-3 pl-3"
          />
        </div>

        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.stop_tracking_when_done')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.stop_tracking_when_done')"
              :message="$t('components.tppa.pins_settings.help_stop_tracking_when_done')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <toggleButton
            :status-value="options.StopTrackingWhenDone"
            @click="toggleStopTrackingWhenDone"
            class="pr-3 pl-3"
          />
        </div>

        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.settle_time')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.settle_time')"
              :message="$t('components.tppa.pins_settings.help_settle_time')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <NumberInputPicker
            v-model="options.AutomatedAdjustmentSettleTime"
            labelKey="components.tppa.pins_settings.settle_time"
            :min="0"
            :max="300"
            :step="0.1"
            :decimalPlaces="1"
            inputId="pins-settle-time"
            @change="
              updateOption('AutomatedAdjustmentSettleTime', options.AutomatedAdjustmentSettleTime)
            "
          />
        </div>

        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.auto_pause')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.auto_pause')"
              :message="$t('components.tppa.pins_settings.help_auto_pause')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <toggleButton
            :status-value="options.AutoPause"
            @click="toggleAutoPause"
            class="pr-3 pl-3"
          />
        </div>

        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <label class="text-sm text-content">{{
              $t('components.tppa.pins_settings.log_error')
            }}</label>
            <InfoModal
              :title="$t('components.tppa.pins_settings.log_error')"
              :message="$t('components.tppa.pins_settings.help_log_error')"
              :size="'w-5 h-5'"
              :iconTextColour="'text-accent'"
            />
          </div>
          <toggleButton
            :status-value="options.LogError"
            @click="toggleLogError"
            class="pr-3 pl-3"
          />
        </div>

        <button @click="reset" class="tns-btn-secondary w-full text-xs mt-2">
          {{ $t('components.tppa.pins_settings.reset') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiService from '@/services/apiService';
import { useTppaStore } from '@/store/tppaStore';
import { apiStore } from '@/store/store';
import toggleButton from '../helpers/toggleButton.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import InfoModal from '@/components/helpers/infoModal.vue';
import Spinner from '@/components/helpers/Spinner.vue';

const tppaStore = useTppaStore();
const store = apiStore();

const loading = ref(true);
const options = ref({
  DefaultMoveRate: 3,
  DefaultEastDirection: true,
  MoveTimeoutFactor: 2,
  DefaultTargetDistance: 10,
  DefaultSearchRadius: 10,
  DefaultAzimuthOffset: 1,
  DefaultAltitudeOffset: 2,
  AlignmentTolerance: 0,
  RefractionAdjustment: false,
  StopTrackingWhenDone: true,
  AutomatedAdjustmentSettleTime: 2,
  AutoPause: false,
  LogError: false,
});

onMounted(async () => {
  try {
    const data = await apiService.getTppaOptions();
    if (data?.Success && data.Options) {
      for (const [key, entry] of Object.entries(data.Options)) {
        options.value[key] = entry.Value;
      }
    }
  } catch (error) {
    console.error('Error loading TPPA options:', error);
  } finally {
    loading.value = false;
  }
});

async function updateOption(key, value) {
  try {
    await apiService.postTppaOptions({ [key]: value });
  } catch (error) {
    console.error(`Error updating option ${key}:`, error);
  }
}

function toggleDefaultEastDirection() {
  options.value.DefaultEastDirection = !options.value.DefaultEastDirection;
  updateOption('DefaultEastDirection', options.value.DefaultEastDirection);
}

function toggleRefractionAdjustment() {
  options.value.RefractionAdjustment = !options.value.RefractionAdjustment;
  updateOption('RefractionAdjustment', options.value.RefractionAdjustment);
}

function toggleStopTrackingWhenDone() {
  options.value.StopTrackingWhenDone = !options.value.StopTrackingWhenDone;
  updateOption('StopTrackingWhenDone', options.value.StopTrackingWhenDone);
}

function toggleAutoPause() {
  options.value.AutoPause = !options.value.AutoPause;
  updateOption('AutoPause', options.value.AutoPause);
}

function toggleLogError() {
  options.value.LogError = !options.value.LogError;
  updateOption('LogError', options.value.LogError);
}

async function reset() {
  try {
    await apiService.postTppaReset();
    const data = await apiService.getTppaOptions();
    if (data?.Success && data.Options) {
      for (const [key, entry] of Object.entries(data.Options)) {
        options.value[key] = entry.Value;
      }
    }
  } catch (error) {
    console.error('Error resetting TPPA options:', error);
  }
}
</script>
