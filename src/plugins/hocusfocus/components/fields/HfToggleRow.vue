<template>
  <div>
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-1 min-w-0">
        <span class="text-sm font-medium text-gray-300">{{ label }}</span>
        <InfoModal v-if="help" :title="label" :message="help" size="w-4 h-4" />
      </div>
      <toggleButton
        :status-value="!!modelValue"
        :disabled="disabled"
        :class="status === 'saved' ? 'glow-green' : status === 'error' ? 'glow-red' : ''"
        @update:statusValue="onToggle"
      />
    </div>
    <p v-if="error" class="mt-1 text-xs text-red-400">{{ error }}</p>
  </div>
</template>

<script setup>
import toggleButton from '@/components/helpers/toggleButton.vue';
import InfoModal from '@/components/helpers/infoModal.vue';

defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, required: true },
  help: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  // '' | 'saving' | 'saved' | 'error'
  status: { type: String, default: '' },
  error: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'change']);

function onToggle(value) {
  emit('update:modelValue', value);
  emit('change', value);
}
</script>
