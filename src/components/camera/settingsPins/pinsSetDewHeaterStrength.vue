<template>
  <div
    class="flex items-center w-full justify-between border border-gray-500 p-1 md:p-2 rounded-lg"
  >
    <label for="setUsbLimit" class="text-xs md:text-sm text-gray-200 font-medium">
      {{ $t('components.camera.dewHeaterStrength') }}
    </label>
    <select
      @change="setDewHeaterStrength"
      id="setDewHeaterStrength"
      v-model="dewHeaterStrength"
      class="default-select h-7 md:h-8 w-20 md:w-28"
    >
      <option v-for="n in dewHeaterOptions" :key="n" :value="n">
        {{ n }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import apiService from '@/services/apiService';
import { useCameraStore } from '@/store/cameraStore';

const cameraStore = useCameraStore();
const dewHeaterStrength = ref(9);

const dewHeaterOptions = computed(() => {
  const min = cameraStore.cameraSettings.MinDewHeaterStrength;
  const max = cameraStore.cameraSettings.MaxDewHeaterStrength;
  if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }
  return Array.from({ length: 11 }, (_, i) => i * 10);
});

onMounted(() => {
  dewHeaterStrength.value = cameraStore.cameraSettings.TargetDewHeaterStrength;
});

async function setDewHeaterStrength() {
  try {
    const response = await apiService.cameraAction(
      `set-setting?settingName=TargetDewHeaterStrength&newValue=${dewHeaterStrength.value}`
    );
    await cameraStore.readSettings();
    console.log('[dewHeaterStrength] ', response);
  } catch (error) {
    console.log('Error while setting dewHeaterStrength');
  }
}
</script>
