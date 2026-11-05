<template>
  <div class="rounded-card border border-status-danger/30 bg-status-danger/10 p-4" role="status">
    <p class="text-center font-medium text-status-danger">{{ $t(messageKey) }}</p>
  </div>
</template>

<script setup>
defineProps({
  messageKey: { type: String, required: true },
});
</script>
