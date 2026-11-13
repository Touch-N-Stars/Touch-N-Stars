<template>
  <div
    v-if="store.flatdeviceInfo.Connected"
    class="border border-line-strong p-2 rounded-lg bg-surface-2/40"
  >
    <NumberInputPicker
      v-model="openPositionValue"
      :label="$t('components.flat.settings.openPosition')"
      labelKey="components.flat.settings.openPosition"
      :min="0"
      :max="360"
      :step="0.1"
      :decimalPlaces="1"
      placeholder="0"
      inputId="SetOpenPosition"
      wrapperClass="flex-1"
      @change="setOpenPositionValue"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const store = apiStore();
const openPositionValue = ref(0);

async function loadOpenPosition() {
  try {
    const response = await apiService.flatdeviceGetOpenPosition();
    if (response.Success) {
      openPositionValue.value = response.Response || 0;
    }
  } catch (error) {
    console.error('Error loading open position:', error);
  }
}

async function setOpenPositionValue() {
  try {
    await apiService.flatdeviceSetOpenPosition(openPositionValue.value);
    // Reload to confirm persistence
    await loadOpenPosition();
  } catch (error) {
    console.error('Error setting open position:', error);
  }
}

onMounted(() => {
  loadOpenPosition();
});
</script>
