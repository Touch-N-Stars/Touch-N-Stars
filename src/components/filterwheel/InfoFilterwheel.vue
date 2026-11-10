<template>
  <div v-if="!store.filterInfo.Connected" class="text-status-danger">
    <p>{{ $t('components.filterwheel.please_connect_filterwheel') }}</p>
  </div>
  <div
    v-else
    :class="
      compact
        ? 'flex flex-wrap items-center gap-x-5 gap-y-2'
        : 'gap-2 grid grid-cols-2 landscape:grid-cols-3'
    "
  >
    <StatusString
      :compact="compact"
      :isEnabled="store.filterInfo.SelectedFilter && store.filterInfo.SelectedFilter.Name"
      :Name="$t('components.filterwheel.currentFilter')"
      :Value="store.filterInfo.SelectedFilter ? store.filterInfo.SelectedFilter.Name : ''"
    />
    <StatusString
      :compact="compact"
      :isEnabled="
        store.filterInfo.SelectedFilter && store.filterInfo.SelectedFilter.Position !== undefined
      "
      :Name="$t('components.filterwheel.position')"
      :Value="
        store.filterInfo.SelectedFilter && store.filterInfo.SelectedFilter.Position !== undefined
          ? store.filterInfo.SelectedFilter.Position
          : ''
      "
    />
    <StatusString
      :compact="compact"
      :isEnabled="store.filterInfo.AvailableFilters && store.filterInfo.AvailableFilters.length > 0"
      :Name="$t('components.filterwheel.availableFilters')"
      :Value="store.filterInfo.AvailableFilters ? store.filterInfo.AvailableFilters.length : 0"
    />
    <template
      v-if="
        store.isPINS &&
        filterStore.filterwheelSettings &&
        Object.keys(filterStore.filterwheelSettings).length > 0
      "
    >
      <StatusString
        v-if="filterStore.filterwheelSettings.BoardTemperature !== undefined"
        :compact="compact"
        secondary
        :isEnabled="true"
        :Name="$t('components.filterwheel.BoardTemperature')"
        :Value="filterStore.filterwheelSettings.BoardTemperature + ' °C'"
      />
      <StatusString
        v-if="
          filterStore.filterwheelSettings.States !== undefined &&
          filterStore.filterwheelSettings.State !== undefined
        "
        :compact="compact"
        secondary
        :isEnabled="true"
        :Name="$t('components.filterwheel.State')"
        :Value="
          filterStore.filterwheelSettings.States[filterStore.filterwheelSettings.State] ??
          filterStore.filterwheelSettings.State
        "
      />
      <StatusString
        v-if="filterStore.filterwheelSettings.Counter !== undefined"
        :compact="compact"
        secondary
        :isEnabled="true"
        :Name="$t('components.filterwheel.Counter')"
        :Value="filterStore.filterwheelSettings.Counter"
      />
    </template>
  </div>
</template>

<script setup>
import StatusString from '@/components/helpers/StatusString.vue';
import { apiStore } from '@/store/store';
import { useFilterStore } from '@/store/filterStore';

const store = apiStore();
const filterStore = useFilterStore();

// Dense page layout: two quiet value columns.
const { compact } = defineProps({
  compact: {
    type: Boolean,
    default: false,
  },
});
</script>
