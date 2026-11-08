<template>
  <div class="flex flex-col bg-surface-2 rounded-control border border-line overflow-hidden">
    <!-- Header Button -->
    <button
      @click="toggleControls"
      type="button"
      class="flex items-center gap-2 px-3 min-h-touch text-sm font-semibold text-content hover:bg-surface-3 transition-colors w-full text-left"
      :aria-expanded="isControlsOpen"
    >
      <ChevronRightIcon
        class="w-4 h-4 shrink-0 transition-transform duration-200"
        :class="{ 'rotate-90': isControlsOpen }"
      />
      <Cog6ToothIcon class="w-4 h-4 shrink-0" />
      <span>{{ $t('components.sequence.graphControls.title') }}</span>
    </button>

    <!-- Collapsible Controls Section -->
    <transition name="slide-fade">
      <div v-if="isControlsOpen" class="flex flex-col gap-3 p-3 border-t border-line">
        <!-- Time Display -->
        <div class="flex justify-between items-center text-xs text-content-muted">
          <span>{{ formatTime(currentStartIndex) }}</span>
          <span>{{ formatTime(currentEndIndexValue) }}</span>
        </div>

        <!-- Range slider with two handles -->
        <div v-if="dataLength > 0" class="flex flex-col gap-3">
          <!-- Dual Range Slider -->
          <div class="relative pt-2 pb-2">
            <!-- Background Track -->
            <div
              class="absolute top-1/2 left-0 right-0 h-1 bg-surface-3 rounded-full -translate-y-1/2"
            ></div>

            <!-- Highlight Track (selected range) -->
            <div
              class="absolute top-1/2 h-1 bg-accent-action rounded-full pointer-events-none -translate-y-1/2"
              :style="{
                left: dataLength > 1 ? `${(currentStartIndex / (dataLength - 1)) * 100}%` : '0%',
                right:
                  dataLength > 1
                    ? `${((dataLength - 1 - currentEndIndexValue) / (dataLength - 1)) * 100}%`
                    : '0%',
              }"
            ></div>

            <!-- Start Thumb (visual only) -->
            <div
              class="absolute top-1/2 w-2 rounded-md h-6 bg-accent -translate-y-1/2 -translate-x-1/2 pointer-events-none shadow-lg"
              :style="{
                left: dataLength > 1 ? `${(currentStartIndex / (dataLength - 1)) * 100}%` : '0%',
              }"
            ></div>

            <!-- End Thumb (visual only) -->
            <div
              class="absolute top-1/2 w-2 rounded-md h-6 bg-accent -translate-y-1/2 -translate-x-1/2 pointer-events-none shadow-lg"
              :style="{
                left: dataLength > 1 ? `${(currentEndIndexValue / (dataLength - 1)) * 100}%` : '0%',
              }"
            ></div>

            <!-- Start Slider (invisible, for input) -->
            <input
              type="range"
              min="0"
              :max="dataLength - 1"
              :value="currentStartIndex"
              @input="updateStartIndex"
              class="absolute w-full top-1/2 -translate-y-1/2 h-8 appearance-none bg-transparent rounded-full cursor-pointer slider-input"
              style="z-index: 5"
            />

            <!-- End Slider (invisible, for input) -->
            <input
              type="range"
              min="0"
              :max="dataLength - 1"
              :value="currentEndIndexValue"
              @input="updateEndIndex"
              class="absolute w-full top-1/2 -translate-y-1/2 h-8 appearance-none bg-transparent rounded-full cursor-pointer slider-input"
              style="z-index: 4"
            />
          </div>

          <!-- Reset Button -->
          <button
            v-if="currentStartIndex !== 0 || currentEndIndex !== null"
            @click="resetTimeRange"
            type="button"
            class="tns-btn-secondary text-xs!"
          >
            {{ $t('components.sequence.graphControls.reset') }}
          </button>
        </div>

        <div v-else class="text-xs text-content-faint">
          {{ $t('components.sequence.graphControls.noDataAvailable') }}
        </div>

        <!-- Divider -->
        <div class="border-t border-line"></div>

        <!-- Data Source Selector -->
        <div class="flex flex-col gap-2">
          <div class="text-xs text-content font-semibold">
            {{ $t('components.sequence.graphControls.dataSources') }}
          </div>
          <div class="grid grid-cols-2 gap-3">
            <!-- First Data Source -->
            <div class="flex flex-col gap-1">
              <label class="tns-label">{{ $t('components.sequence.graphControls.source1') }}</label>
              <select :value="dataSource1" @change="updateDataSource1" class="tns-select text-sm">
                <option v-for="source in availableSources" :key="source" :value="source">
                  {{ source }}
                </option>
              </select>
            </div>

            <!-- Second Data Source -->
            <div class="flex flex-col gap-1">
              <label class="tns-label">{{ $t('components.sequence.graphControls.source2') }}</label>
              <select :value="dataSource2" @change="updateDataSource2" class="tns-select text-sm">
                <option v-for="source in availableSources" :key="source" :value="source">
                  {{ source }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ChevronRightIcon, Cog6ToothIcon } from '@heroicons/vue/24/outline';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';

