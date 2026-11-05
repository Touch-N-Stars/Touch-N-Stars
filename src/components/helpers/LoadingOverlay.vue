<template>
  <teleport to="body">
    <div
      v-if="show"
      :class="[
        'fixed inset-0 bg-black/50 flex items-center justify-center pointer-events-auto',
        zIndex,
      ]"
    >
      <div class="flex flex-col items-center">
        <div
          class="w-16 h-16 border-4 border-gray-600 border-t-cyan-400 rounded-full animate-spin"
        ></div>
        <p v-if="message" class="text-white mt-4 px-4 text-center">{{ message }}</p>
      </div>
    </div>
  </teleport>
</template>

<script setup>
defineProps({
  show: Boolean,
  message: {
    type: String,
    default: '',
  },
  // Above modals, below the setup wizard.
  zIndex: {
    type: String,
    default: 'z-loading',
  },
});
</script>
