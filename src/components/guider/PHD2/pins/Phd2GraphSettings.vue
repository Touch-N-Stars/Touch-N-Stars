<template>
  <div class="flex flex-col gap-1 w-full border border-line-strong rounded-lg p-3">
    <!-- Guider Scale -->
    <div class="flex flex-row w-full items-center">
      <label for="phd2-guider-scale" class="text-sm sm:text-xs mr-3 text-content">
        {{ $t('components.guider.phd2.guiderScale') }}
      </label>
      <select
        id="phd2-guider-scale"
        v-model="guiderScale"
        @change="onGuiderScaleChange"
        :class="[guiderScaleStatusClass]"
        class="tns-select min-w-40 ml-auto"
      >
        <option v-for="option in scaleOptions" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </div>

    <!-- Max Y -->
    <div class="flex flex-row w-full items-center">
      <label for="phd2-max-y" class="text-sm sm:text-xs mr-3 text-content">
        {{ $t('components.guider.phd2.maxY') }}
      </label>
      <select
        id="phd2-max-y"
        v-model="maxY"
        @change="onMaxYChange"
        :class="[maxYStatusClass]"
        class="tns-select min-w-40 ml-auto"
      >
        <option v-for="option in maxYOptions" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </div>

    <!-- History Size -->
    <div class="flex flex-row w-full items-center">
      <label for="phd2-history-size" class="text-sm sm:text-xs mr-3 text-content">
        {{ $t('components.guider.phd2.historySize') }}
      </label>
      <select
        id="phd2-history-size"
        v-model="historySize"
        @change="onHistorySizeChange"
        :class="[historySizeStatusClass]"
        class="tns-select min-w-40 ml-auto"
      >
        <option v-for="option in historySizeOptions" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';

const store = apiStore();

const scaleOptions = ['ARCSECONDS', 'PIXELS'];
const maxYOptions = [1, 2, 4, 8, 16, 32];
const historySizeOptions = [50, 100, 200, 400];

const guiderScale = ref('');
const maxY = ref(4);
const historySize = ref(100);

const guiderScaleStatusClass = ref('');
const maxYStatusClass = ref('');
const historySizeStatusClass = ref('');

onMounted(() => {
  guiderScale.value = store.profileInfo?.GuiderSettings?.PHD2GuiderScale || 'ARCSECONDS';
  maxY.value = store.profileInfo?.GuiderSettings?.MaxY || 4;
  historySize.value = store.profileInfo?.GuiderSettings?.PHD2HistorySize || 100;
});

const onGuiderScaleChange = async () => {
  try {
    const response = await apiService.profileChangeValue(
      'GuiderSettings-PHD2GuiderScale',
      guiderScale.value
    );
    if (response.Success) {
      guiderScaleStatusClass.value = 'glow-green';
      setTimeout(() => {
        guiderScaleStatusClass.value = '';
      }, 1000);
    }
  } catch (error) {
    console.error('Error changing guider scale:', error);
  }
};

const onMaxYChange = async () => {
  try {
    const response = await apiService.profileChangeValue('GuiderSettings-MaxY', maxY.value);
    if (response.Success) {
      maxYStatusClass.value = 'glow-green';
      setTimeout(() => {
        maxYStatusClass.value = '';
      }, 1000);
    }
  } catch (error) {
    console.error('Error changing max Y:', error);
  }
};

const onHistorySizeChange = async () => {
  try {
    const response = await apiService.profileChangeValue(
      'GuiderSettings-PHD2HistorySize',
      historySize.value
    );
    if (response.Success) {
      historySizeStatusClass.value = 'glow-green';
      setTimeout(() => {
        historySizeStatusClass.value = '';
      }, 1000);
    }
  } catch (error) {
    console.error('Error changing history size:', error);
  }
};
</script>
