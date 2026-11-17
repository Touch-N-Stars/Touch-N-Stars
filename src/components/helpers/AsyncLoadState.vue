<template>
  <!-- Placeholder of a lazily loaded component: spinner while loading, message when the chunk
       could not be fetched (slow or lost link to the rig), so the page is never just blank. -->
  <div
    class="flex items-center justify-center gap-2 p-6 text-sm"
    :class="failed ? 'text-status-danger' : 'text-content-muted'"
    role="status"
  >
    <ExclamationTriangleIcon v-if="failed" class="h-5 w-5 shrink-0" />
    <ArrowPathIcon v-else class="h-5 w-5 shrink-0 animate-spin" />
    <span>{{ failed ? message : $t('common.loading') }}</span>
  </div>
</template>

<script setup>
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';

defineProps({
  failed: { type: Boolean, default: false },
  message: { type: String, default: '' },
});
</script>
