<template>
  <div class="flex gap-1">
    <button @click="syncCoordinates" :class="['tns-btn-secondary', statusClass]">
      <span
        v-if="isLoading"
        class="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"
      ></span>
      <p v-else>{{ $t('components.mount.control.setLocationSyncToMount') }}</p>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';

const store = apiStore();
const statusClass = ref('');
const isLoading = ref(false);

async function syncCoordinates() {
  isLoading.value = true;
  try {
    const response = await apiService.profileChangeValue(
      'TelescopeSettings-TelescopeLocationSyncDirection',
      2
    );
    console.log(response);
    await store.fetchProfilInfos();
    statusClass.value = 'glow-green';
  } catch (error) {
    console.log('Error when setting the TelescopeLocationSyncDirection');
    statusClass.value = 'glow-red';
  }
  isLoading.value = false;
  setTimeout(() => {
    statusClass.value = '';
  }, 1000);
}
</script>
