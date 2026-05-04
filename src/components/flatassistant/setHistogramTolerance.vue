<template>
  <NumberInputPicker
    v-model="meanTolerancePercentage"
    :label="$t('components.flatassistant.mean_tolerance')"
    labelKey="components.flatassistant.mean_tolerance"
    :min="0"
    :max="100"
    :step="1"
    :decimalPlaces="0"
    inputId="mean-tolerance"
  />
</template>
<script setup>
import { computed, onMounted, watch } from 'vue';
import { apiStore } from '@/store/store';
import { useFlatassistantStore } from '@/store/flatassistantStore';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import apiService from '@/services/apiService';

const store = apiStore();
const flatsStore = useFlatassistantStore();

const meanTolerancePercentage = computed({
  get: () => Math.round(flatsStore.meanTolerance * 100),
  set: (value) => {
    flatsStore.meanTolerance = value / 100;
  },
});

watch(
  () => flatsStore.meanTolerance,
  async (newValue) => {
    if (!newValue) return;
    await apiService.profileChangeValue('FlatWizardSettings-HistogramTolerance', newValue);
  }
);

onMounted(() => {
  flatsStore.meanTolerance = store.profileInfo?.FlatWizardSettings?.HistogramTolerance ?? 0;
});
</script>
