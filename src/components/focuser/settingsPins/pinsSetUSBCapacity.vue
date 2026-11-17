<template>
  <div
    v-if="focuserStore.focuserSettings?.USBCapacities !== undefined"
    class="flex items-center w-full justify-between border border-line-strong p-1 md:p-2 rounded-control"
  >
    <label for="setUSBCapacity" class="text-xs md:text-sm text-content font-medium">
      {{ $t('components.focuser.settings.USBCapacity') }}
    </label>
    <select
      id="setUSBCapacity"
      v-model="usbCapacity"
      @change="setUSBCapacity"
      class="tns-select w-32"
    >
      <option
        v-for="(label, index) in focuserStore.focuserSettings.USBCapacities"
        :key="index"
        :value="index"
      >
        {{ label }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import apiService from '@/services/apiService';
import { useFocuserStore } from '@/store/focuserStore';

const focuserStore = useFocuserStore();
const usbCapacity = ref(0);

onMounted(() => {
  usbCapacity.value = focuserStore.focuserSettings?.USBCapacity ?? 0;
});

watch(
  () => focuserStore.focuserSettings?.USBCapacity,
  (val) => {
    if (val !== undefined) usbCapacity.value = val;
  }
);

async function setUSBCapacity() {
  try {
    await apiService.focusAction(
      `set-setting?settingName=USBCapacity&newValue=${usbCapacity.value}`
    );
  } catch (error) {
    console.log('[pinsSetUSBCapacity] Error:', error);
  }
}
</script>
