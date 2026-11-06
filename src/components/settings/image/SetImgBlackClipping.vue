<template>
  <div class="block">
    <label class="block text-sm font-medium text-content mb-2">{{
      $t('components.settings.image.black_clipping')
    }}</label>
    <NumberInputPicker
      v-model="setValue"
      labelKey="components.settings.image.black_clipping"
      :min="-10"
      :max="0"
      :step="0.1"
      :decimalPlaces="1"
      placeholder="-2.8"
      inputId="black-clipping"
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
const setValue = ref(0);

async function updateSetting() {
  let value = String(setValue.value).replace(',', '.');
  try {
    const response = await apiService.profileChangeValue('ImageSettings-BlackClipping', value);
    if (!response.Success) return;
  } catch (error) {
    console.log('Error save setting');
  }
}

onMounted(() => {
  setValue.value = store.profileInfo.ImageSettings.BlackClipping;
});
</script>
