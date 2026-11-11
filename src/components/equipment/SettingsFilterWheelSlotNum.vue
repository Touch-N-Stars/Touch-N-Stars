<template>
  <div v-if="isVisible" class="tns-card flex flex-col">
    <div class="flex flex-row items-center justify-between w-full">
      <label for="slotNum" class="text-xs md:text-sm text-content mr-2">
        {{ $t('components.filterwheel.settings.SlotNum') }}
      </label>
      <select
        id="slotNum"
        v-model.number="slotNum"
        @change="setSlotNum"
        class="tns-select text-xs md:text-sm w-48"
        :class="statusClass"
      >
        <option :value="-1">{{ $t('components.filterwheel.settings.slotNumDefault') }}</option>
        <option v-for="n in [5, 7, 8]" :key="n" :value="n">{{ n }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import { useProfileSetting } from '@/composables/useProfileSetting';

const props = defineProps({
  selectedDevice: { type: String, default: '' },
  selectedDeviceObj: { type: Object, default: null },
});

const store = apiStore();
const {
  value: slotNum,
  save: setSlotNum,
  glowClass: statusClass,
} = useProfileSetting('FilterWheelSettings-SlotNum', { fallback: -1 });

const isVisible = computed(() => {
  if (props.selectedDeviceObj?.Category === 'ASCOM Alpaca') return false;
  const deviceName = props.selectedDevice.toLowerCase();
  const driverInfo = store.filterInfo?.DriverInfo?.toLowerCase() || '';
  const category = store.filterInfo?.Category?.toLowerCase() || '';
  return !(deviceName.includes('indi') || driverInfo.includes('indi') || category.includes('indi'));
});

// The modal can open right after a driver change: fetch the profile now instead of waiting
// for the poller, so the select starts on the current slot count.
onMounted(() => store.fetchProfilInfos());
</script>
