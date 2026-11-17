<template>
  <NumberInputPicker
    v-if="darksAvailable"
    v-model="flatsStore.darkCount"
    :label="$t('components.flatassistant.darks_to_take')"
    labelKey="components.flatassistant.darks_to_take"
    :min="0"
    :max="999"
    :step="1"
    :decimalPlaces="0"
    inputId="dark-count"
    @change="updateDarkCount"
  />
</template>

<script setup>
import { computed, watch } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useFlatassistantStore } from '@/store/flatassistantStore';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const store = apiStore();
const flatsStore = useFlatassistantStore();

// Dark flats come from the plugin-side run (NINA and PINS) or, with older plugins,
// from the PINS ninaAPI fork. Official ninaAPI under NINA has none.
const darksAvailable = computed(() => store.isPINS || flatsStore.serverWorkflow === true);

async function updateDarkCount(value) {
  await apiService.profileChangeValue('FlatWizardSettings-DarkFlatCount', value);
}

watch(
  darksAvailable,
  (available) => {
    flatsStore.darkCount = available
      ? store.profileInfo?.FlatWizardSettings?.DarkFlatCount || 0
      : 0;
  },
  { immediate: true }
);
</script>
