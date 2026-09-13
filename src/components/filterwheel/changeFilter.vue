<template>
  <div class="">
    <div
      class="flex flex-col bg-gray-900/90 border border-line-strong p-1 pb-2 rounded-control h-full"
    >
      <label for="filter" class="text-xs mb-1 text-gray-400"
        >{{ $t('components.filterwheel.filter') }}
      </label>

      <select id="filter" v-model.number="store.filterNr" @change="changeFilter" class="tns-select">
        <!-- Name anzeigen und ID speichern -->
        <template v-if="store.filterInfo?.AvailableFilters">
          <option
            v-for="filter in store.filterInfo.AvailableFilters"
            :key="filter.Id"
            :value="filter.Id"
          >
            {{ filter.Name }}
          </option>
        </template>
        <option v-else :value="null" disabled>
          {{ $t('components.filterwheel.nofilteravailable') }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { watch } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';

const store = apiStore();

async function changeFilter() {
  try {
    await apiService.changeFilter(store.filterNr);
  } catch (error) {
    console.log('Error:', error);
  }
}

// Follow the wheel, not just the initial mount: the status bar panel keeps this
// component mounted, and a sequence or another page may move the filter meanwhile.
watch(
  () => store.filterInfo?.SelectedFilter?.Id,
  (id) => {
    store.filterNr = id ?? null;
  },
  { immediate: true }
);
</script>
