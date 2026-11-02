<template>
  <button @click="homeDome" class="tns-btn-secondary" :class="statusClass">
    {{ $t('components.dome.control.home') }}
  </button>
</template>

<script setup>
import { runDomeAction } from './runDomeAction';
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';

const { t } = useI18n();
const statusClass = ref('');

async function homeDome() {
  await runDomeAction('home', statusClass, t('components.dome.control.errors.home'));
}
</script>
<style scoped>
.glow-green {
  box-shadow: 0 0 10px #00ff00; /* Grüner Schein */
}
</style>
