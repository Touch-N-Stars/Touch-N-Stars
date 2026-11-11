<template>
  <div>
    <div class="flex items-center justify-between pr-1">
      <span class="text-sm font-medium text-content">
        {{ $t('components.focuser.settings.UseFilterWheelOffsets') }}
      </span>
      <toggleButton @click="updateSetting" :status-value="isEnabled" />
    </div>
    <div v-if="isEnabled && filters.length > 0" class="mt-2 flex items-center justify-between pr-1">
      <span class="text-sm font-medium text-content">
        {{ $t('components.focuser.settings.AutoFocusFilter') }}
      </span>
      <select v-model="selectedFilterIndex" @change="updateAutoFocusFilter" class="tns-select w-40">
        <option :value="-1">{{ $t('components.focuser.settings.AutoFocusFilterNone') }}</option>
        <option v-for="(filter, index) in filters" :key="index" :value="index">
          {{ filter.Name }}
        </option>
      </select>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import { useProfileSetting } from '@/composables/useProfileSetting';
import toggleButton from '@/components/helpers/toggleButton.vue';

const store = apiStore();
const { value: isEnabled, save } = useProfileSetting('FocuserSettings-UseFilterWheelOffsets', {
  fallback: false,
});
const selectedFilterIndex = ref(0);

const filters = computed(() => store.profileInfo?.FilterWheelSettings?.FilterWheelFilters ?? []);

function updateSetting() {
  save(!isEnabled.value);
}

async function updateAutoFocusFilter() {
  const newIndex = selectedFilterIndex.value;
  try {
    for (let i = 0; i < filters.value.length; i++) {
      await apiService.profileChangeValue(
        `FilterWheelSettings-FilterWheelFilters-${i}-AutoFocusFilter`,
        i === newIndex
      );
    }
  } catch (error) {
    console.log('Error saving AutoFocusFilter');
  }
}

onMounted(() => {
  const idx = filters.value.findIndex((f) => f.AutoFocusFilter);
  selectedFilterIndex.value = idx >= 0 ? idx : -1;
});
</script>
