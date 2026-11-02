<template>
  <button @click="stopShutter" class="tns-btn-danger w-24" :class="statusClass">
    <StopCircleIcon class="w-8 h-8" />
  </button>
</template>

<script setup>
import { runDomeAction } from './runDomeAction';
import { useI18n } from 'vue-i18n';
import { StopCircleIcon } from '@heroicons/vue/24/outline';
import { ref } from 'vue';

const { t } = useI18n();
const statusClass = ref('');

async function stopShutter() {
  await runDomeAction('stop', statusClass, t('components.dome.control.errors.stop'));
}
</script>
<style scoped>
.glow-green {
  box-shadow: 0 0 10px #00ff00; /* Grüner Schein */
}
</style>
