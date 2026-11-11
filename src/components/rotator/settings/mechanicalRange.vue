<template>
  <div class="p-4 gap-2 flex flex-col bg-surface-2/50 rounded-lg border border-line/50">
    <SettingSelect
      labelKey="components.rotator.settings.RangeType"
      settingKey="RotatorSettings-RangeType"
      :modelValue="store.profileInfo.RotatorSettings.RangeType"
      :options="['QUARTER', 'HALF', 'FULL']"
      translationPrefix="components.rotator.settings."
    />
    <SettingInput
      labelKey="components.rotator.settings.RangeStartMechanicalPosition"
      settingKey="RotatorSettings-RangeStartMechanicalPosition"
      :modelValue="store.profileInfo.RotatorSettings.RangeStartMechanicalPosition"
      :min="0"
      :max="360"
      step="1"
    />
  </div>
</template>
<script setup>
import { apiStore } from '@/store/store';
import SettingInput from '@/components/helpers/settings/UpdatePorfileNumber.vue';
import SettingSelect from '@/components/helpers/settings/SettingProfilSelect.vue';

const store = apiStore();
</script>
