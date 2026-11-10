<template>
  <button
    @click="addNewFilter"
    class="w-full h-32 border-2 border-dashed border-line-strong hover:border-accent rounded-lg flex items-center justify-center transition-colors"
  >
    <span class="text-4xl text-content-faint hover:text-accent transition-colors">+</span>
  </button>
</template>
<script setup>
import apiServeice from '@/services/apiService';
import { apiStore } from '@/store/store';

const store = apiStore();

async function addNewFilter() {
  try {
    await apiServeice.filterAction('add-filter');
    await store.fetchProfilInfos();
  } catch (error) {
    console.error('[Filtersettings] Error adding new filter:', error);
  }
}
</script>
