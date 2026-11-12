<template>
  <div class="seg" role="group" :aria-label="label">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      class="seg-btn"
      :class="{ 'seg-btn-active': modelValue === o.value }"
      :aria-pressed="modelValue === o.value"
      @click="emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<script setup>
// The small segmented choice of the viewer's panels (unit, filter, sort, source).
defineProps({
  /** [{ value, label }] */
  options: { type: Array, required: true },
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);
</script>

<style scoped>
@reference '../../../assets/tailwind.css';

.seg {
  @apply flex overflow-hidden rounded-chip border border-line-strong bg-surface-2;
}

.seg-btn {
  @apply min-h-touch px-2.5 text-xs font-semibold tabular-nums text-content-muted transition-colors border-r border-line last:border-r-0;
}

.seg-btn-active {
  @apply bg-accent/15 text-accent;
}
</style>
