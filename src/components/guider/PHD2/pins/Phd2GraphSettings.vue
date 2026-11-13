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
import { useProfileSetting } from '@/composables/useProfileSetting';

const scaleOptions = ['ARCSECONDS', 'PIXELS'];
const maxYOptions = [1, 2, 4, 8, 16, 32];
const historySizeOptions = [50, 100, 200, 400];

// An empty or zero profile value falls back to PHD2's default, as before.
const {
  value: guiderScale,
  save: onGuiderScaleChange,
  glowClass: guiderScaleStatusClass,
} = useProfileSetting('GuiderSettings-PHD2GuiderScale', {
  fallback: 'ARCSECONDS',
  fromProfile: (v) => v || 'ARCSECONDS',
});
const {
  value: maxY,
  save: onMaxYChange,
  glowClass: maxYStatusClass,
} = useProfileSetting('GuiderSettings-MaxY', {
  fallback: 4,
  fromProfile: (v) => v || 4,
});
const {
  value: historySize,
  save: onHistorySizeChange,
  glowClass: historySizeStatusClass,
} = useProfileSetting('GuiderSettings-PHD2HistorySize', {
  fallback: 100,
  fromProfile: (v) => v || 100,
});
</script>
