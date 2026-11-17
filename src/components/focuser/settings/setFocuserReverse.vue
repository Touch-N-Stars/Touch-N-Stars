<template>
  <div
    v-if="store.focuserInfo.CanReverse"
    class="flex items-center justify-between border border-line-strong p-2 rounded-control"
  >
    <span class="text-sm font-medium text-content">
      {{ $t('components.focuser.settings.Reverse') }}
    </span>
    <toggleButton
      @click="updateSetting"
      :disabled="store.focuserInfo.IsMoving"
      :status-value="isEnabled"
    />
  </div>
</template>
<script setup>
//#################################
//This is PINS only
//#################################
import { ref, onMounted, watch } from 'vue';
import { apiStore } from '@/store/store';
import apiPinsService from '@/services/apiPinsService';
import apiService from '@/services/apiService';
import toggleButton from '@/components/helpers/toggleButton.vue';

const store = apiStore();
const isEnabled = ref(false);

async function updateSetting() {
  isEnabled.value = !isEnabled.value;
  try {
    const response = await apiPinsService.focuserAction(`reverse?value=${isEnabled.value}`);
    await apiService.profileChangeValue('FocuserSettings-Reverse', isEnabled.value);

    if (!response.Success) {
      // Revert on error
      isEnabled.value = !isEnabled.value;
    }
  } catch (error) {
    console.log('Error save setting', error);
    // Revert on error
    isEnabled.value = !isEnabled.value;
  }
}

onMounted(() => {
  isEnabled.value = store.profileInfo?.FocuserSettings?.Reverse ?? false;
});

watch(
  () => store.profileInfo?.FocuserSettings?.Reverse,
  (newValue) => {
    if (newValue !== undefined) {
      isEnabled.value = newValue;
    }
  }
);
</script>
