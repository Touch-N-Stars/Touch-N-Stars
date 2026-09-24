<template>
  <div class="flex flex-col rounded-lg border border-gray-700/50 bg-gray-800/50">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 p-2 text-left sm:p-4"
      :aria-expanded="open"
      @click="emit('update:open', !open)"
    >
      <h3 class="text-base font-bold text-cyan-400">{{ title }}</h3>
      <ChevronDownIcon
        class="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
      />
    </button>
    <!-- v-if, not v-show: a collapsed section's content is not rendered (or fetched) at all -->
    <div v-if="open" class="flex flex-col gap-2 px-2 pb-2 sm:gap-3 sm:px-4 sm:pb-4">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ChevronDownIcon } from '@heroicons/vue/24/outline';

defineProps({
  title: { type: String, required: true },
  open: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open']);
</script>
