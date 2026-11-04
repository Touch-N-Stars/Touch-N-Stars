<template>
  <FilterSettings />
</template>

<script setup>
import { ref } from 'vue';
import FilterSettings from '@/components/filterwheel/settings/FilterSettings.vue';
import { useFilterStore } from '@/store/filterStore';
import { useBackgroundAwarePolling } from '@/utils/appLifecycle';

const filterStore = useFilterStore();

useBackgroundAwarePolling(() => filterStore.readSettings(), 2000, ref(true), { immediate: true });
</script>
