<template>
  <div class="flex flex-col bg-surface-1/90 border border-line-strong p-1 pb-2 rounded-control">
    <label for="flat-filter" class="text-xs mb-1 text-content-muted">
      {{ $t('components.filterwheel.filter') }}
    </label>
    <select
      id="flat-filter"
      :value="modelValue"
      @change="$emit('update:modelValue', Number($event.target.value))"
      class="tns-select"
    >
      <option
        v-for="filter in store.filterInfo.AvailableFilters"
        :key="filter.Id"
        :value="filter.Id"
      >
        {{ filter.Name }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { apiStore } from '@/store/store';

defineProps({ modelValue: Number });
defineEmits(['update:modelValue']);

const store = apiStore();
</script>
