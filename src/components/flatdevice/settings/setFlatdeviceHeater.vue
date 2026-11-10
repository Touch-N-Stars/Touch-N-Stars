<template>
  <div
    v-if="store.flatdeviceInfo.Connected"
    class="border border-line-strong p-2 rounded-lg bg-surface-2/40"
  >
    <NumberInputPicker
      v-model="heaterValue"
      :label="$t('components.flat.settings.heater')"
      labelKey="components.flat.settings.heater"
      :min="0"
      :max="3"
      :step="1"
      :decimalPlaces="0"
      placeholder="0"
      inputId="SetHeater"
      wrapperClass="flex-1"
      @change="setHeaterValue"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const store = apiStore();
const heaterValue = ref(0);

async function loadHeater() {
  try {
    const response = await apiService.flatdeviceGetHeater();
    if (response.Success) {
      heaterValue.value = response.Response || 0;
    }
  } catch (error) {
    console.error('Error loading heater:', error);
  }
}

async function setHeaterValue() {
  try {
    await apiService.flatdeviceSetHeater(heaterValue.value);
    // Reload to confirm persistence
    await loadHeater();
  } catch (error) {
    console.error('Error setting heater:', error);
  }
}

onMounted(() => {
  loadHeater();
});
</script>
