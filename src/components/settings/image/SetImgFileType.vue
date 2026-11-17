<template>
  <div>
    <label class="block text-sm font-medium text-content mb-2">{{
      $t('components.settings.image.fileType')
    }}</label>
    <select v-model="fileType" @change="updateSetting" :class="[statusClass]" class="tns-select">
      <option v-for="type in fileTypes" :key="type" :value="type">{{ type }}</option>
    </select>
  </div>
</template>

<script setup>
import { useProfileSetting } from '@/composables/useProfileSetting';

const fileTypes = ['TIFF', 'FITS', 'XISF'];

const {
  value: fileType,
  save: updateSetting,
  glowClass: statusClass,
} = useProfileSetting('ImageFileSettings-FileType');
</script>
