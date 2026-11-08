<template>
  <div class="flex flex-col w-full border border-line-strong p-1 md:p-2 rounded-lg">
    <!-- Settle Pixel Tolerance -->
    <div class="flex flex-row items-center justify-between">
      <NumberInputPicker
        v-model="settlePixels"
        :label="$t('components.guider.settlePixels')"
        labelKey="components.guider.settlePixels"
        :min="0"
        :max="100"
        :step="0.1"
        :decimalPlaces="1"
        placeholder="1.5"
        inputId="settlePixels"
        wrapperClass="w-24"
        @change="setSettlePixels"
      />
    </div>

    <!-- Minimum Settle Time -->
    <div class="flex flex-row items-center justify-between mt-2 md:mt-3">
      <NumberInputPicker
        v-model="settleTime"
        :label="$t('components.guider.settleTime')"
        labelKey="components.guider.settleTime"
        :min="0"
        :max="300"
        :step="1"
        :decimalPlaces="0"
        placeholder="10"
        inputId="settleTime"
        wrapperClass="w-24"
        @change="setSettleTime"
      />
    </div>

    <!-- Settle Timeout -->
    <div class="flex flex-row items-center justify-between mt-2 md:mt-3">
      <NumberInputPicker
        v-model="settleTimeout"
        :label="$t('components.guider.settleTimeout')"
        labelKey="components.guider.settleTimeout"
        :min="0"
        :max="300"
        :step="1"
        :decimalPlaces="0"
        placeholder="30"
        inputId="settleTimeout"
        wrapperClass="w-24"
        @change="setSettleTimeout"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const store = apiStore();

const settlePixels = ref(1.5);
const settleTime = ref(10);
const settleTimeout = ref(30);

const statusClassSettlePixels = ref('');
const statusClassSettleTime = ref('');
const statusClassSettleTimeout = ref('');

const initializeSettings = () => {
  if (!store.profileInfo?.GuiderSettings) {
    console.warn('GuiderSettings not loaded');
    return;
  }

  settlePixels.value = store.profileInfo.GuiderSettings.SettlePixels ?? 1.5;
  settleTime.value = store.profileInfo.GuiderSettings.SettleTime ?? 10;
  settleTimeout.value = store.profileInfo.GuiderSettings.SettleTimeout ?? 30;
};

async function setSettlePixels() {
  try {
    await apiService.profileChangeValue('GuiderSettings-SettlePixels', settlePixels.value);
    statusClassSettlePixels.value = 'glow-green';
  } catch (error) {
    console.error('Error setting settle pixels:', error);
    statusClassSettlePixels.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassSettlePixels.value = '';
    }, 2000);
  }
}

async function setSettleTime() {
  try {
    await apiService.profileChangeValue('GuiderSettings-SettleTime', settleTime.value);
    statusClassSettleTime.value = 'glow-green';
  } catch (error) {
    console.error('Error setting settle time:', error);
    statusClassSettleTime.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassSettleTime.value = '';
    }, 2000);
  }
}

async function setSettleTimeout() {
  try {
    await apiService.profileChangeValue('GuiderSettings-SettleTimeout', settleTimeout.value);
    statusClassSettleTimeout.value = 'glow-green';
  } catch (error) {
    console.error('Error setting settle timeout:', error);
    statusClassSettleTimeout.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassSettleTimeout.value = '';
    }, 2000);
  }
}

onMounted(() => {
  initializeSettings();
});
</script>
