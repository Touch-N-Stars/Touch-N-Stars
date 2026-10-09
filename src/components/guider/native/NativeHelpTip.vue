<template>
  <!-- With content (e.g. a stat tile): the whole content is the button, so the touch target is
       the tile and its label keeps the full width. Without: a small ⓘ next to a label whose
       hit area is enlarged to the 48 px touch size. Hover titles don't work on touch screens,
       so both open a short explanation. -->
  <button
    v-if="$slots.default"
    v-bind="$attrs"
    type="button"
    class="relative text-left"
    aria-haspopup="dialog"
    @click.stop="open = true"
  >
    <slot />
    <InformationCircleIcon
      class="pointer-events-none absolute right-1 top-1 h-3 w-3 text-content-faint"
      aria-hidden="true"
    />
  </button>
  <button
    v-else
    v-bind="$attrs"
    type="button"
    class="relative -m-1 shrink-0 p-1 text-content-faint hover:text-content-muted before:absolute before:-inset-3 before:content-['']"
    :aria-label="title"
    aria-haspopup="dialog"
    @click.stop="open = true"
  >
    <InformationCircleIcon class="h-3.5 w-3.5" />
  </button>
  <Modal :show="open" max-width="max-w-md" @close="open = false">
    <template #header>
      <h2 class="text-lg font-bold">{{ title }}</h2>
    </template>
    <template #body>
      <p class="text-sm leading-relaxed whitespace-pre-line">{{ text }}</p>
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

// Two root nodes (button + modal): class and listeners belong on the button.
defineOptions({ inheritAttrs: false });

const open = ref(false);
</script>
