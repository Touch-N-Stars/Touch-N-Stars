<template>
  <div
    v-if="focuserStore.focuserSettings?.HasMotorSpeedControl"
    class="flex items-center w-full justify-between border border-line-strong p-1 md:p-2 rounded-control"
  >
    <label for="setMotorSpeed" class="text-xs md:text-sm text-content font-medium">
      {{ $t('components.focuser.settings.MotorSpeedControl') }}
    </label>
    <select id="setMotorSpeed" v-model="motorSpeed" @change="setMotorSpeed" class="tns-select w-32">
      <option
        v-for="(label, index) in focuserStore.focuserSettings.MotorSpeeds"
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
const motorSpeed = ref(0);

onMounted(() => {
  motorSpeed.value = focuserStore.focuserSettings?.MotorSpeed ?? 0;
});

watch(
  () => focuserStore.focuserSettings?.MotorSpeed,
  (val) => {
    if (val !== undefined) motorSpeed.value = val;
  }
);

async function setMotorSpeed() {
  try {
    await apiService.focusAction(`set-setting?settingName=MotorSpeed&newValue=${motorSpeed.value}`);
  } catch (error) {
    console.log('[pinsSetMotorSpeedControl] Error:', error);
  }
}
</script>
