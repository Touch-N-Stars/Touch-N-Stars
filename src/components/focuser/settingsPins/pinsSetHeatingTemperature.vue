<template>
  <div
    v-if="focuserStore.focuserSettings?.HeatingTemperature !== undefined"
    class="flex items-center w-full justify-between border border-line-strong p-1 md:p-2 rounded-control"
  >
    <label class="text-xs md:text-sm text-content font-medium">
      {{ $t('components.focuser.settings.HeatingTemperature') }}
    </label>
    <NumberInputPicker
      v-model="temperature"
      labelKey="components.focuser.settings.HeatingTemperature"
      :min="-40"
      :max="30"
      :step="1"
      :decimalPlaces="0"
      inputId="heating-temperature"
      @update:modelValue="setTemperature"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import apiService from '@/services/apiService';
import { useFocuserStore } from '@/store/focuserStore';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const focuserStore = useFocuserStore();
const temperature = ref(0);

onMounted(() => {
  temperature.value = focuserStore.focuserSettings?.HeatingTemperature ?? 0;
});

watch(
  () => focuserStore.focuserSettings?.HeatingTemperature,
  (val) => {
    if (val !== undefined) temperature.value = val;
  }
);

async function setTemperature(val) {
  try {
    await apiService.focusAction(`set-setting?settingName=HeatingTemperature&newValue=${val}`);
  } catch (error) {
    console.log('[pinsSetHeatingTemperature] Error:', error);
  }
}
</script>
