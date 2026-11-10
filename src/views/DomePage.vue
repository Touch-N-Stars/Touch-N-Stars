<template>
  <div class="text-left mb-2">
    <h1 class="text-xl text-center font-bold">{{ $t('components.dome.title') }}</h1>
  </div>
  <DeviceNotConnected
    v-if="!store.domeInfo.Connected"
    messageKey="components.dome.please_connect_dome"
  />
  <div v-else class="container flex items-center justify-center">
    <div class="container max-w-3xl">
      <div>
        <infoDome compact class="p-3 bg-surface-1 rounded-card border border-line" />
      </div>
      <div class="mt-4 tns-card">
        <controlDome />
      </div>
    </div>
  </div>
</template>

<script setup>
import DeviceNotConnected from '@/components/helpers/DeviceNotConnected.vue';
import infoDome from '@/components/dome/infoDome.vue';
import controlDome from '@/components/dome/controlDome.vue';
import { apiStore } from '@/store/store';

const store = apiStore();
</script>

<style scoped></style>