const settingsStore = useSettingsStore();
const apiStoreInstance = apiStore();

const isControlsOpen = ref(false);

const availableSources = [
  'Stars',
  'HFR',
  'Median',
  'Mean',
  'StDev',
  'Min',
  'Max',
  'Temperature',
  'HFRStDev',
  'RMS',
];

const dataLength = computed(() => apiStoreInstance.imageHistoryInfo?.length ?? 0);

const currentStartIndex = computed(
  () => settingsStore.monitorViewSetting.historyTimeRange.startIndex
);

const currentEndIndex = computed(() => settingsStore.monitorViewSetting.historyTimeRange.endIndex);

const currentEndIndexValue = computed(() =>
  currentEndIndex.value !== null ? currentEndIndex.value : dataLength.value - 1
);

const dataSource1 = computed(() => settingsStore.monitorViewSetting.graphDataSource1);
const dataSource2 = computed(() => settingsStore.monitorViewSetting.graphDataSource2);

function updateStartIndex(event) {
  const newStart = parseInt(event.target.value, 10);
  // A start dragged past the end swaps the two
  if (newStart > currentEndIndexValue.value) {
    settingsStore.setHistoryTimeRange(currentEndIndexValue.value, newStart);
  } else {
    settingsStore.setHistoryTimeRange(newStart, currentEndIndex.value);
  }
}

function updateEndIndex(event) {
  const newEnd = parseInt(event.target.value, 10);
  // An end dragged before the start swaps the two
  if (newEnd < currentStartIndex.value) {
    settingsStore.setHistoryTimeRange(newEnd, currentStartIndex.value);
  } else {
    settingsStore.setHistoryTimeRange(currentStartIndex.value, newEnd);
  }
}

function resetTimeRange() {
  settingsStore.resetHistoryTimeRange();
}

function formatTime(index) {
  const allData = apiStoreInstance.imageHistoryInfo || [];
  if (index >= 0 && index < allData.length) {
    return new Date(allData[index].Date).toLocaleTimeString();
  }
  return '';
}

function toggleControls() {
  isControlsOpen.value = !isControlsOpen.value;
}

function updateDataSource1(event) {
  settingsStore.setGraphDataSource1(event.target.value);
}

function updateDataSource2(event) {
  settingsStore.setGraphDataSource2(event.target.value);
}
</script>

<style scoped>
/* Custom dual range slider styling */
.slider-input {
  -webkit-appearance: none;
  appearance: none;
  pointer-events: none;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  pointer-events: all;
}

.slider-input::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  border: none;
  pointer-events: all;
}

/* Remove default track styling */
.slider-input::-webkit-slider-runnable-track {
  background: transparent;
  height: 8px;
  border: none;
}

.slider-input::-moz-range-track {
  background: transparent;
  border: none;
}

.slider-input::-moz-range-progress {
  background: transparent;
}

/* Transition animations */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  max-height: 0;
  opacity: 0;
}

.slide-fade-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
