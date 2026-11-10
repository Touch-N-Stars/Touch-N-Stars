<template>
  <QuickAccessButton :isActive="isActive" @click="emit('click')" title="Filter Wheel">
    <svg
      :class="iconClasses"
      baseProfile="full"
      version="1.1"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs />
      <circle cx="50.0" cy="50.0" fill="currentColor" r="40.0" stroke="black" />
      <circle cx="70.0" cy="50.0" fill="black" r="5.0" />
      <circle cx="56.180339887498945" cy="69.02113032590307" fill="black" r="5.0" />
      <circle cx="33.819660112501055" cy="61.75570504584947" fill="black" r="5.0" />
      <circle cx="33.81966011250105" cy="38.24429495415054" fill="black" r="5.0" />
      <circle cx="56.180339887498945" cy="30.978869674096927" fill="black" r="5.0" />
    </svg>
  </QuickAccessButton>
</template>

<script setup>
import { computed } from 'vue';
import { useOrientation } from '@/composables/useOrientation';
import QuickAccessButton from '../QuickAccessButton.vue';

defineProps({
  isActive: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['click']);

const { isLandscape } = useOrientation();

const iconClasses = computed(() => ({
  'text-content': true,
  'w-6 h-6': !isLandscape.value,
  'w-5 h-5': isLandscape.value,
}));
</script>
