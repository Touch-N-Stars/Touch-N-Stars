<template>
  <div v-if="isWandererRotator" class="border border-line-strong p-2 rounded-lg bg-surface-2/40">
    <NumberInputPicker
      v-model="backlashValue"
      :label="$t('components.rotator.settings.Backlash')"
      :min="0"
      :max="360"
      :step="0.1"
      :decimalPlaces="1"
      placeholder="0"
      wrapperClass="flex-1"
      @change="setBacklashValue"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const store = apiStore();
const backlashValue = ref(0);

const isWandererRotator = computed(() => store.rotatorInfo?.Name?.includes('Wanderer') ?? false);

watch(
  isWandererRotator,
  async (isWanderer) => {
    if (!isWanderer) return;
    await loadBacklash();
  },
  { immediate: true }
);

async function loadBacklash() {
  try {
    const response = await apiService.getRotatorBacklash();
    if (response?.Success && response?.Response !== undefined) {
      backlashValue.value = parseFloat(response.Response);
    }
  } catch (err) {
    console.error('Error loading rotator backlash:', err);
  }
}

async function setBacklashValue() {
  try {
    const response = await apiService.setRotatorBacklash(backlashValue.value);
    if (response?.Success) {
      console.log('Rotator backlash set to:', backlashValue.value);
      await loadBacklash();
    } else {
      console.error('Failed to set rotator backlash:', response?.Error);
    }
  } catch (err) {
    console.error('Error setting rotator backlash:', err);
  }
}
</script>
