<template>
  <button
    @click="syncTelescope"
    class="tns-btn-secondary"
    :class="statusClass"
    :disabled="store.domeInfo.Slewing"
  >
    <label> {{ $t('components.dome.control.sync') }}</label>
    <div
      v-if="store.domeInfo.Slewing"
      class="ml-2 w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
    ></div>
  </button>
</template>

<script setup>
import { runDomeAction } from './runDomeAction';
import { apiStore } from '@/store/store';
import { ref } from 'vue';

const store = apiStore();
const statusClass = ref('');

async function syncTelescope() {
  await runDomeAction('sync', statusClass, 'components.dome.control.errors.sync');
}
</script>
<style scoped>
.glow-green {
  box-shadow: 0 0 10px #00ff00; /* Grüner Schein */
}
</style>
