<template>
  <!-- Takes the current text color, so it fits a button as is; set text-accent or similar on
       the instance elsewhere. -->
  <span
    class="inline-block shrink-0 animate-spin rounded-full border-current border-t-transparent"
    :class="SIZE_CLASSES[size]"
    role="status"
    :aria-label="$t('common.loading')"
  ></span>
</template>

<script setup>
const SIZE_CLASSES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-4',
  lg: 'h-12 w-12 border-4',
};

defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value),
  },
});
</script>
