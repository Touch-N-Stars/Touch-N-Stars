<template>
  <div class="flex flex-col md:flex-row w-full md:items-center">
    <NumberInputPicker
      v-model="value"
      :label="$t(`${labelKey}`)"
      :labelKey="labelKey"
      :helpMessage="helpKey ? $t(`${helpKey}`) : ''"
      :min="min"
      :max="max"
      :step="step"
      :decimalPlaces="decimalPlaces"
      :placeholder="placeholder"
      wrapperClass="flex-1"
      @change="updateSetting"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const props = defineProps({
  labelKey: {
    type: String,
    required: true,
  },
  helpKey: {
    type: String,
    default: '',
  },
  settingKey: {
    type: String,
    required: true,
  },
  modelValue: {
    type: Number,
    required: true,
  },
  modelDefaultValue: {
    type: Number,
    default: 0,
  },
  min: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: 100000,
  },
  step: {
    type: Number,
    default: 1,
  },
  placeholder: {
    type: String,
    default: '100',
  },
});

const value = ref(0);

const decimalPlaces = computed(() => {
  const stepStr = String(props.step);
  return stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
});

async function updateSetting() {
  let settingValue = String(value.value).replace(',', '.');
  try {
    await apiService.profileChangeValue(`${props.settingKey}`, settingValue);
  } catch (error) {
    console.error('Error updating setting:', error);
  }
}

onMounted(() => {
  if (props.modelValue === -1) {
    value.value = props.modelDefaultValue;
  } else {
    value.value = props.modelValue;
  }
});
</script>
