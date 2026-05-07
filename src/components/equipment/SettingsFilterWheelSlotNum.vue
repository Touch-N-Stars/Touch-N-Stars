<template>
  <div
    v-if="isVisible"
    class="flex flex-col border border-gray-500 p-1 md:p-2 rounded-lg"
  >
    <div class="flex flex-row items-center justify-between w-full">
      <label for="slotNum" class="text-xs md:text-sm text-gray-200 mr-2">
        {{ $t('components.filterwheel.settings.SlotNum') }}
      </label>
      <select
        id="slotNum"
        v-model.number="slotNum"
        @change="setSlotNum"
        class="default-input h-7 md:h-8 text-xs md:text-sm w-48"
        :class="statusClass"
      >
        <option :value="-1">{{ $t('components.filterwheel.settings.slotNumDefault') }}</option>
        <option v-for="n in [5,7,8]" :key="n" :value="n">{{ n }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';

const props = defineProps({
  selectedDevice: { type: String, default: '' },
  selectedDeviceObj: { type: Object, default: null },
});

const store = apiStore();
const slotNum = ref(-1);
const statusClass = ref('');

const isVisible = computed(() => {
  if (props.selectedDeviceObj?.Category === 'ASCOM Alpaca') return false;
  const deviceName = props.selectedDevice.toLowerCase();
  const driverInfo = store.filterInfo?.DriverInfo?.toLowerCase() || '';
  const category = store.filterInfo?.Category?.toLowerCase() || '';
  return !(deviceName.includes('indi') || driverInfo.includes('indi') || category.includes('indi'));
});

onMounted(async () => {
  await store.fetchProfilInfos();
  slotNum.value = store.profileInfo?.FilterWheelSettings?.SlotNum ?? -1;
});

async function setSlotNum() {
  try {
    await apiService.profileChangeValue('FilterWheelSettings-SlotNum', slotNum.value);
    statusClass.value = 'glow-green';
  } catch (error) {
    console.error('Error setting filter wheel slot num:', error);
    statusClass.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClass.value = '';
    }, 2000);
  }
}
</script>
