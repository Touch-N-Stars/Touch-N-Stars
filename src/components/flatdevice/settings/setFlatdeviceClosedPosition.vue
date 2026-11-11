<template>
  <div
    v-if="store.flatdeviceInfo.Connected"
    class="border border-line-strong p-2 rounded-lg bg-surface-2/40"
  >
    <NumberInputPicker
      v-model="closedPositionValue"
      :label="$t('components.flat.settings.closedPosition')"
      labelKey="components.flat.settings.closedPosition"
      :min="0"
      :max="360"
      :step="0.1"
      :decimalPlaces="1"
      placeholder="0"
      inputId="SetClosedPosition"
      wrapperClass="flex-1"
      @change="setClosedPositionValue"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const store = apiStore();
const closedPositionValue = ref(0);

async function loadClosedPosition() {
  try {
    const response = await apiService.flatdeviceGetClosedPosition();
    if (response.Success) {
      closedPositionValue.value = response.Response || 0;
    }
  } catch (error) {
    console.error('Error loading closed position:', error);
  }
}

async function setClosedPositionValue() {
  try {
    await apiService.flatdeviceSetClosedPosition(closedPositionValue.value);
    // Reload to confirm persistence
    await loadClosedPosition();
  } catch (error) {
    console.error('Error setting closed position:', error);
  }
}

onMounted(() => {
  loadClosedPosition();
});
</script>
