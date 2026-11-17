<template>
  <div v-if="available">
    <select
      :value="currentLevel"
      @change="updateSetting($event.target.value)"
      :class="[statusClass]"
      class="tns-select"
    >
      <option v-for="level in availableLevels" :key="level" :value="level">{{ level }}</option>
    </select>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiService from '@/services/apiService';

const available = ref(false);
const currentLevel = ref('');
const availableLevels = ref([]);
const statusClass = ref('');

onMounted(async () => {
  try {
    const data = await apiService.getLogLevel();
    if (data && data.success) {
      currentLevel.value = data.logLevel;
      availableLevels.value = data.availableLevels;
      available.value = true;
    }
  } catch {
    // backend not reachable or endpoint not supported — hide component
  }
});

async function updateSetting(value) {
  try {
    await apiService.setLogLevel(value);
    currentLevel.value = value;
    statusClass.value = 'glow-green';
    setTimeout(() => {
      statusClass.value = '';
    }, 1000);
  } catch {
    console.log('Error saving log level setting');
  }
}
</script>
