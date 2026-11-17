<template>
  <div>
    <button :class="buttonClasses" :title="title" @click="emit('click')">
      <slot></slot>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useOrientation } from '@/composables/useOrientation';

const props = defineProps({
  isActive: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['click']);

const { isLandscape } = useOrientation();

const buttonClasses = computed(() => ({
  'rounded-full bg-surface-3 flex items-center justify-center shadow-md shadow-black border border-accent transition-colors duration-200': true,
  'w-12 h-12': !isLandscape.value,
  'w-10 h-10': isLandscape.value,
  'glow-green': props.isActive,
}));
</script>

<style scoped>
.glow-green {
  box-shadow: 0 0 15px rgba(34, 197, 94, 0.5);
  border-color: rgb(34, 197, 94);
}

.transition-colors {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}
</style>
