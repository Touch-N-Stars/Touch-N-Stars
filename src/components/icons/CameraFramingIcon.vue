<template>
  <span class="relative inline-flex items-center justify-center align-middle">
    <svg
      class="absolute inset-0 w-full h-full"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5"
      />
    </svg>
    <CameraIcon
      :class="[
        'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2',
        cameraClass,
      ]"
    />
  </span>
</template>

<script setup>
import { CameraIcon } from '@heroicons/vue/24/outline';

defineProps({
  cameraClass: { type: String, default: '' },
});
</script>
