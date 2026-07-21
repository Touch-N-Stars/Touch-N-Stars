<template>
  <div class="flex flex-col gap-2 sm:gap-4">
    <!-- Basic Settings Container -->
    <div
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
    >
      <h3 class="font-bold text-base text-cyan-400">
        {{ $t('components.settings.plate_solver.basic') }}
      </h3>
      <SettingInput
        labelKey="components.settings.plate_solver.ExposureTime"
        helpKey="components.settings.plate_solver.help.ExposureTime"
        settingKey="PlateSolveSettings-ExposureTime"
        :modelValue="store.profileInfo.PlateSolveSettings.ExposureTime"
        :max="600"
      />
      <SettingInput
        labelKey="components.settings.plate_solver.Gain"
        helpKey="components.settings.plate_solver.help.Gain"
        settingKey="PlateSolveSettings-Gain"
        :modelValue="store.profileInfo.PlateSolveSettings.Gain"
        :modelDefaultValue="store.profileInfo.CameraSettings.Gain"
        :min="0"
        :max="600"
      />
      <div class="flex flex-row items-center justify-between w-full">
        <span class="flex items-center gap-1">
          <label for="astapLocation" class="text-xs sm:text-sm text-gray-200">
            {{ $t('components.settings.plate_solver.ASTAPLocation') }}
          </label>
          <InfoModal
            :title="$t('components.settings.plate_solver.ASTAPLocation')"
            :message="$t('components.settings.plate_solver.help.ASTAPLocation')"
            size="w-4 h-4"
          />
        </span>
        <input
          id="astapLocation"
          v-model="astapLocation"
          @change="setAstapLocation"
          type="text"
          class="tns-input text-xs sm:text-sm w-48"
          :class="statusClassAstapLocation"
          placeholder="C:\\Program Files\\astap\\astap.exe"
        />
      </div>
      <SetPlateSolverFilterPins
        v-if="store.profileInfo?.FilterWheelSettings?.FilterWheelFilters?.length"
      />
      <SetPlateSolverAstapDatabasePins v-if="store.isPINS" />
    </div>

    <!-- Search Settings Container -->
    <div
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
    >
      <h3 class="font-bold text-base text-cyan-400">
        {{ $t('components.settings.plate_solver.search') }}
      </h3>
      <SettingInput
        labelKey="components.settings.plate_solver.SearchRadius"
        helpKey="components.settings.plate_solver.help.SearchRadius"
        settingKey="PlateSolveSettings-SearchRadius"
        :modelValue="store.profileInfo.PlateSolveSettings.SearchRadius"
        :max="360"
      />
      <SettingInput
        labelKey="components.settings.plate_solver.Threshold"
        helpKey="components.settings.plate_solver.help.Threshold"
        settingKey="PlateSolveSettings-Threshold"
        :modelValue="store.profileInfo.PlateSolveSettings.Threshold"
        :min="0"
        :max="999"
        step="0.01"
      />
      <SettingInput
        labelKey="components.settings.plate_solver.RotationTolerance"
        helpKey="components.settings.plate_solver.help.RotationTolerance"
        settingKey="PlateSolveSettings-RotationTolerance"
        :modelValue="store.profileInfo.PlateSolveSettings.RotationTolerance"
        :min="0"
        :max="360"
        step="0.1"
      />
      <SettingInput
        labelKey="components.settings.plate_solver.MaxObjects"
        helpKey="components.settings.plate_solver.help.MaxObjects"
        settingKey="PlateSolveSettings-MaxObjects"
        :modelValue="store.profileInfo.PlateSolveSettings.MaxObjects"
        :max="9999"
      />
    </div>

    <!-- Retry Settings Container -->
    <div
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
    >
      <h3 class="font-bold text-base text-cyan-400">
        {{ $t('components.settings.plate_solver.retry') }}
      </h3>
      <SettingInput
        labelKey="components.settings.plate_solver.NumberOfAttempts"
        helpKey="components.settings.plate_solver.help.NumberOfAttempts"
        settingKey="PlateSolveSettings-NumberOfAttempts"
        :modelValue="store.profileInfo.PlateSolveSettings.NumberOfAttempts"
        :max="100"
      />
      <SettingInput
        labelKey="components.settings.plate_solver.ReattemptDelay"
        helpKey="components.settings.plate_solver.help.ReattemptDelay"
        settingKey="PlateSolveSettings-ReattemptDelay"
        :modelValue="store.profileInfo.PlateSolveSettings.ReattemptDelay"
        :max="3600"
      />
      <ProfileToggle
        labelKey="components.settings.plate_solver.BlindFailoverEnabled"
        helpKey="components.settings.plate_solver.help.BlindFailoverEnabled"
        settingKey="PlateSolveSettings-BlindFailoverEnabled"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import SettingInput from '@/components/helpers/settings/UpdatePorfileNumber.vue';
import ProfileToggle from '@/components/helpers/settings/ProfileToggle.vue';
import InfoModal from '@/components/helpers/infoModal.vue';
import SetPlateSolverFilterPins from './SetPlateSolverFilterPins.vue';
import SetPlateSolverAstapDatabasePins from './SetPlateSolverAstapDatabasePins.vue';
import apiService from '@/services/apiService';

const store = apiStore();

const astapLocation = ref('');
const statusClassAstapLocation = ref('');

const initializeSettings = () => {
  if (!store.profileInfo?.PlateSolveSettings) {
    console.warn('PlateSolveSettings not loaded');
    return;
  }

  astapLocation.value = store.profileInfo.PlateSolveSettings.ASTAPLocation ?? '';
};

async function setAstapLocation() {
  try {
    const data = await apiService.profileChangeValue(
      'PlateSolveSettings-ASTAPLocation',
      astapLocation.value
    );
    console.log(data);
    statusClassAstapLocation.value = 'glow-green';
  } catch (error) {
    console.error('Error setting ASTAP location:', error);
    statusClassAstapLocation.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassAstapLocation.value = '';
    }, 2000);
  }
}

onMounted(() => {
  initializeSettings();
});
</script>
