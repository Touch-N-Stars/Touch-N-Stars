<template>
  <!-- Small ⓘ next to a label: taps open a short explanation (hover titles don't work on touch screens) -->
  <button
    type="button"
    class="-m-1 shrink-0 p-1 text-content-faint hover:text-content-muted"
    :aria-label="title"
    @click.stop="open = true"
  >
    <InformationCircleIcon class="h-3.5 w-3.5" />
  </button>
  <Modal :show="open" max-width="max-w-md" @close="open = false">
    <template #header>
      <h2 class="text-lg font-bold">{{ title }}</h2>
    </template>
    <template #body>
      <p class="text-sm leading-relaxed">{{ text }}</p>
    </template>
  </Modal>
</template>

<script setup>
import { ref } from 'vue';
import { InformationCircleIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';

defineProps({
  title: { type: String, required: true },
  text: { type: String, required: true },
});

const open = ref(false);
</script>
