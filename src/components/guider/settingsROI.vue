<template>
  <div class="flex flex-col w-full border border-line-strong p-1 md:p-2 rounded-lg">
    <!-- ROI Percentage -->
    <div class="flex flex-row items-center justify-between">
      <NumberInputPicker
        v-model="roiPercentage"
        :label="$t('components.guider.roiPercentage')"
        labelKey="components.guider.roiPercentage"
        :min="0"
        :max="100"
        :step="1"
        :decimalPlaces="0"
        placeholder="25"
        inputId="roiPercentage"
        wrapperClass="w-24"
        @change="setRoiPercentage"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const store = apiStore();

const roiPercentage = ref(25);

const statusClassRoiPercentage = ref('');

const initializeSettings = () => {
  if (!store.profileInfo?.GuiderSettings) {
    console.warn('GuiderSettings not loaded');
    return;
  }

  roiPercentage.value = store.profileInfo.GuiderSettings.PHD2ROIPct ?? 25;
};

async function setRoiPercentage() {
  try {
    await apiService.profileChangeValue('GuiderSettings-PHD2ROIPct', roiPercentage.value);
    statusClassRoiPercentage.value = 'glow-green';
  } catch (error) {
    console.error('Error setting ROI percentage:', error);
    statusClassRoiPercentage.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassRoiPercentage.value = '';
    }, 2000);
  }
}

onMounted(() => {
  initializeSettings();
});
</script>
