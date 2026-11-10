<template>
  <div
    class="flex flex-row items-center justify-between w-full border border-line-strong p-2 rounded-lg"
  >
    <label for="rotator-reverse" class="text-content-muted"> Reverse </label>
    <div>
      <toggleButton
        @click="reverseRotator"
        :status-value="store.rotatorInfo.Reverse"
        class="pr-5 pl-5 justify-center"
      />
    </div>
  </div>
</template>
<script setup>
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import toggleButton from '../helpers/toggleButton.vue';

const store = apiStore();

async function reverseRotator() {
  try {
    if (store.rotatorInfo.Reverse) {
      await apiService.rotatorAction('reverse?reverseDirection=false');
      console.log('[Rotator Reverse] Rotator revere off');
    } else {
      await apiService.rotatorAction('reverse?reverseDirection=true');
      console.log('[Rotator Reverse] Rotator revere on');
    }
  } catch (error) {
    console.log('Error reversing rotator');
  }
}
</script>
