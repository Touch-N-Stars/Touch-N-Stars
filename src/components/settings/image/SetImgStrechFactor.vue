<template>
  <div class="block">
    <label class="block text-sm font-medium text-content mb-2">{{
      $t('components.settings.image.strech_factor')
    }}</label>
    <NumberInputPicker
      v-model="strechFactor"
      labelKey="components.settings.image.strech_factor"
      :min="0"
      :max="10"
      :step="0.1"
      :decimalPlaces="1"
      placeholder="0.1"
      inputId="strech-factor"
      wrapperClass="w-full"
      @change="updateSetting"
    />
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const store = apiStore();
const strechFactor = ref(0);

async function updateSetting() {
  let value = String(strechFactor.value).replace(',', '.');
  try {
    const response = await apiService.profileChangeValue('ImageSettings-AutoStretchFactor', value);
    if (!response.Success) return;
  } catch (error) {
    console.log('Error save setting');
  }
}

onMounted(() => {
  strechFactor.value = store.profileInfo.ImageSettings.AutoStretchFactor;
});
</script>
