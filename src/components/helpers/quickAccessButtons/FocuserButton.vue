<template>
  <QuickAccessButton :isActive="isActive" @click="emit('click')" title="Focuser Controls">
    <EyeIcon :class="iconClasses" />
  </QuickAccessButton>
</template>

<script setup>
import { computed } from 'vue';
import { useOrientation } from '@/composables/useOrientation';
import { EyeIcon } from '@heroicons/vue/24/outline';
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
