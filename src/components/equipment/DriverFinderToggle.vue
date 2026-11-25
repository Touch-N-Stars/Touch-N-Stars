<template>
  <button
    type="button"
    class="tns-btn-ghost justify-end! px-0! text-sm! text-accent!"
    :aria-expanded="open"
    @click="open = !open"
  >
    {{ label }}
  </button>
  <div v-if="open" class="rounded-control border border-line p-3">
    <slot />
  </div>
</template>

<script setup>
import { ref } from 'vue';

/** The link below a driver dropdown of the INDI setup that unfolds a driver finder. */
defineProps({
  label: { type: String, required: true },
});

const open = ref(false);
</script>
