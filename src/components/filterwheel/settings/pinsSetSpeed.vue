<template>
  <div
    v-if="filterStore.filterwheelSettings?.Speeds !== undefined"
    class="flex items-center w-full justify-between border border-line-strong p-1 md:p-2 rounded-control"
  >
    <label for="setSpeed" class="text-xs md:text-sm text-content font-medium">
      {{ $t('components.filterwheel.settings.Speed') }}
    </label>
    <select id="setSpeed" v-model="speed" @change="setSpeed" class="tns-select w-24 md:w-32">
      <option
        v-for="(label, index) in filterStore.filterwheelSettings.Speeds"
        :key="index"
        :value="index"
      >
        {{ label }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import apiService from '@/services/apiService';
import { useFilterStore } from '@/store/filterStore';

const filterStore = useFilterStore();
const speed = ref(0);

onMounted(() => {
  speed.value = filterStore.filterwheelSettings?.Speed ?? 0;
});

watch(
  () => filterStore.filterwheelSettings?.Speed,
  (val) => {
    if (val !== undefined) speed.value = val;
  }
);

async function setSpeed() {
  try {
    await apiService.filterAction(`set-setting?settingName=Speed&newValue=${speed.value}`);
  } catch (error) {
    console.log('[pinsSetSpeed] Error:', error);
  }
}
</script>
