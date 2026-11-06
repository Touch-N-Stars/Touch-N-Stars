<template>
  <div>
    <label class="block text-sm font-medium text-content mb-2">{{
      $t('components.settings.image.maxDimension')
    }}</label>
    <select
      :value="String(settingsStore.camera.maxDimension)"
      @change="
        (e) => {
          settingsStore.camera.maxDimension = parseInt(e.target.value);
          updateSetting();
        }
      "
      :class="[statusClass]"
      class="tns-select"
    >
      <option v-for="option in resolutionOptions" :key="option.value" :value="String(option.value)">
        {{ option.label }}{{ option.value < 99999 ? ` (${option.value}px)` : '' }}
      </option>
    </select>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { useSettingsStore } from '@/store/settingsStore';

const settingsStore = useSettingsStore();
const statusClass = ref('');

const resolutionOptions = [
  { label: 'Full', value: 99999 },
  { label: 'High', value: 4096 },
  { label: 'Medium', value: 2048 },
  { label: 'Low', value: 1024 },
];

function updateSetting() {
  statusClass.value = 'glow-green';
  console.log(`Set max image dimension to ${settingsStore.camera.maxDimension}px`);
  settingsStore.saveCameraSettings();
  setTimeout(() => {
    statusClass.value = '';
  }, 1000);
}
</script>
