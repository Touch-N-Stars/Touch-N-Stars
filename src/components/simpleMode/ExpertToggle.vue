<template>
  <!-- Pages the simple mode trims down: the rest is one tap away, never gone -->
  <button
    v-if="active"
    type="button"
    class="tns-btn-ghost w-full! mt-4"
    :aria-expanded="modelValue"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <ChevronDownIcon class="w-4 h-4 transition-transform" :class="{ 'rotate-180': modelValue }" />
    {{ $t(`components.simpleMode.expert.${modelValue ? 'hide' : 'show'}`) }}
  </button>
</template>

<script setup>
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import { useSimpleMode } from '@/composables/useSimpleMode';

defineProps({ modelValue: { type: Boolean, required: true } });
defineEmits(['update:modelValue']);

const { active } = useSimpleMode();
</script>
