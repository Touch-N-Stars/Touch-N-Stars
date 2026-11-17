<template>
  <p class="text-content whitespace-pre-wrap">{{ message }}</p>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  dialog: {
    type: Object,
    required: true,
  },
});

const message = computed(() => {
  const d = props.dialog;
  return (
    d?.Content?.Message ||
    d?.Parameters?.Message ||
    d?.parameters?.Message ||
    d?.parameters?.message ||
    d?.Status ||
    d?.status ||
    ''
  );
});
</script>
