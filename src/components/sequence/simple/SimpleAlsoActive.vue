<template>
  <!-- The enabled entries of an area the simple view has no switch for. Tapping opens the
       full editor, where they can be changed. -->
  <button
    v-if="names.length"
    type="button"
    class="w-full min-h-touch flex items-center gap-2 text-left text-xs text-content-faint hover:text-content-muted"
  >
    <span class="min-w-0 flex-1 truncate">
      {{ $t('components.sequence.simple.alsoActive') }}: {{ names.join(', ') }}
    </span>
    <ChevronRightIcon class="w-4 h-4 shrink-0" />
  </button>
</template>

<script setup>
import { ChevronRightIcon } from '@heroicons/vue/24/outline';

defineProps({
  names: { type: Array, default: () => [] },
});
</script>
