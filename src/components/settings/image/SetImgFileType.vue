<template>
  <div>
    <label class="block text-sm font-medium text-content mb-2">{{
      $t('components.settings.image.fileType')
    }}</label>
    <select
      :value="store.profileInfo.ImageFileSettings.FileType"
      @change="updateSetting($event.target.value)"
      :class="[statusClass]"
      class="tns-select"
    >
      <option v-for="type in fileTypes" :key="type" :value="type">{{ type }}</option>
    </select>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';

const store = apiStore();
const statusClass = ref('');
const fileTypes = ['TIFF', 'FITS', 'XISF'];

async function updateSetting(value) {
  try {
    await apiService.profileChangeValue('ImageFileSettings-FileType', value);
    statusClass.value = 'glow-green';
    setTimeout(() => {
      statusClass.value = '';
    }, 1000);
  } catch (error) {
    console.log('Error saving file type setting');
  }
}
</script>
