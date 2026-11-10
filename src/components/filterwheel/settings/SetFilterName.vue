<template>
  <div class="flex flex-row w-full items-center">
    <label class="text-sm text-content mr-10 whitespace-nowrap">
      {{ $t('components.filterwheel.settings.FilterWheelFilters.Name') }}
    </label>
    <input
      v-model="value"
      type="text"
      class="tns-input w-full"
      @input="sanitizeName"
      @change="updateSetting"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiService from '@/services/apiService';

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  settingKey: {
    type: String,
    required: true,
  },
});

const value = ref('');
const filterName = ref(props.modelValue);

// Allow harmless separators (dash, underscore, space) in filter names such as
// "Ha 3nm" or "L-eXtreme"; everything else is stripped while typing.
function sanitizeName(event) {
  value.value = event.target.value.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '');
}

async function updateSetting() {
  value.value = value.value.trim();
  try {
    await apiService.profileChangeValue(`${props.settingKey}`, value.value);
  } catch (error) {
    console.error('Error updating filter name:', error);
  }
}

onMounted(() => {
  value.value = props.modelValue;
  filterName.value = props.modelValue;
});
</script>
