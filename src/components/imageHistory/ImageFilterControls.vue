<template>
  <div class="tns-card flex flex-wrap items-center gap-2 p-2!">
    <select
      :value="filter.selectedTarget"
      @change="
        settingsStore.setImageFilterTarget($event.target.value === '' ? null : $event.target.value)
      "
      class="tns-select flex-1 min-w-[110px]"
    >
      <option value="">{{ $t('components.sequence.imageFilter.allTargets') }}</option>
      <option v-for="t in availableTargets" :key="t" :value="t">{{ t }}</option>
    </select>

    <select
      :value="filter.selectedFilter"
      @change="
        settingsStore.setImageFilterFilter($event.target.value === '' ? null : $event.target.value)
      "
      class="tns-select flex-1 min-w-[110px]"
    >
      <option value="">{{ $t('components.sequence.imageFilter.allFilters') }}</option>
      <option v-for="f in availableFilters" :key="f" :value="f">{{ f }}</option>
    </select>

    <select
      :value="filter.selectedNight"
      @change="
        settingsStore.setImageFilterNight($event.target.value === '' ? null : $event.target.value)
      "
      class="tns-select flex-1 min-w-[120px]"
    >
      <option value="">{{ $t('components.sequence.imageFilter.allNights') }}</option>
      <option v-for="n in availableNights" :key="n" :value="n">{{ formatNightLabel(n) }}</option>
    </select>

    <select
      :value="filter.selectedImageType"
      @change="
        settingsStore.setImageFilterImageType(
          $event.target.value === '' ? null : $event.target.value
        )
      "
      class="tns-select flex-1 min-w-[100px]"
    >
      <option value="">{{ $t('components.sequence.imageFilter.allImageTypes') }}</option>
      <option v-for="type in availableImageTypes" :key="type" :value="type">{{ type }}</option>
    </select>

    <button
      v-if="isAnyFilterActive"
      type="button"
      @click="settingsStore.resetImageFilter()"
      class="tns-btn-secondary w-auto! px-3! text-xs! whitespace-nowrap"
    >
      {{ $t('components.sequence.imageFilter.reset') }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useSettingsStore } from '@/store/settingsStore';
import { useImageFilter } from '@/composables/useImageFilter';

const settingsStore = useSettingsStore();
const { filter, availableTargets, availableFilters, availableNights, availableImageTypes } =
  useImageFilter();

const isAnyFilterActive = computed(
  () =>
    filter.value.selectedTarget !== null ||
    filter.value.selectedFilter !== null ||
    filter.value.selectedNight !== null ||
    filter.value.selectedImageType !== null
);

function formatNightLabel(nightKey) {
  const date = new Date(nightKey + 'T12:00:00');
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}
</script>
