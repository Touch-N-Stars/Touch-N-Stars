<template>
  <div class="flex flex-col w-full border border-line-strong p-1 rounded-lg">
    <label class="text-sm sm:text-xs mb-2 text-content">{{ $t(`${labelKey}`) }}</label>
    <select
      v-model="value"
      @change="updateSetting"
      :class="[statusClass]"
      class="tns-select w-full py-2"
    >
      <option value="">{{ $t('common.select') }}</option>
      <option v-for="option in options" :key="option" :value="option">
        {{ $t(translationPrefix + option) }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiService from '@/services/apiService';

const props = defineProps({
  labelKey: {
    type: String,
    required: true,
  },
  settingKey: {
    type: String,
    required: true,
  },
  modelValue: {
    type: String,
    required: true,
  },
  options: {
    type: Array,
    required: true,
  },
  translationPrefix: {
    type: String,
    required: true,
  },
});

const value = ref('');
const statusClass = ref('');

async function updateSetting() {
  try {
    const response = await apiService.profileChangeValue(props.settingKey, value.value);
    if (!response.Success) return;
    statusClass.value = 'glow-green';
  } catch (error) {
    console.log('Error save setting');
  }
  setTimeout(() => {
    statusClass.value = '';
  }, 1000);
}

onMounted(() => {
  value.value = props.modelValue;
});
</script>
