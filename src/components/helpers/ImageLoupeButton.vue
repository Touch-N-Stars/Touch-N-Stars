<template>
  <button
    @click.stop="$emit('toggle')"
    :class="[
      'w-10 h-10 rounded-lg shadow-lg flex items-center justify-center transition-colors',
      active
        ? 'bg-accent-action text-white hover:brightness-110'
        : 'bg-surface-1/90 hover:bg-surface-2 text-content',
    ]"
    :title="label"
    :aria-label="label"
    :aria-pressed="active"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-5 h-5"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" />
      <line x1="10.5" y1="7.5" x2="10.5" y2="13.5" />
      <line x1="7.5" y1="10.5" x2="13.5" y2="10.5" />
    </svg>
  </button>
</template>

<script setup>
defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  label: {
    type: String,
    default: 'Toggle loupe',
  },
});

defineEmits(['toggle']);
</script>
