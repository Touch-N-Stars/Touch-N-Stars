<template>
  <button @click="closeShutter" class="tns-btn-secondary w-full" :class="statusClass">
    {{ $t('components.dome.control.close') }}
  </button>
</template>

<script setup>
import { runDomeAction } from './runDomeAction';
import { ref } from 'vue';

const statusClass = ref('');

async function closeShutter() {
  await runDomeAction('close', statusClass, 'components.dome.control.errors.close');
}
</script>
<style scoped>
.glow-green {
  box-shadow: 0 0 10px #00ff00; /* Grüner Schein */
}
</style>
