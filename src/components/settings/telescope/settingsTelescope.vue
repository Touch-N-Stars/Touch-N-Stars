<template>
  <div
    class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
  >
    <h3 class="font-bold text-base text-cyan-400">
      {{ $t('components.settings.telescope.titel') }}
    </h3>
    <div class="flex flex-row items-center justify-between w-full">
      <label class="text-sm text-gray-200 whitespace-nowrap">
        {{ $t('components.settings.telescope.name') }}
      </label>
      <input
        v-model="telescopeName"
        type="text"
        class="tns-input text-xs md:text-sm w-48"
        :class="nameStatusClass"
        @change="updateTelescopeName"
      />
    </div>
    <NumberInputPicker
      v-model="focalLength"
      :label="$t('components.camera.chip_settings.focal_length')"
      labelKey="components.camera.chip_settings.focal_length"
      :min="1"
      :max="5000"
      :step="1"
      :decimalPlaces="0"
      inputId="focal-length"
      @change="updateFocalLength"
    />
    <NumberInputPicker
      v-model="focalRatio"
      :label="$t('components.settings.telescope.focal_ratio')"
      labelKey="components.settings.telescope.focal_ratio"
      :min="1"
      :max="50"
      :step="0.1"
      :decimalPlaces="1"
      inputId="focal-ratio"
      @change="updateFocalRatio"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const store = apiStore();

const focalLength = ref(0);
const focalRatio = ref(5.0);
const telescopeName = ref('');
const nameStatusClass = ref('');

async function updateTelescopeName() {
  try {
    await apiService.profileChangeValue('TelescopeSettings-Name', telescopeName.value);
    nameStatusClass.value = 'glow-green';
  } catch (error) {
    console.error('Error updating telescope name:', error);
    nameStatusClass.value = 'glow-red';
  } finally {
    setTimeout(() => {
      nameStatusClass.value = '';
    }, 2000);
  }
}

async function updateFocalLength() {
  try {
    await apiService.profileChangeValue('TelescopeSettings-FocalLength', focalLength.value);
  } catch (error) {
    console.error('Error updating FocalLength:', error);
  }
}

async function updateFocalRatio() {
  try {
    await apiService.profileChangeValue('TelescopeSettings-FocalRatio', focalRatio.value);
  } catch (error) {
    console.error('Error updating FocalRatio:', error);
  }
}

onMounted(() => {
  const profile = store.profileInfo;
  focalLength.value = profile?.TelescopeSettings?.FocalLength || 500;
  focalRatio.value = profile?.TelescopeSettings?.FocalRatio || 5.0;
  telescopeName.value = profile?.TelescopeSettings?.Name ?? '';
});
</script>
